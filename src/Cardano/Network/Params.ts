import { Context, Effect, Schema } from "effect"
import * as UTxORef from "../Ledger/UTxORef.js"

/**
 * The raw JSON can be downloaded from the following CDN locations:
 *
 *  - Preview: [https://network-status.helios-lang.io/preview/config](https://network-status.helios-lang.io/preview/config)
 *  - Preprod: [https://network-status.helios-lang.io/preprod/config](https://network-status.helios-lang.io/preprod/config)
 *  - Mainnet: [https://network-status.helios-lang.io/mainnet/config](https://network-status.helios-lang.io/mainnet/config)
 *
 * These JSONs are updated every 15 minutes.
 *
 * Only include the minimum fields needed. flattened so it can be extended more easily
 *
 * NetworkParams are a summary of the Era-specific params, relevant for tx building and validation
 *
 * Optionally, NetworkParams returned by a private node can specify a `collateralUTXO` to use (<txID>#<outputIndex> format). Any transaction submitted through that same node will then add the signature necessary to spend the collateral UTXO.
 * This allows the collateral UTXO managed to be done in a central place (i.e. the node).
 */
export const Params = Schema.Struct({
  txFeeFixed: Schema.Number,
  txFeePerByte: Schema.Number,
  exMemFeePerUnit: Schema.Number,
  exCpuFeePerUnit: Schema.Number,
  utxoDepositPerByte: Schema.Number,
  refScriptsFeePerByte: Schema.Number,
  collateralPercentage: Schema.Number,
  maxCollateralInputs: Schema.Number,
  maxTxExMem: Schema.Number,
  maxTxExCpu: Schema.Number,
  maxTxSize: Schema.Number,
  secondsPerSlot: Schema.Number,
  stakeAddrDeposit: Schema.Number,
  refTipSlot: Schema.Number,
  refTipTime: Schema.Number,
  costModelParamsV1: Schema.Array(Schema.Number),
  costModelParamsV2: Schema.Array(Schema.Number),
  costModelParamsV3: Schema.Array(Schema.Number),
  collateralUTXO: Schema.optional(UTxORef.UTxORef)
})

export type Params = Schema.Schema.Type<typeof Params>

export class params extends Context.Tag("Cardano.Network.Params.params")<
  params,
  Params
>() {}

/**
 * Calculates the time (in milliseconds in 01/01/1970) associated with a given slot number.
 */
export const slotToTime = (slot: number) =>
  params.pipe(
    Effect.map((p) => {
      const slotDiff = slot - p.refTipSlot

      return p.refTipTime + slotDiff * p.secondsPerSlot * 1000
    })
  )

/**
 * Calculates the slot number associated with a given time. Time is specified as milliseconds since 01/01/1970.
 */
export const timeToSlot = (time: number) =>
  params.pipe(
    Effect.map((p) => {
      const timeDiff = time - p.refTipTime

      return p.refTipSlot + Math.round(timeDiff / (1000 * p.secondsPerSlot))
    })
  )

export const costModel = (version: 1 | 2 | 3) =>
  params.pipe(
    Effect.map((p) => {
      switch (version) {
        case 1:
          return p.costModelParamsV1
        case 2:
          return p.costModelParamsV2
        case 3:
          return p.costModelParamsV3
      }
    })
  )
