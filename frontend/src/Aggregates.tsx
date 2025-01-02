import React, { useEffect } from "react";

import { backendFetch } from "./common/BackendCall";
import { Aggregate, analyze_aggregates, Outgoing } from "./logic/Accounting";
import { Button, MenuItem, Select } from "@mui/material";
import { Alias } from "./logic/Alias";
import Blockie from "./Blockie";
import "./Aggregates.css";
import "./Outgoings.css";
import { getAvailableYears, shortMonth } from "./Month";
import { getAddressFromLocalStorage, getYearFromLocalStorageOrCurrent, useScans } from "./providers/CommonProvider";
import DisplayEther from "./DisplayEth";
import { useNavigate } from "react-router-dom";

const getFirstDayInMonth = (year: number, month: number) => {
    return new Date(Date.UTC(year, month - 1, 1));
};
const getLastDayInMonth = (year: number, month: number) => {
    const firstDay = getFirstDayInMonth(year, month);
    return new Date(firstDay.setUTCMonth(firstDay.getUTCMonth() + 1));
};

const Aggregates = () => {
    const [year, setYearInt] = React.useState(getYearFromLocalStorageOrCurrent());
    const setYear = (year: number) => {
        localStorage.setItem("year", year.toString());
        setYearInt(year);
    };
    const navigate = useNavigate();
    const firstDayInYear = getFirstDayInMonth(year, 1);
    const lastDayInYear = getLastDayInMonth(year, 12);
    lastDayInYear.setTime(lastDayInYear.getTime() - 1);

    const [recomputeResult, setRecomputeResult] = React.useState("");
    const [reloadNo, setReloadNo] = React.useState(0);
    const [aliases, setAliases] = React.useState<Alias[]>([]);
    const [address, setAddressInt] = React.useState<string | null>(getAddressFromLocalStorage());
    const setAddress = (address: string) => {
        localStorage.setItem("address", address);
        setAddressInt(address);
    };
    const [currency, setCurrency] = React.useState("ETH");
    const [blocks, setBlocks] = React.useState<Array<Aggregate>>([]);
    const [recomputing, setRecomputing] = React.useState("");
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
        setBlocks([]);
        if (!address) {
            return;
        }
        setLoading(true);
        const url = `/api/scan/${address}/aggregates`;
        const response = await backendFetch(url, {
            method: "Get",
        });
        const data = await response.json();
        setBlocks(data["aggregates"]);
        setLoading(false);
    };
    useEffect(() => {
        getAliases().then();
    }, []);

    useEffect(() => {
        if (scanInfo.scans.length == 0) {
            return;
        }
        getAggregates().then();
    }, [scanInfo.scans, address, reloadNo]);

    function rowClass(aggr: Aggregate): string {
        if (aggr.yearMonth == recomputing) {
            return "recomputing";
        }
        if (aggr.totalCheckZero != BigInt(0)) {
            return "unbalanced";
        }
        if (aggr.monthFinished) {
            return "check-ok";
        }
        return "check-ok-unfinished";
    }

    const aggregates_result = analyze_aggregates(address ?? "", blocks, year);
    const summary = aggregates_result.summary;
    const entries = aggregates_result.aggregates;

    const renderOutgoingEntry = (aggr: Aggregate, outgoing: Outgoing) => {
        const alias = aliases.find((alias) => alias.address === outgoing.receiverAddr);
        return (
            <tr key={outgoing.yearMonth + "_" + outgoing.receiverAddr}>
                <td>
                    <div className={"header-field"}>{shortMonth(aggr.yearMonth)}</div>
                </td>
                <td className={"numeric"}>
                    <DisplayEther balance={outgoing.amount} inverted={true} currency={currency} />
                </td>
                <td>
                    <div className={"address-field"}>
                        <Blockie address={outgoing.receiverAddr} />
                        <div className={"address-field-content"}>
                            <div className={"address-field-label"}>
                                {alias?.name ?? "Unknown"} ({alias?.category ?? "Unknown"})
                            </div>
                            <div className={"address-field-short-address"}>{outgoing.receiverAddr}</div>
                        </div>
                    </div>
                </td>
            </tr>
        );
    };

    function navigateToBlocks(e: React.MouseEvent<HTMLAnchorElement>, yearMonth: string) {
        localStorage.setItem("selectedYear", yearMonth.split("-")[0]);
        localStorage.setItem("selectedMonth", yearMonth.split("-")[1]);
        navigate("/blocks");
        e.preventDefault();
    }

    const renderAggregateEntry = (idx: number, block: Aggregate) => {
        return (
            <tr key={idx} className={rowClass(block)}>
                <td>
                    <div className={"header-field"}>
                        <a href={"#"} onClick={(e) => navigateToBlocks(e, block.yearMonth)}>
                            {shortMonth(block.yearMonth)}
                        </a>
                    </div>
                </td>
                <td>
                    <div className={"timestamp-field"}>
                        <div>{block.startTs.replace("T", " ")}</div>
                        <div>{block.endTs.replace("T", " ")}</div>
                    </div>
                </td>

                <td>
                    <div className={"block-field"}>
                        <div>
                            <a href={`https://etherscan.io/block/${block.blockStart}`}>{block.blockStart}</a>
                        </div>
                        <div>
                            <a href={`https://etherscan.io/block/${block.blockEnd}`}>{block.blockEnd}</a>
                        </div>
                    </div>
                </td>
                <td>
                    <div className={"balance-field"}>
                        <div>
                            <DisplayEther balance={block.ethStart} inverted={false} currency={currency} />
                        </div>
                        <div>
                            <DisplayEther balance={block.ethEnd} inverted={false} currency={currency} />
                        </div>
                    </div>
                </td>
                <td className={"numeric"}>
                    <DisplayEther balance={block.ethDelta} inverted={false} currency={currency} />
                </td>

                <td className={"numeric"}>
                    <DisplayEther balance={block.ethConsensus} inverted={false} currency={currency} />
                </td>
                <td className={"numeric"}>
                    <DisplayEther balance={block.ethExecution} inverted={false} currency={currency} />
                </td>
                <td className={"numeric"}>
                    <DisplayEther balance={block.ethMev} inverted={false} currency={currency} />
                </td>
                <td className={"numeric"}>
                    <DisplayEther balance={block.ethOther} inverted={false} currency={currency} />
                </td>
                <td className={"numeric"}>
                    <DisplayEther balance={block.totalIncoming} inverted={false} currency={currency} />
                </td>
                <td className={"numeric"}>
                    <DisplayEther balance={block.totalOutgoing} inverted={true} currency={currency} />
                </td>
                <td>
                    {block.outgoings.length == 1 ? (
                        <Blockie address={block.outgoings[0].receiverAddr} />
                    ) : block.outgoings.length == 0 ? (
                        <>None</>
                    ) : (
                        <>Multiple</>
                    )}
                </td>

                <td className={"numeric"}>
                    <DisplayEther balance={block.totalGasPaid} inverted={true} currency={currency} />
                </td>
            </tr>
        );
    };

    const _recompute = async (yearMonth: string) => {
        const year = parseInt(yearMonth.split("-")[0]);
        const month = parseInt(yearMonth.split("-")[1]);
        const firstDayString = getFirstDayInMonth(year, month).toISOString().split(".")[0];
        const lastDayString = getLastDayInMonth(year, month).toISOString().split(".")[0];
        const url = `/api/scan/${address}/aggregate?newer_than=${firstDayString}&older_than=${lastDayString}`;

        setRecomputing(yearMonth);
        setRecomputeResult("");
        const response = await backendFetch(url, { method: "POST" });
        const data = await response.text();
        console.log(data);
        setReloadNo(reloadNo + 1);
        if (response.status == 304) {
            setRecomputeResult("No changes detected");
        } else if (response.status == 200) {
            setRecomputeResult(data);
        } else {
            setRecomputeResult("Error recomputing: " + data);
        }
        setRecomputing("");
    };

    const exportXls = async () => {
        const url = `/api/scan/${address}/report_total/xls?year=${year}`;

        //open new window with the xls
        window.open(url, "_blank");
    };

    const exportCsv = async () => {
        const url = `/api/scan/${address}/report_total/xls?year=${year}&csv=true`;

        //open new window with the xls
        window.open(url, "_blank");
    };

    function displayAddress(address: string, type: string | null) {
        const alias = aliases.find((alias) => alias.address === address && (type === null || alias.category === type));
        if (alias) {
            const shortAddr = address.substring(0, 6) + "…" + address.substring(address.length - 4);
            return alias.name + " (" + shortAddr + ")";
        }
        return address;
    }

    return (
        <div className={"content-main"}>
            <div className={"content-header-selection"}>
                <div className={"content-subtitle"}>
                    {year} AGGREGATES ({currency}) FOR
                </div>
                <div className={"blocks-header-select-address"}>
                    <Blockie address={address} />
                    <Select
                        sx={{ fontFamily: "'Roboto Mono', monospace;", marginRight: 2 }}
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

                <Select
                    sx={{ width: 100, marginRight: 2 }}
                    value={year.toString()}
                    onChange={(e) => setYear(parseInt(e.target.value))}
                >
                    {getAvailableYears().map((year) => (
                        <MenuItem key={year} value={year.toString()}>
                            {year.toString()}
                        </MenuItem>
                    ))}
                </Select>
                <Select sx={{ width: 100 }} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                    <MenuItem value={"ETH"}>ETH</MenuItem>
                    <MenuItem value={"USD"}>USD</MenuItem>
                    <MenuItem value={"EUR"}>EUR</MenuItem>
                    <MenuItem value={"PLN"}>PLN</MenuItem>
                </Select>
            </div>
            <>
                <div className={"error-msg"}>{recomputeResult}</div>
                <div style={{ width: 1390, overflow: "auto" }}>
                    <table className={"aggregate-table"}>
                        <thead>
                            <tr>
                                <th>Month</th>
                                <th>
                                    Time
                                    <br />
                                    Start/End
                                </th>
                                <th>
                                    Block
                                    <br />
                                    Start/End
                                </th>
                                <th>
                                    Balance
                                    <br />
                                    Start/End
                                </th>
                                <th>Delta</th>
                                <th>Consensus</th>
                                <th>Execution</th>
                                <th>Mev</th>
                                <th>
                                    Others
                                    <br />
                                    and Spam
                                </th>
                                <th>
                                    Total
                                    <br />
                                    incoming
                                </th>
                                <th>
                                    Total
                                    <br />
                                    outgoing
                                </th>
                                <th>
                                    Outgoing
                                    <br />
                                    receiver
                                </th>
                                <th>
                                    Total
                                    <br />
                                    gas paid
                                </th>
                            </tr>
                        </thead>
                    </table>
                </div>

                {loading ? (
                    <div className={"spinner"}>
                        <div>LOADING ...</div>
                    </div>
                ) : (
                    <table className={"aggregate-table"}>
                        <tbody>
                            {entries.map((block, idx) => {
                                return renderAggregateEntry(idx, block);
                            })}
                        </tbody>
                        <tfoot>
                            <tr className={"summary"}>
                                <td>
                                    <div className={"block-field"}>
                                        <div>Jan</div>
                                        <div>Dec</div>
                                    </div>
                                </td>
                                <td>
                                    <div className={"timestamp-field"}>
                                        <div>{firstDayInYear.toISOString().substring(0, 19).replace("T", " ")}</div>
                                        <div>{lastDayInYear.toISOString().substring(0, 19).replace("T", " ")}</div>
                                    </div>
                                </td>

                                <td>
                                    <div className={"block-field"}>
                                        <div>
                                            <a href={`https://etherscan.io/block/${summary.blockStart}`}>
                                                {summary.blockStart}
                                            </a>
                                        </div>
                                        <div>
                                            <a href={`https://etherscan.io/block/${summary.blockEnd}`}>
                                                {summary.blockEnd}
                                            </a>
                                        </div>
                                    </div>
                                </td>

                                <td>
                                    <div className={"balance-field"}>
                                        <div>
                                            <DisplayEther
                                                balance={summary.ethStart}
                                                inverted={false}
                                                currency={currency}
                                            />
                                        </div>
                                        <div>
                                            <DisplayEther
                                                balance={summary.ethEnd}
                                                inverted={false}
                                                currency={currency}
                                            />
                                        </div>
                                    </div>
                                </td>
                                <td className={"numeric"}>
                                    <DisplayEther balance={summary.ethDelta} inverted={false} currency={currency} />
                                </td>
                                <td className={"numeric"}>
                                    <DisplayEther balance={summary.ethConsensus} inverted={false} currency={currency} />
                                </td>
                                <td className={"numeric"}>
                                    <DisplayEther balance={summary.ethExecution} inverted={false} currency={currency} />
                                </td>
                                <td className={"numeric"}>
                                    <DisplayEther balance={summary.ethMev} inverted={false} currency={currency} />
                                </td>
                                <td className={"numeric"}>
                                    <DisplayEther balance={summary.ethOther} inverted={false} currency={currency} />
                                </td>
                                <td className={"numeric"}>
                                    <DisplayEther
                                        balance={summary.totalIncoming}
                                        inverted={false}
                                        currency={currency}
                                    />
                                </td>
                                <td className={"numeric"}>
                                    <DisplayEther balance={summary.totalOutgoing} inverted={true} currency={currency} />
                                </td>
                                <td></td>
                                <td className={"numeric"}>
                                    <DisplayEther balance={summary.totalGasPaid} inverted={true} currency={currency} />
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                )}
                <div className={"blocks-export-bottom-row"}>
                    <div className={"aggregates-summary-row"}>
                        <h2>List of receivers</h2>
                        <table className={"outgoing-table"}>
                            <thead>
                                <tr>
                                    <th>Month</th>
                                    <th>
                                        Sum of
                                        <br />
                                        Transfers
                                    </th>
                                    <th>Address</th>
                                </tr>
                            </thead>
                            <tbody>
                                {entries.map((aggr) => {
                                    return (
                                        <React.Fragment key={aggr.yearMonth}>
                                            {aggr.outgoings.map((outgoing) => {
                                                return renderOutgoingEntry(aggr, outgoing);
                                            })}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div style={{ flexGrow: 1 }}></div>
                    <div className={"blocks-export-row"}>
                        <div>EXPORT BLOCKS DATA:</div>
                        <Button onClick={() => exportXls()}>
                            <img alt={"XLS"} src={"/dashboard/uxwing/xls-file-icon.svg"} />
                        </Button>
                        <Button onClick={() => exportCsv()}>
                            <img alt={"CSV"} src={"/dashboard/uxwing/csv-file-icon.svg"} />
                        </Button>
                    </div>
                </div>
            </>
        </div>
    );
};

export default Aggregates;
