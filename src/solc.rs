use bollard::Docker;
use bollard::container::{AttachContainerOptions, Config, CreateContainerOptions, LogOutput, StartContainerOptions};
use bollard::image::CreateImageOptions;
use bollard::models::{CreateImageInfo, HostConfig};
use futures_util::stream::StreamExt;
use futures_util::TryStreamExt;
use lettre::transport::smtp::response::Severity;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use web3::types::Res;
use crate::err_custom_create;
use crate::error::AddressologyError;

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct SolidityError {
    message: String,
    severity: String,
    formatted_message: String,
    #[serde(rename = "type")]
    typ: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct SolidityJsonResponse {
    errors: Option<Vec<SolidityError>>,
}



pub async fn compile_solc(solidity_code: &str, solidity_version: &str) -> Result<(), AddressologyError> {
    let mut bin = "solc";
    if solidity_version == "0.8.28" {
        bin = "solc-windows.exe";
    } else {
        return Err(err_custom_create!("Unsupported solidity version: {}", solidity_version));
    }

    let mut cmd = match tokio::process::Command::new(bin)
        .arg("--standard-json")
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn() {
        Ok(cmd) => cmd,
        Err(err) => return Err(err_custom_create!("Error starting solc: {} {}", bin, err))
    };

    let sol_input_json = r#"
{
    "language": "Solidity",
    "sources": {
        "Contract.sol": {
            "content": ""
        }
    },
    "settings": {
        "outputSelection": {
            "*": {
                "*": [
                    "metadata",
                    "evm.bytecode"
                ]
            }
        }
    }
}
"#;
    let mut sol_input_json = serde_json::from_str::<serde_json::Value>(sol_input_json).map_err(
        |err| err_custom_create!("Error parsing solc input json: {}", err)
    )?;

    sol_input_json["sources"]["Contract.sol"]["content"] = serde_json::Value::String(solidity_code.to_string());


    {
        let stdin = cmd.stdin.as_mut().ok_or_else(|| err_custom_create!("Error getting stdin"))?;

        stdin.write_all(sol_input_json.to_string().as_bytes()).await.map_err(
            |err| err_custom_create!("Error writing to stdin: {}", err)
        )?;
    }
    let output = cmd.wait_with_output().await.map_err(
        |err| err_custom_create!("Error waiting for solc: {}", err)
    )?;
    match output {
        std::process::Output { status, stdout, stderr } => {
            if !status.success() {
                return Err(err_custom_create!("Error compiling solidity code: {}", String::from_utf8_lossy(&stderr)));
            }

            match serde_json::from_slice::<SolidityJsonResponse>(stdout.as_slice()) {
                Ok(json) => {
                    println!("Parsed solc output: {:?}", json);
                }
                Err(err) => {
                    return Err(err_custom_create!("Error parsing solc output: {}", err));
                }

            }
            println!("Command finished with {}", String::from_utf8_lossy(&stdout));
        }
    }
    Ok(())
}


//experimental - not working
pub async fn compile_solc_in_docker_not_working() -> Result<(), AddressologyError> {
    // Initialize the Docker client
    let docker = Docker::connect_with_local_defaults().map_err(
        |err| err_custom_create!("Error connecting to Docker: {}", err)
    )?;

    let image_base_name = "ethereum/solc";
    let image_tag = "0.8.28";
    let image_full_name = format!("{}:{}", image_base_name, image_tag);

    //download image
    docker.create_image(
        Some(CreateImageOptions {
            from_image: image_full_name.clone(),
            ..Default::default()
        }),
        None,
        None,
    ).try_for_each(|ev| async {
        match ev { CreateImageInfo { .. } => {} }
        Ok(())
    }).await.map_err(
        |err| err_custom_create!("Error creating image: {}", err)
    )?;


    // Define the container configuration

    //gen random container name

    let config = Config {
        image: Some(image_full_name.clone()), // Use a lightweight base image
        cmd: Some(vec!["--standard-json".to_string()]), // Run a command that will keep the container running
        attach_stdin: Some(true),
        attach_stdout: Some(true),
        host_config: Some(HostConfig {
            auto_remove: Some(true), // Automatically remove the container when stopped
            ..Default::default()
        }),
        ..Default::default()
    };

    let container_name = uuid::Uuid::new_v4().to_string();
    // Create the container
    docker
        .create_container(Some(CreateContainerOptions {
            name: container_name.clone(),
            platform: None,
        }), config)
        .await.map_err(
            |err| err_custom_create!("Error creating container: {}", err)
        )?;

    // Start the container
    docker
        .start_container(&container_name, None::<StartContainerOptions<String>>)
        .await.map_err(
            |err| err_custom_create!("Error starting container: {}", err)
        )?;

    // Attach to the container's stdin
    let attach_options: AttachContainerOptions<String> = AttachContainerOptions {
        stream: Some(true),
        stdin: Some(true),
        stdout: Some(true),
        stderr: Some(true),
        ..Default::default()
    };

    let mut attach_stream = docker.attach_container(&container_name, Some(attach_options)).await.map_err(
        |err| err_custom_create!("Error attaching to container: {}", err)
    )?;

    log::info!("Attached to container, writing to input");
    attach_stream.input.write_all(b"// SPDX-License-Identifier: UNLICENSED\npragma solidity ^0.8.28;\n\n// Uncomment this line to use console.log\n// import \"hardhat/console.sol\";\n\ncontract Lock {\n    uint public unlockTime;\n    address payable public owner;\n\n    event Withdrawal(uint amount, uint when);\n\n    constructor(uint _unlockTime) payable {\n        require(\n            block.timestamp < _unlockTime,\n            \"Unlock time should be in the future\"\n        );\n\n        unlockTime = _unlockTime;\n        owner = payable(msg.sender);\n    }\n\n    function withdraw() public {\n        // Uncomment this line, and the import of \"hardhat/console.sol\", to print a log in your terminal\n        // console.log(\"Unlock time is %o and block timestamp is %o\", unlockTime, block.timestamp);\n\n        require(block.timestamp >= unlockTime, \"You can't withdraw yet\");\n        require(msg.sender == owner, \"You aren't the owner\");\n\n        emit Withdrawal(address(this).balance, block.timestamp);\n\n        owner.transfer(address(this).balance);\n    }\n}\n\n").await.map_err(
        |err| err_custom_create!("Error writing to container stdin: {}", err)
    )?;
    log::info!("Wrote to input");

    attach_stream.output.try_for_each(
        |output| async {
            match output {
                LogOutput::StdErr { message } => {
                    log::error!("Container error: {}", String::from_utf8_lossy(&message));
                }
                LogOutput::StdOut { message } => {
                    println!("Container output: {}", String::from_utf8_lossy(&message));
                }
                LogOutput::StdIn { .. } => {
                }
                LogOutput::Console { .. } => {
                }
            }
            Ok(())
        }
    ).await.map_err(
        |err| err_custom_create!("Error reading from container stdout: {}", err)
    )?;

    Ok(())
}