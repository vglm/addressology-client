import { BlockFromApi } from "../logic/Accounting";
import { ethers } from "ethers";

export function decodeBlocks(address: string, arr: ArrayBuffer): BlockFromApi[] {
    const startTime = new Date().getTime();

    const dataView = new DataView(arr);

    let offset = 0;
    const blocks: BlockFromApi[] = [];
    while (offset < dataView.byteLength) {
        const blockNumber = dataView.getUint32(offset);
        offset += 4;
        //console.log("blockNumber", blockNumber);
        const timestamp = dataView.getUint32(offset);
        offset += 4;
        const blockMiner = ethers
            .getAddress(ethers.hexlify(new Uint8Array(arr.slice(offset, offset + 20))))
            .toLowerCase();
        offset += 20;

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
        const balance = decodeBigIntPacked(dataView);
        const balanceDiff = decodeBigIntPacked(dataView);
        const consensusReward = decodeBigIntPacked(dataView);
        const mevReward = decodeBigIntPacked(dataView);
        //console.log("mevReward", mevReward);
        const blockReward = decodeBigIntPacked(dataView);
        //console.log("blockReward", blockReward);
        const amountIncoming = decodeBigIntPacked(dataView);
        //console.log("amountIncoming", amountIncoming);
        const amountOutgoing = decodeBigIntPacked(dataView);
        //console.log("amountOutgoing", amountOutgoing);
        const gasUsed = decodeBigIntPacked(dataView);
        //console.log("gasUsed", gasUsed);
        const priorityFees = decodeBigIntPacked(dataView);

        blocks.push({
            address: address ?? "",
            blockNumber: blockNumber,
            timestamp: new Date((timestamp + 1577854800) * 1000).toISOString(),
            balance: balance.toString(),
            balanceDiff: balanceDiff.toString(),
            consensusReward: consensusReward.toString(),
            mevReward: mevReward.toString(),
            blockReward: blockReward.toString(),
            amountIncoming: amountIncoming.toString(),
            amountOutgoing: amountOutgoing.toString(),
            gasUsed: gasUsed.toString(),
            priorityFees: priorityFees.toString(),
            blockMiner: blockMiner,
            updated: "",
        });
    }
    if (offset != dataView.byteLength) {
        console.error("offset != dataView.byteLength", offset, dataView.byteLength);
        throw new Error("offset != dataView.byteLength");
    }
    console.log("Decoding took", new Date().getTime() - startTime, "ms");
    return blocks;
}
