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
export interface ContractCompiledInt {
    evm: ContractCompiledEvm;
    metadata: string;
    singleFileCode: string;
}
export interface ContractCompiled {
    name: string;
    constructorArgs: string;
    contract: ContractCompiledInt;
}

export interface CompileResponse {
    contracts?: { [key: string]: { [key: string]: ContractCompiledInt } };
    errors?: CompileErrors[];
}

export interface ContractSaved {
    contractId: string;
    created: string;
    address: string | null;
    network: string;
    data: string;
    deployStatus: string;
    deployRequested: string | null;
    deploySent: string | null;
    deployed: string | null;
}

export interface ContractAssigned {
    contractId: string;
    userId: string;
    created: string;
    address: string;
    network: string;
    tx: string | null;
    deployStatus: string;
    deployRequested: string | null;
    deploySent: string | null;
    deployed: string | null;
}
export interface FancyAssignedAddress {
    address: string;
    salt: string;
    factory: string;
    created: string;
    score: number;
    owner: string;
    price: number;
    category: string;
    job: string;
    provName: string;
    provNodeId: string;
    provRewardAddr: string;
    assignedContracts: ContractAssigned[];
}
