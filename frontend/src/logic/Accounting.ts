import { parseUnits } from "ethers";

export interface TransactionTraceFromApi {
    address: string;
    txHash: string;
    blockNumber: number;
    timestamp: string;
    blockIndex: number;
    isEmpty: boolean;
    isMev: boolean;
    isSimple: boolean;
    isOutgoing: boolean;
    isFishing: boolean;
    amountReceived: string;
    amountReceivedMev: string;
    amountSent: string;
    fromAddr: string | null;
    toAddr: string | null;
    gasUsed: string;
}

export interface AnalyzedTrace {
    address: string;
    txHash: string;
    blockNumber: number;
    timestamp: string;
    blockIndex: number;
    isEmpty: boolean;
    isMev: boolean;
    isSimple: boolean;
    isOutgoing: boolean;
    isFishing: boolean;
    amountReceived: bigint;
    amountReceivedMev: bigint;
    amountSent: bigint;
    fromAddr: string | null;
    toAddr: string | null;
    gasUsed: bigint;
}

export interface AnalyzedTracesSummary {
    transactions: AnalyzedTrace[];
}

export interface TransactionSummary {
    txHash: string;
    blockNumber: number;
    blockIndex: string;
    isSimple: boolean;
    isMevReward: boolean;
    isOutgoing: boolean;
    amountReceived: bigint;
    amountSent: bigint;
    fromAddr?: string;
    toAddr?: string;
    isPhishing: boolean;
}

export interface OutgoingFromApi {
    yearMonth: string;
    address: string;
    amount: bigint;
    receiverAddr: string;
}

export interface AggregateFromApi {
    yearMonth: string;
    address: string;
    startTs: string;
    endTs: string;
    blockStart: number;
    blockEnd: number;
    monthCompleted: boolean;
    ethStart: bigint;
    ethEnd: bigint;
    ethDelta: bigint;
    ethConsensus: bigint;
    ethExecution: bigint;
    ethMev: bigint;
    ethOther: bigint;
    totalIncoming: bigint;
    totalOutgoing: bigint;
    totalGasPaid: bigint;
    totalInout: bigint;
    totalCheckZero: bigint;
    outgoings: OutgoingFromApi[];
}

export interface Outgoing {
    yearMonth: string;
    address: string;
    amount: bigint;
    receiverAddr: string;
}

export interface Aggregate {
    yearMonth: string;
    address: string;
    startTs: string;
    endTs: string;
    blockStart: number;
    blockEnd: number;
    monthCompleted: boolean;
    ethStart: bigint;
    ethEnd: bigint;
    ethDelta: bigint;
    ethConsensus: bigint;
    ethExecution: bigint;
    ethMev: bigint;
    ethOther: bigint;
    totalIncoming: bigint;
    totalOutgoing: bigint;
    totalGasPaid: bigint;
    totalInout: bigint;
    totalCheckZero: bigint;
    monthFinished: boolean;
    outgoings: Outgoing[];
}

export interface AggregateSummary {
    address: string;
    startTs: string;
    endTs: string;
    blockStart: number;
    blockEnd: number;
    monthCompleted: boolean;
    ethStart: bigint;
    ethEnd: bigint;
    ethDelta: bigint;
    ethConsensus: bigint;
    ethExecution: bigint;
    ethMev: bigint;
    ethOther: bigint;
    totalIncoming: bigint;
    totalOutgoing: bigint;
    totalGasPaid: bigint;
    totalInout: bigint;
    totalCheckZero: bigint;
    outgoings: Outgoing[];
}

export interface BlockFromApi {
    address: string;
    blockNumber: number;
    timestamp: string;
    balance: string;
    balanceDiff: string;
    updated: string;
    blockMiner: string;
    consensusReward: string;
    mevReward: string;
    blockReward: string;
    amountIncoming: string;
    amountOutgoing: string;
    gasUsed: string;
    priorityFees: string;
}

export interface Block {
    no: number;
    address: string;
    blockNumber: number;
    timestamp: string;
    balance: bigint;
    balanceDiff: bigint;
    updated: string;
    blockMiner: string;
    consensusReward: bigint;
    mevReward: bigint;
    blockReward: bigint;
    amountIncoming: bigint;
    amountOutgoing: bigint;
    unBalance: bigint;
    gasUsed: bigint;
    priorityFees: bigint;
}

export interface ValidatorWithdrawal {
    address: string;
    blockNumber: number;
    withdrawalIdx: number;
    validatorIdx: number;
    amount: bigint;
}

