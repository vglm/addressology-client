export interface RunnerTarget {
    factory: string | null;
    publicKeyBase: string | null;
}

export interface Runner {
    started: boolean;
    enabled: boolean;
    currentTarget: string | RunnerTarget;
    workTarget: string | RunnerTarget;
    queueLen: number;
    data: {
        runnerNo: number;
        deviceName: string | null;
        totalComputed: number | null;
        reportedSpeed: number | null;
        foundAddressesCount: number;
        lastUpdatedSpeed: string | null;
        lastAddressFound: string | null;
    };
}
