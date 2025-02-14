import React, { useEffect, useState } from "react";
import { ConstructorFragment, ethers } from "ethers";
import InputParameter from "./InputParameter";

interface InputParametersProps {
    abi: string;
    constructorArgs: string;
    setConstructorArgs: (args: string) => void;
}

function decodeConstructorParameters(abiStr: string) {
    // Create an Interface from the ABI
    const abi = JSON.parse(abiStr);
    const contractInterface = new ethers.Interface(abi);

    contractInterface.forEachFunction((func) => {
        console.log("Function:", func);
    });

    console.log(contractInterface.deploy);

    return contractInterface.deploy;
}

export function encodeConstructorParameters(abiStr: string, argStr: string) {
    const args = argStr.split(",");
    const fragment = decodeConstructorParameters(abiStr);
    if (args.length !== fragment.inputs.length) {
        throw new Error("Invalid number of arguments");
    }

    const binary = [];
    for (let idx = 0; idx < args.length; idx++) {
        const param = fragment.inputs[idx];
        if (param.type === "uint256") {
            binary.push(BigInt(args[idx]).toString(16).padStart(64, "0"));
        } else if (param.type === "address") {
            binary.push(BigInt(args[idx]).toString(16).padStart(64, "0"));
        } else {
            throw new Error(`Unsupported type ${param.type}`);
        }
    }
    return binary.join("");
}

const InputParameters = (props: InputParametersProps) => {
    const [constructorArgs, setConstructorArgs] = useState<ConstructorFragment | null>(null);

    useEffect(() => {
        setConstructorArgs(decodeConstructorParameters(props.abi));
        updateConstructorArgs();
    }, []);

    const updateConstructorArgs = () => {
        const newArgs = [];
        for (const _input of constructorArgs?.inputs ?? []) {
            newArgs.push(props.constructorArgs);
        }
        const binary = [];
        for (const arg of newArgs) {
            binary.push(ethers.hexlify(ethers.toUtf8Bytes(arg)));
        }
    };

    const updateInput = (name: string, value: string) => {
        const newArgs = [];
        const params = [];
        for (const input of constructorArgs?.inputs ?? []) {
            params.push(input);
            if (input.name === name) {
                newArgs.push(value);
            } else {
                newArgs.push("");
            }
        }

        const binary = [];
        for (let idx = 0; idx < newArgs.length; idx++) {
            const param = params[idx];
            if (param.type === "uint256") {
                binary.push(BigInt(newArgs[idx]).toString(16).padStart(64, "0"));
            }
            if (param.type === "address") {
                binary.push(BigInt(newArgs[idx]).toString(16).padStart(64, "0"));
            }
        }
        props.setConstructorArgs(newArgs.join(","));
    };

    return (
        <div>
            <h1>Input Parameters</h1>

            <div>
                <h2>Constructor Arguments</h2>
                <table>
                    <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Value</th>
                    </tr>
                    {constructorArgs?.inputs.map((input) => {
                        return (
                            <InputParameter
                                key={input.name}
                                name={input.name}
                                type={input.type}
                                value={props.constructorArgs}
                                setValue={(value) => updateInput(input.name, value)}
                            />
                        );
                    })}
                </table>
            </div>
        </div>
    );
};

export default InputParameters;
