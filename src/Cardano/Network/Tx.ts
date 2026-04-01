import { Context, Effect } from "effect"
import type { Tx } from "../Ledger/Tx.js"
import type { TxHash } from "../Ledger/TxHash.js"
import { ConnectionError, UnexpectedFormat, TxNotFound } from "./errors.js"

class Tx$ extends Context.Tag("Cardano.Network.Tx")<
  Tx$,
  (
    hash: TxHash
  ) => Effect.Effect<Tx, ConnectionError | UnexpectedFormat | TxNotFound>
>() {}

export { Tx$ as Tx }