export interface BlocksSummary {
    totalEntries: number;
    totalDiff: bigint;
    totalSumDiff: bigint;
    totalConsensusReward: bigint;
    totalMevReward: bigint;
    totalBlockReward: bigint;
    totalAmountIncoming: bigint;
    totalAmountOutgoing: bigint;
    totalGasUsed: bigint;
    blocks: Block[];
}

export interface BlockBinFromApi {
    startTime: string;
    endTime: string;
    blockCount: number;
    withdrawalCount: number;
    withdrawalAmount: string;
    epochTotal: string;
    epochAvgPerS: number;
    epochAvgConsensus: number;
    mev: string;
    epochNo: number;
}

export interface BlockBinResponse {
    all: BlockBinFromApi[];
    byEpoch: { [key: number]: BlockBinFromApi[] };
}

export interface BlockBin {
    startTime: Date;
    endTime: Date;
    blockCount: number;
    withdrawalCount: number;
    withdrawalAmount: bigint;
    epochTotal: bigint;
    epochAvgPerS: number;
    epochAvgConsensus: number;
    mev: bigint;
    epochNo: number;
}

export interface BlockBinsSummary {
    all: BlockBin[];
    byEpoch: { [key: number]: BlockBin[] };
}

export function analyze_block_bins(bins: BlockBinFromApi[]): BlockBin[] {
    const analyzedBins: BlockBin[] = [];
    for (let i = 0; i < bins.length; i++) {
        const bin = {
            startTime: new Date(bins[i].startTime),
            endTime: new Date(bins[i].endTime),
            blockCount: bins[i].blockCount,
            withdrawalCount: bins[i].withdrawalCount,
            withdrawalAmount: BigInt(bins[i].withdrawalAmount),
            epochTotal: BigInt(bins[i].epochTotal),
            epochAvgPerS: bins[i].epochAvgPerS,
            epochAvgConsensus: bins[i].epochAvgConsensus,
            mev: BigInt(bins[i].mev),
            epochNo: bins[i].epochNo,
        };
        analyzedBins.push(bin);
    }

    return analyzedBins;
}

export function analyze_block_bin_response(resp: BlockBinResponse): BlockBinsSummary {
    const byEpoch: { [key: number]: BlockBin[] } = {};
    for (const key in resp.byEpoch) {
        byEpoch[key] = analyze_block_bins(resp.byEpoch[key]);
    }
    return {
        all: analyze_block_bins(resp.all),
        byEpoch: byEpoch,
    };
}

export function analyze_transaction_traces(traces: TransactionTraceFromApi[]): AnalyzedTracesSummary {
    const analyzedTraces: AnalyzedTrace[] = [];

    for (let i = 0; i < traces.length; i++) {
        const trace = traces[i];
        analyzedTraces.push({
            address: trace.address,
            txHash: trace.txHash,
            blockNumber: trace.blockNumber,
            timestamp: trace.timestamp,
            blockIndex: trace.blockIndex,
            isEmpty: trace.isEmpty,
            isMev: trace.isMev,
            isSimple: trace.isSimple,
            isOutgoing: trace.isOutgoing,
            isFishing: trace.isFishing,
            amountReceived: BigInt(trace.amountReceived),
            amountReceivedMev: BigInt(trace.amountReceivedMev),
            amountSent: BigInt(trace.amountSent),
            fromAddr: trace.fromAddr,
            toAddr: trace.toAddr,
            gasUsed: BigInt(trace.gasUsed),
        });
    }

    return {
        transactions: analyzedTraces,
    };
}

export function analyze_summaries(summaries: AggregateSummary[]) {
    const total: AggregateSummary = {
        address: "",
        startTs: "",
        endTs: "",
        blockStart: summaries[0]?.blockStart ?? 0,
        blockEnd: 0,
        monthCompleted: false,
        ethStart: BigInt(0),
        ethEnd: BigInt(0),
        ethDelta: BigInt(0),
        ethConsensus: BigInt(0),
        ethExecution: BigInt(0),
        ethMev: BigInt(0),
        ethOther: BigInt(0),
        totalIncoming: BigInt(0),
        totalOutgoing: BigInt(0),
        totalGasPaid: BigInt(0),
        totalInout: BigInt(0),
        totalCheckZero: BigInt(0),
        outgoings: [],
    };
    for (const summary of summaries) {
        total.blockStart = Math.min(total.blockStart, summary.blockStart);
        total.blockEnd = Math.max(total.blockEnd, summary.blockEnd);
        total.ethStart += summary.ethStart;
        total.ethEnd += summary.ethEnd;
        total.ethDelta += summary.ethDelta;
        total.ethConsensus += summary.ethConsensus;
        total.ethExecution += summary.ethExecution;
        total.ethMev += summary.ethMev;
        total.ethOther += summary.ethOther;
        total.totalIncoming += summary.totalIncoming;
        total.totalOutgoing += summary.totalOutgoing;
        total.totalGasPaid += summary.totalGasPaid;
        total.totalInout += summary.totalInout;
        total.totalCheckZero += summary.totalCheckZero;
        total.outgoings = total.outgoings.concat(summary.outgoings);
    }
    return total;
}

