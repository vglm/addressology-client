import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { BrowserRouter } from "react-router-dom";
import { LoginProvider } from "./LoginProvider";
import Dashboard from "./Dashboard";

const rootEl = document.getElementById("root");
if (!rootEl) {
    throw new Error("No root element found");
}
const root = ReactDOM.createRoot(rootEl);

root.render(
    <React.StrictMode>
        <BrowserRouter basename={"dashboard"}>
            <LoginProvider>
                <Dashboard />
            </LoginProvider>
        </BrowserRouter>
    </React.StrictMode>,
);
