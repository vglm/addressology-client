import React, { useState } from "react";
import AnimatedGPUIcon from "./AnimatedGpuIcon";
import { Button } from "@mui/material";

const AnimatedGPUIconTester = () => {
    const [targetSpeed, setTargetSpeed] = useState(0);
    return (
        <div style={{ margin: "auto", width: 200, height: 200, padding: 30 }}>
            <AnimatedGPUIcon targetSpeed={targetSpeed} enabled={true} />

            <Button onClick={() => setTargetSpeed(100)}>Start Gpu</Button>
            <Button onClick={() => setTargetSpeed(70)}>Start Gpu 70%</Button>
            <Button onClick={() => setTargetSpeed(50)}>Start Gpu 50%</Button>
            <Button onClick={() => setTargetSpeed(0)}>Stop Gpu</Button>
        </div>
    );
};

export default AnimatedGPUIconTester;
