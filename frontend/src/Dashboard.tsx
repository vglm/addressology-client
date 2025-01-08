import React, { useEffect, useState } from "react";

import Editor from "react-simple-code-editor";
import { highlight, languages } from "prismjs";
import "prismjs/components/prism-clike";
import "prismjs/components/prism-solidity";
import "prismjs/themes/prism.css";
import { backendFetch } from "./common/BackendCall";
import { Button } from "@mui/material";
import { ethers } from "ethers"; //Example style, you can use another
import "./Dashboard.css";

interface CompilerMetadata {
    compiler: {
        version: string;
    };
    language: string;
    output: {
        abi: any[];
    };
    settings: {
        evmVersion: string;
        optimizer: {
            enabled: boolean;
            runs: number;
        };
    };
}

interface CompileErrors {
    message: string;
    formattedMessage: string;
    severity: string;
    type: string;
}

interface ContractCompiledBytecode {
    object: string;
    opcodes: string;
    sourceMap: string;
}
interface ContractCompiledEvm {
    bytecode: ContractCompiledBytecode;
}
interface ContractCompiled {
    evm: ContractCompiledEvm;
    metadata: string;
}

interface CompileResponse {
    contracts?: { [key: string]: { [key: string]: ContractCompiled } };
    errors?: CompileErrors[];
}

interface CompiledContractProps {
    contract: ContractCompiled;
}

const CompiledContractEl = (props: CompiledContractProps) => {
    const [network, _setNetwork] = useState("holesky");
    const [address, setAddress] = useState();
    const [bytecode, setBytecode] = useState(props.contract.evm.bytecode.object);
    const [constructorArgs, setConstructorArgs] = useState("");

    const getAddress = async () => {
        const response = await backendFetch("/api/fancy/random", {
            method: "Get",
        });
        const address = await response.json();
        setAddress(address.address);
    };

    useEffect(() => {
        getAddress().then();
    }, []);

    const deploySourceCode = async (bytecode: string, constructorArgs: string) => {
        const bytecodeBytes = ethers.getBytes("0x" + bytecode.replace("0x", ""));
        const constructorArgsBytes = ethers.getBytes("0x" + constructorArgs.replace("0x", ""));

        const response = await backendFetch("/api/fancy/deploy", {
            method: "Post",
            body: JSON.stringify({
                network: network,
                address: address,
                bytecode: ethers.hexlify(bytecodeBytes),
                constructorArgs: ethers.hexlify(constructorArgsBytes),
            }),
        });
        const deploy = await response.json();
        console.log(deploy);
    };

    const metadata = JSON.parse(props.contract.metadata) as CompilerMetadata;

    return (
        <div>
            <h3>Contract info</h3>
            <div>Address {address}</div>
            <Button onClick={(_e) => getAddress()}>Get Random Address</Button>
            <div>
                Compiler version: {metadata.language} - {metadata.compiler.version}
            </div>
            <div>
                Optimizer enabled:
                <span style={{ fontWeight: "bold" }}>
                    {metadata.settings.optimizer.enabled ? "true" : "false"}
                </span>{" "}
                runs:
                <span style={{ fontWeight: "bold" }}>{metadata.settings.optimizer.runs}</span>
            </div>
            <textarea
                value={bytecode}
                onChange={(e) => {}}
                style={{
                    backgroundColor: "#f5f5f5",
                    border: "1px solid #ddd",
                    borderRadius: "5px",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                    fontSize: "14px",
                    lineHeight: "20px",
                    width: "100%",
                    height: "200px",
                }}
            ></textarea>
            ABI
            <textarea
                value={JSON.stringify(metadata.output.abi, null, 2)}
                style={{
                    backgroundColor: "#f5f5f5",
                    border: "1px solid #ddd",
                    borderRadius: "5px",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                    fontSize: "14px",
                    lineHeight: "20px",
                    width: "100%",
                    height: "200px",
                }}
            />
            Constructor binary data
            <textarea
                value={constructorArgs}
                onChange={(e) => setConstructorArgs(e.target.value)}
                style={{
                    backgroundColor: "#f5f5f5",
                    border: "1px solid #ddd",
                    borderRadius: "5px",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                    fontSize: "14px",
                    lineHeight: "20px",
                    width: "100%",
                    height: "200px",
                }}
            ></textarea>
            <Button onClick={(_e) => deploySourceCode(bytecode, constructorArgs)}>Deploy</Button>
        </div>
    );
};

