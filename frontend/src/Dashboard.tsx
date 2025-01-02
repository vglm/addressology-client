import React from "react";

import { Routes, Route, Link, useNavigate, useLocation } from "react-router-dom";
import LoginScreen from "./LoginScreen";
//import { LoginStatus, useLoginEvent, useLoginOrNull } from "./LoginProvider";
import { Avatar, Button, Menu, MenuItem } from "@mui/material";
import { backendFetch } from "./common/BackendCall";
import Blocks from "./Blocks";
import ChangePassScreen from "./ChangePassScreen";
import Transactions from "./Transactions";
import Aggregates from "./Aggregates";
import Aliases from "./Aliases";
import Summary from "./Summary";
import Charts from "./Charts";
import DailyCharts from "./DailyCharts";

const Dashboard = () => {
    //const loginInformation = useLoginOrNull();
    const navigate = useNavigate();

    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const urlParams = new URLSearchParams(window.location.search);
    const reset_token = urlParams.get("reset_token");

    //const isLoggedIn = loginInformation.loginData != null;
    const [_logoutInProgress, setLogoutInProgress] = React.useState(false);
    //const updateLogin = useLoginEvent();

    function getMarginLeft() {
        return Math.max((window.innerWidth - 1500) / 2, 15);
    }
    window.onresize = () => {
        const marginLeft = getMarginLeft();
        document.getElementsByClassName("main-page")[0].setAttribute("style", `margin-left: ${marginLeft}px`);
    };

    const location = useLocation();


    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };
    const handleChangePass = () => {
        window.location.href = "/dashboard/change_pass";
        setAnchorEl(null);
    };

    const handleChangeOrg = (newOrg: string) => {
        localStorage.setItem("organization", newOrg);
        localStorage.removeItem("scans");
        localStorage.removeItem("address");

        window.location.href = "/dashboard";
    };
    const open = Boolean(anchorEl);
    const marginLeft = getMarginLeft();

    return (
        <div className="main-page" style={{ marginLeft: marginLeft }}>
            Main page content
        </div>
    );
};

export default Dashboard;
