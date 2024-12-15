// import { ChainType, SendTransactionNearParams, Action as DefuseAction, SendTransactionEVMParams } from "@defuse-protocol/defuse-sdk";
import { ActionExample,composeContext,generateObject,IAgentRuntime,Memory,ModelClass,State,type Action,HandlerCallback } from "@ai16z/eliza";
import { walletProvider } from "../providers/wallet";
import { connect, InMemorySigner } from "near-api-js";
import { KeyPairString, Signature } from "near-api-js/lib/utils/key_pair";
import { utils } from "near-api-js";
import { keyStores } from "near-api-js";
import { createBatchDepositNearNep141Transaction, getDepositedBalances, getNearNep141StorageBalance, getNearNep141StorageBalanceOf, sendNearTransaction, TokenBalances } from "../utils/deposit";
import * as Borsh from "@dao-xyz/borsh";
import * as js_sha256 from "js-sha256";
import crypto from "crypto";
import { CrossChainSwapParams, createTokenDiffIntent, IntentMessage, IntentStatus,
     PublishIntentRequest, PublishIntentResponse, QuoteRequest, QuoteResponse,
     DefuseAssetIdentifier,
     DefuseAssets} from "../types/intents";
import { DefuseMainnetTokenContractAddress, DefuseTestnetTokenContractAddress } from "../types/intents";
import { KeyPair } from "near-api-js";
import { Payload, SignMessageParams } from "../types/intents";
import { providers } from "near-api-js";
const DEFUSE_RPC_URL = "https://solver-relay-v2.chaindefuser.com/rpc";


const POLLING_INTERVAL_MS = 2000; // 2 seconds
const MAX_POLLING_TIME_MS = 300000; // 5 minutes


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

const getContractAddress = (assetIdentifier: DefuseAssetIdentifier, isTestnet: boolean = false): DefuseAssets => {
    // Convert DefuseAssetIdentifier to the corresponding contract address enum key
    console.log("Asset identifier:", assetIdentifier);
    const contractKey = assetIdentifier.toString() as keyof typeof DefuseMainnetTokenContractAddress;

    if (isTestnet) {
        // For testnet, only NEAR is supported
        if (assetIdentifier === DefuseAssetIdentifier.NEAR) {
            return DefuseTestnetTokenContractAddress.NEAR;
        }
        throw new Error(`Token ${assetIdentifier} is not supported on testnet`);
    }

    const address = DefuseMainnetTokenContractAddress[contractKey];
    if (!address) {
        throw new Error(`Token ${assetIdentifier} not found in mainnet contract addresses`);
    }
    return address;
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


// First check the balance of the user, then deposit the tokens if there are any
export const depositIntoDefuse = async (runtime: IAgentRuntime, message: Memory, state: State, tokenIds: DefuseMainnetTokenContractAddress[] | DefuseTestnetTokenContractAddress[], amount: bigint) => {
    const settings = getRuntimeSettings(runtime);
    const nearConnection = await connect({
        networkId: settings.networkId,
        nodeUrl: settings.nodeUrl,
    });
    const nep141balance = await getNearNep141StorageBalance({
        contractId: settings.defuseContractId,
        accountId: settings.accountId
    });
    const publicKey = await nearConnection.connection.signer.getPublicKey(settings.accountId);
    const transaction = createBatchDepositNearNep141Transaction(settings.defuseContractId, amount, nep141balance > BigInt(0), BigInt(0));

    for (const tx of transaction) {
        const result = await sendNearTransaction(nearConnection, settings.accountId, publicKey, settings.defuseContractId, tx);
        console.log("Transaction result:", result);
    }
}


async function getBalances(
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    tokenIds: (DefuseMainnetTokenContractAddress | DefuseTestnetTokenContractAddress)[],
    nearClient: providers.Provider
): Promise<TokenBalances> {
    const isTestnet = runtime.getSetting("NEAR_NETWORK") === "testnet";
    const mainnetTokens = tokenIds.filter((id): id is DefuseMainnetTokenContractAddress => !isTestnet);
    const testnetTokens = tokenIds.filter((id): id is DefuseTestnetTokenContractAddress => isTestnet);

    const tokenBalances = await getDepositedBalances(
        runtime.getSetting("NEAR_ADDRESS") || "",
        isTestnet ? testnetTokens : mainnetTokens,
        nearClient
    );
    console.log("Token balances:", tokenBalances);
    return tokenBalances;
}

async function pollIntentStatus(intentHash: string): Promise<IntentStatus> {
    const startTime = Date.now();

    while (Date.now() - startTime < MAX_POLLING_TIME_MS) {
        const status = await getIntentStatus(intentHash);
        console.log("Current intent status:", status);

        if (status.status === "SETTLED" || status.status === "NOT_FOUND_OR_NOT_VALID") {
            return status;
        }

        await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL_MS));
    }

    throw new Error("Timeout waiting for intent to settle");
}