export function analyze_aggregates(address: string, aggregates: AggregateFromApi[], year: number | undefined | null) {
    const analyzedAggregates: Aggregate[] = [];

    const summary: AggregateSummary = {
        address,
        startTs: "",
        endTs: "",
        blockStart: 0,
        blockEnd: 0,
        monthCompleted: false,
        ethStart: BigInt(0),
        ethEnd: BigInt(0),
        ethDelta: BigInt(0),
        ethConsensus: BigInt(0),
        ethExecution: BigInt(0),
        ethMev: BigInt(0),
        ethOther: BigInt(0),
        totalIncoming: BigInt(0),
        totalOutgoing: BigInt(0),
        totalGasPaid: BigInt(0),
        totalInout: BigInt(0),
        totalCheckZero: BigInt(0),
        outgoings: [],
    };
    for (let i = 0; i < aggregates.length; i++) {
        const aggregate = aggregates[i];
        if (address != aggregate.address) {
            continue;
        }
        if (year && aggregate.yearMonth.substring(0, 4) != year.toString()) {
            continue;
        }
        const outgoings: Outgoing[] = [];
        for (let j = 0; j < aggregate.outgoings.length; j++) {
            const outgoing = aggregate.outgoings[j];
            outgoings.push({
                yearMonth: outgoing.yearMonth,
                address: outgoing.address,
                amount: BigInt(outgoing.amount),
                receiverAddr: outgoing.receiverAddr,
            });
        }
        const startTs = new Date(aggregate.startTs);
        const startTsStr = startTs.toISOString().substring(0, 19);
        const endTs = new Date(aggregate.endTs);
        const monthBefore = endTs.getUTCMonth();
        endTs.setUTCSeconds(endTs.getUTCSeconds() - 1);
        const monthAfter = endTs.getUTCMonth();
        const endTsStr = endTs.toISOString().substring(0, 19);

        if (i == 0) {
            summary.address = aggregate.address;
            summary.startTs = startTsStr;
            summary.blockStart = aggregate.blockStart;
            summary.ethStart = BigInt(aggregate.ethStart);
        }
        if (i == aggregates.length - 1) {
            summary.endTs = endTsStr;
            summary.blockEnd = aggregate.blockEnd;
            summary.ethEnd = BigInt(aggregate.ethEnd);
        }
        summary.ethDelta += BigInt(aggregate.ethDelta);
        summary.ethConsensus += BigInt(aggregate.ethConsensus);
        summary.ethExecution += BigInt(aggregate.ethExecution);
        summary.ethMev += BigInt(aggregate.ethMev);
        summary.ethOther += BigInt(aggregate.ethOther);
        summary.totalIncoming += BigInt(aggregate.totalIncoming);
        summary.totalOutgoing += BigInt(aggregate.totalOutgoing);
        summary.totalGasPaid += BigInt(aggregate.totalGasPaid);
        summary.totalInout += BigInt(aggregate.totalInout);
        summary.totalCheckZero += BigInt(aggregate.totalCheckZero);

        summary.outgoings = summary.outgoings.concat(outgoings);

        analyzedAggregates.push({
            monthFinished: monthAfter != monthBefore,
            yearMonth: aggregate.yearMonth,
            address: aggregate.address,
            startTs: startTsStr,
            endTs: endTsStr,
            blockStart: aggregate.blockStart,
            blockEnd: aggregate.blockEnd,
            monthCompleted: aggregate.monthCompleted,
            ethStart: BigInt(aggregate.ethStart),
            ethEnd: BigInt(aggregate.ethEnd),
            ethDelta: BigInt(aggregate.ethDelta),
            ethConsensus: BigInt(aggregate.ethConsensus),
            ethExecution: BigInt(aggregate.ethExecution),
            ethMev: BigInt(aggregate.ethMev),
            ethOther: BigInt(aggregate.ethOther),
            totalIncoming: BigInt(aggregate.totalIncoming),
            totalOutgoing: BigInt(aggregate.totalOutgoing),
            totalGasPaid: BigInt(aggregate.totalGasPaid),
            totalInout: BigInt(aggregate.totalInout),
            totalCheckZero: BigInt(aggregate.totalCheckZero),
            outgoings: outgoings,
        });
    }

    return {
        aggregates: analyzedAggregates,
        summary: summary,
    };
}

