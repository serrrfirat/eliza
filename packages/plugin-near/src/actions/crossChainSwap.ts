import { ChainType, SendTransactionNearParams, Action as DefuseAction, SendTransactionEVMParams } from "@defuse-protocol/defuse-sdk";
import { ActionExample,composeContext,generateObject,IAgentRuntime,Memory,ModelClass,State,type Action,HandlerCallback } from "@ai16z/eliza";
import { walletProvider } from "../providers/wallet";
import { connect } from "near-api-js";
import { KeyPairString, Signature } from "near-api-js/lib/utils/key_pair";
import { utils } from "near-api-js";
import { keyStores } from "near-api-js";
import { signTransaction } from "near-api-js/lib/transaction";
import crypto from "crypto";

const DEFUSE_RPC_URL = "https://solver-relay-v2.chaindefuser.com/rpc";

// Quote Types
interface QuoteRequest {
    defuse_asset_identifier_in: string;
    defuse_asset_identifier_out: string;
    exact_amount_in?: string;
    exact_amount_out?: string;
    quote_id?: string;
    min_deadline_ms?: number;
}

interface Quote {
    quote_hash: string;
    defuse_asset_identifier_in: string;
    defuse_asset_identifier_out: string;
    amount_in: string;
    amount_out: string;
    expiration_time: number;
}

interface QuoteResponse {
    quotes: Quote[];
}

// Intent Types
interface TokenDiffIntent {
    intent: "token_diff";
    diff: { [key: string]: string };
}

interface MTBatchTransferIntent {
    intent: "mt_batch_transfer";
    receiver_id: string;
    token_id_amounts: { [key: string]: string };
}

interface FTWithdrawIntent {
    intent: "ft_withdraw";
    token: string;
    receiver_id: string;
    amount: string;
    msg: string;
}

type Intent = TokenDiffIntent | MTBatchTransferIntent | FTWithdrawIntent;

interface IntentDeadline {
    timestamp: number;
    block_number: number;
}

interface IntentMessage {
    signer_id: string;
    deadline: IntentDeadline;
    intents: Intent[];
}

interface SignedData {
    standard: "nep413" | "erc191" | "raw_ed25519";
    message: IntentMessage;
    nonce: string;
    recipient: string;
    signature: Signature;
    public_key?: string;
}

interface PublishIntentRequest {
    quote_hashes: string[];
    signed_data: SignedData;
}

interface PublishIntentResponse {
    status: "OK" | "FAILED";
    reason?: string;
    intent_hash: string;
}

interface IntentStatus {
    intent_hash: string;
    status: "PENDING" | "TX_BROADCASTED" | "SETTLED" | "NOT_FOUND_OR_NOT_VALID_ANYMORE";
    data?: {
        hash?: string;
    };
}

