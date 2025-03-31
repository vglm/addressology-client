mod api;
mod config;
mod error;
mod fancy;
mod hash;

pub mod service;
pub mod runner;
mod types;
mod update;
use crate::api::scope::server_api_scope;

use crate::hash::{compute_address_command, compute_create3_command};
use crate::runner::{test_run, CrunchRunner};
use actix_multipart::form::MultipartFormConfig;
use actix_multipart::MultipartError;
use actix_web::http::StatusCode;
use actix_web::{web, App, HttpRequest, HttpResponse, HttpResponseBuilder, HttpServer, Responder};
use awc::Client;
use clap::{Parser, Subcommand};
use lazy_static::lazy_static;
use serde::Deserialize;
use std::env;
use std::sync::Arc;

fn get_allowed_emails() -> Vec<String> {
    let res = env::var("ALLOWED_EMAILS")
        .unwrap_or("sieciech.czajka@golem.network".to_string())
        .split(",")
        .map(|x| x.trim().to_string())
        .collect();
    log::info!("Allowed emails loaded: {:?}", res);
    res
}

fn get_domain() -> String {
    let res = env::var("WEB_PORTAL_DOMAIN").unwrap_or("localhost".to_string());

    log::info!("Portal domain: {}", res);

    res
}

lazy_static! {
    pub static ref ALLOWED_EMAILS: Vec<String> = get_allowed_emails();
    pub static ref WEB_PORTAL_DOMAIN: String = get_domain();
    static ref PASS_SALT: String = env::var("PASS_SALT").unwrap_or("LykwVQJAcU".to_string());
    pub static ref ALLOW_CREATING_NEW_ACCOUNTS: bool = env::var("ALLOW_CREATING_NEW_ACCOUNTS")
        .map(|v| v == "true")
        .unwrap_or(false);
}

