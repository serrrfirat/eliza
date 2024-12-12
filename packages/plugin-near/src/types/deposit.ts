

import type { Address, Hash } from "viem"

/// Taken from defuse-sdk, will be removed once a proper SDK will be released
/// https://github.com/defuse-protocol/defuse-sdk/blob/main/src/types/deposit.ts
export type ChainType = "near" | "evm"

export const ChainType = {
  Near: "near",
  EVM: "evm",
} as const

export type UserInfo = {
  userAddress?: string
  chainType?: ChainType
}

export type Transaction = {
  NEAR: SendTransactionNearParams
  EVM: SendTransactionEVMParams
}

export type DepositEvent = {
  type: string
  data: unknown
  error?: string
}

export interface FunctionCallAction {
  type: "FunctionCall"
  params: {
    methodName: string
    args: object
    gas: string
    deposit: string
  }
}

export type Action = FunctionCallAction

export interface SendTransactionNearParams {
  receiverId: string
  actions: Array<Action>
}

export interface SendTransactionEVMParams {
  from: Address
  to: Address
  chainId: number
  data: Hash
  value?: bigint
  gasPrice?: bigint
  gas?: bigint
}