async function signMessage(keyPair: KeyPair, params: SignMessageParams) {
    // Check the nonce is a 32bytes array
    if (params.nonce.byteLength !== 32) {
        throw Error("Expected nonce to be a 32 bytes buffer");
    }

    // Create the payload and sign it
    const payload = new Payload({ tag: 2147484061, message: params.message, nonce: Array.from(params.nonce), recipient: params.recipient});
    const borshPayload = Borsh.serialize(payload);
    const hashedPayload = js_sha256.sha256.array(borshPayload)
    const { signature } = keyPair.sign(Uint8Array.from(hashedPayload))

    return {
        signature: utils.serialize.base_encode(signature),
        publicKey: utils.serialize.base_encode(keyPair.getPublicKey().data)
    };
}

async function crossChainSwap(runtime: IAgentRuntime, messageFromMemory: Memory,
     state: State, params: CrossChainSwapParams): Promise<any> {

    const settings = getRuntimeSettings(runtime);

    if (!settings.accountId) {
        throw new Error("NEAR_ADDRESS not configured");
    }

    const keyStore = new keyStores.InMemoryKeyStore();
    const keyPair = utils.KeyPair.fromString(settings.secretKey as KeyPairString);
    await keyStore.setKey(settings.networkId, settings.accountId, keyPair);
    const isTestnet = settings.networkId === 'testnet';

    const nearConnection = await connect({
        networkId: settings.networkId,
        keyStore,
        nodeUrl: settings.nodeUrl,
    });

    const defuseAssetIdentifierIn = getContractAddress(params.defuse_asset_identifier_in, isTestnet);
    const defuseAssetIdentifierOut = getContractAddress(params.defuse_asset_identifier_out, isTestnet);
    const tokenBalances = await getBalances(runtime, messageFromMemory, state, [defuseAssetIdentifierIn], nearConnection.connection.provider);
    if (tokenBalances[defuseAssetIdentifierIn] && tokenBalances[defuseAssetIdentifierIn] < BigInt(params.exact_amount_in)) {
        const tokenArray = isTestnet ?
            [defuseAssetIdentifierIn as DefuseTestnetTokenContractAddress] :
            [defuseAssetIdentifierIn as DefuseMainnetTokenContractAddress];
        depositIntoDefuse(runtime, messageFromMemory, state, tokenArray, BigInt(params.exact_amount_in));
    }


    const quote = await getQuote({
        defuse_asset_identifier_in: defuseAssetIdentifierIn,
        defuse_asset_identifier_out: defuseAssetIdentifierOut,
        exact_amount_in: params.exact_amount_in,
    });
    console.log("Quote:", quote);
    const intentMessage: IntentMessage = {
        signer_id: settings.accountId,
        deadline: new Date(Date.now() + 300000).toISOString(), // 5 minutes from now in ISO format
        intents: [createTokenDiffIntent(
            quote[0].defuse_asset_identifier_in,
            quote[0].defuse_asset_identifier_out,
            quote[0].amount_in,
            quote[0].amount_out
        )]
    };
    const messageString = JSON.stringify(intentMessage);
    const nonce = new Uint8Array(crypto.randomBytes(32));
    const recipient = "intents.near";
    const { signature, publicKey } = await signMessage(keyPair, {
        message: messageString,
        recipient,
        nonce
    });

    await ensurePublicKeyRegistered(runtime, `ed25519:${publicKey}`);

    const intent = await publishIntent({
        quote_hashes: [quote[0].quote_hash],
        signed_data: {
            payload: {
                message: messageString,
                nonce: Buffer.from(nonce).toString('base64'),
                recipient
            },
            standard: "nep413",
            signature: `ed25519:${signature}`,
            public_key: `ed25519:${publicKey}`
        }
    });

    console.log("Intent:", intent);

    if (intent.status === "OK") {
        const finalStatus = await pollIntentStatus(intent.intent_hash);
        return finalStatus;
    }

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
            const txHashes = intent.data?.hash;

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

async function addPublicKeyToIntents(runtime: IAgentRuntime, publicKey: string): Promise<void> {
    const settings = getRuntimeSettings(runtime);

    const keyStore = new keyStores.InMemoryKeyStore();
    const keyPair = utils.KeyPair.fromString(settings.secretKey as KeyPairString);
    await keyStore.setKey(settings.networkId, settings.accountId, keyPair);

    const nearConnection = await connect({
        networkId: settings.networkId,
        keyStore,
        nodeUrl: settings.nodeUrl,
    });

    const account = await nearConnection.account(settings.accountId);

    await account.functionCall({
        contractId: "intents.near",
        methodName: "add_public_key",
        args: {
            public_key: publicKey
        },
        gas: BigInt(300000000000000),
        attachedDeposit: BigInt(1)
    });
}

interface RuntimeSettings {
    networkId: string;
    nodeUrl: string;
    accountId: string;
    secretKey: string;
    defuseContractId: string;
}

function getRuntimeSettings(runtime: IAgentRuntime): RuntimeSettings {
    const accountId = runtime.getSetting("NEAR_ADDRESS");
    if (!accountId) {
        throw new Error("NEAR_ADDRESS not configured");
    }

    const secretKey = runtime.getSetting("NEAR_WALLET_SECRET_KEY");
    if (!secretKey) {
        throw new Error("NEAR_WALLET_SECRET_KEY not configured");
    }

    return {
        networkId: runtime.getSetting("NEAR_NETWORK") || "testnet",
        nodeUrl: runtime.getSetting("RPC_URL") || "https://rpc.testnet.near.org",
        accountId: runtime.getSetting("NEAR_ADDRESS") || "",
        secretKey: runtime.getSetting("NEAR_WALLET_SECRET_KEY") || "",
        defuseContractId: runtime.getSetting("DEFUSE_CONTRACT_ID") || "intents.near"
    };
}

// /// Returns set of public keys registered for given account
// fn public_keys_of(&self, account_id: &AccountId) -> HashSet<PublicKey>;

async function getPublicKeysOf(runtime: IAgentRuntime, accountId: string): Promise<Set<string>> {
    const settings = getRuntimeSettings(runtime);
    const nearConnection = await connect({
        networkId: settings.networkId,
        nodeUrl: settings.nodeUrl,
    });

    const account = await nearConnection.account(accountId);
    const result = await account.viewFunction({
        contractId: runtime.getSetting("DEFUSE_CONTRACT_ID") || "intents.near",
        methodName: "public_keys_of",
        args: { account_id: accountId }
    });

    return new Set(result);
}

async function ensurePublicKeyRegistered(runtime: IAgentRuntime, publicKey: string): Promise<void> {
    const settings = getRuntimeSettings(runtime);
    const existingKeys = await getPublicKeysOf(runtime, settings.accountId);
    console.log("Existing keys:", existingKeys);
    console.log("Public key:", publicKey);
    if (!existingKeys.has(publicKey)) {
        console.log(`Public key ${publicKey} not found, registering...`);
        await addPublicKeyToIntents(runtime, publicKey);
    } else {
        console.log(`Public key ${publicKey} already registered`);
    }
}
