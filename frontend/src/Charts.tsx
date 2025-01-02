import React, { useEffect } from "react";

import { backendFetch } from "./common/BackendCall";
import { analyze_blocks, BlocksSummary, ValidatorWithdrawal } from "./logic/Accounting";
import { Select, MenuItem, FormControlLabel, Checkbox, Button, TextField } from "@mui/material";
import { Alias } from "./logic/Alias";
import Blockie from "./Blockie";
import SelectMonth, { getSelectedYearMonth } from "./Month";
import "./Blocks.css";
import { getAddressFromLocalStorage, useScans } from "./providers/CommonProvider";
import { decodeBlocks } from "./providers/BlocksDecoder";
import Plot from "react-plotly.js";

interface PlotFilter {
    blockFrom: number;
    blockTo: number;
}

interface PlotComponentProps {
    summary: BlocksSummary | null;
    withdrawals: ValidatorWithdrawal[];
}

const PlotComponent = (props: PlotComponentProps) => {
    const { summary } = props;
    const [plotFilter, setPlotFilter] = React.useState<PlotFilter>({ blockFrom: 0, blockTo: 999999999999 });

    if (!summary) {
        return <div>Loading...</div>;
    }
    if (summary.blocks.length == 0) {
        return <div>No blocks found...</div>;
    }
    const blocks = summary.blocks.filter(
        (block) => block.blockNumber >= plotFilter.blockFrom && block.blockNumber <= plotFilter.blockTo,
    );
    const withdrawals = props.withdrawals.filter(
        (withdrawal) => withdrawal.blockNumber >= plotFilter.blockFrom && withdrawal.blockNumber <= plotFilter.blockTo,
    );

    const xData = blocks.map((block) => block.blockNumber);
    //const balanceData = summary?.blocks?.map((block) => Number(block.balance) * 1E-18);
    //const mevReward = summary?.blocks?.map((block) => Number(block.mevReward) * 1E-18);

    let aggregateMev = 0.0;
    const aggregateMevArray = [];
    for (let i = 1; i < blocks.length; i++) {
        aggregateMevArray.push(aggregateMev);
        aggregateMev += Number(blocks[i].mevReward) * 1e-18;
    }
    let aggregateBlock = 0.0;
    const aggregateBlockArray = [];
    for (let i = 1; i < blocks.length; i++) {
        aggregateBlockArray.push(aggregateBlock);
        aggregateBlock += Number(blocks[i].blockReward) * 1e-18;
    }
    let consensusBlock = 0.0;
    const consAggr = [];
    for (let i = 1; i < blocks.length; i++) {
        consAggr.push(consensusBlock);
        const consRew = Number(blocks[i].consensusReward) * 1e-18;
        if (consRew > 30) {
            continue;
        }
        consensusBlock += consRew;
    }

    //average consensus

    const maxConsensus = [];
    maxConsensus[0] = 0;
    for (let i = 0; i < blocks.length; i++) {
        maxConsensus[Math.floor(blocks[i].blockNumber / 100)] = consAggr[i];
    }
    for (let i = 1; i < maxConsensus.length; i++) {
        if (maxConsensus[i] == undefined) {
            maxConsensus[i] = maxConsensus[i - 1];
        }
    }
    const avgConsAggrX: number[] = [];
    const avgConsAggrY: number[] = [];
    for (let i = 1; i < maxConsensus.length; i++) {
        if (maxConsensus[i] == 0) {
            continue;
        }
        let cont = false;
        for (let j = 1; j < 300; j++) {
            if (j + i >= maxConsensus.length) {
                break;
            }
            if (maxConsensus[i + j] - maxConsensus[i + j - 1] > 0.1) {
                cont = true;
            }
        }
        if (cont) {
            continue;
        }

        if (maxConsensus[i] - maxConsensus[i - 1] > 0.1) {
            avgConsAggrX.push(i * 100);
            avgConsAggrY.push(maxConsensus[i]);
        }
    }

    const withdrawalsX = [];
    const withdrawalsY = [];
    let aggregateWithdrawals = 0;
    for (let i = 0; i < withdrawals.length; i++) {
        withdrawalsX.push(withdrawals[i].blockNumber);
        aggregateWithdrawals += 1;
        withdrawalsY.push(aggregateWithdrawals);
    }

    return (
        <div>
            <div>
                <TextField
                    value={plotFilter.blockFrom}
                    onChange={(e) =>
                        setPlotFilter({
                            blockFrom: parseInt(e.target.value),
                            blockTo: plotFilter.blockTo,
                        })
                    }
                ></TextField>
                <TextField
                    value={plotFilter.blockTo}
                    onChange={(e) =>
                        setPlotFilter({
                            blockFrom: plotFilter.blockFrom,
                            blockTo: parseInt(e.target.value),
                        })
                    }
                ></TextField>

                <div>{plotFilter.blockTo - plotFilter.blockFrom + 1} blocks</div>
            </div>
            <div>
                <Button
                    onClick={() =>
                        setPlotFilter({
                            blockFrom: plotFilter.blockFrom,
                            blockTo: plotFilter.blockTo - 1000,
                        })
                    }
                >
                    Left 1000
                </Button>
                <Button
                    onClick={() =>
                        setPlotFilter({
                            blockFrom: plotFilter.blockFrom,
                            blockTo: plotFilter.blockTo - 100,
                        })
                    }
                >
                    Left 100
                </Button>
                <Button
                    onClick={() =>
                        setPlotFilter({
                            blockFrom: plotFilter.blockFrom,
                            blockTo: plotFilter.blockTo - 10,
                        })
                    }
                >
                    Left 10
                </Button>
                <Button
                    onClick={() =>
                        setPlotFilter({
                            blockFrom: plotFilter.blockFrom,
                            blockTo: plotFilter.blockTo - 1,
                        })
                    }
                >
                    Left 1
                </Button>
                <Button
                    onClick={() =>
                        setPlotFilter({
                            blockFrom: plotFilter.blockFrom,
                            blockTo: plotFilter.blockTo + 1,
                        })
                    }
                >
                    Right 1
                </Button>
                <Button
                    onClick={() =>
                        setPlotFilter({
                            blockFrom: plotFilter.blockFrom,
                            blockTo: plotFilter.blockTo + 100,
                        })
                    }
                >
                    Right 10
                </Button>
                <Button
                    onClick={() =>
                        setPlotFilter({
                            blockFrom: plotFilter.blockFrom,
                            blockTo: plotFilter.blockTo + 100,
                        })
                    }
                >
                    Right 100
                </Button>
                <Button
                    onClick={() =>
                        setPlotFilter({
                            blockFrom: plotFilter.blockFrom,
                            blockTo: plotFilter.blockTo + 1000,
                        })
                    }
                >
                    Right 1000
                </Button>
            </div>
            <Plot
                data={[
                    {
                        x: xData,
                        y: aggregateMevArray,
                        type: "scatter",
                        mode: "lines+markers",
                        marker: { color: "red" },
                        name: "MEV",
                    },
                    {
                        x: xData,
                        y: aggregateBlockArray,
                        type: "scatter",
                        mode: "lines+markers",
                        marker: { color: "blue" },
                        name: "Block",
                    },
                    {
                        x: xData,
                        y: consAggr,
                        type: "scatter",
                        mode: "lines+markers",
                        marker: { color: "green" },
                        name: "Consensus",
                    },
                    {
                        x: avgConsAggrX,
                        y: avgConsAggrY,
                        type: "scatter",
                        mode: "lines+markers",
                        marker: { color: "black" },
                        name: "Average Consensus",
                    },
                    {
                        x: withdrawalsX,
                        y: withdrawalsY,
                        type: "scatter",
                        mode: "markers",
                        marker: { color: "orange" },
                        name: "Withdrawals",
                        yaxis: "y2",
                    },
                ]}
                layout={{
                    width: 1320,
                    height: 740,
                    xaxis: {
                        title: "Block Number",
                        tickformat: "d",
                    },
                    yaxis: {
                        title: "Primary Y-Axis",
                    },
                    yaxis2: {
                        title: "Secondary Y-Axis",
                        overlaying: "y", // Make it overlay the first y-axis
                        side: "right", // Position it on the right side
                        tickformat: "d",
                    },
                }}
            />
            <div>
                {avgConsAggrX.map((x, idx) => (
                    <div key={idx}>
                        {x} {x - avgConsAggrX[idx - 1]} {avgConsAggrY[idx].toString()}{" "}
                        {avgConsAggrY[idx] - avgConsAggrY[idx - 1]}
                        <button
                            onClick={() =>
                                setPlotFilter({
                                    blockFrom:
                                        avgConsAggrX[idx] - Math.floor((avgConsAggrX[idx] - avgConsAggrX[idx - 1]) / 2),
                                    blockTo:
                                        avgConsAggrX[idx] + Math.floor((avgConsAggrX[idx] - avgConsAggrX[idx - 1]) / 2),
                                })
                            }
                        >
                            Set filter
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

const Charts = () => {
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
    const [withdrawals, setWithdrawals] = React.useState<ValidatorWithdrawal[]>([]);

    const [currency, setCurrency] = React.useState("ETH");
    const [summary, setBlocksSummary] = React.useState<BlocksSummary | null>(null);
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

        setBlocksSummary(null);
        if (selectedYear == null || selectedMonth == null || address == null) {
            return;
        }
        setLoading(true);
        //format firstDay
        //const firstDayString = getFirstDayInMonth(selectedYear, selectedMonth).toISOString().split(".")[0];
        //const lastDayString = getLastDayInMonth(selectedYear, selectedMonth).toISOString().split(".")[0];
        //const url = `/api/scan/${address}/blocks?newer_than=${firstDayString}&older_than=${lastDayString}`;
        const urlBin = `/api/scan/${address}/blocks_bin`;
        const responseBin = await backendFetch(urlBin, {
            method: "Get",
        });

        const binData = await responseBin.arrayBuffer();
        const blocks = decodeBlocks(address, binData);
        const summary = analyze_blocks(blocks);
        setBlocksSummary(summary);
        const valWithdrawals = await backendFetch(`/api/scan/${address}/validator_withdrawals`, {
            method: "Get",
        });
        const valWithdrawalsJson = await valWithdrawals.json();

        setWithdrawals(valWithdrawalsJson);

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
                    Displaying {summary?.blocks?.length ?? 0} blocks of {summary?.blocks?.length ?? 0}
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

            <>{!loading && <PlotComponent summary={summary} withdrawals={withdrawals}></PlotComponent>}</>
        </div>
    );
    console.log("Rendering took: ", new Date().getTime() - startRendering);
    return fullRender;
};

export default Charts;
