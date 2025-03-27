import React, { useEffect, useState } from "react";
import "./Workers.css";
import { backendFetch } from "./common/BackendCall";
import { Runner } from "./model/Contract";
import { Button } from "@mui/material";

const MyWorkers = () => {
    const [runners, setRunners] = useState<Runner[]>([]);

    const getRunners = async () => {
        const response = await backendFetch("/api/runners", {
            method: "Get",
        });
        const runners = await response.json();
        setRunners(runners);
    };

    const startRunner = async (runnerNo: number) => {
        const response = await backendFetch(`/api/runner/${runnerNo}/start`, {
            method: "Post",
        });
        const data = await response.text();
        console.log("Start runner result: ", data);
        getRunners();
    };

    const stopRunner = async (runnerNo: number) => {
        const response = await backendFetch(`/api/runner/${runnerNo}/stop`, {
            method: "Post",
        });
        const data = await response.text();
        console.log("Stop runner result: ", data);
        getRunners();
    };

    useEffect(() => {
        getRunners();
        const interval = setInterval(getRunners, 5000); // Refresh every 5 seconds
        return () => clearInterval(interval); // Cleanup on unmount
    }, []);

    return (
        <div>
            <h1>My Runner</h1>
            {runners.map((runner) => (
                <div key={runner.data.runnerNo}>
                    {runner.data.runnerNo}
                    <div>
                        <div>Found addresses:</div>
                        <div>{runner.data.foundAddressesCount}</div>
                    </div>
                    <Button disabled={runner.started} onClick={() => startRunner(runner.data.runnerNo)}>
                        Start runner
                    </Button>
                    <Button disabled={!runner.started} onClick={() => stopRunner(runner.data.runnerNo)}>
                        Stop runner
                    </Button>
                </div>
            ))}
        </div>
    );
};

export default MyWorkers;