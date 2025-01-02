import React, { createContext } from "react";
import { semiDeepArrayEqual } from "../common/DeepCompare";
import { backendFetch } from "../common/BackendCall";
import { Scan } from "../logic/Scan";
import { useLoginOrNull } from "../LoginProvider";
import { ethers } from "ethers";

export interface ScansInformation {
    isLoading: boolean;
    error: string;
    scans: Scan[];
}

export const ScanContext = createContext<ScansInformation>({
    isLoading: true,
    error: "",
    scans: [],
});

interface PricesInformation {
    toUsd: number;
    toEur: number;
    toPln: number;
}

export const PricesContext = createContext<PricesInformation>({
    toUsd: 0,
    toEur: 0,
    toPln: 0,
});

export const useScans = () => React.useContext(ScanContext);
export const usePrices = () => React.useContext(PricesContext);

interface ScanProviderProps {
    children: React.ReactNode;
}

function getScansFromLocalStorage(): Scan[] {
    const scansJsonStr = localStorage.getItem("scans");

    if (!scansJsonStr) {
        console.log("No scans in local storage");
        return [];
    }
    try {
        return JSON.parse(scansJsonStr);
    } catch (_e) {
        console.error("Failed to parse scans from local storage");
        return [];
    }
}

export function getAddressFromLocalStorage(): string | null {
    try {
        const address = localStorage.getItem("address");
        if (!address) {
            return null;
        }
        const parsedAddress = ethers.getAddress(address);
        const lowercasedAddress = parsedAddress.toLowerCase();
        return lowercasedAddress;
    } catch (_) {
        return null;
    }
    return null;
}

export function getYearFromLocalStorageOrCurrent(): number {
    const yearCandidate = localStorage.getItem("year");
    if (yearCandidate) {
        try {
            const yearCandidateInt = parseInt(yearCandidate);
            if (yearCandidateInt > 2000 && yearCandidateInt < 2100) {
                return yearCandidateInt;
            }
        } catch (_e) {
            // Ignore
        }
    }
    return new Date().getFullYear();
}

/// Returns true if the scans were updated
function saveScansToLocalStorage(scans: Scan[]): boolean {
    const newScansJson = JSON.stringify(scans);
    const newScansReloaded = JSON.parse(newScansJson);

    const oldScansJson = JSON.stringify(getScansFromLocalStorage());
    const oldScansReloaded = JSON.parse(oldScansJson);

    if (semiDeepArrayEqual(newScansReloaded, oldScansReloaded)) {
        console.log("Scans are the same, not updating");
        return false;
    }
    console.log("Updating scans");
    localStorage.setItem("scans", newScansJson);
    return true;
}

export const CommonProvider = (props: ScanProviderProps) => {
    const login = useLoginOrNull();
    const [prices, setPrices] = React.useState<PricesInformation>({
        toUsd: 0,
        toEur: 0,
        toPln: 0,
    });
    const [scans, setScans] = React.useState<ScansInformation>({
        isLoading: true,
        error: "",
        scans: getScansFromLocalStorage(),
    });

    const fetchPrices = async () => {
        try {
            const f = await backendFetch("/api/scan/eth_prices", { method: "GET" });
            const p = await f.json();
            const usdPrice = p.USD;
            const eurPrice = p.EUR;
            const plnPrice = p.PLN;
            //console.log("USD price: ", usdPrice);
            //console.log("EUR price: ", eurPrice);
            //console.log("PLN price: ", plnPrice);
            setPrices({
                toUsd: usdPrice,
                toEur: eurPrice,
                toPln: plnPrice,
            });
        } catch (e) {
            console.error("Error fetching prices", e);
        }
    };

    const getScans = async () => {
        const newScanInfo = {
            isLoading: true,
            error: "",
            scans: scans.scans,
        };

        setScans(newScanInfo);

        try {
            let url = "/api/scan/all";
            if (localStorage.getItem("organization")) {
                url += "?organization=" + localStorage.getItem("organization");
            }
            const response = await backendFetch(url, {
                method: "Get",
            });
            if (response.status !== 200) {
                const data = await response.text();
                throw new Error("Failed to fetch scans " + data);
            }
            const data = await response.json();
            if (saveScansToLocalStorage(data)) {
                setScans({
                    isLoading: false,
                    error: "",
                    scans: data,
                });
            } else {
                if (semiDeepArrayEqual(data, scans.scans)) {
                    setScans({
                        isLoading: false,
                        error: "",
                        scans: scans.scans,
                    });
                } else {
                    setScans({
                        isLoading: false,
                        error: "",
                        scans: data,
                    });
                }
            }
        } catch (e) {
            console.error("Error when loading scans", e);
            setScans({
                isLoading: false,
                error: `Error when loading scans: ${e}`,
                scans: [],
            });
        }
    };

    React.useEffect(() => {
        getScans().then();
        fetchPrices().then();
    }, [login]);

    return (
        <PricesContext.Provider value={prices}>
            <ScanContext.Provider value={scans}>{props.children}</ScanContext.Provider>
        </PricesContext.Provider>
    );
};
