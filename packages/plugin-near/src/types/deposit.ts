

import type { Address, Hash } from "viem"
import type { Action } from "@near-js/transactions"
/// Taken from defuse-sdk, will be removed once a proper SDK will be released
/// https://github.com/defuse-protocol/defuse-sdk/blob/main/src/types/deposit.ts
export type ChainType = "near" | "evm"

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

export type GetNearNep141StorageBalanceOfRequest = JSONRPCRequest<
  "query",
  {
    request_type: "call_function"
    account_id: string
    method_name: "storage_balance_of"
    args_base64: string
    finality: "optimistic"
  }
>

export type GetNearNep141StorageBalanceOfResponse = JSONRPCResponse<{
  block_hash: string
  block_height: number
  logs: []
  result: number[]
}>

export type JSONRPCRequest<Method, Params> = {
    id: string
    jsonrpc: "2.0"
    method: Method
    params: Params[]
  }

  export type JSONRPCResponse<Result> = {
    id: string
    jsonrpc: "2.0"
    result: Result
  }

  export type GetNearNep141StorageBalanceBoundsRequest = JSONRPCRequest<
  "query",
  {
    request_type: "call_function"
    account_id: string
    method_name: "storage_balance_bounds"
    args_base64: string
    finality: "optimistic"
  }
>

export type GetNearNep141StorageBalanceBoundsResponse = JSONRPCResponse<{
  block_hash: string
  block_height: number
  logs: []
  result: number[]
}>

export class FetchError extends Error {
    name = "FetchError"
  }

export  class ResponseError extends Error {
    name = "ResponseError"
    constructor(
      public response: Response,
      msg?: string
    ) {
      super(msg)
    }
  }