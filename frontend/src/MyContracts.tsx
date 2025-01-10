import React from "react";
import "./MyContracts.css";
import { backendFetch } from "./common/BackendCall";
import { useEffect, useState } from "react";
import { ContractSaved } from "./model/Contract";
import { Button } from "@mui/material";

const MyContracts = () => {
    const [contracts, setContracts] = useState<ContractSaved[]>([]);

    const getContracts = async () => {
        const response = await backendFetch("/api/contracts/list", {
            method: "Get",
        });
        const contracts = await response.json();
        setContracts(contracts);
    };

    const deleteContract = async (contractId: string) => {
        const response = await backendFetch(`/api/contract/${contractId}/delete`, {
            method: "Post",
        });
        const data = await response.text();
        console.log("Delete contract result: ", data);
        getContracts().then();
    };

    useEffect(() => {
        getContracts().then();
    }, []);

    return (
        <div>
            <h1>My Contracts</h1>

            {contracts.map((contract) => (
                <div key={contract.contractId} className="contract">
                    <h3>{contract.contractId}</h3>
                    <p>{contract.network}</p>
                    <Button onClick={(_e) => deleteContract(contract.contractId)}>Delete</Button>
                </div>
            ))}
        </div>
    );
};

export default MyContracts;