pub struct ServerData {
    pub runners: Vec<Arc<tokio::sync::Mutex<CrunchRunner>>>,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DeployDataContractEvmBytecode {
    pub object: String,
    pub opcodes: String,
    pub source_map: String,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DeployDataContractEvm {
    pub bytecode: DeployDataContractEvmBytecode,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DeployDataContract {
    pub evm: DeployDataContractEvm,
    pub metadata: String,
    pub single_file_code: String,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DeployData {
    pub name: String,
    pub contract: DeployDataContract,
    pub constructor_args: String,
}

#[cfg(feature = "dashboard")]
#[derive(rust_embed::RustEmbed)]
#[folder = "frontend/dist"]
struct Asset;

pub async fn redirect_to_dashboard() -> impl Responder {
    {
        let target = "/dashboard/";
        log::debug!("Redirecting to endpoint: {target}");
        HttpResponse::Ok()
            .status(actix_web::http::StatusCode::PERMANENT_REDIRECT)
            .append_header((actix_web::http::header::LOCATION, target))
            .finish()
    }
}

#[allow(dead_code)]
async fn proxy(
    path: web::Path<String>,
    client: web::Data<Client>,
    request: HttpRequest,
) -> HttpResponse {
    log::info!("Proxying request to: {path}");
    let url = format!("http://localhost:5173/dashboard/{path}");

    // here we use `IntoHttpResponse` to return the request to
    // duckduckgo back to the client that called this endpoint

    let mut new_request = client.request(request.method().clone(), url);
    for (header_name, header_value) in request.headers() {
        new_request = new_request.insert_header((header_name.clone(), header_value.clone()));
    }
    match new_request.send().await {
        Ok(resp) => {
            log::info!("Response: {}", resp.status());
            let mut response = HttpResponse::build(resp.status());

            resp.headers().into_iter().for_each(|(k, v)| {
                response.insert_header((k, v));
            });

            response.streaming(resp)
        }
        Err(e) => {
            log::error!("Error: {e}");
            HttpResponseBuilder::new(StatusCode::INTERNAL_SERVER_ERROR).body(format!("Error: {e}"))
        }
    }
}
#[allow(clippy::needless_return)]
#[allow(unreachable_code)]
pub async fn dashboard_serve(
    path: web::Path<String>,
    _client: web::Data<Client>,
    _request: HttpRequest,
) -> HttpResponse {
    #[cfg(feature = "dashboard")]
    {
        let mut path = path.as_str();

        let mut compression_header = None;
        let compressions_to_check = vec![".br", ".gz", ""];

        let mut content = None;
        if path.ends_with(".gz") || path.ends_with(".br") {
            content = Asset::get(path);
        } else {
            for compression in compressions_to_check {
                let path_with_compress = format!("{}{}", path, compression);
                content = Asset::get(&path_with_compress);
                if content.is_some() {
                    if compression == ".br" {
                        compression_header = Some("br");
                    } else if compression == ".gz" {
                        compression_header = Some("gzip");
                    }
                    break;
                }
            }
            if content.is_none() && !path.contains('.') {
                path = "index.html";
                content = Asset::get(path);
            }
        }

        log::debug!("Serving frontend file: {path}");

        return match content {
            Some(content) => {
                let mut builder: HttpResponseBuilder = HttpResponseBuilder::new(StatusCode::OK);
                builder.content_type(mime_guess::from_path(path).first_or_octet_stream().as_ref());
                if let Some(compression) = compression_header {
                    builder.append_header(("Content-Encoding", compression));
                }
                builder.append_header(("Cache-Control", "public, max-age=3600")); // 1 hour
                builder.body(content.data.into_owned())
            }
            None => HttpResponse::NotFound().body("404 Not Found"),
        };
    }
    #[cfg(feature = "proxy")]
    {
        return proxy(path, _client, _request).await;
    }
    #[cfg(all(not(feature = "dashboard"), not(feature = "proxy")))]
    HttpResponse::NotFound().body(format!("404 Not Found: {}", path))
}

/// Enum that defines the available subcommands
#[derive(Subcommand)]
enum Commands {
    Test {},
    ComputeCreate3 {
        #[arg(short, long)]
        factory: String,
        #[arg(short, long)]
        salt: String,
    },
    ComputeAddress {
        #[arg(short = 'b', long)]
        public_key_base: String,
        #[arg(short = 'p', long)]
        private_key_add: String,
        #[arg(short = 'e', long)]
        expected_address: Option<String>,
    },

    /// Start web server
    Server {
        #[arg(long, default_value = "localhost:80")]
        addr: String,

        #[arg(long)]
        threads: Option<usize>,

        #[arg(long)]
        no_cuda_devices: Option<u64>,
    },
}

#[derive(Parser)]
#[command(version, about, long_about = None)]
struct Cli {
    #[command(subcommand)]
    cmd: Commands,

    #[arg(long, default_value = "addressology.sqlite")]
    db: String,
}

fn handle_multipart_error(err: MultipartError, _req: &HttpRequest) -> actix_web::Error {
    log::error!("Multipart error: {}", err);
    actix_web::Error::from(err)
}

#[actix_rt::main]
async fn main() -> std::io::Result<()> {
    dotenv::dotenv().ok();
    std::env::set_var(
        "RUST_LOG",
        std::env::var("RUST_LOG").unwrap_or("info".to_string()),
    );
    env_logger::init();

    let args = Cli::parse();

    match args.cmd {
        Commands::Server {
            addr,
            threads,
            no_cuda_devices,
        } => {
            let mut cuda_workers = Vec::new();
            if let Some(no_cuda_devices) = no_cuda_devices {
                for i in 0..no_cuda_devices {
                    cuda_workers.push(Arc::new(tokio::sync::Mutex::new(CrunchRunner::new(
                        "profanity_cuda.exe".parse().unwrap(),
                        i,
                    ))));
                }
            }

            HttpServer::new(move || {
                let cors = actix_cors::Cors::permissive();

                let client = web::Data::new(Client::new());
                let server_data = web::Data::new(Box::new(ServerData {
                    runners: cuda_workers.clone(),
                }));

                App::new()
                    .wrap(cors)
                    .app_data(server_data)
                    .app_data(client)
                    .app_data(
                        MultipartFormConfig::default()
                            .total_limit(10 * 1024 * 1024 * 1024) // 10 GB
                            .memory_limit(10 * 1024 * 1024) // 10 MB
                            .error_handler(handle_multipart_error),
                    )
                    .route("/", web::get().to(redirect_to_dashboard))
                    .route("/dashboard", web::get().to(redirect_to_dashboard))
                    .route("/dashboard/{_:.*}", web::get().to(dashboard_serve))
                    .route("/service/update", web::post().to(update::push_update))
                    .service(server_api_scope())
            })
            .workers(threads.unwrap_or(std::thread::available_parallelism().unwrap().into()))
            .bind(addr)?
            .run()
            .await
        }

        Commands::ComputeCreate3 { factory, salt } => {
            let result = compute_create3_command(&factory, &salt);
            match result {
                Ok(hash) => {
                    log::info!("Computed create3 hash: {}", hash);
                    println!("{}", hash);
                }
                Err(e) => {
                    log::error!("{}", e);
                    std::process::exit(1);
                }
            }
            Ok(())
        }
        Commands::ComputeAddress {
            public_key_base,
            private_key_add,
            expected_address,
        } => {
            let result = compute_address_command(&public_key_base, &private_key_add);
            match result {
                Ok(addr) => {
                    if let Some(expected) = expected_address {
                        return if addr.replace("0x", "").to_lowercase()
                            != expected.replace("0x", "").to_lowercase()
                        {
                            log::error!(
                                "Computed address: {} does not match expected: {}",
                                addr,
                                expected
                            );
                            Err(std::io::Error::new(
                                std::io::ErrorKind::Other,
                                format!(
                                    "Computed address: {} does not match expected: {}",
                                    addr, expected
                                ),
                            ))
                        } else {
                            log::info!("Computed address: {} matches expected", addr);
                            Ok(())
                        };
                    }
                    log::info!("Computed address: {}", addr);
                    println!("{}", addr);
                }
                Err(e) => {
                    log::error!("{}", e);
                    std::process::exit(1);
                }
            }
            Ok(())
        }

        Commands::Test {} => {
            test_run().await;
            //test_command(conn).await;
            /*match compile_solc(
                "// SPDX-License-Identifier: UNLICENSED\npragma solidity ^0.8.28;\n\n// Uncomment this line to use console.log\n// import \"hardhat/console.sol\";\n\ncontract Lock {\n    uint public unlockTime;\n    address payable public owner;\n\n    event Withdrawal(uint amount, uint when);\n\n    constructor(uint _unlockTime) payable {\n        require(\n            block.timestamp < _unlockTime,\n            \"Unlock time should be in the future\"\n        );\n\n        unlockTime = _unlockTime;\n        owner = payable(msg.sender);\n    }\n\n    function withdraw() public {\n        // Uncomment this line, and the import of \"hardhat/console.sol\", to print a log in your terminal\n        // console.log(\"Unlock time is %o and block timestamp is %o\", unlockTime, block.timestamp);\n\n        require(block.timestamp >= unlockTime, \"You can't withdraw yet\");\n        require(msg.sender == owner, \"You aren't the owner\");\n\n        emit Withdrawal(address(this).balance, block.timestamp);\n\n        owner.transfer(address(this).balance);\n    }\n}\n\n",
                               "0.8.28").await {
                Ok(res) => (
                    println!("Output of compilation: {:#?}", res)
                    ),
                Err(e) => {
                    log::error!("{}", e);
                    std::process::exit(1);
                }
            }*/

            Ok(())
        }
    }
}
