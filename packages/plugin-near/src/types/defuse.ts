import { KeyPairString, Signature } from "near-api-js/lib/utils/key_pair";

// Quote Types
export interface QuoteRequest {
    defuse_asset_identifier_in: string;
    defuse_asset_identifier_out: string;
    exact_amount_in?: string;
    exact_amount_out?: string;
    quote_id?: string;
    min_deadline_ms?: number;
}

export interface Quote {
    quote_hash: string;
    defuse_asset_identifier_in: string;
    defuse_asset_identifier_out: string;
    amount_in: string;
    amount_out: string;
    expiration_time: number;
}

export interface QuoteResponse {
    quotes: Quote[];
}

// Intent Types
export interface TokenDiffIntent {
    intent: "token_diff";
    diff: { [key: string]: string };
}

export  interface MTBatchTransferIntent {
    intent: "mt_batch_transfer";
    receiver_id: string;
    token_id_amounts: { [key: string]: string };
}

export interface FTWithdrawIntent {
    intent: "ft_withdraw";
    token: string;
    receiver_id: string;
    amount: string;
    msg: string;
}

export type Intent = TokenDiffIntent | MTBatchTransferIntent | FTWithdrawIntent;

export interface IntentDeadline {
    timestamp: number;
    block_number: number;
}

export interface IntentMessage {
    signer_id: string;
    deadline: IntentDeadline;
    intents: Intent[];
}

export interface SignedData {
    standard: "nep413" | "erc191" | "raw_ed25519";
    message: IntentMessage;
    nonce: string;
    recipient: string;
    signature: Signature;
    public_key?: string;
}

export interface PublishIntentRequest {
    quote_hashes: string[];
    signed_data: SignedData;
}

export interface PublishIntentResponse {
    status: "OK" | "FAILED";
    reason?: string;
    intent_hash: string;
}

export interface IntentStatus {
    intent_hash: string;
    status: "PENDING" | "TX_BROADCASTED" | "SETTLED" | "NOT_FOUND_OR_NOT_VALID_ANYMORE";
    data?: {
        hash?: string;
    };
}


// Example usage of creating a token diff intent
export const createTokenDiffIntent = (
    defuse_asset_identifier_in: string,
    defuse_asset_identifier_out: string,
    exact_amount_in: string,
    exact_amount_out: string
): TokenDiffIntent => {
    return {
        intent: "token_diff",
        diff: {
            [defuse_asset_identifier_in]: `-${exact_amount_in}`,
            [defuse_asset_identifier_out]: exact_amount_out
        }
    };
};

export interface CrossChainSwapParams {
    exact_amount_in: string;
    defuse_asset_identifier_in: DefuseAssetIdentifier;
    defuse_asset_identifier_out: DefuseAssetIdentifier;
}

export enum DefuseMainnetTokenContractAddress {
    AURORA = "aaaaa20d9e0e2461697782ef11675f668207961.factory.bridge.near",
    NEAR = "wrap.near",
    ETHER = "aurora",
    USDC = "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
    SWEAT = "sweat.near",
    USDT = "usdt.tether-token.near",
    MOGCOIN = "eth-0xaaee1a9723aadb7afa2810263653a34ba2c21c7a.omft.near",
    PEPE = "eth-0x6982508145454ce325ddbe47a25d4ec3d2311933.omft.near",
    SHIBAINU = "eth-0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce.omft.near",
    USDC_E = "eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near",
    USDT_E = "eth-0xdac17f958d2ee523a2206206994597c13d831ec7.omft.near",
    DOGE = "doge.omft.near",
    BRETT = "base-0x532f27101965dd16442e59d40670faf5ebb142e4.omft.near",
    ARB = "arb-0x912ce59144191c1204e64559fe8253a0e49e6548.omft.near",
    UNI = "eth-0x1f9840a85d5af5bf1d1762f925bdaddc4201f984.omft.near",
    LINK = "eth-0x514910771af9ca656af840dff83e8264ecf986ca.omft.near",
    SOL = "sol.omft.near",
    ETH_OMFT = "eth.omft.near",
    ETH_BASE = "base.omft.near",
    ETH_ARB = "arb.omft.near",
    AAVE = "eth-0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9.omft.near",
    BTC = "btc.omft.near",
}

export enum DefuseTestnetTokenContractAddress {
    NEAR = "wrap.testnet",
}

export enum DefuseAssetIdentifier {
    // Native tokens
    NEAR = "NEAR",
    ETH = "ETH",
    BTC = "BTC",
    SOL = "SOL",

    // Stablecoins
    USDC = "USDC",
    USDT = "USDT",
    USDC_E = "USDC_E",
    USDT_E = "USDT_E",

    // Other tokens
    AURORA = "AURORA",
    SWEAT = "SWEAT",
    MOGCOIN = "MOGCOIN",
    PEPE = "PEPE",
    SHIBAINU = "SHIBAINU",
    DOGE = "DOGE",
    BRETT = "BRETT",
    ARB = "ARB",
    UNI = "UNI",
    LINK = "LINK",
    ETH_OMFT = "ETH_OMFT",
    ETH_BASE = "ETH_BASE",
    ETH_ARB = "ETH_ARB",
    AAVE = "AAVE"
}
