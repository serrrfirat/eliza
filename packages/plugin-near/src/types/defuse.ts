
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
    inToken: string,
    outToken: string,
    inAmount: string,
    outAmount: string
): TokenDiffIntent => {
    return {
        intent: "token_diff",
        diff: {
            [inToken]: `-${inAmount}`,
            [outToken]: outAmount
        }
    };
};

export interface CrossChainSwapParams {
    amountIn: string;
    tokenIn: string;
    tokenOut: string;
}