async function makeRPCRequest<T>(method: string, params: any[]): Promise<T> {
    const response = await fetch(DEFUSE_RPC_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            id: 1,
            jsonrpc: "2.0",
            method,
            params,
        }),
    });

    if (!response.ok) {
        throw new Error(`RPC request failed: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.error) {
        throw new Error(`RPC error: ${data.error.message}`);
    }

    return data.result;
}

export const getQuote = async (params: QuoteRequest): Promise<QuoteResponse> => {
    return makeRPCRequest<QuoteResponse>("quote", [params]);
};

export const publishIntent = async (params: PublishIntentRequest): Promise<PublishIntentResponse> => {
    return makeRPCRequest<PublishIntentResponse>("publish_intent", [params]);
};

export const getIntentStatus = async (intentHash: string): Promise<IntentStatus> => {
    return makeRPCRequest<IntentStatus>("get_status", [{
        intent_hash: intentHash
    }]);
};

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

export const getCurrentBlock = async (runtime: IAgentRuntime): Promise<{ blockHeight: number }> => {
    try {
        const networkId = runtime.getSetting("NEAR_NETWORK") || "testnet";
        const nodeUrl = runtime.getSetting("RPC_URL") || "https://rpc.testnet.near.org";

        const nearConnection = await connect({
            networkId,
            nodeUrl,
            headers: {}
        });

        // Get the latest block using finality: 'final' for the most recent finalized block
        const block = await nearConnection.connection.provider.block({
            finality: 'final'
        });

        return {
            blockHeight: block.header.height
        };
    } catch (error) {
        console.error("Error getting current block:", error);
        throw error;
    }
};

export const depositIntoDefuse = async (runtime: IAgentRuntime, message: Memory, state: State) => {
    const walletInfo = await walletProvider.get(runtime, message, state);
    state.walletInfo = walletInfo;
}

async function crossChainSwap(runtime: IAgentRuntime, messageFromMemory: Memory, state: State, params: CrossChainSwapParams) {

    const networkId = runtime.getSetting("NEAR_NETWORK") || "testnet";
    const nodeUrl = runtime.getSetting("RPC_URL") || "https://rpc.testnet.near.org";
    const accountId = runtime.getSetting("NEAR_ADDRESS");
    if (!accountId) {
        throw new Error("NEAR_ADDRESS not configured");
    }

    const secretKey = runtime.getSetting("NEAR_WALLET_SECRET_KEY");
    const keyStore = new keyStores.InMemoryKeyStore();
    const keyPair = utils.KeyPair.fromString(secretKey as KeyPairString);
    await keyStore.setKey(networkId, accountId, keyPair);

    const nearConnection = await connect({
        networkId,
        keyStore,
        nodeUrl,
    });
    const signer =  nearConnection.connection.signer

    const quote = await getQuote({
        defuse_asset_identifier_in: params.tokenIn,
        defuse_asset_identifier_out: params.tokenOut,
        exact_amount_in: params.amountIn,
    });

    console.log("Quote:", quote);
    const intentMessage: IntentMessage = {
        signer_id: accountId,
        deadline: {
            timestamp: Date.now() + 1000 * 60 * 5, // 5 minutes from now
            block_number: (await getCurrentBlock(runtime)).blockHeight+1000,
        },
        intents: [createTokenDiffIntent(params.tokenIn, params.tokenOut, params.amountIn, quote.quotes[0].amount_out)]
    };

    const message = await signer.signMessage(new Uint8Array(Buffer.from(JSON.stringify(intentMessage))));
    const intent = await publishIntent({
        quote_hashes: [quote.quotes[0].quote_hash],
        signed_data: {
            standard: "nep413",
            message: intentMessage,
            nonce: await generateUniqueNonce(runtime),
            recipient: runtime.getSetting("DEFUSE_CONTRACT_ID") as string,
            signature: message,
            public_key: keyPair.getPublicKey().toString()
        }
    });

    console.log("Intent:", intent);
}

export const executeCrossChainSwap: Action = {
    name: "near_cross_chain_swap",
    description: "Swap tokens between NEAR and other supported chains",
    similes: [
        "swap NEAR tokens for tokens on other chains",
        "perform cross-chain token exchange from NEAR",
        "exchange NEAR tokens across different blockchains"
    ],
    examples: [
        [
            {
                user: "user1",
                content: {
                    text: "Swap 10 NEAR for ETH"
                }
            }
        ],
        [
            {
                user: "user2",
                content: {
                    text: "Exchange 5 NEAR to USDC on Base"
                }
            }
        ]
    ],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        console.log("Message:", message);
        return true;
    },
    handler: async (runtime: IAgentRuntime, message: Memory, state: State, _options: { [key: string]: unknown }, callback?: HandlerCallback) => {
        const walletInfo = await walletProvider.get(runtime, message, state);
        state.walletInfo = walletInfo;

        const swapContext = composeContext({
            state,
            template: swapTemplate,
        });

        const response = await generateObject({
            runtime,
            context: swapContext,
            modelClass: ModelClass.LARGE,
        });

        console.log("Response:", response);

        if (!response.amountIn || !response.tokenIn || !response.tokenOut ) {
            console.log("Missing required parameters, skipping swap");
            const responseMsg = {
                text: "I need the input token ID, output token ID, and amount to perform the swap",
            };
            callback?.(responseMsg);
            return true;
        }
        // Create the cross-chain swap transaction
        const transaction: SendTransactionNearParams = {
            receiverId: runtime.getSetting("DEFUSE_CONTRACT_ID") as string,
            actions: [
                {
                    type: "FunctionCall",
                    params: {
                        methodName: "swap_tokens",
                        args: {
                            token_in: response.tokenIn,
                            token_out: response.tokenOut,
                            amount_in: response.amountIn,
                            min_amount_out: "0", // You might want to calculate this
                            referral_id: "",
                        },
                        gas: "300000000000000", // 300 TGas
                        deposit: "1", // Attach 1 yoctoNEAR for security
                    }
                }
            ]
        };

        try {
            const result = await context.sendTransaction(transaction);
            return {
                success: true,
                data: {
                    txHash: result.txHash,
                    message: `Successfully initiated cross-chain swap of ${amountIn} ${tokenIn} for ${tokenOut}`
                }
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to execute cross-chain swap: ${error.message}`
            };
        }
    }
};

export const generateUniqueNonce = async (runtime: IAgentRuntime): Promise<string> => {
    try {
        const { blockHeight } = await getCurrentBlock(runtime);
        const timestamp = Date.now();
        const randomBytes = crypto.randomBytes(32).toString('base64');

        const uniqueString = `${blockHeight}-${timestamp}-${randomBytes}`;
        const hash = crypto.createHash('sha256').update(uniqueString).digest();
        const hashedNonce = utils.serialize.base_encode(hash);

        return hashedNonce;
    } catch (error) {
        console.error("Error generating nonce:", error);
        throw error;
    }
};

