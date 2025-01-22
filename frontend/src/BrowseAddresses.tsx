import React, { useEffect, useState } from "react";
import { backendFetch } from "./common/BackendCall";

import "./BrowseAddresses.css";
import { ethers } from "ethers";
import { Fancy, FancyCategoryInfo } from "./model/Fancy";
import { Checkbox, FormControlLabel, MenuItem, Select } from "@mui/material";

interface TotalHashInfo {
    estimatedWorkTH: number;
}

interface SelectCategoryProps {
    selectedCategory: string;
    setSelectedCategory: (category: string) => void;
}

export const SelectCategory = (props: SelectCategoryProps) => {
    const [categories, setCategories] = useState<FancyCategoryInfo[] | null>(null);
    const loadCategories = async () => {
        const response = await backendFetch("/api/fancy/categories", {
            method: "Get",
        });
        const addresses = await response.json();

        setCategories(addresses);
    };

    useEffect(() => {
        loadCategories().then();
    }, []);

    return (
        <Select
            variant={"outlined"}
            defaultValue={props.selectedCategory}
            onChange={(e) => props.setSelectedCategory(e.target.value)}
        >
            <MenuItem value={"all"}>All</MenuItem>
            {categories &&
                categories.map((category) => {
                    return (
                        <MenuItem key={category.key} value={category.key}>
                            {category.name}
                        </MenuItem>
                    );
                })}
        </Select>
    );
};

const BrowseAddresses = () => {
    const [fancies, setFancies] = useState<Fancy[]>([]);
    const [totalHash, setTotalHash] = useState<TotalHashInfo | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string>("all");
    const [newest, setNewest] = useState<boolean>(false);

    const loadAddresses = async () => {
        const order = newest ? "created" : "score";
        const response = await backendFetch(
            `/api/fancy/list_best_score?limit=1000&order=${order}&category=${selectedCategory}`,
            {
                method: "Get",
            },
        );
        const addresses = await response.json();

        setFancies(addresses);
    };

    const loadTotalHashes = async () => {
        const response = await backendFetch("/api/fancy/total_hash", {
            method: "Get",
        });
        const totalHash = await response.json();
        console.log("Total hashes: ", totalHash);
        setTotalHash(totalHash);
    };

    useEffect(() => {
        loadTotalHashes().then();
    }, []);

    useEffect(() => {
        loadAddresses().then();
    }, [selectedCategory, newest]);

    if (!fancies) {
        return <div>Loading...</div>;
    }
    if (!totalHash) {
        return <div>Loading...</div>;
    }
    if (!selectedCategory) {
        return <div>Loading...</div>;
    }

    return (
        <div>
            <h1>Browse Addresses</h1>

            <FormControlLabel
                label="Show newest"
                control={<Checkbox value={newest} onChange={(e) => setNewest(e.target.checked)}></Checkbox>}
            ></FormControlLabel>

            <div>
                <h2>Estimated total work: {totalHash.estimatedWorkTH.toFixed(3)} TH</h2>
            </div>

            <SelectCategory
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
            ></SelectCategory>

            <table>
                <thead>
                    <tr>
                        <th>Address</th>
                        <th>Short Etherscan</th>
                        <th>Difficulty</th>
                        <th>Price</th>
                        <th>Category</th>
                        <th>Created</th>
                        <th>Miner</th>
                    </tr>
                </thead>
                <tbody>
                    {fancies.map((fancy) => {
                        //0xa27CEF8a...Ae96F491F
                        //0xd2674dA9...211369A4B
                        //0x00000000...072C22734
                        //0x0000000000001fF3684f28c67538d4D072C22734
                        //0x000000000000001d48ffbd0c0da7c129137a9c55

                        const mixedCaseForm = ethers.getAddress(fancy.address);
                        const etherscanForm = mixedCaseForm.slice(0, 10) + "..." + mixedCaseForm.slice(33);
                        return (
                            <tr key={fancy.address}>
                                <td>
                                    <a className={"fancy-address-entry"} href={`/dashboard/address/${mixedCaseForm}`}>
                                        {mixedCaseForm}
                                    </a>
                                </td>
                                <td>
                                    <span className={"fancy-address-entry"}>{etherscanForm}</span>
                                </td>

                                <td>{fancy.score}</td>
                                <td>{fancy.price}</td>
                                <td>{fancy.category}</td>
                                <td>{fancy.created}</td>
                                <td>{fancy.miner}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default BrowseAddresses;
