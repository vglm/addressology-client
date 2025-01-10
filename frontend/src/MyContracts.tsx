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
            <table>
                <tr>
                    <th>Contract ID</th>
                    <th>Name</th>
                    <th>Address</th>
                    <th>Network</th>
                    <th>Create Date</th>
                    <th>Deployed</th>
                    <th>Actions</th>
                </tr>

                {contracts.map((contract) => {
                    const data = JSON.parse(contract.data);
                    return (
                        <tr key={contract.contractId} className="contract">
                            <td>
                                <Button onClick={(_e) => selectContract(contract.contractId)}>
                                    {contract.contractId}
                                </Button>
                            </td>

                            <td>{data.name}</td>
                            <td>{contract.address ?? "Not assigned"}</td>
                            <td>{contract.network}</td>
                            <td>{contract.created}</td>
                            <td>{contract.deployed}</td>

                            <Button onClick={(_e) => deleteContract(contract.contractId)}>Delete</Button>
                        </tr>
                    );
                })}
            </table>
        </div>
    );
};

export default MyContracts;
