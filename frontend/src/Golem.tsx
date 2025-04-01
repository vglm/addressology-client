import React, { useEffect, useRef, useState } from "react";
import "./Workers.css";
import { backendFetch } from "./common/BackendCall";
import { Runner } from "./model/Contract";
import { Button } from "@mui/material";
import CountUp from "react-countup";
import AnimatedGPUIcon from "./AnimatedGpuIcon";


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

    const stopYagna = async () => {
        const response = await backendFetch(`/api/yagna/stop`, {
            method: "Post",
        });
        const data = await response.text();
        console.log("Stop runner result: ", data);
    };

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

                <div className={"worker-card-main"}>

                </div>
                <Button disabled={yagnaInfo?.status == "started"} onClick={() => startYagna()}>
                    Start
                </Button>
            </div>

        </div>
    );
};

export default Golems;
