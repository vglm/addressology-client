import React, { useEffect } from "react";

import { backendFetch } from "./common/BackendCall";
import { analyze_block_bin_response, BlockBinsSummary } from "./logic/Accounting";
import { Select, MenuItem, FormControlLabel, Checkbox } from "@mui/material";
import { Alias } from "./logic/Alias";
import Blockie from "./Blockie";
import SelectMonth, { getSelectedYearMonth } from "./Month";
import "./Blocks.css";
import { getAddressFromLocalStorage, useScans } from "./providers/CommonProvider";
import Plot from "react-plotly.js";

interface PlotComponentProps {
    summary: BlockBinsSummary | null;
}

const PlotComponent = (props: PlotComponentProps) => {
    const { summary } = props;
    //const [plotFilter, setPlotFilter] = React.useState<PlotFilter>({ blockFrom: 0, blockTo: 999999999999 });

    if (!summary) {
        return <div>Loading...</div>;
    }
    if (summary.all.length == 0) {
        return <div>No blocks found...</div>;
    }
    //const xData = summary.all.map((bin) => bin.startTime);
    //const yDataMev = summary.all.map((bin) => Number(bin.mev) * 1e-18);
    //const yDataWithdrawal = summary.all.map((bin) => Number(bin.withdrawalAmount) * 1e-18);
    //const yDataEpoch = summary.all.map((bin) => Number(bin.epochAvgPerS) * 24 * 3600 * 1e-18);

    const subplots = [];

    const colors = ["red", "green", "blue", "yellow", "purple", "orange", "black", "brown", "pink", "gray"];
    for (const epochNo in summary.byEpoch) {
        const epoch = summary.byEpoch[epochNo];
        const xCurrData = epoch.map((bin) => bin.startTime);
        const avgConsensus = epoch.map((bin) => Number(bin.epochAvgConsensus) * 1e-18);
        subplots.push({
            x: xCurrData,
            y: avgConsensus,
            type: "bar",
            mode: "markers",
            marker: { color: colors[Number(epochNo) % colors.length] },
            name: "AVG consensus " + epochNo,
        });
    }

    return (
        <div>
            <Plot
                //@ts-ignore
                data={[
                    /*{
                        x: xData,
                        y: yDataMev,
                        type: "bar",
                        mode: "lines+markers",
                        marker: { color: "red" },
                        name: "MEV",
                    },
                    {
                        x: xData,
                        y: yDataWithdrawal,
                        type: "bar",
                        mode: "lines+markers",
                        marker: { color: "blue" },
                        name: "MEV",
                    },
                    {
                        x: xData,
                        y: yDataEpoch,
                        type: "bar",
                        mode: "lines+markers",
                        marker: { color: "green" },
                        name: "MEV",
                    },*/
                    ...subplots,
                ]}
                layout={{
                    width: 1320,
                    height: 740,
                    xaxis: {
                        title: "Day no",
                    },
                    yaxis: {
                        title: "Primary Y-Axis",
                        /*,
                        range: [0, 1.5],*/
                    },
                    barmode: "stack",
                }}
            />
        </div>
    );
};

