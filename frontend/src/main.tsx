import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { BrowserRouter } from "react-router-dom";
import Dashboard from "./Dashboard";
import AnimatedGPUIconTester from "./AnimatedGpuIconTester";

const rootEl = document.getElementById("root");
if (!rootEl) {
    throw new Error("No root element found");
}
const root = ReactDOM.createRoot(rootEl);

root.render(
    <React.StrictMode>
        <BrowserRouter basename={"dashboard"}>
            <Dashboard />
        </BrowserRouter>
    </React.StrictMode>,
);
