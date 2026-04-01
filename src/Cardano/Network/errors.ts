import { Data } from "effect"
import type { Tx } from "../Ledger/Tx.js"
import type { TxHash } from "../Ledger/TxHash.js"
import type { UTxO } from "../Ledger/UTxO.js"
import type { UTxORef } from "../Ledger/UTxORef.js"

export class ConnectionError extends Data.TaggedError(
  "Cardano.Network.ConnectionError"
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
  "Cardano.Network.UnexpectedFormat"
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
)<{ message: string; utxo: UTxO; spendingTx: TxHash }> {
  constructor(utxo: UTxO, spendingTx: TxHash) {
    super({
      utxo,
      spendingTx,
      message: `UTxO ${utxo.ref} already spent by ${spendingTx}`
    })
  }
}

export class SubmitTxFailed extends Data.TaggedError(
  "Cardano.Network.SubmitTxFailed"
)<{ message: string; tx: Tx }> {
  constructor(message: string, tx: Tx) {
    super({ message, tx })
  }
}

export class TxNotFound extends Data.TaggedError("Cardano.Network.TxNotFound")<{
  message: string
  txHash: TxHash
}> {
  constructor(txHash: TxHash) {
    super({
      txHash,
      message: `Tx ${txHash} not found`
    })
  }
}
