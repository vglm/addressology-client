import React, { useEffect } from "react";

import { backendFetch } from "./common/BackendCall";
import { Aggregate, AggregateSummary, analyze_aggregates, analyze_summaries } from "./logic/Accounting";

import { Alias } from "./logic/Alias";

import "./Outgoings.css";
import "./Summary.css";
import { getYearFromLocalStorageOrCurrent, useScans } from "./providers/CommonProvider";

import { useNavigate } from "react-router-dom";

const getFirstDayInMonth = (year: number, month: number) => {
    return new Date(Date.UTC(year, month - 1, 1));
};
const getLastDayInMonth = (year: number, month: number) => {
    const firstDay = getFirstDayInMonth(year, month);
    return new Date(firstDay.setUTCMonth(firstDay.getUTCMonth() + 1));
};

const Summary = () => {
    const [year, setYearInt] = React.useState(getYearFromLocalStorageOrCurrent());
    const setYear = (year: number) => {
        localStorage.setItem("year", year.toString());
        setYearInt(year);
    };
    const navigate = useNavigate();
    const firstDayInYear = getFirstDayInMonth(year, 1);
    const lastDayInYear = getLastDayInMonth(year, 12);
    lastDayInYear.setTime(lastDayInYear.getTime() - 1);

    const [aliases, setAliases] = React.useState<Alias[]>([]);
    const [currency, setCurrency] = React.useState("ETH");
    const [blocks, setBlocks] = React.useState<Map<string, Array<Aggregate>>>(new Map());
    const [loading, setLoading] = React.useState(false);
    const scanInfo = useScans();

    const getAliases = async () => {
        const response = await backendFetch("/api/scan/aliases", {
            method: "Get",
        });
        const aliases = await response.json();
        setAliases(aliases);
    };
    const getAggregates = async () => {
        setBlocks(new Map());
        const blocksMap = new Map();
        for (const scan of scanInfo.scans) {
            const address = scan.address;
            const url = `/api/scan/${address}/aggregates`;
            const response = await backendFetch(url, {
                method: "Get",
            });
            const data = await response.json();
            const blocks = data["aggregates"];
            blocksMap.set(address, blocks);
        }
        setBlocks(blocksMap);
        setLoading(false);
    };

    useEffect(() => {
        getAliases().then();
    }, []);

    useEffect(() => {
        console.log("Scans changed - updating {}", scanInfo.scans.length);
        if (scanInfo.scans.length == 0) {
            return;
        }
        getAggregates().then();
    }, [scanInfo.scans]);

    const summaries = new Map();
    for (const blocks1 of blocks.values()) {
        const addr = blocks1[0]?.address ?? "";
        const aggregates_result = analyze_aggregates(addr, blocks1, year);
        const summary = aggregates_result.summary;
        //const entries = aggregates_result.aggregates;
        summaries.set(summary.address, summary);
    }

    const valuesUnsorted = Array.from(summaries.values());
    const values = valuesUnsorted.sort((a, b) => {
        return a.address.localeCompare(b.address);
    });
    const total = analyze_summaries(values);

    function rowClass(aggr: AggregateSummary): string {
        if (aggr.totalCheckZero != BigInt(0)) {
            return "unbalanced";
        }
        return "check-ok-unfinished";
    }


    const renderAggregateEntry = (idx: number, block: AggregateSummary) => {

    };

    return (
        <div className={"content-main"}>
            Summary
        </div>
    );
};

export default Summary;
