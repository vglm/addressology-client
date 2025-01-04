import React, {useState} from "react";

import { Routes, Route, Link, useNavigate, useLocation } from "react-router-dom";
import Editor from "react-simple-code-editor";
//@ts-ignore
import { highlight, languages } from 'prismjs/components/prism-core';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-solidity';
import 'prismjs/themes/prism.css'; //Example style, you can use another


const Dashboard = () => {
    //const loginInformation = useLoginOrNull();
    const navigate = useNavigate();
    const [code, setCode] = useState("// SPDX-License-Identifier: UNLICENSED\n" +
        "pragma solidity ^0.8.28;\n" +
        "\n" +
        "// Uncomment this line to use console.log\n" +
        "// import \"hardhat/console.sol\";\n" +
        "\n" +
        "contract Lock {\n" +
        "    uint public unlockTime;\n" +
        "    address payable public owner;\n" +
        "\n" +
        "    event Withdrawal(uint amount, uint when);\n" +
        "\n" +
        "    constructor(uint _unlockTime) payable {\n" +
        "        require(\n" +
        "            block.timestamp < _unlockTime,\n" +
        "            \"Unlock time should be in the future\"\n" +
        "        );\n" +
        "\n" +
        "        unlockTime = _unlockTime;\n" +
        "        owner = payable(msg.sender);\n" +
        "    }\n" +
        "\n" +
        "    function withdraw() public {\n" +
        "        // Uncomment this line, and the import of \"hardhat/console.sol\", to print a log in your terminal\n" +
        "        // console.log(\"Unlock time is %o and block timestamp is %o\", unlockTime, block.timestamp);\n" +
        "\n" +
        "        require(block.timestamp >= unlockTime, \"You can't withdraw yet\");\n" +
        "        require(msg.sender == owner, \"You aren't the owner\");\n" +
        "\n" +
        "        emit Withdrawal(address(this).balance, block.timestamp);\n" +
        "\n" +
        "        owner.transfer(address(this).balance);\n" +
        "    }\n" +
        "}\n" +
        "\n" );

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
            <div style={{
                fontFamily: '"Fira code", "Fira Mono", monospace',
            }}>
                <Editor
                    value={code}
                    onValueChange={(newCode) => setCode(newCode)}
                    padding={10}
                    tabSize={4}
                    highlight={code => highlight(code, languages.solidity)}
                    style={{
                        backgroundColor: "#f5f5f5",
                        border: "1px solid #ddd",
                        borderRadius: "5px",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                        fontSize: "14px",
                        lineHeight: "20px",
                    }}
                />
            </div>
        </div>
    );
};

export default Dashboard;
