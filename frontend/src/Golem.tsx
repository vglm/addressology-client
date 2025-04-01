import React, { useEffect, useRef, useState } from "react";
import { backendFetch } from "./common/BackendCall";
import { Runner } from "./model/Contract";
import { Button } from "@mui/material";
import CountUp from "react-countup";
import AnimatedGPUIcon from "./AnimatedGpuIcon";
import "./Golem.css"
import JsonView from 'react18-json-view'
import 'react18-json-view/src/style.css'

interface YagnaInfo {
    status: string;
}
interface ProviderInfo {
    status: string;
}

const Golems = () => {
    const [yagnaInfo, setYagnaInfo] = useState<YagnaInfo | null>(null);
    const [providerInfo, setProviderInfo] = useState<ProviderInfo | null>(null);
    const [updateNo, setUpdateNo] = useState(0);
    const [offers, setOffers] = useState<string>();

    const getYagnaInfo = async () => {
        const response = await backendFetch("/api/yagna/info", {
            method: "Get",
        });
        const yagnaInfo = await response.json();
        setYagnaInfo(yagnaInfo);
    };
    const getProviderInfo = async () => {
        const response = await backendFetch("/api/provider/info", {
            method: "Get",
        });
        const providerInfo = await response.json();
        setProviderInfo(providerInfo);
    };


    const startYagna = async () => {
        const response = await backendFetch(`/api/yagna/start`, {
            method: "Post",
        });
        const data = await response.text();
        console.log("Start runner result: ", data);
    };

    const startProvider = async () => {
        const response = await backendFetch(`/api/provider/start`, {
            method: "Post",
        });
        const data = await response.text();
        console.log("Start runner result: ", data);
    };

    const stopYagna = async () => {
        const response = await backendFetch(`/api/yagna/stop`, {
            method: "Post",
        });
        const data = await response.text();
        console.log("Stop runner result: ", data);
    };
    const configureProvider = async () => {
        const response = await backendFetch(`/api/provider/configure`, {
            method: "Post",
        });
        const data = await response.text();
        console.log("Stop runner result: ", data);
    };
    const stopProvider = async () => {
        const response = await backendFetch(`/api/provider/stop`, {
            method: "Post",
        });
        const data = await response.text();
        console.log("Stop runner result: ", data);
    };

    const cleanYagna = async () => {
        const response = await backendFetch(`/api/yagna/clean`, {
            method: "Post",
        });
        const data = await response.text();
        console.log("Stop runner result: ", data);
    };

    const cleanProvider = async () => {
        const response = await backendFetch(`/api/provider/clean`, {
            method: "Post",
        });
        const data = await response.text();
        console.log("Stop runner result: ", data);
    };

    const getOffers = async () => {
        const response = await backendFetch("/api/yagna/market/offers", {
            method: "Get",
        });
        const offers = await response.json();
        setOffers(offers);
        console.log("Offers: ", offers);
    }

    useEffect(() => {
        getYagnaInfo().then();
        getProviderInfo().then();
    }, [updateNo]);

    useEffect(() => {
        setTimeout(() => {
            setUpdateNo(updateNo + 1);
        }, 1000);
    }, [updateNo]);

    return (
        <div>
            <div>

                <div className={"golem-node-card-main"}>
                    <div>
                        <div className={"golem-node-card-logo"}>
                            <div className={"golem-node-card-logo-text"}>Connect to</div>
                            <img src={"golem.png"}></img>
                        </div>
                            Yagna:
                        <Button disabled={yagnaInfo?.status == "running"} onClick={() => startYagna()}>
                            Start
                        </Button>
                        <Button disabled={yagnaInfo?.status == "stopped"} onClick={() => stopYagna()}>
                            Stop
                        </Button>
                        <Button disabled={yagnaInfo?.status == "running"} onClick={() => cleanYagna()}>
                            Clean
                        </Button>
                        <Button disabled={yagnaInfo?.status == "stopped"} onClick={() => getOffers()}>
                            Get Offers
                        </Button>
                    </div>
                    <div>
                        Provider:
                        <Button disabled={providerInfo?.status == "running"} onClick={() => startProvider()}>
                            Start
                        </Button>
                        <Button disabled={providerInfo?.status == "running"} onClick={() => configureProvider()}>
                            Configure
                        </Button>
                        <Button disabled={providerInfo?.status == "stopped"} onClick={() => stopProvider()}>
                            Stop
                        </Button>
                        <Button disabled={providerInfo?.status == "running"} onClick={() => cleanProvider()}>
                            Clean
                        </Button>
                    </div>

                    <JsonView src={offers}>

                    </JsonView>
                </div>

            </div>

        </div>
    );
};

export default Golems;
