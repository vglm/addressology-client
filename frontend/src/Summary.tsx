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
};

export default Summary;
