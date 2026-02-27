import { Context, Effect, Option, ParseResult, Schema } from "effect"
import {
  FromUplcData as DatumHashFromUplcData,
  hash as hashDatum
} from "./Ledger/DatumHash.js"
import { FromUplcData as MintingPolicyFromUplcData } from "./Ledger/MintingPolicy.js"
import {
  FromUplcData as AssetsFromUplcData,
  type Assets,
  nonAdaPolicies
} from "./Ledger/Assets.js"
import { FromUplcData as DCertFromUplcData } from "./Ledger/DCert.js"
import { FromUplcData as PubKeyHashFromUplcData } from "./Ledger/PubKeyHash.js"
import { Redeemer } from "./Ledger/Redeemer.js"
import { FromUplcData as RewardAddressFromUplcData } from "./Ledger/RewardAddress.js"
import { type Tx, hash as hashTx, inputDatum } from "./Ledger/Tx.js"
import {
  FromUplcData as TxHashFromUplcData,
  FromUplcDataV3 as TxHashFromUplcDataV3
} from "./Ledger/TxHash.js"
import { FromUplcData as TxOutputFromUplcData } from "./Ledger/TxOutput.js"
import {
  FromUplcData as UTxOFromUplcData,
  FromUplcDataV3 as UTxOFromUplcDataV3
} from "./Ledger/UTxO.js"
import {
  FromUplcData as UTxORefFromUplcData,
  FromUplcDataV3 as UTxORefFromUplcDataV3
} from "./Ledger/UTxORef.js"
import * as Params from "./Network/Params.js"
import * as Data from "./Uplc/Data.js"
import * as Value from "./Uplc/Value.js"

export const makeArgs = (version: 1 | 2 | 3, tx: Tx, redeemerIndex: number) =>
  Effect.gen(function* () {
    switch (version) {
      case 1:
        throw new Error("ScriptContext for UPLC v1 not supported")
      case 2:
        return yield* makeArgsV2(tx, redeemerIndex)
      case 3:
        return yield* makeArgsV3(tx, redeemerIndex)
    }
  })

const LovelaceFromData = Schema.transform(
  AssetsFromUplcData(false),
  Schema.BigIntFromSelf,
  {
    strict: true,
    decode: (assets: Assets) => assets[""],
    encode: (fee: bigint) => ({ "": fee })
  }
)

/**
 * in V2, 0 lovelace is prepended
 */
const MintedAssetsV2 = Schema.transform(
  AssetsFromUplcData(true),
  Schema.typeSchema(AssetsFromUplcData(true)),
  {
    strict: true,
    decode: (assets) => assets,
    encode: (assets) => ({ "": 0n, ...assets })
  }
)

const ValiditySlotRange = Schema.transformOrFail(
  Data.TimeRange,
  Schema.Struct({
    firstValidSlot: Schema.optional(Schema.Int),
    lastValidSlot: Schema.optional(Schema.Int)
  }),
  {
    strict: true,
    decode: (tr) =>
      Effect.zip(
        Number.isFinite(tr.start)
          ? Params.timeToSlot(tr.start)
          : Effect.succeed(undefined),
        Number.isFinite(tr.end)
          ? Params.timeToSlot(tr.end)
          : Effect.succeed(undefined)
      ).pipe(
        Effect.map(([firstValidSlot, lastValidSlot]) => ({
          firstValidSlot,
          lastValidSlot
        }))
      ),
    encode: (tr) =>
      Effect.zip(
        tr.firstValidSlot === undefined
          ? Effect.succeed(Number.NEGATIVE_INFINITY)
          : Params.slotToTime(tr.firstValidSlot),
        tr.lastValidSlot === undefined
          ? Effect.succeed(Number.POSITIVE_INFINITY)
          : Params.slotToTime(tr.lastValidSlot)
      ).pipe(Effect.map(([start, end]): Data.TimeRange => ({ start, end })))
  }
)

