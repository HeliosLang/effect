import { Context, Effect } from "effect"
import type { UTxO } from "../Ledger/UTxO.js"
import type { UTxORef } from "../Ledger/UTxORef.js"
import {
  ConnectionError,
  UnexpectedFormat,
  UTxOAlreadySpent,
  UTxONotFound
} from "./errors.js"

// TODO: add UTxONotFound and UTxOAlreadySpent errors
class UTxO$ extends Context.Tag("Cardano.Network.UTxO")<
  UTxO$,
  (
    ref: UTxORef
  ) => Effect.Effect<
    UTxO,
    ConnectionError | UnexpectedFormat | UTxONotFound | UTxOAlreadySpent
  >
>() {}

export { UTxO$ as UTxO }

/**
 * Usefuly for testing
 * @param knownUTxOs
 * @returns
 */
export const provideKnownUTxOs = (knownUTxOs: Record<string, UTxO>) =>
  Effect.provideService(UTxO$, (ref: UTxORef) => {
    if (ref in knownUTxOs) {
      return Effect.succeed(knownUTxOs[ref])
    } else {
      return Effect.fail(new UTxONotFound(ref))
    }
  })
