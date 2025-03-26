export interface Runner {
    started: boolean;
    data: {
        runnerNo: number;
        totalComputed: number | null;
        reportedSpeed: number | null;
        foundAddressesCount: number;
        lastUpdatedSpeed: string | null;
        lastAddressFound: string | null;
    };
}
