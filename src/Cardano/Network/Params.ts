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
 *
 * The guards throwing defects help during debugging
 */
export const slotToTime = (slot: number) =>
  params.pipe(
    Effect.map((p) => {
      if (p.refTipSlot === undefined) {
        throw new Error(`Network.Params.params.refTipSlot is undefined`)
      }

      if (p.refTipTime === undefined) {
        throw new Error(`Network.Params.params.refTipTime is undefined`)
      }

      if (p.secondsPerSlot === undefined) {
        throw new Error(`Network.Params.params.secondsPerSlot is undefined`)
      }

      const slotDiff = slot - p.refTipSlot

      return p.refTipTime + slotDiff * p.secondsPerSlot * 1000
    })
  )

/**
 * Calculates the slot number associated with a given time. Time is specified as milliseconds since 01/01/1970.
 *
 * The guards throwing defects help during debugging
 */
export const timeToSlot = (time: number) =>
  params.pipe(
    Effect.map((p) => {
      if (p.refTipSlot === undefined) {
        throw new Error(`Network.Params.params.refTipSlot is undefined`)
      }

      if (p.refTipTime === undefined) {
        throw new Error(`Network.Params.params.refTipTime is undefined`)
      }

      if (p.secondsPerSlot === undefined) {
        throw new Error(`Network.Params.params.secondsPerSlot is undefined`)
      }

      const timeDiff = time - p.refTipTime

      return p.refTipSlot + Math.round(timeDiff / (1000 * p.secondsPerSlot))
    })
  )

/**
 * The guards throwing defects help during debugging
 */
export const costModel = (version: 1 | 2 | 3) =>
  params.pipe(
    Effect.map((p) => {
      switch (version) {
        case 1:
          if (p.costModelParamsV1 === undefined) {
            throw new Error(
              `Network.Params.params.costModelParamsV1 is undefined`
            )
          }
          return p.costModelParamsV1
        case 2:
          if (p.costModelParamsV2 === undefined) {
            throw new Error(
              `Network.Params.params.costModelParamsV2 is undefined`
            )
          }
          return p.costModelParamsV2
        case 3:
          if (p.costModelParamsV3 === undefined) {
            throw new Error(
              `Network.Params.params.costModelParamsV3 is undefined`
            )
          }
          return p.costModelParamsV3
      }
    })
  )

