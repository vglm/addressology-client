import React from "react";
import "./MyContracts.css";
import { backendFetch } from "./common/BackendCall";
import { useEffect, useState } from "react";
import { ContractSaved } from "./model/Contract";
import { Button } from "@mui/material";
import { useNavigate } from "react-router-dom";

const MyContracts = () => {
    const [contracts, setContracts] = useState<ContractSaved[]>([]);
    const navigate = useNavigate();

    const getContracts = async () => {
        const response = await backendFetch("/api/contracts/list", {
            method: "Get",
        });
        const contracts = await response.json();
        setContracts(contracts);
    };

    const selectContract = async (contractId: string) => {
        navigate(`/contract/${contractId}`);
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
                    <Button onClick={(_e) => selectContract(contract.contractId)}>{contract.contractId}</Button>
                    <p>{contract.network}</p>
                    <Button onClick={(_e) => deleteContract(contract.contractId)}>Delete</Button>
                </div>
            ))}
        </div>
    );
};

export default MyContracts;
