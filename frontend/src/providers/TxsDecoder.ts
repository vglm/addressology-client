import { TransactionTraceFromApi } from "../logic/Accounting";
import { ethers } from "ethers";

export function decodeTraces(address: string, arr: ArrayBuffer): TransactionTraceFromApi[] {
    const startTime = new Date().getTime();

    const dataView = new DataView(arr);

    let offset = 0;
    const traces: TransactionTraceFromApi[] = [];
    while (offset < dataView.byteLength) {
        const txHash = ethers.hexlify(new Uint8Array(arr.slice(offset, offset + 32)));
        offset += 32;
        const blockNumber = dataView.getUint32(offset);
        offset += 4;
        //console.log("blockNumber", blockNumber);
        const timestamp = dataView.getUint32(offset);
        offset += 4;
        const blockIdx = dataView.getUint16(offset);
        offset += 2;

        //console.log("balanceDiff", balanceDiff);
        const decodeBigIntPacked = (dv: DataView) => {
            if (dv.getUint8(offset) == 0) {
                offset += 1;
                return BigInt(0);
            }
            offset += 1;
            const high = dv.getBigInt64(offset);
            offset += 8;
            const low = dv.getBigUint64(offset);
            offset += 8;
            return (high << 64n) + low;
        };
        const amountReceivedMev = decodeBigIntPacked(dataView);
        const amountReceived = decodeBigIntPacked(dataView);
        const amountSent = decodeBigIntPacked(dataView);
        const gasUsed = decodeBigIntPacked(dataView);

        const bools = dataView.getUint8(offset);
        offset += 1;

        const isEmpty = (bools & 1) != 0;
        const isMev = (bools & 2) != 0;
        const isSimple = (bools & 4) != 0;
        const isOutgoing = (bools & 8) != 0;
        const isFishing = (bools & 16) != 0;
        const hasFrom = (bools & 32) != 0;
        const hasTo = (bools & 64) != 0;
        //console.log("gasUsed", gasUsed);
        let txFrom: string | null = null;
        let txTo: string | null = null;
        if (hasFrom) {
            txFrom = ethers.getAddress(ethers.hexlify(new Uint8Array(arr.slice(offset, offset + 20)))).toLowerCase();
            offset += 20;
        }
        if (hasTo) {
            txTo = ethers.getAddress(ethers.hexlify(new Uint8Array(arr.slice(offset, offset + 20)))).toLowerCase();
            offset += 20;
        }

        traces.push({
            address: address ?? "",
            txHash,
            blockNumber: blockNumber,
            timestamp: new Date((timestamp + 1577854800) * 1000)
                .toISOString()
                .substring(0, 19)
                .replace("T", " ")
                .replace("Z", ""),
            blockIndex: blockIdx,
            isEmpty,
            isMev,
            isSimple,
            isOutgoing,
            isFishing,
            amountReceived: amountReceived.toString(),
            amountReceivedMev: amountReceivedMev.toString(),
            amountSent: amountSent.toString(),
            fromAddr: txFrom,
            toAddr: txTo,
            gasUsed: gasUsed.toString(),
        });
    }
    if (offset != dataView.byteLength) {
        console.error("offset != dataView.byteLength", offset, dataView.byteLength);
        throw new Error("offset != dataView.byteLength");
    }
    console.log("Decoding took", new Date().getTime() - startTime, "ms");
    return traces;
}