const Dashboard = () => {
    //const loginInformation = useLoginOrNull();
    //const navigate = useNavigate();
    const [errors, setErrors] = useState<CompileErrors[]>([]);
    const [contracts, setContracts] = useState<{ [key: string]: { [key: string]: ContractCompiled } }>({});
    const [code, setCode] = useState(
        "// SPDX-License-Identifier: UNLICENSED\n" +
            "pragma solidity ^0.8.28;\n" +
            "\n" +
            "// Uncomment this line to use console.log\n" +
            '// import "hardhat/console.sol";\n' +
            "\n" +
            "contract Lock {\n" +
            "    uint public unlockTime;\n" +
            "    address payable public owner;\n" +
            "\n" +
            "    event Withdrawal(uint amount, uint when);\n" +
            "\n" +
            "    constructor(uint _unlockTime) payable {\n" +
            "        require(\n" +
            "            block.timestamp < _unlockTime,\n" +
            '            "Unlock time should be in the future"\n' +
            "        );\n" +
            "\n" +
            "        unlockTime = _unlockTime;\n" +
            "        owner = payable(msg.sender);\n" +
            "    }\n" +
            "\n" +
            "    function withdraw() public {\n" +
            '        // Uncomment this line, and the import of "hardhat/console.sol", to print a log in your terminal\n' +
            '        // console.log("Unlock time is %o and block timestamp is %o", unlockTime, block.timestamp);\n' +
            "\n" +
            '        require(block.timestamp >= unlockTime, "You can\'t withdraw yet");\n' +
            '        require(msg.sender == owner, "You aren\'t the owner");\n' +
            "\n" +
            "        emit Withdrawal(address(this).balance, block.timestamp);\n" +
            "\n" +
            "        owner.transfer(address(this).balance);\n" +
            "    }\n" +
            "}\n" +
            "\n",
    );

    const compileSourceCode = async (sourceCode: string) => {
        const response = await backendFetch("/api/contract/compile", {
            method: "Post",
            body: JSON.stringify({
                sources: {
                    main: sourceCode,
                },
            }),
        });
        const compile: CompileResponse = await response.json();
        console.log(compile);
        if (compile.errors) {
            setErrors(compile.errors);
            console.log(compile.errors);
        } else {
            console.log(compile);
        }
        if (compile.contracts) {
            console.log(compile.contracts);
            setContracts(compile.contracts);
        }
    };

    function getMarginLeft() {
        return Math.max((window.innerWidth - 1500) / 2, 15);
    }
    window.onresize = () => {
        const marginLeft = getMarginLeft();
        document.getElementsByClassName("main-page")[0].setAttribute("style", `margin-left: ${marginLeft}px`);
    };

    const compiledContracts: { [key: string]: ContractCompiled } = {};
    for (const value of Object.values(contracts)) {
        for (const [key2, value2] of Object.entries(value)) {
            compiledContracts[key2] = value2;
        }
    }

    return (
        <div className="main-page">
            <div
                style={{
                    fontFamily: '"Fira code", "Fira Mono", monospace',
                }}
            >
                <div>
                    <h2>Contract from source code</h2>
                    <div className={"source-code"}>
                        <Editor
                            value={code}
                            onValueChange={(newCode) => setCode(newCode)}
                            padding={10}
                            tabSize={4}
                            highlight={(code) => highlight(code, languages.solidity, "Solidity")}
                            style={{
                                backgroundColor: "#f5f5f5",
                                border: "1px solid #ddd",
                                borderRadius: "5px",
                                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                                fontSize: "14px",
                                lineHeight: "20px"
                            }}
                        />
                    </div>
                </div>
                <Button onClick={(_e) => compileSourceCode(code)}>Compile</Button>

                {errors.map((error, index) => (
                    <div key={index}>
                        {error.severity} {error.type} {error.message} {error.formattedMessage}
                    </div>
                ))}
                {Object.keys(compiledContracts).map((key, index) => (
                    <CompiledContractEl key={index} contract={compiledContracts[key]} />
                ))}
            </div>
        </div>
    );
};

export default Dashboard;