const TxInfoV2 = Data.EnumVariant(0, {
  inputs: Data.Array(UTxOFromUplcData),
  refInputs: Data.Array(UTxOFromUplcData),
  outputs: Data.Array(TxOutputFromUplcData),
  fee: LovelaceFromData,
  minted: MintedAssetsV2,
  dcerts: Data.Array(DCertFromUplcData),
  withdrawals: Data.PairArray(RewardAddressFromUplcData, Data.BigInt),
  validityTimeRange: ValiditySlotRange,
  signers: Data.Array(PubKeyHashFromUplcData),
  redeemers: Data.PairArray(Data.Data, Data.Data),
  datums: Data.PairArray(DatumHashFromUplcData, Data.Data),
  txHash: Data.EnumVariant(0, { hash: TxHashFromUplcData })
})

type TxInfoV2 = Schema.Schema.Type<typeof TxInfoV2>

/**
 * Only use for testing!
 */
export const TxInfoV3 = Data.EnumVariant(0, {
  inputs: Data.Array(UTxOFromUplcDataV3),
  refInputs: Data.Array(UTxOFromUplcDataV3),
  outputs: Data.Array(TxOutputFromUplcData),
  fee: LovelaceFromData,
  minted: AssetsFromUplcData(true),
  dcerts: Data.Array(DCertFromUplcData),
  withdrawals: Data.PairArray(RewardAddressFromUplcData, Data.BigInt),
  validityTimeRange: ValiditySlotRange,
  signers: Data.Array(PubKeyHashFromUplcData),
  redeemers: Data.PairArray(Data.Data, Data.Data),
  datums: Data.PairArray(DatumHashFromUplcData, Data.Data),
  txHash: TxHashFromUplcDataV3,
  votes: Data.PairArray(Data.Data, Data.Data), // TODO
  proposalProcedures: Data.Array(Data.Data), // TODO
  currentTreasuryAmount: Data.Option(Data.Data), // TODO
  treasuryDonation: Data.Option(Data.Data) // TODO
})

/**
 * Exported for testing
 */
export class CurrentTx extends Context.Tag(
  "Cardano.Uplc.ScriptContext.CurrentTx"
)<CurrentTx, Tx>() {}

/**
 * Uses same tags as Redeemer to make encoding easy
 */
const PurposeV2 = Schema.transformOrFail(
  Data.Enum({
    Minting: {
      policy: MintingPolicyFromUplcData
    },
    Spending: {
      ref: UTxORefFromUplcData
    },
    Rewarding: {
      address: RewardAddressFromUplcData
    },
    Certifying: {
      dcert: DCertFromUplcData
    }
  }),
  Schema.typeSchema(Redeemer),
  {
    strict: true,
    decode: (purpose, _, ast) =>
      ParseResult.fail(
        new ParseResult.Forbidden(
          ast,
          purpose,
          "Can't decode purpose into redeemer."
        )
      ),
    encode: (redeemer: Redeemer) =>
      CurrentTx.pipe(
        Effect.map((tx) => {
          switch (redeemer._tag) {
            case "Minting":
              return {
                _tag: "Minting" as const,
                policy: nonAdaPolicies(tx.body.minted)[redeemer.policyIndex]
              }
            case "Spending":
              return {
                _tag: "Spending" as const,
                ref: tx.body.inputs[redeemer.inputIndex].ref
              }
            case "Rewarding":
              return {
                _tag: "Rewarding" as const,
                address: tx.body.withdrawals[redeemer.withdrawalIndex][0]
              }
            case "Certifying":
              return {
                _tag: "Certifying" as const,
                dcert: tx.body.dcerts[redeemer.dcertIndex]
              }
          }
        })
      )
  }
)

/**
 * TODO: add voting and proposing redeemers
 *
 * Only exported for testing
 */