export const testParams: Params = {
  txFeeFixed: 155381,
  txFeePerByte: 44,
  exMemFeePerUnit: 0.0577,
  exCpuFeePerUnit: 0.0000721,
  utxoDepositPerByte: 4310,
  refScriptsFeePerByte: 15,
  collateralPercentage: 150,
  maxCollateralInputs: 3,
  maxTxExMem: 16500000,
  maxTxExCpu: 10000000000,
  maxTxSize: 16384,
  secondsPerSlot: 1,
  stakeAddrDeposit: 2000000,
  refTipSlot: 116294635,
  refTipTime: 1771977835000,
  costModelParamsV1: [
    100788, 420, 1, 1, 1000, 173, 0, 1, 1000, 59957, 4, 1, 11183, 32, 201305,
    8356, 4, 16000, 100, 16000, 100, 16000, 100, 16000, 100, 16000, 100, 16000,
    100, 100, 100, 16000, 100, 94375, 32, 132994, 32, 61462, 4, 72010, 178, 0,
    1, 22151, 32, 91189, 769, 4, 2, 85848, 228465, 122, 0, 1, 1, 1000, 42921, 4,
    2, 24548, 29498, 38, 1, 898148, 27279, 1, 51775, 558, 1, 39184, 1000, 60594,
    1, 141895, 32, 83150, 32, 15299, 32, 76049, 1, 13169, 4, 22100, 10, 28999,
    74, 1, 28999, 74, 1, 43285, 552, 1, 44749, 541, 1, 33852, 32, 68246, 32,
    72362, 32, 7243, 32, 7391, 32, 11546, 32, 85848, 228465, 122, 0, 1, 1,
    90434, 519, 0, 1, 74433, 32, 85848, 228465, 122, 0, 1, 1, 85848, 228465,
    122, 0, 1, 1, 270652, 22588, 4, 1457325, 64566, 4, 20467, 1, 4, 0, 141992,
    32, 100788, 420, 1, 1, 81663, 32, 59498, 32, 20142, 32, 24588, 32, 20744,
    32, 25933, 32, 24623, 32, 53384111, 14333, 10
  ],
  costModelParamsV2: [
    100788, 420, 1, 1, 1000, 173, 0, 1, 1000, 59957, 4, 1, 11183, 32, 201305,
    8356, 4, 16000, 100, 16000, 100, 16000, 100, 16000, 100, 16000, 100, 16000,
    100, 100, 100, 16000, 100, 94375, 32, 132994, 32, 61462, 4, 72010, 178, 0,
    1, 22151, 32, 91189, 769, 4, 2, 85848, 228465, 122, 0, 1, 1, 1000, 42921, 4,
    2, 24548, 29498, 38, 1, 898148, 27279, 1, 51775, 558, 1, 39184, 1000, 60594,
    1, 141895, 32, 83150, 32, 15299, 32, 76049, 1, 13169, 4, 22100, 10, 28999,
    74, 1, 28999, 74, 1, 43285, 552, 1, 44749, 541, 1, 33852, 32, 68246, 32,
    72362, 32, 7243, 32, 7391, 32, 11546, 32, 85848, 228465, 122, 0, 1, 1,
    90434, 519, 0, 1, 74433, 32, 85848, 228465, 122, 0, 1, 1, 85848, 228465,
    122, 0, 1, 1, 955506, 213312, 0, 2, 270652, 22588, 4, 1457325, 64566, 4,
    20467, 1, 4, 0, 141992, 32, 100788, 420, 1, 1, 81663, 32, 59498, 32, 20142,
    32, 24588, 32, 20744, 32, 25933, 32, 24623, 32, 43053543, 10, 53384111,
    14333, 10, 43574283, 26308, 10
  ],
  costModelParamsV3: [
    100788, 420, 1, 1, 1000, 173, 0, 1, 1000, 59957, 4, 1, 11183, 32, 201305,
    8356, 4, 16000, 100, 16000, 100, 16000, 100, 16000, 100, 16000, 100, 16000,
    100, 100, 100, 16000, 100, 94375, 32, 132994, 32, 61462, 4, 72010, 178, 0,
    1, 22151, 32, 91189, 769, 4, 2, 85848, 123203, 7305, -900, 1716, 549, 57,
    85848, 0, 1, 1, 1000, 42921, 4, 2, 24548, 29498, 38, 1, 898148, 27279, 1,
    51775, 558, 1, 39184, 1000, 60594, 1, 141895, 32, 83150, 32, 15299, 32,
    76049, 1, 13169, 4, 22100, 10, 28999, 74, 1, 28999, 74, 1, 43285, 552, 1,
    44749, 541, 1, 33852, 32, 68246, 32, 72362, 32, 7243, 32, 7391, 32, 11546,
    32, 85848, 123203, 7305, -900, 1716, 549, 57, 85848, 0, 1, 90434, 519, 0, 1,
    74433, 32, 85848, 123203, 7305, -900, 1716, 549, 57, 85848, 0, 1, 1, 85848,
    123203, 7305, -900, 1716, 549, 57, 85848, 0, 1, 955506, 213312, 0, 2,
    270652, 22588, 4, 1457325, 64566, 4, 20467, 1, 4, 0, 141992, 32, 100788,
    420, 1, 1, 81663, 32, 59498, 32, 20142, 32, 24588, 32, 20744, 32, 25933, 32,
    24623, 32, 43053543, 10, 53384111, 14333, 10, 43574283, 26308, 10, 16000,
    100, 16000, 100, 962335, 18, 2780678, 6, 442008, 1, 52538055, 3756, 18,
    267929, 18, 76433006, 8868, 18, 52948122, 18, 1995836, 36, 3227919, 12,
    901022, 1, 166917843, 4307, 36, 284546, 36, 158221314, 26549, 36, 74698472,
    36, 333849714, 1, 254006273, 72, 2174038, 72, 2261318, 64571, 4, 207616,
    8310, 4, 1293828, 28716, 63, 0, 1, 1006041, 43623, 251, 0, 1, 100181, 726,
    719, 0, 1, 100181, 726, 719, 0, 1, 100181, 726, 719, 0, 1, 107878, 680, 0,
    1, 95336, 1, 281145, 18848, 0, 1, 180194, 159, 1, 1, 158519, 8942, 0, 1,
    159378, 8813, 0, 1, 107490, 3298, 1, 106057, 655, 1, 1964219, 24520, 3
  ]
}
