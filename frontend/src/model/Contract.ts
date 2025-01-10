export interface CompilerMetadata {
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

export interface CompileErrors {
    message: string;
    formattedMessage: string;
    severity: string;
    type: string;
}

export interface ContractCompiledBytecode {
    object: string;
    opcodes: string;
    sourceMap: string;
}
export interface ContractCompiledEvm {
    bytecode: ContractCompiledBytecode;
}
export interface ContractCompiled {
    evm: ContractCompiledEvm;
    metadata: string;
    singleFileCode: string;
}

export interface CompileResponse {
    contracts?: { [key: string]: { [key: string]: ContractCompiled } };
    errors?: CompileErrors[];
}

export interface ContractSaved {
    contractId: string;
    network: string;
    data: string;
}