export const PurposeV3 = Schema.transformOrFail(
  Data.Enum({
    Minting: {
      policy: MintingPolicyFromUplcData
    },
    Spending: {
      ref: UTxORefFromUplcDataV3,
      datum: Data.Option(Data.Data)
    },
    Rewarding: {
      address: RewardAddressFromUplcData
    },
    Certifying: {
      dcert: DCertFromUplcData
    }
  }),
  Schema.typeSchema(Redeemer),
  {
    strict: true,
    decode: (purpose, _, ast) =>
      ParseResult.fail(
        new ParseResult.Forbidden(
          ast,
          purpose,
          "Can't decode purpose into redeemer."
        )
      ),
    encode: (redeemer: Redeemer) =>
      CurrentTx.pipe(
        Effect.map((tx) => {
          switch (redeemer._tag) {
            case "Minting":
              return {
                _tag: "Minting" as const,
                policy: nonAdaPolicies(tx.body.minted)[redeemer.policyIndex]
              }
            case "Spending": {
              return {
                _tag: "Spending" as const,
                ref: tx.body.inputs[redeemer.inputIndex].ref,
                datum: Option.fromNullable(inputDatum(redeemer.inputIndex)(tx))
              }
            }
            case "Rewarding":
              return {
                _tag: "Rewarding" as const,
                address: tx.body.withdrawals[redeemer.withdrawalIndex][0]
              }
            case "Certifying":
              return {
                _tag: "Certifying" as const,
                dcert: tx.body.dcerts[redeemer.dcertIndex]
              }
          }
        })
      )
  }
)

const makeArgsV2 = (tx: Tx, redeemerIndex: number) =>
  Effect.gen(function* () {
    const redeemer = tx.witnesses.redeemers[redeemerIndex]

    const purposes = yield* Effect.all(
      tx.witnesses.redeemers.map((r) => Schema.encode(PurposeV2)(r))
    ).pipe(Effect.provideService(CurrentTx, tx))

    const purpose = purposes[redeemerIndex]

    const txInfo = yield* Schema.encode(TxInfoV2)({
      inputs: tx.body.inputs,
      refInputs: tx.body.refInputs,
      outputs: tx.body.outputs,
      fee: tx.body.fee,
      minted: tx.body.minted,
      dcerts: tx.body.dcerts,
      withdrawals: tx.body.withdrawals,
      validityTimeRange: {
        firstValidSlot: tx.body.firstValidSlot,
        lastValidSlot: tx.body.lastValidSlot
      },
      signers: tx.body.signers,
      redeemers: tx.witnesses.redeemers.map(
        (r, i) => [purposes[i], r.data] as const
      ),
      datums: tx.witnesses.datums.map((d) => [hashDatum(d), d]),
      txHash: { hash: hashTx(tx) }
    })

    const scriptContext = Data.makeConstrData(0, [txInfo, purpose])

    switch (redeemer._tag) {
      case "Certifying":
      case "Minting":
      case "Rewarding":
        return [
          { data: redeemer.data },
          { data: scriptContext }
        ] satisfies Value.Value[]
      case "Spending": {
        const datum = inputDatum(redeemer.inputIndex)(tx)

        if (datum === undefined) {
          throw new Error(`No datum found for input ${redeemer.inputIndex}`)
        }

        return [
          { data: datum },
          { data: redeemer.data },
          { data: scriptContext }
        ] satisfies Value.Value[]
      }
    }
  })

const makeArgsV3 = (tx: Tx, redeemerIndex: number) =>
  Effect.gen(function* () {
    const redeemer = tx.witnesses.redeemers[redeemerIndex]

    const purposes = yield* Effect.all(
      tx.witnesses.redeemers.map((r) => Schema.encode(PurposeV3)(r))
    ).pipe(Effect.provideService(CurrentTx, tx))

    const purpose = purposes[redeemerIndex]

    const txInfo = yield* Schema.encode(TxInfoV3)({
      inputs: tx.body.inputs,
      refInputs: tx.body.refInputs,
      outputs: tx.body.outputs,
      fee: tx.body.fee,
      minted: tx.body.minted,
      dcerts: tx.body.dcerts,
      withdrawals: tx.body.withdrawals,
      validityTimeRange: {
        firstValidSlot: tx.body.firstValidSlot,
        lastValidSlot: tx.body.lastValidSlot
      },
      signers: tx.body.signers,
      redeemers: tx.witnesses.redeemers.map(
        (r, i) => [purposes[i], r.data] as const
      ),
      datums: tx.witnesses.datums.map((d) => [hashDatum(d), d]),
      txHash: hashTx(tx),
      votes: [],
      proposalProcedures: [],
      currentTreasuryAmount: Option.none(),
      treasuryDonation: Option.none()
    })

    return [
      { data: Data.makeConstrData(0, [txInfo, redeemer.data, purpose]) }
    ] satisfies Value.Value[]
  })
