
/// Taken from defuse-sdk, will be removed once a proper SDK will be released
/// https://github.com/defuse-protocol/defuse-sdk/blob/main/src/services/depositService.ts

import { settings } from "@ai16z/eliza"
import type { Transaction } from "../types/deposit"
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