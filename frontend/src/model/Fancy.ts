export interface Fancy {
    address: string;
    score: number;
    price: number;
    category: string;
    created: string;
    miner: string;
}

export interface UserTokenResponse {
    uid: string,
    email: string,
    tokens: number,
}