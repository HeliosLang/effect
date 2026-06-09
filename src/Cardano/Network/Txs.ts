import { Context, Effect } from "effect"
import type { Address } from "../Ledger/Address.js"
import type { TxHash } from "../Ledger/TxHash.js"
import type { ConnectionError, UnexpectedFormat } from "./errors.js"

export type TxsOrder = "asc" | "desc"

export interface TxsArgs {
  readonly address: Address
  readonly count?: number
  readonly fromBlock?: number
  readonly order?: TxsOrder
  readonly page?: number
  readonly toBlock?: number
}

/**
 * A service that returns all transactions that spend from the given address, or pay to the given address
 *
 * TODO: add filtering by AssetClass
 */
export class Txs extends Context.Tag("Cardano.Network.Txs")<
  Txs,
  (args: TxsArgs) => Effect.Effect<
    {
      hash: TxHash
      indexInBlock?: number
      blockHeight?: number
      blockTime?: number
    }[],
    ConnectionError | UnexpectedFormat
  >
>() {}
