import React, { useEffect, useState } from "react";
import { backendFetch } from "./common/BackendCall";

import "./AddressCard.css";
import { ethers } from "ethers";
import { useParams } from "react-router-dom";
import { FancyScore } from "./model/Fancy";
import { Button } from "@mui/material";

interface AddressCardProps {
    initialAddress: string;
}

const AddressCard = (props: AddressCardProps) => {
    const [fancy, setFancy] = useState<FancyScore | null>(null);
    const [address, setAddress] = useState<string>(props.initialAddress);

    const getRandomAddress = async () => {
        const response = await backendFetch("/api/fancy/random", {
            method: "Get",
        });
        const address = await response.json();
        setAddress(address.address);
    };

    const loadFancy = async (addr: string) => {
        try {
            const parsedAddress = ethers.getAddress(addr.toLowerCase());
            const response = await backendFetch(`/api/fancy/score/${parsedAddress}`, {
                method: "Get",
            });
            const scoreResp = await response.json();

            setFancy(scoreResp);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        loadFancy(address).then();
    }, [address]);

    if (!fancy) {
        return <div>Loading...</div>;
    }

    return (
        <div>
            <h1>Address card</h1>

            <Button onClick={(_e) => getRandomAddress()}>Next random</Button>

            <div>
                <span className={"fancy-address-entry"}>{fancy.addressMixedCase}</span>
            </div>
            <div>
                <span className={"fancy-address-entry"}>{fancy.addressShortEtherscan}</span>
            </div>

            <div>{fancy.totalScore}</div>
            <div>{fancy.price}</div>
            <div>{fancy.category}</div>
            <div>{fancy.created}</div>
            <div>{fancy.miner}</div>
        </div>
    );
};

export const AddressCardForRoute = () => {
    const { address } = useParams();

    if (!address) {
        return <div>No address</div>;
    }

    return <AddressCard initialAddress={address} />;
};
