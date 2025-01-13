import { field, option, fixedArray } from '@dao-xyz/borsh';


export interface SignMessageParams {
    message: string;
    recipient: string;
    nonce: Uint8Array;
    callbackUrl?: string;
}

export class Payload {
    @field({ type: 'u32' })
    tag: number; // Always the same tag: 2**31 + 413

    @field({ type: 'string' })
    message: string; // The same message passed in `SignMessageParams.message`

    @field({ type: fixedArray('u8', 32) })
    nonce: number[]; // The same nonce passed in `SignMessageParams.nonce`

    @field({ type: 'string' })
    recipient: string; // The same recipient passed in `SignMessageParams.recipient`

    @field({ type: option('string') })
    callbackUrl?: string;

    constructor({ message, nonce, recipient }: Payload) {
        this.tag = 2147484061;
        this.message = message;
        this.nonce = nonce;
        this.recipient = recipient;
    }
}
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

export type QuoteResponse = Quote[];

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
    memo: string;
}

export type Intent = TokenDiffIntent | MTBatchTransferIntent | FTWithdrawIntent;

export interface IntentMessage {
    signer_id: string;
    deadline: string;
    intents: Intent[];
}

export interface SignedData {
    standard: "nep413" | "erc191" | "raw_ed25519";
    payload: {
        message: string;  // JSON stringified IntentMessage
        nonce: string;
        recipient: string;
    };
    public_key: string;
    signature: string;
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
    status: "PENDING" | "TX_BROADCASTED" | "SETTLED" | "NOT_FOUND_OR_NOT_VALID";
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
            [defuse_asset_identifier_out]: exact_amount_out,
            [defuse_asset_identifier_in]: `-${exact_amount_in}`
        }
    };
};

export interface CrossChainSwapParams {
    exact_amount_in: string;
    defuse_asset_identifier_in: string;
    defuse_asset_identifier_out: string;
    network?: string;
}

export interface CrossChainSwapAndWithdrawParams {
    exact_amount_in: string;
    defuse_asset_identifier_in: string;
    defuse_asset_identifier_out: string;
    destination_address: string;
    network?: string;
}
