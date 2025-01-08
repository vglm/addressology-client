import React, { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { backendFetch } from "./common/BackendCall";

interface LoginData {
    uid: string;
    email: string;
    createdDate: string;
    lastPassChange: string;
}

export enum LoginStatus {
    LOGGED_IN,
    LOGGED_OUT,
    LOGIN_IN_PROGRESS,
}
interface LoginInformation {
    loginData: LoginData | null;
    loginStatus: LoginStatus;
    loginError: string;
}
export default LoginData;

function defaultLoginInformation(): LoginInformation {
    return {
        loginData: null,
        loginStatus: LoginStatus.LOGIN_IN_PROGRESS,
        loginError: "",
    };
}
interface LogEvent {
    loggedIn: LoginData | null;
    loggedOut: boolean | null;
}

export const LoginContext = createContext<LoginInformation>(defaultLoginInformation());
export const LoginEvent = createContext((_e: LogEvent) => {
    console.error("LoginEvent not implemented");
});

export const useLoginEvent = () => useContext(LoginEvent);

export const useLoginOrNull = () => useContext<LoginInformation>(LoginContext);
export const useLogin = () => {
    const value = useLoginOrNull();
    if (!value.loginData) {
        throw new Error("Login not available");
    }
    return value;
};

interface LoginProviderProps {
    children: React.ReactNode;
}

export const LoginProvider = (props: LoginProviderProps) => {
    const [login, setLogin] = useState<LoginInformation>(defaultLoginInformation());
    const navigate = useNavigate();

    const subscribeLoginEvent = (e: LogEvent) => {
        if (e.loggedIn) {
            setLogin({
                loginData: e.loggedIn,
                loginStatus: LoginStatus.LOGGED_IN,
                loginError: "",
            });
            navigate("/");
        } else if (e.loggedOut) {
            setLogin({
                loginData: null,
                loginStatus: LoginStatus.LOGGED_OUT,
                loginError: "",
            });
            navigate("/");
            return;
        } else {
            console.error("Invalid logging event");
            throw new Error("Invalid logging event");
        }
    };
    const greetCheck = async () => {
        const response = await backendFetch("/api/greet", {
            method: "GET",
        });
        const data = await response.json();
        console.log("Web portal backend version:", data.version);
    };

    const [_loginCheckInProgress, setLoginCheckInProgress] = useState(false);
    useEffect(() => {
        (async () => {
            setLoginCheckInProgress(true);
            let loginDataHere: LoginData | null = null;
            try {
                const response = await backendFetch("/api/is_login", {
                    method: "GET",
                });
                if (response.status === 401) {
                    setLogin({
                        loginData: null,
                        loginStatus: LoginStatus.LOGGED_OUT,
                        loginError: "",
                    });
                } else {
                    const data = await response.json();
                    loginDataHere = data;
                    setLogin({
                        loginData: data,
                        loginStatus: LoginStatus.LOGGED_IN,
                        loginError: "",
                    });
                }
            } catch (e) {
                console.error(e);
            }
            if (loginDataHere === null && window.location.pathname !== "/dashboard/login") {
                console.info("Redirecting to login");
                window.location.href = "/dashboard/login";
            }
            setLoginCheckInProgress(false);
        })();
    }, [setLogin]);

    useEffect(() => {
        greetCheck().then();
    }, []);

    return (
        <LoginEvent.Provider value={subscribeLoginEvent}>
            <LoginContext.Provider value={login}>{props.children}</LoginContext.Provider>
        </LoginEvent.Provider>
    );
};
