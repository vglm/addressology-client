import React, { useEffect } from "react";

import { backendFetch } from "./common/BackendCall";
import { analyze_transaction_traces, AnalyzedTrace, BlockFromApi, TransactionTraceFromApi } from "./logic/Accounting";
import { Select, MenuItem, Checkbox, FormControlLabel } from "@mui/material";
import { Alias } from "./logic/Alias";
import Blockie from "./Blockie";
import SelectMonth, { getFirstDayInMonth, getLastDayInMonth, getSelectedYearMonth } from "./Month";
import "./Transactions.css";
import { getAddressFromLocalStorage, useScans } from "./providers/CommonProvider";
import DisplayEther from "./DisplayEth";
import { decodeBlocks } from "./providers/BlocksDecoder";
import { decodeTraces } from "./providers/TxsDecoder";

const Transactions = () => {
    const [aliases, setAliases] = React.useState<Alias[]>([]);
    const [address, setAddressInt] = React.useState<string | null>(getAddressFromLocalStorage());
    const setAddress = (address: string) => {
        localStorage.setItem("address", address);
        setAddressInt(address);
    };
    const [currency, setCurrency] = React.useState("ETH");
    const [traces, setTraces] = React.useState<[BlockFromApi[], TransactionTraceFromApi[]]>([[], []]);
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

    const [displayMev, setDisplayMev] = React.useState(true);
    const [displayOutgoing, setDisplayOutgoing] = React.useState(true);
    const [displayIncoming, setDisplayIncoming] = React.useState(true);
    const [displayFishing, setDisplayFishing] = React.useState(true);
    const getAliases = async () => {
        const response = await backendFetch("/api/scan/aliases", {
            method: "Get",
        });
        const aliases = await response.json();
        setAliases(aliases);
    };
    const getBlocks = async () => {
        setTraces([[], []]);
        if (selectedYear == null || selectedMonth == null || address == null) {
            return;
        }
        setLoading(true);
        //format firstDay
        const firstDayString = getFirstDayInMonth(selectedYear, selectedMonth).toISOString().split(".")[0];
        const lastDayString = getLastDayInMonth(selectedYear, selectedMonth).toISOString().split(".")[0];
        const urlTraces = `/api/scan/${address}/transaction_traces_bin?newer_than=${firstDayString}&older_than=${lastDayString}`;
        const responseTraces = await backendFetch(urlTraces, {
            method: "Get",
        });
        const dataTracesBinaryData = await responseTraces.arrayBuffer();

        const dataTracesDecoded = decodeTraces(address, dataTracesBinaryData);

        const urlBlocks = `/api/scan/${address}/blocks_bin?newer_than=${firstDayString}&older_than=${lastDayString}`;
        const responseBlocks = await backendFetch(urlBlocks, {
            method: "Get",
        });
        const dataBlocksBinaryData = await responseBlocks.arrayBuffer();
        const dataBlocksDecoded = decodeBlocks(address, dataBlocksBinaryData);

        setTraces([dataBlocksDecoded, dataTracesDecoded]);
        setLoading(false);
    };

    useEffect(() => {
        getAliases().then();
    }, []);

    useEffect(() => {
        if (address == null && scanInfo.scans.length > 0) {
            setAddress(scanInfo.scans[0].address);
            return;
        }
        if (scanInfo.scans.length == 0 || selectedYear == null || selectedMonth == null) {
            return;
        }
        getBlocks().then();
    }, [scanInfo.scans, address, selectedYear, selectedMonth]);

    const summary = analyze_transaction_traces(traces[1]);
    function displayAddress(address: string, type: string | null) {
        const alias = aliases.find((alias) => alias.address === address && (type === null || alias.category === type));
        if (alias) {
            const shortAddr = address.substring(0, 6) + "…" + address.substring(address.length - 4);
            return alias.name + " (" + shortAddr + ")";
        }
        return address;
    }
    const renderCategory = (tr: AnalyzedTrace) => {
        if (tr.isMev) {
            return "MEV";
        }
        if (tr.isFishing) {
            return "Spam";
        }
        if (tr.isOutgoing) {
            return "Outgoing";
        }
        if (tr.amountReceived > BigInt(0)) {
            return "Incoming";
        }
        return "Unknown";
    };
    const renderTx = (idx: number, tr: AnalyzedTrace) => {
        const trFromAddrAlias = aliases.find((alias) => alias.address === tr.fromAddr);
        const trToAddrAlias = aliases.find((alias) => alias.address === tr.toAddr);
        return (
            <tr key={tr.txHash}>
                <td>{idx + 1}</td>
                <td>
                    <a href={`https://etherscan.io/block/${tr.blockNumber}`}>{tr.blockNumber}</a>
                </td>
                <td>{tr.timestamp}</td>
                {tr.isOutgoing ? (
                    <td>
                        <DisplayEther balance={tr.amountSent} inverted={true} currency={currency} />
                    </td>
                ) : (
                    <td>
                        <DisplayEther
                            balance={tr.isMev ? tr.amountReceivedMev : tr.amountReceived}
                            inverted={false}
                            currency={currency}
                        />
                    </td>
                )}
                <td>{renderCategory(tr)}</td>
                <td>
                    {tr.fromAddr ? (
                        <div className={"address-field"}>
                            <Blockie address={tr.fromAddr} />
                            <div className={"address-field-content"}>
                                <div className={"address-field-label"}>
                                    {trFromAddrAlias?.name ?? "Unknown"} ({trFromAddrAlias?.category ?? "Unknown"})
                                </div>
                                <div className={"address-field-short-address"}>
                                    <a href={`https://etherscan.io/address/${tr.fromAddr}`}>{tr.fromAddr}</a>
                                </div>
                            </div>
                        </div>
                    ) : (
                        ""
                    )}
                    {tr.toAddr ? (
                        <div className={"address-field"}>
                            <Blockie address={tr.toAddr} />
                            <div className={"address-field-content"}>
                                <div className={"address-field-label"}>
                                    {trToAddrAlias?.name ?? "Unknown"} ({trToAddrAlias?.category ?? "Unknown"})
                                </div>
                                <div className={"address-field-short-address"}>
                                    <a href={`https://etherscan.io/address/${tr.toAddr}`}>{tr.toAddr}</a>
                                </div>
                            </div>
                        </div>
                    ) : (
                        ""
                    )}
                </td>
                <td>
                    <a href={`https://etherscan.io/tx/${tr.txHash}`}>{tr.txHash.substring(0, 16)}...</a>
                </td>
            </tr>
        );
    };

    if (scanInfo.isLoading) {
        return <div className={"blocks-main"}>Loading...</div>;
    }
    if (address == null) {
        return <div className={"blocks-main"}>Address not selected</div>;
    }
    const _exportXls = async () => {
        if (selectedYear == null || selectedMonth == null) {
            return;
        }
        const firstDayString = getFirstDayInMonth(selectedYear, selectedMonth).toISOString().split(".")[0];
        const lastDayString = getLastDayInMonth(selectedYear, selectedMonth).toISOString().split(".")[0];
        const url = `/api/scan/${address}/report/xls?newer_than=${firstDayString}&older_than=${lastDayString}`;

        //open new window with the xls
        window.open(url, "_blank");
    };

    const displayedTransactions: React.ReactElement[] = [];
    summary.transactions.map((txSum, idx) => {
        if (!displayFishing && txSum.isFishing) {
            return;
        }
        if (!displayOutgoing && txSum.isOutgoing) {
            return;
        }
        if (!displayMev && txSum.isMev) {
            return;
        }
        if (!displayIncoming && txSum.amountReceived > BigInt(0) && !txSum.isFishing) {
            return;
        }

        displayedTransactions.push(renderTx(idx, txSum));
    });
    const currentScan = scanInfo.scans.find((scan) => scan.address === address);

    return (
        <div className={"content-main"}>
            <div className={"content-header-selection"}>
                <div className={"content-subtitle"}>
                    {`${selectedYear}-${String(selectedMonth).padStart(2, "0")}`} TRANSACTIONS FOR
                </div>
                <div className={"blocks-header-select-address"}>
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
                    Displaying {displayedTransactions.length} transactions of {summary.transactions.length}
                </div>
                <div style={{ flexGrow: 1 }}></div>
                <div className={"transaction-display-filters"}>
                    <div>
                        <FormControlLabel
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
                            control={
                                <Checkbox checked={displayMev} onChange={(e) => setDisplayMev(e.target.checked)} />
                            }
                            label="MEV"
                        />
                    </div>
                    <div>
                        <FormControlLabel
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

            <>
                <div style={{ width: 1485, overflow: "auto" }}>
                    <table className={"transaction-table"}>
                        <thead>
                            <tr>
                                <th>No</th>
                                <th>Block number</th>
                                <th>Block date</th>
                                <th>Transfer value ({currency})</th>
                                <th>Categorization</th>
                                <th>Additional info</th>
                                <th>Tx Hash</th>
                            </tr>
                        </thead>
                    </table>
                </div>
                <div>
                    {loading ? (
                        <div className={"spinner"}>
                            <div>LOADING ...</div>
                        </div>
                    ) : (
                        <table className={"transaction-table"}>
                            <tbody>{displayedTransactions}</tbody>
                        </table>
                    )}
                </div>
            </>
        </div>
    );
};

export default Transactions;
