import React from "react";
import "./Workers.css";
import { backendFetch } from "./common/BackendCall";
import { useEffect, useState } from "react";
import { Runner } from "./model/Contract";
import { Button } from "@mui/material";

const MyWorkers = () => {
    const [runners, setRunners] = useState<Runner[]>([]);
    //const navigate = useNavigate();

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
        getRunners().then();
    };

    const stopRunner = async (runnerNo: number) => {
        const response = await backendFetch(`/api/runner/${runnerNo}/stop`, {
            method: "Post",
        });
        const data = await response.text();
        console.log("Stop runner result: ", data);
        getRunners().then();
    };
    useEffect(() => {
        getRunners().then();
    }, []);

    return (
        <div>
            <h1>My Runnerc</h1>

            {runners.map((runner) => {
                return (
                    <div key={runner.data.runnerNo}>
                        {runner.data.runnerNo}
                        <div>
                            <div>Found addresses:</div>
                            <div>{runner.data.foundAddressesCount}</div>
                        </div>
                        <Button disabled={runner.started} onClick={(_) => startRunner(runner.data.runnerNo)}>
                            Start runner
                        </Button>
                        <Button disabled={!runner.started} onClick={(_) => stopRunner(runner.data.runnerNo)}>
                            Stop runner
                        </Button>
                    </div>
                );
            })}
        </div>
    );
};

export default MyWorkers;
