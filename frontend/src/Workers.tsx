import React, {useCallback, useEffect, useRef, useState} from "react";
import "./Workers.css";
import { backendFetch } from "./common/BackendCall";
import { Runner } from "./model/Contract";
import { Box, Button, Card, CardContent } from "@mui/material";
import CountUp from "react-countup";
import { motion } from "framer-motion";

interface GpuIconProps {
    targetSpeed: number;
}
const AnimatedGPUIcon = (gpuProps: GpuIconProps) => {
    const speedRef = useRef(1);
    const rotationLeft = useRef(0);
    const rotationRight = useRef(0);
    const lastTimeRef = useRef(0);

    const animationRef = useRef<number | null>(null);
    const [rerenderNo, setRerenderNo] = useState(0);


    useEffect(() => {
        const animate = (time: number) => {
            const deltaTime = time - lastTimeRef.current;
            lastTimeRef.current = time;
            if (deltaTime > 1000) {
                animationRef.current = requestAnimationFrame(animate);
                return;
            }
            rotationLeft.current = (rotationLeft.current + speedRef.current * 0.008 * deltaTime) % 360;
            rotationRight.current = (rotationRight.current + speedRef.current * 0.008 * 1.1 * deltaTime) % 360;

            const prev = speedRef.current;
            if (prev - gpuProps.targetSpeed > 0.0) {
                speedRef.current = prev - Math.min(prev - gpuProps.targetSpeed, 0.05 * deltaTime);
            } else {
                speedRef.current = prev + Math.min(gpuProps.targetSpeed - prev, 0.05 * deltaTime);
            }
            setRerenderNo((prev)=> prev + 1);
            animationRef.current = requestAnimationFrame(animate);
        }

        animationRef.current = requestAnimationFrame(animate);
        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        }
    }, [gpuProps.targetSpeed]);

    return (
        <div style={{ display: "flex", justifyContent: "center" }   }>
            <div style={{position:"relative", width: 180, height: 100}}>
                <div style={{position: "absolute"}}>
                    <img width={250} src={`gpu.svg`} />
                </div>
                <div style={{position: "absolute", left: 33.5, top: 20.5}}>
                    <svg width="55" height="55" viewBox="0 0 99.902439 99.243902" style={{ transform: `rotate(${rotationLeft.current}deg)` }}>
                        <path
                            xmlns="http://www.w3.org/2000/svg"
                            className="cls-1"
                            d="m 53.815238,66.792161 c -0.08673,1.032236 -0.205039,2.064471 -0.370644,3.096709 -1.127703,7.146256 -4.566002,11.386364 -6.371894,17.603603 -2.160779,7.527388 5.188988,10.767018 11.458374,10.346188 a 29.67507,29.879281 0 0 0 9.250298,-2.382085 35.487054,35.731268 0 0 0 7.349762,-4.255992 C 90.989907,79.448967 87.748775,63.489006 70.312777,54.389444 a 11.829018,11.910419 0 0 0 -3.264809,-1.11164 17.349226,17.468617 0 0 1 -4.73161,8.789888 v 0 a 17.420205,17.540078 0 0 1 -8.50112,4.724469 z M 49.958973,36.079153 A 13.485085,13.577879 0 1 1 36.473885,49.657037 13.485085,13.577879 0 0 1 49.958973,36.079153 Z M 67.04008,46.091848 c 0.99364,0.03971 1.995165,0.111164 2.988805,0.230271 7.144723,0.794025 11.497778,4.097184 17.743552,5.6376 7.570543,1.865962 10.46477,-5.693185 9.786553,-11.981889 A 29.470037,29.672829 0 0 0 94.759433,30.790924 35.763072,36.009173 0 0 0 90.21713,23.581151 C 77.851809,8.1134833 62.166527,12.083624 53.901978,30.052481 a 11.150816,11.227556 0 0 0 -0.788601,2.334444 17.349226,17.468617 0 0 1 9.147781,4.851507 v 0 a 17.404428,17.524202 0 0 1 4.731609,8.837535 z M 45.826706,32.59337 c 0,-1.270442 0.102519,-2.548827 0.24446,-3.819278 0.7886,-7.201831 4.037647,-11.592805 5.520213,-17.88151 C 53.476134,3.2619724 45.95288,0.3717096 39.715044,1.0704544 a 29.493688,29.696653 0 0 0 -9.124122,2.83468 35.15585,35.397772 0 0 0 -7.144726,4.5894834 C 8.1394436,20.97674 12.098226,36.762017 29.928499,45.043734 A 11.53724,11.616631 0 0 0 32.893638,45.948922 17.443865,17.563902 0 0 1 45.826706,32.59337 Z M 32.814784,52.912549 a 41.094018,41.376805 0 0 1 -4.5108,-0.190565 C 21.14348,52.023236 16.735206,48.815362 10.46582,47.378174 2.8637009,45.631314 0.09570966,53.246045 0.87642443,59.518865 a 29.533114,29.736353 0 0 0 2.94936947,9.139264 35.534382,35.778907 0 0 0 4.6606344,7.146252 C 21.104058,91.025897 36.718357,86.817551 44.69112,68.729587 A 12.562422,12.648868 0 0 0 45.385091,66.617476 17.467518,17.587719 0 0 1 32.814784,52.912549 Z"
                        />
                    </svg>
                </div>
                <div style={{position: "absolute", left: 104.5, top: 20.5}}>
                    <svg width="55" height="55" viewBox="0 0 99.902439 99.243902"  style={{ transform: `rotate(${rotationRight.current}deg)` }}>
                        <path
                            xmlns="http://www.w3.org/2000/svg"
                            className="cls-1"
                            d="m 53.815238,66.792161 c -0.08673,1.032236 -0.205039,2.064471 -0.370644,3.096709 -1.127703,7.146256 -4.566002,11.386364 -6.371894,17.603603 -2.160779,7.527388 5.188988,10.767018 11.458374,10.346188 a 29.67507,29.879281 0 0 0 9.250298,-2.382085 35.487054,35.731268 0 0 0 7.349762,-4.255992 C 90.989907,79.448967 87.748775,63.489006 70.312777,54.389444 a 11.829018,11.910419 0 0 0 -3.264809,-1.11164 17.349226,17.468617 0 0 1 -4.73161,8.789888 v 0 a 17.420205,17.540078 0 0 1 -8.50112,4.724469 z M 49.958973,36.079153 A 13.485085,13.577879 0 1 1 36.473885,49.657037 13.485085,13.577879 0 0 1 49.958973,36.079153 Z M 67.04008,46.091848 c 0.99364,0.03971 1.995165,0.111164 2.988805,0.230271 7.144723,0.794025 11.497778,4.097184 17.743552,5.6376 7.570543,1.865962 10.46477,-5.693185 9.786553,-11.981889 A 29.470037,29.672829 0 0 0 94.759433,30.790924 35.763072,36.009173 0 0 0 90.21713,23.581151 C 77.851809,8.1134833 62.166527,12.083624 53.901978,30.052481 a 11.150816,11.227556 0 0 0 -0.788601,2.334444 17.349226,17.468617 0 0 1 9.147781,4.851507 v 0 a 17.404428,17.524202 0 0 1 4.731609,8.837535 z M 45.826706,32.59337 c 0,-1.270442 0.102519,-2.548827 0.24446,-3.819278 0.7886,-7.201831 4.037647,-11.592805 5.520213,-17.88151 C 53.476134,3.2619724 45.95288,0.3717096 39.715044,1.0704544 a 29.493688,29.696653 0 0 0 -9.124122,2.83468 35.15585,35.397772 0 0 0 -7.144726,4.5894834 C 8.1394436,20.97674 12.098226,36.762017 29.928499,45.043734 A 11.53724,11.616631 0 0 0 32.893638,45.948922 17.443865,17.563902 0 0 1 45.826706,32.59337 Z M 32.814784,52.912549 a 41.094018,41.376805 0 0 1 -4.5108,-0.190565 C 21.14348,52.023236 16.735206,48.815362 10.46582,47.378174 2.8637009,45.631314 0.09570966,53.246045 0.87642443,59.518865 a 29.533114,29.736353 0 0 0 2.94936947,9.139264 35.534382,35.778907 0 0 0 4.6606344,7.146252 C 21.104058,91.025897 36.718357,86.817551 44.69112,68.729587 A 12.562422,12.648868 0 0 0 45.385091,66.617476 17.467518,17.587719 0 0 1 32.814784,52.912549 Z"
                        />
                    </svg>
                </div>
            </div>
        </div>
    );
};

interface MyWorkerProps {
    runner: Runner;
    startRunner: (runnerNo: number) => void;
    stopRunner: (runnerNo: number) => void;
    enableRunner: (runnerNo: number) => void;
    disableRunner: (runnerNo: number) => void;
    startRunnerBenchmark: (runnerNo: number) => void;
}

const MyWorker = (props: MyWorkerProps) => {
    const [countUpDuration, setCountUpDuration] = useState(5.0);

    const totalComputed = useRef(props.runner.data.totalComputed || 0);
    const reportedSpeed = useRef(props.runner.data.reportedSpeed || 0);
    const queueLen = useRef(props.runner.queueLen || 0);
    const foundAddressesCount = useRef(props.runner.data.foundAddressesCount || 0);

    return (
        <div key={props.runner.data.runnerNo}>
            {props.runner.data.runnerNo}

            <div>
                <AnimatedGPUIcon targetSpeed={props.runner.started ? 100: 0} />
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
    const [countUpDuration, setCountUpDuration] = useState(0.0001);
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
            if (updateNo > 5) {
                setCountUpDuration(5);
            }
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
