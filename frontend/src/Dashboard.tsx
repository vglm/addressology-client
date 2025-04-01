import React from "react";

import { Routes, Route } from "react-router-dom";
import MyWorkers from "./Workers";
import Golem from "./Golem";

const Dashboard = () => {
    return (
        <div className="main-page">
            <div className="top-header"></div>
            <div className="main-content">
                <Routes>
                    <Route
                        path="/"
                        element={
                            <div>
                                <MyWorkers />
                                <Golem  />
                            </div>
                        }
                    />
                </Routes>
            </div>
        </div>
    );
};

export default Dashboard;
