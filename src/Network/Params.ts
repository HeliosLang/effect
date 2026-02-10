import { Context, Effect, Schema } from "effect"
import * as UTxORef from "../Ledger/UTxORef.js"
import { ConnectionError, UnexpectedFormat } from "./errors.js"

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
  refTopSlot: Schema.Number,
  refTipTime: Schema.Number,
  costModelParamsV1: Schema.Array(Schema.Number),
  costModelParamsV2: Schema.Array(Schema.Number),
  costModelParamsV3: Schema.Array(Schema.Number),
  collateralUTXO: Schema.optional(UTxORef.UTxORef)
})

export type Params = Schema.Schema.Type<typeof Params>

export class Fetch extends Context.Tag("NetworkParamsFetch")<
  Fetch,
  () => Effect.Effect<Params, ConnectionError | UnexpectedFormat, never>
>() {}
