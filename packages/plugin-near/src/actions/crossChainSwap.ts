import { ChainType, SendTransactionNearParams, Action as DefuseAction, SendTransactionEVMParams } from "@defuse-protocol/defuse-sdk";
import { ActionExample,composeContext,generateObject,IAgentRuntime,Memory,ModelClass,State,type Action,HandlerCallback } from "@ai16z/eliza";
import { walletProvider } from "../providers/wallet";
import { connect } from "near-api-js";
import { KeyPairString, Signature } from "near-api-js/lib/utils/key_pair";
import { utils } from "near-api-js";
import { keyStores } from "near-api-js";
import { signTransaction } from "near-api-js/lib/transaction";
import crypto from "crypto";
import { CrossChainSwapParams, createTokenDiffIntent, IntentMessage, IntentStatus,
     PublishIntentRequest, PublishIntentResponse, QuoteRequest, QuoteResponse } from "../types/defuse";

const DEFUSE_RPC_URL = "https://solver-relay-v2.chaindefuser.com/rpc";

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

async function crossChainSwap(runtime: IAgentRuntime, messageFromMemory: Memory,
     state: State, params: CrossChainSwapParams): Promise<any> {

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
    return intent;
}


const crossChainSwapTemplate = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Example response:
\`\`\`json
{
            "defuse_asset_identifier_in": "nep141:ft1.near",
            "defuse_asset_identifier_out": "nep141:ft2.near",
            "exact_amount_in": "1000",
            "quote_id": "00000000-0000-0000-0000-000000000000", // OPTIONAL. default will be generated randomly
            "min_deadline_ms": "60000" // OPTIONAL. default 120_000ms / 2min
        }
\`\`\`

{{recentMessages}}

Given the recent messages and wallet information below:

{{walletInfo}}

Extract the following information about the requested token swap:
- defuse_asset_identifier_in: The input token ID
- defuse_asset_identifier_out: The output token ID
- exact_amount_in: The amount to swap

Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined. The result should be a valid JSON object with the following schema:
\`\`\`json
{
    "defuse_asset_identifier_in": string | null,
    "defuse_asset_identifier_out": string | null,
    "exact_amount_in": string | null
}
\`\`\``;


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
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<any> => {
        if (!state) {
            state = await runtime.composeState(message);
        }
        const walletInfo = await walletProvider.get(runtime, message, state);
        state.walletInfo = walletInfo;

        const swapContext = composeContext({
            state,
            template: crossChainSwapTemplate,
        });

        const response = await generateObject({
            runtime,
            context: swapContext,
            modelClass: ModelClass.LARGE,
        });

        console.log("Response:", response);

        if (!response.defuse_asset_identifier_in || !response.defuse_asset_identifier_out
             || !response.exact_amount_in || !response.exact_amount_out) {
            console.log("Missing required parameters, skipping swap");
            const responseMsg = {
                text: "I need to have the input token, output token, and amount to perform the swap",
            };
            callback?.(responseMsg);
            return true;
        }
        try {
            const intent = await crossChainSwap(runtime, message, state, response);
            console.log("Swap completed successfully!");
            const txHashes = intent.data.hashes;

            const responseMsg = {
                text: `Swap completed successfully! Transaction hashes: ${txHashes}`,
            };

            callback?.(responseMsg);
            return true;
        } catch (error) {
            console.error("Error during cross-chain swap:", error);
            const responseMsg = {
                text: `Error during cross-chain swap: ${error instanceof Error ? error.message : String(error)}`,
            };
            callback?.(responseMsg);
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