export function analyze_blocks(blocks: BlockFromApi[]) {
    const totalEntries = blocks.length;

    let totalDiff =
        blocks.length > 1 ? BigInt(blocks[blocks.length - 1].balance) - BigInt(blocks[0].balance) : BigInt(0);
    let totalSumDiff = BigInt(0);
    let totalConsensusReward = BigInt(0);
    let totalMevReward = BigInt(0);
    let totalBlockReward = BigInt(0);
    let totalAmountIncoming = BigInt(0);
    let totalAmountOutgoing = BigInt(0);
    let totalGasUsed = BigInt(0);
    const analyzedBlocks: Block[] = [];
    for (let i = 0; i < blocks.length; i++) {
        if (i == 0) {
            totalDiff += BigInt(blocks[i].balanceDiff);
        }
        totalSumDiff = totalSumDiff + BigInt(blocks[i].balanceDiff);
        totalConsensusReward = totalConsensusReward + BigInt(blocks[i].consensusReward);
        totalMevReward = totalMevReward + BigInt(blocks[i].mevReward);
        totalBlockReward = totalBlockReward + BigInt(blocks[i].blockReward);
        totalAmountIncoming = totalAmountIncoming + BigInt(blocks[i].amountIncoming);
        totalAmountOutgoing = totalAmountOutgoing + BigInt(blocks[i].amountOutgoing);
        totalGasUsed = totalGasUsed + BigInt(blocks[i].gasUsed);
        analyzedBlocks.push({
            no: i + 1,
            address: blocks[i].address,
            blockNumber: blocks[i].blockNumber,
            timestamp: blocks[i].timestamp,
            balance: BigInt(blocks[i].balance),
            balanceDiff: BigInt(blocks[i].balanceDiff),
            updated: blocks[i].updated,
            blockMiner: blocks[i].blockMiner,
            consensusReward: BigInt(blocks[i].consensusReward),
            mevReward: BigInt(blocks[i].mevReward),
            blockReward: BigInt(blocks[i].blockReward),
            amountIncoming: BigInt(blocks[i].amountIncoming),
            amountOutgoing: BigInt(blocks[i].amountOutgoing),
            gasUsed: BigInt(blocks[i].gasUsed),
            priorityFees: BigInt(blocks[i].priorityFees),
            unBalance:
                BigInt(blocks[i].consensusReward) +
                BigInt(blocks[i].mevReward) +
                BigInt(blocks[i].blockReward) +
                BigInt(blocks[i].amountIncoming) -
                BigInt(blocks[i].gasUsed) -
                BigInt(blocks[i].amountOutgoing) -
                BigInt(blocks[i].balanceDiff),
        });
    }

    for (let i = 0; i < analyzedBlocks.length; i++) {
        const block = analyzedBlocks[i];
        const blockBalanceRight =
            block.consensusReward + block.mevReward + block.blockReward + block.amountIncoming - block.amountOutgoing;
        const blockBalanceLeft = BigInt(block.balanceDiff);
        if (blockBalanceLeft != blockBalanceRight) {
            if (block.amountOutgoing > 0) {
                //allow tolerance for gas paid (0.005 ETH)
                if (blockBalanceRight - blockBalanceLeft > parseUnits("0.005", "ether")) {
                    console.error(`Balance mismatch2: ${blockBalanceLeft} != ${blockBalanceRight}`);
                    console.error(blocks[i]);
                }
            } else {
                console.error(`Balance mismatch: ${blockBalanceLeft} != ${blockBalanceRight}`);
                console.error(blocks[i]);
            }
        }
    }

    return {
        totalEntries: totalEntries,
        totalDiff: totalDiff,
        totalSumDiff: totalSumDiff,
        totalConsensusReward: totalConsensusReward,
        totalMevReward: totalMevReward,
        totalBlockReward: totalBlockReward,
        totalAmountIncoming: totalAmountIncoming,
        totalAmountOutgoing: totalAmountOutgoing,
        totalGasUsed: totalGasUsed,
        blocks: analyzedBlocks,
    } as BlocksSummary;
}
