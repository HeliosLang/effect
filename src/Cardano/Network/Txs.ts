import { Context, Effect } from "effect"
import type { Address } from "../Ledger/Address.js"
import type { TxHash } from "../Ledger/TxHash.js"
import type { ConnectionError, UnexpectedFormat } from "./errors.js"

/**
 * A service that returns all transactions that spend from the given address, or pay to the given address
 *
 * TODO: add config for filtering, pagination etc. (these can potentially be a lot of transactions!)
 * TODO: add filtering by AssetClass
 */
export class Txs extends Context.Tag("Cardano.Network.Txs")<
  Txs,
  (args: { address: Address }) => Effect.Effect<
    {
      hash: TxHash
      indexInBlock?: number
      blockHeight?: number
      blockTime?: number
    }[],
    ConnectionError | UnexpectedFormat
  >
>() {}
