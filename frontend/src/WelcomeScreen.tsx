import React from "react";
import { Button } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useLoginOrNull } from "./LoginProvider";

const WelcomeScreen = () => {
    const navigate = useNavigate();
    const login = useLoginOrNull();
    return (
        <div className={"blocks-main"}>
            <div>
                <h2>Welcome {login.loginData?.email ?? ""}</h2>

                <Button onClick={() => navigate("/blocks")}>Go to Blocks</Button>
            </div>
        </div>
    );
};
export default WelcomeScreen;
