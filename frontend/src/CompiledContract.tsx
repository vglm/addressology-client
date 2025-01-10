import React, { useEffect, useState } from "react";

import "prismjs/components/prism-clike";
import "prismjs/components/prism-solidity";
import "prismjs/themes/prism.css";
import { backendFetch } from "./common/BackendCall";
import { Button, MenuItem, Select } from "@mui/material";
import { ethers } from "ethers"; //Example style, you can use another
import { ContractSaved } from "./model/Contract";
import "./CompiledContract.css";
import { useParams } from "react-router-dom";

const CompiledContract = () => {
    const [contractDetails, setContractDetails] = useState<ContractSaved | null>(null);
    const [network, setNetwork] = useState("holesky");
    const [address, setAddress] = useState();
    const [constructorArgs, setConstructorArgs] = useState("");
    const [networks, setNetworks] = useState<string[]>([]);
    const [bytecode, setBytecode] = useState<string | null>(null);
    const [metadata, setMetadata] = useState<any | null>(null);
    const [sourceCode, setSourceCode] = useState<string | null>(null);
    const { contractId } = useParams();

    const getContractDetails = async () => {
        const response = await backendFetch(`/api/contract/${contractId}`, {
            method: "Get",
        });
        const contract: ContractSaved = await response.json();
        console.log(contract);

        const data = JSON.parse(contract.data);

        setNetwork(contract.network);
        setBytecode(data.bytecode);
        setConstructorArgs(data.constructorArgs);
        setMetadata(JSON.parse(data.metadata));
        setSourceCode(data.sourceCode);

        setContractDetails(contract);
    };

    const getNetworks = async () => {
        return ["holesky", "amoy"];
    };

    const getAddress = async () => {
        const response = await backendFetch("/api/fancy/random", {
            method: "Get",
        });
        const address = await response.json();
        setAddress(address.address);
    };

    useEffect(() => {
        getContractDetails().then();
        getAddress().then();
        getNetworks().then(setNetworks);
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

    if (!contractDetails || !metadata || !bytecode) {
        return <div>No contract</div>;
    }

    /*
    const metadata = JSON.parse(props.contract.metadata) as CompilerMetadata;

    const saveSourceCode = async () => {
        const bytecodeBytes = ethers.getBytes("0x" + bytecode.replace("0x", ""));
        const constructorArgsBytes = ethers.getBytes("0x" + constructorArgs.replace("0x", ""));
     */

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
                onChange={(_e) => {
                    console.log("Readonly");
                }}
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
            Source code
            <textarea
                value={sourceCode ?? ""}
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
            <Select
                variant={"filled"}
                value={network}
                onChange={(e) => setNetwork(e.target.value)}
                style={{ width: "100px" }}
            >
                {networks.map((network) => (
                    <MenuItem key={network} value={network}>
                        {network}
                    </MenuItem>
                ))}
            </Select>
            <div style={{ height: 300 }}>Empty</div>
            <Button onClick={(_e) => deploySourceCode(bytecode, constructorArgs)}>Deploy</Button>
        </div>
    );
};

export default CompiledContract;
