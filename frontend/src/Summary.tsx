import React, {useEffect, useState} from "react";

import { backendFetch } from "./common/BackendCall";
import { Aggregate, AggregateSummary, analyze_aggregates, analyze_summaries } from "./logic/Accounting";

import { Alias } from "./logic/Alias";

import "./Outgoings.css";
import "./Summary.css";
import { getYearFromLocalStorageOrCurrent, useScans } from "./providers/CommonProvider";

import { useNavigate } from "react-router-dom";

import Editor from 'react-simple-code-editor';

const getFirstDayInMonth = (year: number, month: number) => {
    return new Date(Date.UTC(year, month - 1, 1));
};
const getLastDayInMonth = (year: number, month: number) => {
    const firstDay = getFirstDayInMonth(year, month);
    return new Date(firstDay.setUTCMonth(firstDay.getUTCMonth() + 1));
};


const Summary = () => {
    const [code, setCode] = useState("// Write your code here...\nconsole.log('Hello, World!');");
    // Function to highlight code using Prism.js

    return (
        <div className={"content-main"}>
            <Editor
                value={code}
                onValueChange={(newCode) => setCode(newCode)}
                padding={10}
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
    );
};

export default Summary;
