import React, { useEffect, useRef, useState } from "react";
import { Button, Checkbox, FormControlLabel, TextField } from "@mui/material";
import { useLoginOrNull } from "./LoginProvider";
import { backendFetch } from "./common/BackendCall";

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface LoginScreenProps {}

const ChangePassScreen = (_props: LoginScreenProps) => {
    const loginInformation = useLoginOrNull();

    const [loginErrorMessage, setLoginErrorMessage] = useState<string>("");
    const [_frameCount, setFrameCount] = useState<DOMHighResTimeStamp>(0); // State to track the current frame count
    const requestRef = useRef<number>(); // Holds the requestAnimationFrame id
    const previousTimeRef = useRef<DOMHighResTimeStamp>(); // Holds the previous timestamp

    const urlParams = new URLSearchParams(window.location.search);
    const reset_token = urlParams.get("reset_token");
    const email_from_url = urlParams.get("email");

    // Animation function that gets called every frame
    const animate = (time: DOMHighResTimeStamp) => {
        if (previousTimeRef.current != undefined) {
            // Calculate the elapsed time between frames
            const _deltaTime = time - previousTimeRef.current;

            //Or if you want to update after a specific time (e.g. 60 frames per second)
            //if (deltaTime > 1000 / 60) { // for 60 FPS
            setFrameCount((prevCount) => prevCount + 1);
            //}
        }

        previousTimeRef.current = time; // Update the previous timestamp for the next frame
        requestRef.current = requestAnimationFrame(animate); // Request the next frame
    };
    useEffect(() => {
        requestRef.current = requestAnimationFrame(animate);

        return () => cancelAnimationFrame(requestRef.current ?? 0); // Cleanup the animation loop on unmount
    }, []); // Empty array to run only once on mount

    const [passwordChangedSuccess, setPasswordChangedSuccess] = useState<boolean>(false);
    const [changPassInProgress, setChangPassInProgress] = useState<boolean>(false);

    const currentWidth = useRef<number>(window.innerWidth);
    const currentHeight = useRef<number>(window.innerHeight);

    const targetX = window.innerWidth;
    const targetY = window.innerHeight;

    const newWidth = currentWidth.current + (targetX - currentWidth.current) * 0.1;
    const newHeight = currentHeight.current + (targetY - currentHeight.current) * 0.1;

    const [password, setPassword] = useState<string>("");
    const [newPassword, setNewPassword] = useState<string>("");
    const [passwordRepeat, setPasswordRepeat] = useState<string>("");

    currentWidth.current = newWidth;
    currentHeight.current = newHeight;
    const [showPassword, setShowPassword] = useState<boolean>(false);

    const setPassAction = async () => {
        setChangPassInProgress(true);

        setLoginErrorMessage("");
        if (!showPassword && newPassword !== passwordRepeat) {
            setLoginErrorMessage("Passwords do not match");
            setChangPassInProgress(false);
            return;
        }
        const response = await backendFetch("/api/set_pass", {
            method: "POST",
            body: JSON.stringify({
                email: email_from_url,
                token: reset_token,
                newPassword: newPassword,
            }),
        });
        if (response.status === 401) {
            const data = await response.text();
            setLoginErrorMessage("Wrong user or password: " + data);
            setChangPassInProgress(false);
            return;
        }
        const data = await response.text();

        if (response.status === 400) {
            setLoginErrorMessage(data);
        }
        if (response.status === 200) {
            setPasswordChangedSuccess(true);
            setTimeout(() => {
                window.location.href = "/dashboard/login";
            }, 2000);
        }
        console.log("change pass data:", data);
        //window.location.href = "/";
        setChangPassInProgress(false);
    };

    const changePassAction = async () => {
        if (email_from_url || reset_token) {
            return await setPassAction();
        }
        setChangPassInProgress(true);

        setLoginErrorMessage("");
        if (!showPassword && newPassword !== passwordRepeat) {
            setLoginErrorMessage("Passwords do not match");
            setChangPassInProgress(false);
            return;
        }
        const response = await backendFetch("/api/change_pass", {
            method: "POST",
            body: JSON.stringify({
                email: loginInformation.loginData?.email ?? "",
                oldPassword: password,
                newPassword: newPassword,
            }),
        });
        if (response.status === 401) {
            setLoginErrorMessage("Wrong user or password");
            setChangPassInProgress(false);
            return;
        }
        const data = await response.text();

        if (response.status === 400) {
            setLoginErrorMessage(data);
        }
        if (response.status === 200) {
            setPasswordChangedSuccess(true);
            setTimeout(() => {
                window.location.href = "/dashboard/login";
            }, 2000);
        }
        console.log("change pass data:", data);
        //window.location.href = "/";
        setChangPassInProgress(false);
    };

    const divX = newWidth / 10;
    const divY = newHeight / 15 + 100;
    const maxScaleWidth = 1200;
    const minScaleWidth = 300;
    const scaleWidth = Math.max(Math.min(newWidth, maxScaleWidth), minScaleWidth);
    const fontSizeTitleComputed = 10 + scaleWidth / 20;
    return (
        <div
            style={{
                overflow: "hidden",
                position: "absolute",
                left: 0,
                top: 0,
                zIndex: -100,
                width: window.innerWidth - 20,
                height: window.innerHeight - 20,
            }}
        >
            <div
                style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    zIndex: -100,
                    width: currentWidth.current,
                    height: currentHeight.current,
                }}
            >
                <div
                    className="welcome-box-title"
                    style={{ left: divX, top: divY, display: "flex", flexDirection: "column", position: "absolute" }}
                >
                    {passwordChangedSuccess ? (
                        <div>Password changed successfully. Login again</div>
                    ) : (
                        <div className="welcome-box-title" style={{ marginBottom: 10, fontSize: 20 }}>
                            Change password
                            <br />
                            {email_from_url
                                ? email_from_url
                                : loginInformation.loginData && <span>{loginInformation.loginData.email}</span>}
                            <div style={{ marginBottom: 10, fontSize: fontSizeTitleComputed * 0.4 }}>
                                <div className={"login-error-msg"}>{loginErrorMessage}</div>
                                {!email_from_url && (
                                    <div style={{ marginTop: 15 }}>
                                        <TextField
                                            slotProps={{
                                                inputLabel: {
                                                    shrink: true,
                                                },
                                            }}
                                            label={"Current Password"}
                                            disabled={changPassInProgress}
                                            value={password}
                                            autoComplete="current-password"
                                            onChange={(e) => setPassword(e.target.value)}
                                            type={showPassword ? "text" : "password"}
                                            style={{ width: 350 }}
                                        ></TextField>
                                    </div>
                                )}
                                <div style={{ marginTop: 15 }}>
                                    <TextField
                                        slotProps={{
                                            inputLabel: {
                                                shrink: true,
                                            },
                                        }}
                                        label={"New Password"}
                                        disabled={changPassInProgress}
                                        value={newPassword}
                                        autoComplete="new-password"
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        type={showPassword ? "text" : "password"}
                                        style={{ width: 350 }}
                                    ></TextField>
                                </div>
                                <div style={{ marginTop: 15, display: showPassword ? "none" : "block" }}>
                                    <TextField
                                        slotProps={{
                                            inputLabel: {
                                                shrink: true,
                                            },
                                        }}
                                        label={"Repeat New Password"}
                                        disabled={changPassInProgress}
                                        value={passwordRepeat}
                                        autoComplete="new-password"
                                        onChange={(e) => setPasswordRepeat(e.target.value)}
                                        type={"password"}
                                        style={{ width: 350 }}
                                    ></TextField>
                                </div>
                                <div style={{ marginTop: 10, paddingLeft: 10 }}>
                                    <FormControlLabel
                                        label="Show password"
                                        control={
                                            <Checkbox
                                                onChange={(e) => setShowPassword(e.target.checked)}
                                                disabled={changPassInProgress}
                                                inputProps={{ "aria-label": "controlled" }}
                                            />
                                        }
                                    />
                                </div>
                                <div style={{ marginTop: 15 }}>
                                    <Button disabled={changPassInProgress} onClick={() => changePassAction()}>
                                        Submit
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChangePassScreen;
