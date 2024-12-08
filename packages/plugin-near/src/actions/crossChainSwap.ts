// import { ChainType, SendTransactionNearParams, Action as DefuseAction, SendTransactionEVMParams } from "@defuse-protocol/defuse-sdk";
import { ActionExample,composeContext,generateObject,IAgentRuntime,Memory,ModelClass,State,type Action,HandlerCallback } from "@ai16z/eliza";
import { walletProvider } from "../providers/wallet";
import { connect, InMemorySigner } from "near-api-js";
import { KeyPairString, Signature } from "near-api-js/lib/utils/key_pair";
import { utils } from "near-api-js";
import { keyStores } from "near-api-js";
import crypto from "crypto";
import { CrossChainSwapParams, createTokenDiffIntent, IntentMessage, IntentStatus,
     PublishIntentRequest, PublishIntentResponse, QuoteRequest, QuoteResponse,
     DefuseAssetIdentifier} from "../types/defuse";
import { DefuseMainnetTokenContractAddress, DefuseTestnetTokenContractAddress } from "../types/defuse";
const DEFUSE_RPC_URL = "https://solver-relay-v2.chaindefuser.com/rpc";

async function makeRPCRequest<T>(method: string, params: any[]): Promise<T> {
    const requestBody = {
        id: 1,
        jsonrpc: "2.0",
        method,
        params,
    };
    console.log("Making RPC request to:", DEFUSE_RPC_URL, method);
    console.log("Request body:", JSON.stringify(requestBody, null, 2));

    const response = await fetch(DEFUSE_RPC_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        throw new Error(`RPC request failed: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.error) {
        throw new Error(`RPC error: ${data.error.message}`);
    }
    console.log("RPC response:", data.result);
    return data.result;
}

const getContractAddress = (assetIdentifier: DefuseAssetIdentifier, isTestnet: boolean = false): string => {
    // Convert DefuseAssetIdentifier to the corresponding contract address enum key
    console.log("Asset identifier:", assetIdentifier);
    const contractKey = assetIdentifier.toString() as keyof typeof DefuseMainnetTokenContractAddress;

    if (isTestnet) {
        // For testnet, only NEAR is supported
        if (assetIdentifier === DefuseAssetIdentifier.NEAR) {
            return DefuseTestnetTokenContractAddress.NEAR;
        }
        return '';
    }

    return DefuseMainnetTokenContractAddress[contractKey] || '';
};

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

    // const signer =  nearConnection.connection.signer
    // console.log("Signer:", signer);
    const isTestnet = networkId === 'testnet';
    const signer = new InMemorySigner(keyStore);

    const quote = await getQuote({
        defuse_asset_identifier_in: getContractAddress(params.defuse_asset_identifier_in, isTestnet),
        defuse_asset_identifier_out: getContractAddress(params.defuse_asset_identifier_out, isTestnet),
        exact_amount_in: params.exact_amount_in,
    });
    console.log("Quote:", quote);
    const intentMessage: IntentMessage = {
        signer_id: accountId,
        deadline: {
            timestamp: Math.floor(Date.now() / 1000) + 300, // 5 minutes from now in seconds
        },
        intents: [createTokenDiffIntent(
            quote[0].defuse_asset_identifier_in,
            quote[0].defuse_asset_identifier_out,
            quote[0].amount_in,
            quote[0].amount_out
        )]
    };
    console.log("Intent message:", intentMessage);

    const message = await signer.signMessage(new Uint8Array(Buffer.from(JSON.stringify(intentMessage))),accountId,networkId);
    const publicKeyBase64 = Buffer.from(message.publicKey.data).toString('base64');

    const intent = await publishIntent({
        quote_hashes: [quote[0].quote_hash],
        signed_data: {
            standard: "nep413",
            payload: {
                message: JSON.stringify(intentMessage),
                nonce: Buffer.from(crypto.randomBytes(32)).toString('base64'),
                recipient: "intents.near"
            },
            public_key: `ed25519:${publicKeyBase64}`,
            signature: `ed25519:${Buffer.from(message.signature).toString('base64')}`
        }
    });

    console.log("Intent:", intent);
    return intent;
}


const crossChainSwapTemplate = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Example response:
\`\`\`json
{
            "defuse_asset_identifier_in": "NEAR",
            "defuse_asset_identifier_out": "USDC,
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
        ],
        [
            {
                user: "user3",
                content: {
                    text: "Swap 100 USDC for NEAR"
                }
            }
        ]
    ] as ActionExample[][],
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
             || !response.exact_amount_in) {
            console.log("Missing required parameters, skipping swap");

            const responseMsg = {
                text: "I need to have the input token, output token, and amount to perform the swap",
            };
            callback?.(responseMsg);
            return true;
        }

        // Add validation for asset identifiers
        if (!Object.values(DefuseAssetIdentifier).includes(response.defuse_asset_identifier_in) ||
            !Object.values(DefuseAssetIdentifier).includes(response.defuse_asset_identifier_out)) {
            console.log("Invalid asset identifiers provided");

            const responseMsg = {
                text: `Invalid tokens provided. Supported tokens are: ${Object.values(DefuseAssetIdentifier).join(', ')}`,
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
} as Action;

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

