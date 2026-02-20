import { Context, Effect } from "effect"
import type { Tx } from "../Ledger/Tx.js"
import type { TxHash } from "../Ledger/TxHash.js"
import { ConnectionError, UnexpectedFormat, SubmitTxFailed } from "./errors.js"

export class Submit extends Context.Tag("Cardano.Network.Submit")<
  Submit,
  (
    tx: Tx
  ) => Effect.Effect<
    TxHash,
    ConnectionError | UnexpectedFormat | SubmitTxFailed
  >
>() {}