const DailyCharts = () => {
    const [aliases, setAliases] = React.useState<Alias[]>([]);
    const [address, setAddressInt] = React.useState<string | null>(getAddressFromLocalStorage());
    const setAddress = (address: string) => {
        localStorage.setItem("address", address);
        setAddressInt(address);
    };

    const [displayMev, setDisplayMev] = React.useState(true);
    const [displayOutgoing, setDisplayOutgoing] = React.useState(true);
    const [displayIncoming, setDisplayIncoming] = React.useState(true);
    const [displayFishing, setDisplayFishing] = React.useState(true);
    //const [withdrawals, setWithdrawals] = React.useState<ValidatorWithdrawal[]>([]);

    const [currency, setCurrency] = React.useState("ETH");
    const [summary, setSummary] = React.useState<BlockBinsSummary | null>(null);
    const [loading, setLoading] = React.useState(false);
    const scanInfo = useScans();

    const [selectedYear, setSelectedYear] = React.useState<number>(getSelectedYearMonth().selectedYear);
    const [selectedMonth, setSelectedMonth] = React.useState<number>(getSelectedYearMonth().selectedMonth);
    const setSelectedMonthAndYear = (year: number, month: number) => {
        //localstorage
        localStorage.setItem("selectedYear", year.toString());
        localStorage.setItem("selectedMonth", month.toString());
        setSelectedYear(year);
        setSelectedMonth(month);
    };

    const getAliases = async () => {
        const response = await backendFetch("/api/scan/aliases", {
            method: "Get",
        });
        const aliases = await response.json();
        setAliases(aliases);
    };
    const getBlocks = async () => {
        const startTime = new Date().getTime();

        setSummary(null);
        if (selectedYear == null || selectedMonth == null || address == null) {
            return;
        }
        setLoading(true);
        //format firstDay
        //const firstDayString = getFirstDayInMonth(selectedYear, selectedMonth).toISOString().split(".")[0];
        //const lastDayString = getLastDayInMonth(selectedYear, selectedMonth).toISOString().split(".")[0];
        //const url = `/api/scan/${address}/blocks?newer_than=${firstDayString}&older_than=${lastDayString}`;
        const urlBin = `/api/scan/${address}/days`;
        const responseBin = await backendFetch(urlBin, {
            method: "Get",
        });

        const blocksFromApi = await responseBin.json();
        const summ = analyze_block_bin_response(blocksFromApi);
        setSummary(summ);

        setLoading(false);
        console.log("Loading took: ", new Date().getTime() - startTime);
    };

    useEffect(() => {
        getAliases().then();
    }, []);

    useEffect(() => {
        if (scanInfo.scans.length > 0 && address == null) {
            setAddress(scanInfo.scans[0].address);
            return;
        }
        if (scanInfo.scans.length == 0 || selectedYear == null || selectedMonth == null) {
            return;
        }
        getBlocks().then();
    }, [scanInfo.scans, address, selectedYear, selectedMonth]);

    function displayAddress(address: string, type: string | null) {
        const alias = aliases.find((alias) => alias.address === address && (type === null || alias.category === type));
        if (alias) {
            const shortAddr = address.substring(0, 6) + "…" + address.substring(address.length - 4);
            return alias.name + " (" + shortAddr + ")";
        }
        return address;
    }

    if (scanInfo.scans.length == 0) {
        return <div>Loading scans...</div>;
    }
    if (address == null) {
        return <div>Null address...</div>;
    }

    const currentScan = scanInfo.scans.find((scan) => scan.address === address);
    const startRendering = new Date().getTime();

    const fullRender = (
        <div className={"content-main"}>
            <div className={"content-header-selection"}>
                <div className={"blocks-header-select-address"}>
                    <div className={"content-subtitle"}>CHARTS FOR</div>
                    <Blockie address={address} />
                    <Select
                        sx={{ fontFamily: "'Roboto Mono', monospace;" }}
                        value={address ?? ""}
                        onChange={(e) => setAddress(e.target.value)}
                    >
                        {scanInfo.scans.map((scan, idx) => {
                            return (
                                <MenuItem
                                    sx={{ fontFamily: "'Roboto Mono', monospace;" }}
                                    key={idx}
                                    value={scan.address}
                                >
                                    {displayAddress(scan.address, "wallet")}
                                </MenuItem>
                            );
                        })}
                    </Select>
                </div>
                <div style={{ flexGrow: 1 }} />

                <Select sx={{ marginRight: 2 }} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                    <MenuItem value={"ETH"}>ETH</MenuItem>
                    <MenuItem value={"USD"}>USD</MenuItem>
                    <MenuItem value={"EUR"}>EUR</MenuItem>
                    <MenuItem value={"PLN"}>PLN</MenuItem>
                </Select>
                {currentScan && (
                    <SelectMonth
                        startPossibleDate={new Date(currentScan.firstBlockTimestamp)}
                        endPossibleDate={new Date(currentScan.nextBlockTimestamp)}
                        currentYear={selectedYear}
                        currentMonth={selectedMonth}
                        onMonthChanged={(year, month) => setSelectedMonthAndYear(year, month)}
                    />
                )}
            </div>

            <div className={"transactions-filter-row"}>
                <div style={{ fontSize: 20 }}>
                    Displaying {summary?.all?.length ?? 0} blocks of {summary?.all?.length ?? 0}
                </div>
                <div style={{ flexGrow: 1 }}></div>
                <div className={"transaction-display-filters"}>
                    <div>
                        <FormControlLabel
                            disabled={true}
                            control={
                                <Checkbox
                                    checked={displayIncoming}
                                    onChange={(e) => setDisplayIncoming(e.target.checked)}
                                />
                            }
                            label="Incoming"
                        />
                    </div>
                    <div>
                        <FormControlLabel
                            disabled={true}
                            control={
                                <Checkbox
                                    checked={displayOutgoing}
                                    onChange={(e) => setDisplayOutgoing(e.target.checked)}
                                />
                            }
                            label="Outgoing"
                        />
                    </div>
                    <div>
                        <FormControlLabel
                            disabled={true}
                            control={
                                <Checkbox checked={displayMev} onChange={(e) => setDisplayMev(e.target.checked)} />
                            }
                            label="MEV"
                        />
                    </div>
                    <div>
                        <FormControlLabel
                            disabled={true}
                            control={
                                <Checkbox
                                    checked={displayFishing}
                                    onChange={(e) => setDisplayFishing(e.target.checked)}
                                />
                            }
                            label="Spam"
                        />
                    </div>
                </div>
            </div>

            <>{!loading && <PlotComponent summary={summary}></PlotComponent>}</>
        </div>
    );
    console.log("Rendering took: ", new Date().getTime() - startRendering);
    return fullRender;
};

export default DailyCharts;
