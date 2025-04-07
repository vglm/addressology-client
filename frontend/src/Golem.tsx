import React, { useEffect, useState } from "react";
import { backendFetch } from "./common/BackendCall";
import { Button } from "@mui/material";
import "./Golem.css";
import JsonView from "react18-json-view";
import "react18-json-view/src/style.css";

interface YagnaInfo {
    status: string;
}
interface ProviderInfo {
    status: string;
}

interface ActivityDetails {
    activityId: string;
    agreementJson: any;
    log: string;
}

const Golems = () => {
    const [yagnaInfo, setYagnaInfo] = useState<YagnaInfo | null>(null);
    const [providerInfo, setProviderInfo] = useState<ProviderInfo | null>(null);
    const [updateNo, setUpdateNo] = useState(0);
    const [offers, setOffers] = useState<string>();
    const [activityDetails, setActivityDetails] = useState<ActivityDetails | null>();
    const [activityTrackingHistory, setActivityTrackingHistory] = useState<any | null>();

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
    };

    const getActivityTrackingHistory = async () => {
        const response = await backendFetch("/api/provider/activity/all", {
            method: "Get",
        });
        const activityTrackingHistory = await response.json();
        console.log("Activity tracking history: ", activityTrackingHistory);
        setActivityTrackingHistory(activityTrackingHistory);
    }

    const getActivityDetails = async () => {
        const response = await backendFetch("/api/provider/activity/details", {
            method: "Get",
        });
        const activityDetails = await response.json();
        setActivityDetails(activityDetails);
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
                    {offers && <JsonView src={offers} />}
                    <Button onClick={() => getActivityDetails()}>Get activity details</Button>
                    <Button onClick={() => getActivityTrackingHistory()}>Get activity tracking history</Button>
                    {activityTrackingHistory && <JsonView src={activityTrackingHistory} />}
                    {activityDetails?.log && <textarea value={activityDetails?.log}></textarea>}
                    {activityDetails?.agreementJson && <JsonView src={activityDetails.agreementJson} />}
                </div>
            </div>
        </div>
    );
};

export default Golems;
