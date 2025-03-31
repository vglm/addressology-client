import React, { useEffect, useRef, useState } from "react";
import "./Workers.css";
import { backendFetch } from "./common/BackendCall";
import { Runner } from "./model/Contract";
import { Button } from "@mui/material";
import CountUp from "react-countup";
import AnimatedGPUIcon from "./AnimatedGpuIcon";


interface MyWorkerProps {
    runner: Runner;
    startRunner: (runnerNo: number) => void;
    stopRunner: (runnerNo: number) => void;
    enableRunner: (runnerNo: number) => void;
    disableRunner: (runnerNo: number) => void;
    startRunnerBenchmark: (runnerNo: number) => void;
}

const MyWorker = (props: MyWorkerProps) => {
    const [countUpDuration, _setCountUpDuration] = useState(5.0);

    const totalComputed = useRef(props.runner.data.totalComputed || 0);
    const reportedSpeed = useRef(props.runner.data.reportedSpeed || 0);
    const queueLen = useRef(props.runner.queueLen || 0);
    const foundAddressesCount = useRef(props.runner.data.foundAddressesCount || 0);

    return (
        <div key={props.runner.data.runnerNo}>
            {props.runner.data.runnerNo}

            <div className={"worker-card-main"}>
                <div className={"worker-card-top"}>
                    <AnimatedGPUIcon targetSpeed={props.runner.started ? 100 : 0} enabled={props.runner.enabled} />
                    <div>
                        <div className={"worker-card-gpu-name"}>GPU/CUDA worker no {props.runner.data.runnerNo}</div>
                        <div className={"worker-card-gpu-model"}>Model detected: {props.runner.data.deviceName}</div>
                    </div>
                </div>
                <div className={"worker-card-box-holder"}>
                    <div className={"worker-card-box"}>
                        <div className={"worker-card-box-header"}>Found Addresses</div>
                        <div className={"worker-card-box-value"}>
                            <CountUp
                                preserveValue={true}
                                useGrouping={false}
                                start={foundAddressesCount.current}
                                end={props.runner.data.foundAddressesCount || 0}
                                duration={countUpDuration}
                            />
                        </div>
                    </div>
                    <div className={"worker-card-box"}>
                        <div className={"worker-card-box-header"}>Current speed</div>
                        <div className={"worker-card-box-value"}>
                            <div>
                                <CountUp
                                    preserveValue={true}
                                    useGrouping={false}
                                    start={reportedSpeed.current}
                                    end={props.runner.data.reportedSpeed || 0}
                                    duration={countUpDuration}
                                />
                                MH/s
                            </div>
                        </div>
                    </div>
                    <div className={"worker-card-box"}>
                        <div className={"worker-card-box-header"}>Queue len</div>
                        <div className={"worker-card-box-value"}>
                            <div>
                                {" "}
                                <CountUp
                                    preserveValue={true}
                                    useGrouping={false}
                                    start={queueLen.current}
                                    end={props.runner.queueLen || 0}
                                    duration={countUpDuration}
                                />
                            </div>
                        </div>
                    </div>
                    <div className={"worker-card-box"}>
                        <div className={"worker-card-box-header"}>Computed GH</div>
                        <div className={"worker-card-box-value"}>
                            <div>
                                <CountUp
                                    decimals={2}
                                    preserveValue={true}
                                    useGrouping={false}
                                    start={totalComputed.current}
                                    end={props.runner.data.totalComputed || 0}
                                    duration={countUpDuration}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <Button disabled={props.runner.started} onClick={() => props.startRunner(props.runner.data.runnerNo)}>
                Start
            </Button>
            <Button disabled={!props.runner.started} onClick={() => props.stopRunner(props.runner.data.runnerNo)}>
                Stop
            </Button>
            <Button disabled={props.runner.enabled} onClick={() => props.enableRunner(props.runner.data.runnerNo)}>
                Enable
            </Button>
            <Button disabled={!props.runner.enabled} onClick={() => props.disableRunner(props.runner.data.runnerNo)}>
                Disable
            </Button>
            <Button
                disabled={props.runner.started}
                onClick={() => props.startRunnerBenchmark(props.runner.data.runnerNo)}
            >
                Benchmark
            </Button>
        </div>
    );
};

const MyWorkers = () => {
    const [runners, setRunners] = useState<Runner[]>([]);
    const [updateNo, setUpdateNo] = useState(0);

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
    const enableRunner = async (runnerNo: number) => {
        const response = await backendFetch(`/api/runner/${runnerNo}/enable`, {
            method: "Post",
        });
        const data = await response.text();
        console.log("Start runner result: ", data);
        getRunners();
    };
    const disableRunner = async (runnerNo: number) => {
        const response = await backendFetch(`/api/runner/${runnerNo}/disable`, {
            method: "Post",
        });
        const data = await response.text();
        console.log("Start runner result: ", data);
        getRunners();
    };
    const startRunnerBenchmark = async (runnerNo: number) => {
        const response = await backendFetch(`/api/runner/${runnerNo}/benchmark/start`, {
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
    }, [updateNo]);

    useEffect(() => {
        setTimeout(() => {
            setUpdateNo(updateNo + 1);
        }, 1000);
    }, [updateNo]);

    return (
        <div>
            <h1>My Runner</h1>
            {runners.length === 0 && <div>No runners found</div>}
            {runners.map((runner) => (
                <div key={runner.data.runnerNo}>
                    <MyWorker
                        runner={runner}
                        startRunner={startRunner}
                        stopRunner={stopRunner}
                        enableRunner={enableRunner}
                        disableRunner={disableRunner}
                        startRunnerBenchmark={startRunnerBenchmark}
                    />
                </div>
            ))}
        </div>
    );
};

export default MyWorkers;
