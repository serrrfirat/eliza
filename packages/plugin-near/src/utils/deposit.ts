
/// Taken from defuse-sdk, will be removed once a proper SDK will be released
/// https://github.com/defuse-protocol/defuse-sdk/blob/main/src/services/depositService.ts

import { settings } from "@ai16z/eliza"
import type { Transaction } from "../types/deposit"
import { DefuseAssetIdentifier, DefuseMainnetTokenContractAddress } from "../types/intents"
import { providers } from "near-api-js"
import { CodeResult } from "near-api-js/lib/providers/provider"
const FT_DEPOSIT_GAS = `30${"0".repeat(12)}` // 30 TGAS
const FT_TRANSFER_GAS = `50${"0".repeat(12)}` // 30 TGAS

/**
 * Creates a deposit transaction for NEAR.
 *
 * @param receiverId - The address of the Defuse protocol.
 * @param assetId - The address of the asset being deposited.
 * @param amount - The amount to deposit.
 * @returns An array containing the transaction object.
 *
 * @remarks
 * The `args` object in the returned transaction can be customized:
 * - If `msg` is empty, the asset will be deposited to the caller's address.
 * - To create an intent after deposit, `msg` should be a JSON string with the following structure:
 *   {
 *     "receiver_id": "receiver.near", // required
 *     "execute_intents": [...], // signed intents, optional
 *     "refund_if_failed": true // optional, default: false
 *   }
 */
export function createBatchDepositNearNep141Transaction(
  assetAccountId: string,
  amount: bigint,
  isStorageDepositRequired: boolean,
  minStorageBalance: bigint
): Transaction["NEAR"][] {
  return [
    {
      receiverId: assetAccountId,
      actions: [
        ...(isStorageDepositRequired
          ? [
              {
                type: "FunctionCall" as const,
                params: {
                  methodName: "storage_deposit",
                  args: {
                    account_id: settings.defuseContractId || "intents.near",
                    registration_only: true,
                  },
                  gas: FT_DEPOSIT_GAS,
                  deposit: minStorageBalance.toString(),
                },
              },
            ]
          : []),
        {
          type: "FunctionCall",
          params: {
            methodName: "ft_transfer_call",
            args: {
              receiver_id: settings.defuseContractId || "intents.near",
              amount: amount.toString(),
              msg: "",
            },
            gas: FT_TRANSFER_GAS,
            deposit: "1",
          },
        },
      ],
    },
  ]
}

export function createBatchDepositNearNativeTransaction(
  assetAccountId: string,
  amount: bigint,
  wrapAmount: bigint,
  isWrapNearRequired: boolean,
  minStorageBalance: bigint
): Transaction["NEAR"][] {
  return [
    {
      receiverId: assetAccountId,
      actions: [
        ...(isWrapNearRequired
          ? [
              {
                type: "FunctionCall" as const,
                params: {
                  methodName: "near_deposit",
                  args: {},
                  gas: FT_DEPOSIT_GAS,
                  deposit: (wrapAmount + minStorageBalance).toString(),
                },
              },
            ]
          : []),
        {
          type: "FunctionCall",
          params: {
            methodName: "ft_transfer_call",
            args: {
              receiver_id: settings.defuseContractId || "intents.near",
              amount: amount.toString(),
              msg: "",
            },
            gas: FT_TRANSFER_GAS,
            deposit: "1",
          },
        },
      ],
    },
  ]
}

type TokenBalances = Record<DefuseMainnetTokenContractAddress , bigint>


export async function getDepositedBalances(
    accountId: string,
    tokenIds: DefuseMainnetTokenContractAddress[],
    nearClient: providers.Provider
  ): Promise<TokenBalances> {
    // RPC call
    // Warning: `CodeResult` is not correct type for `call_function`, but it's closest we have.
    const output = await nearClient.query<CodeResult>({
      request_type: "call_function",
      account_id: settings.defuseContractId || "intents.near",
      method_name: "mt_batch_balance_of",
      args_base64: btoa(
        JSON.stringify({
          account_id: accountId,
          token_ids: tokenIds,
        })
      ),
      finality: "optimistic",
    })

    // Decoding response
    const uint8Array = new Uint8Array(output.result)
    const decoder = new TextDecoder()
    const parsed = JSON.parse(decoder.decode(uint8Array))

    // Validating response
    assert(
      Array.isArray(parsed) && parsed.every((a) => typeof a === "string"),
      "Invalid response"
    )
    assert(parsed.length === tokenIds.length, "Invalid response")


    /// TODO: Need to fix the tokenIds to be correct type. This does not work right now. 
    // Transforming response
    const result: TokenBalances = {}
    for (let i = 0; i < tokenIds.length; i++) {
      // biome-ignore lint/style/noNonNullAssertion: always within bounds
      result[tokenIds[i]!] = BigInt(parsed[i])
    }

    return result
  }

  export function assert(condition: unknown, msg?: string): asserts condition {
    if (!condition) {
      throw new Error(msg)
    }
  }