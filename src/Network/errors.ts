import { Data } from "effect"
import type { TxHash } from "../Ledger/TxHash.js"
import type { UTxORef } from "../Ledger/UTxORef.js"

export class ConnectionError extends Data.TaggedError(
  "CardanoNetworkConnectionError"
)<{
  message: string
}> {
  constructor(message: string) {
    super({
      message: `Failed to connect to Cardano network (${message})`
    })
  }
}

export class UnexpectedFormat extends Data.TaggedError(
  "CardanoNetworkUnexpectedFormat"
)<{
  message: string
}> {
  constructor(message: string) {
    super({
      message: `Unexpected format returned from Cardano network (${message})`
    })
  }
}

export class UTxONotFound extends Data.TaggedError(
  "Cardano.Network.UTxONotFound"
)<{ message: string; ref: UTxORef }> {
  constructor(ref: UTxORef) {
    super({
      ref,
      message: `UTxO ${ref} not found`
    })
  }
}

export class UTxOAlreadySpent extends Data.TaggedError(
  "Cardano.Network.UTxOAlreadySpent"
)<{ message: string; ref: UTxORef; spendingTx: TxHash }> {
  constructor(ref: UTxORef, spendingTx: TxHash) {
    super({
      ref,
      spendingTx,
      message: `UTxO ${ref} already spent by ${spendingTx}`
    })
  }
}
