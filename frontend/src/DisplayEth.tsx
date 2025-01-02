import React from "react";
import { usePrices } from "./providers/CommonProvider";
import { formatEther } from "ethers";
import { BigNumber } from "bignumber.js";

const getDecimals = (currency: string) => {
    switch (currency) {
        case "ETH":
            return 5;
        case "USD":
            return 2;
        case "EUR":
            return 2;
        case "PLN":
            return 2;
        default:
            return 5;
    }
};

const toClass = (balance: string | bigint, inverted: boolean) => {
    if (inverted) {
        if (BigInt(balance) > 0) {
            return "negative";
        } else if (BigInt(balance) < 0) {
            return "positive";
        } else {
            return "zero";
        }
    }
    if (BigInt(balance) > 0) {
        return "positive";
    } else if (BigInt(balance) < 0) {
        return "negative";
    } else {
        return "zero";
    }
};

const displayEth = (balance: bigint | string, decimals: number) => {
    if (decimals == 18) {
        return formatEther(BigInt(balance));
    }
    return BigNumber(formatEther(BigInt(balance))).toFixed(decimals);
};

interface DisplayEtherProps {
    balance: string | bigint;
    inverted: boolean;
    currency: string;
}

const DisplayEther = (props: DisplayEtherProps) => {
    const prices = usePrices();

    const toEth = (balance: string | bigint, decimals: number) => {
        if (props.currency == "ETH") {
            return displayEth(balance, decimals);
        }
        let convertionRate = BigInt(1000);
        if (props.currency == "USD") {
            convertionRate = BigInt(Math.round(prices.toUsd * 1000));
        }
        if (props.currency == "EUR") {
            convertionRate = BigInt(Math.round(prices.toEur * 1000));
        }
        if (props.currency == "PLN") {
            convertionRate = BigInt(Math.round(prices.toPln * 1000));
        }
        const converted = BigInt(balance) * convertionRate;
        const normalized = converted / BigInt(1000);
        return displayEth(normalized, decimals);
    };

    return (
        <span
            className={toClass(props.balance, props.inverted)}
            title={toEth(props.balance, 18) + " Ether (" + props.balance + " Wei)"}
        >
            {toEth(props.balance, getDecimals(props.currency))}
        </span>
    );
};

export default DisplayEther;
