import { Context, Effect } from "effect"
import type { Tx } from "../Ledger/Tx.js"
import { ConnectionError, UnexpectedFormat, SubmitTxFailed } from "./errors.js"

/**
 * The Submit endpoint returns a potentially mutated tx,
 *   this way the server can apply final changes (eg. signing for using centralized collateral utxos)
 *
 * This can potentially also be used to create intentful transactions using only UTxOs locked at smart contract addresses
 *   (so not requiring a PubKey signature from the entity building the tx)
 *
 * The disadvantage of this is that the response is up to 16 kB in size,
 *   but transaction submissions are much rarer than read operations, so this is probably only a minor inconvenience
 */
export class Submit extends Context.Tag("Cardano.Network.Submit")<
  Submit,
  (
    tx: Tx
  ) => Effect.Effect<Tx, ConnectionError | UnexpectedFormat | SubmitTxFailed>
>() {}
