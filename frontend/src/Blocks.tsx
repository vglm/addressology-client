import React, { useEffect } from "react";

import { backendFetch } from "./common/BackendCall";
import { analyze_blocks, Block, BlocksSummary } from "./logic/Accounting";
import { Button, Select, MenuItem, FormControlLabel, Checkbox } from "@mui/material";
import { Alias } from "./logic/Alias";
import Blockie from "./Blockie";
import SelectMonth, { getFirstDayInMonth, getLastDayInMonth, getSelectedYearMonth } from "./Month";
import "./Blocks.css";
import { getAddressFromLocalStorage, useScans } from "./providers/CommonProvider";
import DisplayEther from "./DisplayEth";
import { decodeBlocks } from "./providers/BlocksDecoder";

const Blocks = () => {
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
        const firstDayString = getFirstDayInMonth(selectedYear, selectedMonth).toISOString().split(".")[0];
        const lastDayString = getLastDayInMonth(selectedYear, selectedMonth).toISOString().split(".")[0];
        //const url = `/api/scan/${address}/blocks?newer_than=${firstDayString}&older_than=${lastDayString}`;
        const urlBin = `/api/scan/${address}/blocks_bin?newer_than=${firstDayString}&older_than=${lastDayString}`;
        const responseBin = await backendFetch(urlBin, {
            method: "Get",
        });

        const binData = await responseBin.arrayBuffer();
        const blocks = decodeBlocks(address, binData);
        const summary = analyze_blocks(blocks);
        setBlocksSummary(summary);

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

    function toClassBlock(block: Block) {
        if (block.unBalance != BigInt(0)) {
            return "content unbalance";
        }
        return "content";
    }

    const renderBlock = (idx: number, block: Block) => {
        return (
            <React.Fragment key={block.blockNumber}>
                <tr key={block.blockNumber} className={toClassBlock(block)}>
                    <td>{idx + 1}</td>
                    <td className={"block-number"}>
                        <a href={`https://etherscan.io/block/${block.blockNumber}`}>{block.blockNumber}</a>
                    </td>
                    <td className={"timestamp"}>{block.timestamp.substring(0, 19).replace("T", " ")}</td>
                    <td>
                        <DisplayEther balance={block.balance} inverted={false} currency={currency} />
                    </td>
                    <td>
                        <DisplayEther balance={block.balanceDiff} inverted={false} currency={currency} />
                    </td>
                    <td>
                        <DisplayEther balance={block.consensusReward} inverted={false} currency={currency} />
                    </td>
                    <td>
                        <DisplayEther balance={block.blockReward} inverted={false} currency={currency} />
                    </td>
                    <td>
                        <DisplayEther balance={block.mevReward} inverted={false} currency={currency} />
                    </td>
                    <td>
                        <DisplayEther balance={block.amountIncoming} inverted={false} currency={currency} />
                    </td>
                    <td>
                        <DisplayEther balance={block.amountOutgoing} inverted={true} currency={currency} />
                    </td>
                    <td>
                        <DisplayEther balance={block.gasUsed} inverted={true} currency={currency} />
                    </td>
                    <td>TODO</td>
                </tr>
                {block.unBalance != BigInt(0) && (
                    <tr>
                        <td colSpan={3}>
                            Unbalance: <DisplayEther balance={block.unBalance} inverted={false} currency={currency} />
                        </td>
                    </tr>
                )}
            </React.Fragment>
        );
    };

    const exportDoc = async (is_csv: boolean) => {
        if (selectedYear == null || selectedMonth == null) {
            return;
        }
        const firstDayString = getFirstDayInMonth(selectedYear, selectedMonth).toISOString().split(".")[0];
        const lastDayString = getLastDayInMonth(selectedYear, selectedMonth).toISOString().split(".")[0];
        const url = `/api/scan/${address}/report/xls?newer_than=${firstDayString}&older_than=${lastDayString}&csv=${
            is_csv ? "true" : "false"
        }`;

        //open new window with the xls
        window.open(url, "_blank");
    };

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
                    <div className={"content-subtitle"}>
                        {`${selectedYear}-${String(selectedMonth).padStart(2, "0")}`} BLOCKS FOR
                    </div>
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

            <>
                <div style={{ width: 1385, overflow: "auto" }}>
                    <table className={"block-table"}>
                        <thead>
                            <tr className={"content"}>
                                <th>No</th>
                                <th>Block number</th>
                                <th>Block date</th>
                                <th>Balance</th>
                                <th>Balance Delta</th>
                                <th>Consensus Reward</th>
                                <th>Execution Reward</th>
                                <th>MEV Reward</th>
                                <th>Amount Incoming</th>
                                <th>Amount Outgoing</th>
                                <th>Gas used</th>
                                <th>Number of withdrawals</th>
                            </tr>
                        </thead>
                    </table>
                </div>
                <div style={{ width: 1425 }}>
                    {loading || summary == null ? (
                        <div className={"spinner"}>
                            <div>LOADING ...</div>
                        </div>
                    ) : (
                        <table className={"block-table"}>
                            <tbody>
                                {summary.blocks.map((block, idx) => {
                                    return renderBlock(idx, block);
                                })}
                                <React.Fragment key={"summary"}>
                                    <tr className={"summary"}>
                                        <td colSpan={3}>
                                            <div className={"blocks-header-field"}>
                                                Sum for {summary.totalEntries} blocks
                                            </div>
                                        </td>
                                        <td>
                                            <DisplayEther
                                                balance={summary.totalDiff}
                                                inverted={false}
                                                currency={currency}
                                            />
                                        </td>
                                        <td>
                                            <DisplayEther
                                                balance={summary.totalSumDiff}
                                                inverted={false}
                                                currency={currency}
                                            />
                                        </td>
                                        <td>
                                            <DisplayEther
                                                balance={summary.totalConsensusReward}
                                                inverted={false}
                                                currency={currency}
                                            />
                                        </td>
                                        <td>
                                            <DisplayEther
                                                balance={summary.totalBlockReward}
                                                inverted={false}
                                                currency={currency}
                                            />
                                        </td>
                                        <td>
                                            <DisplayEther
                                                balance={summary.totalMevReward}
                                                inverted={false}
                                                currency={currency}
                                            />
                                        </td>
                                        <td>
                                            <DisplayEther
                                                balance={summary.totalAmountIncoming}
                                                inverted={false}
                                                currency={currency}
                                            />
                                        </td>
                                        <td>
                                            <DisplayEther
                                                balance={summary.totalAmountOutgoing}
                                                inverted={true}
                                                currency={currency}
                                            />
                                        </td>
                                        <td>
                                            <DisplayEther
                                                balance={summary.totalGasUsed}
                                                inverted={true}
                                                currency={currency}
                                            />
                                        </td>
                                        <td></td>
                                    </tr>
                                </React.Fragment>
                            </tbody>
                        </table>
                    )}
                </div>
                <div className={"blocks-export-bottom-row"}>
                    <div className={"blocks-summary-row"}>
                        {loading || summary == null ? (
                            <div className={"spinner"}>
                                <div>LOADING ...</div>
                            </div>
                        ) : (
                            <table className={"check-table"}>
                                <tbody>
                                    <tr>
                                        <th>Difference Between last and first block:</th>
                                        <td>
                                            <DisplayEther
                                                balance={summary.totalDiff.toString()}
                                                inverted={false}
                                                currency={currency}
                                            ></DisplayEther>{" "}
                                            {currency}
                                        </td>
                                    </tr>
                                    <tr>
                                        <th>Sum of changes:</th>
                                        <td>
                                            <DisplayEther
                                                balance={summary.totalDiff.toString()}
                                                inverted={false}
                                                currency={currency}
                                            />{" "}
                                            {currency}
                                        </td>
                                    </tr>
                                    <tr>
                                        <th>Balance (should be the same if everything went fine):</th>
                                        <td>
                                            <DisplayEther
                                                balance={(
                                                    summary.totalConsensusReward +
                                                    summary.totalMevReward +
                                                    summary.totalBlockReward +
                                                    summary.totalAmountIncoming -
                                                    summary.totalAmountOutgoing -
                                                    summary.totalGasUsed
                                                ).toString()}
                                                inverted={false}
                                                currency={currency}
                                            />{" "}
                                            {currency}
                                        </td>
                                    </tr>
                                    <tr>
                                        <th>Sum of incoming txs:</th>
                                        <td>
                                            <DisplayEther
                                                balance={
                                                    summary.totalConsensusReward +
                                                    summary.totalMevReward +
                                                    summary.totalBlockReward +
                                                    summary.totalAmountIncoming
                                                }
                                                inverted={false}
                                                currency={currency}
                                            />{" "}
                                            {currency}
                                        </td>
                                    </tr>
                                    <tr>
                                        <th>Sum of outgoing txs:</th>
                                        <td>
                                            <DisplayEther
                                                balance={summary.totalAmountOutgoing}
                                                inverted={true}
                                                currency={currency}
                                            />{" "}
                                            {currency}
                                        </td>
                                    </tr>
                                    <tr>
                                        <th>Sum of gas used:</th>
                                        <td>
                                            <DisplayEther
                                                balance={summary.totalGasUsed}
                                                inverted={true}
                                                currency={currency}
                                            />{" "}
                                            {currency}
                                        </td>
                                    </tr>
                                    <tr>
                                        <th>Total unbalance:</th>
                                        <td>
                                            <DisplayEther
                                                balance={
                                                    summary.totalConsensusReward +
                                                    summary.totalMevReward +
                                                    summary.totalBlockReward +
                                                    summary.totalAmountIncoming -
                                                    summary.totalAmountOutgoing -
                                                    summary.totalGasUsed -
                                                    summary.totalDiff
                                                }
                                                inverted={true}
                                                currency={currency}
                                            />{" "}
                                            {currency}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        )}
                    </div>
                    <div style={{ flexGrow: 1 }}></div>
                    <div className={"blocks-export-row"}>
                        <div>EXPORT BLOCKS DATA:</div>
                        <Button onClick={() => exportDoc(false)}>
                            <img src={"/dashboard/uxwing/xls-file-icon.svg"} />
                        </Button>
                        <Button onClick={() => exportDoc(true)}>
                            <img src={"/dashboard/uxwing/csv-file-icon.svg"} />
                        </Button>
                    </div>
                </div>
            </>
        </div>
    );
    console.log("Rendering took: ", new Date().getTime() - startRendering);
    return fullRender;
};

export default Blocks;
