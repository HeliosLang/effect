import { Console, Context, Data, Effect } from "effect"
import { Bytes } from "../Codecs/index.js"
import * as CoinSelection from "./CoinSelection.js"
import {
  Address,
  AssetClass,
  Assets,
  Credential,
  DatumHash,
  DCert,
  MintingPolicy,
  NativeScript,
  PubKeyHash,
  Redeemer,
  RewardAddress,
  Tx,
  TxOutput,
  UTxO,
  UTxORef,
  ValidatorHash
} from "./Ledger/index.js"
import * as Network from "./Network/index.js"
import * as ScriptContext from "./ScriptContext.js"
import * as Uplc from "./Uplc/index.js"
import { Balancing as BalancingWallet } from "./Wallet.js"

/**
 * It is difficult to give RedeemerBuilder access to the whole Tx including to Tx.Witnesses, because this leads to circular dependencies
 */
export type RedeemerBuilder = (tx: Tx.Tx) => Uplc.Data.Data

export class UTxOAlreadyAdded extends Data.TaggedError(
  "Cardano.TxBuilder.UTxOAlreadyAdded"
)<{ message: string; ref: UTxORef.UTxORef }> {
  constructor(ref: UTxORef.UTxORef) {
    super({ ref, message: `UTxO ${ref} already added to Tx` })
  }
}

export class MissingDatum extends Data.TaggedError(
  "Cardano.TxBuilder.MissingDatum"
)<{ message: string }> {
  constructor() {
    super({ message: "Datum missing" })
  }
}

export class MissingRedeemer extends Data.TaggedError(
  "Cardano.TxBuilder.MissingRedeemer"
)<{ message: string }> {
  constructor() {
    super({ message: "Redeemer missing" })
  }
}

export class RedundantRedeemer extends Data.TaggedError(
  "Cardano.TxBuilder.RedundantRedeemer"
)<{ message: string }> {
  constructor() {
    super({
      message: "Redeemer is redundant (input not locked by uplc script)"
    })
  }
}

export class RedeemerAlreadyAdded extends Data.TaggedError(
  "Cardano.TxBuilder.RedeemerAlreadyAdded"
)<{ message: string }> {
  constructor() {
    super({ message: "Redeemer already added" })
  }
}

export class MissingScript extends Data.TaggedError(
  "Cardano.TxBuilder.MissingScript"
)<{ message: string }> {
  constructor(hash: ValidatorHash.ValidatorHash) {
    super({ message: `Script missing for ${hash}` })
  }
}

export class DatumNotFound extends Data.TaggedError(
  "Cardano.TxBuilder.DatumNotFound"
)<{ message: string }> {
  constructor(hash: DatumHash.DatumHash, cause?: string) {
    super({ message: `Datum for ${hash} not found (${cause})` })
  }
}

export class CollateralNotAvailable extends Data.TaggedError(
  "Cardano.TxBuilder.CollateralNotAvailable"
)<{ message: string }> {
  constructor() {
    super({
      message: "Collateral not available"
    })
  }
}

export class InsufficientBalancingAssets extends Data.TaggedError(
  "Cardano.TxBuilder.InsufficientBalancingAssets"
)<{
  message: string
  required: Assets.Assets
  available: Assets.Assets
}> {
  constructor(required: Assets.Assets, available: Assets.Assets) {
    super({
      required,
      available,
      message: `Insufficient balancing assets: required ${Assets.pretty(required)}, available ${Assets.pretty(available)}`
    })
  }
}

export class GetDatum extends Context.Tag("Cardano.TxBuilder.GetDatum")<
  GetDatum,
  (
    datumHash: DatumHash.DatumHash
  ) => Effect.Effect<Uplc.Data.Data, DatumNotFound | Network.ConnectionError>
>() {}

/**
 * RedeemerInfo contains redundant information making it easy to build the redeemer indices
 */
type RedeemerInfo =
  | MintingRedeemerInfo
  | SpendingRedeemerInfo
  | RewardingRedeemerInfo
  | CertifyingRedeemerInfo

type MintingRedeemerInfo = {
  readonly policy: MintingPolicy.MintingPolicy
  readonly redeemer: Uplc.Data.Data | RedeemerBuilder
}

type SpendingRedeemerInfo = {
  readonly utxo: UTxO.UTxO
  readonly redeemer: Uplc.Data.Data | RedeemerBuilder
}

type RewardingRedeemerInfo = {
  readonly addr: RewardAddress.RewardAddress
  readonly redeemer: Uplc.Data.Data | RedeemerBuilder
}

type CertifyingRedeemerInfo = {
  readonly dcert: DCert.DCert
  readonly redeemer: Uplc.Data.Data | RedeemerBuilder
}

export interface TxBuilder {
  readonly datums: readonly Uplc.Data.Data[]
  readonly dcerts: readonly DCert.DCert[]
  readonly inputs: readonly UTxO.UTxO[]
  readonly refInputs: readonly UTxO.UTxO[]
  readonly metadata: Tx.Metadata
  readonly minted: Assets.Assets
  readonly outputs: readonly TxOutput.TxOutput[]
  readonly mintingRedeemers: readonly MintingRedeemerInfo[]
  readonly spendingRedeemers: readonly SpendingRedeemerInfo[]
  readonly rewardingRedeemers: readonly RewardingRedeemerInfo[]
  readonly certifyingRedeemers: readonly CertifyingRedeemerInfo[]
  readonly nativeScripts: readonly {
    readonly script: NativeScript.NativeScript
    readonly hash: ValidatorHash.ValidatorHash
  }[]
  readonly v1Scripts: readonly {
    readonly script: Uplc.Script.Script<1>
    readonly hash: ValidatorHash.ValidatorHash
  }[]
  readonly v2Scripts: readonly {
    readonly script: Uplc.Script.Script<2>
    readonly hash: ValidatorHash.ValidatorHash
  }[]
  readonly v3Scripts: readonly {
    readonly script: Uplc.Script.Script<3>
    readonly hash: ValidatorHash.ValidatorHash
  }[]
  readonly v2RefScripts: readonly {
    readonly script: Uplc.Script.Script<2>
    readonly hash: ValidatorHash.ValidatorHash
  }[]
  readonly v3RefScripts: readonly {
    readonly script: Uplc.Script.Script<3>
    readonly hash: ValidatorHash.ValidatorHash
  }[]
  readonly signers: readonly PubKeyHash.PubKeyHash[]
  readonly validFrom:
    | { readonly slot: number }
    | { readonly time: number }
    | undefined
  readonly validTo:
    | { readonly slot: number }
    | { readonly time: number }
    | undefined
  readonly withdrawals: readonly {
    readonly address: RewardAddress.RewardAddress
    readonly lovelace: bigint
  }[]
}

const empty: TxBuilder = {
  datums: [],
  dcerts: [],
  inputs: [],
  metadata: {},
  minted: {},
  outputs: [],
  refInputs: [],
  mintingRedeemers: [],
  spendingRedeemers: [],
  rewardingRedeemers: [],
  certifyingRedeemers: [],
  nativeScripts: [],
  v1Scripts: [],
  v2Scripts: [],
  v3Scripts: [],
  v2RefScripts: [],
  v3RefScripts: [],
  signers: [],
  validFrom: undefined,
  validTo: undefined,
  withdrawals: []
}

export const start = Effect.succeed(empty)

/**
 * Automatically discards duplicates
 */
export const attachScript =
  (script: NativeScript.NativeScript | Uplc.Script.Script) =>
  (b: TxBuilder) => {
    if ("version" in script) {
      if (Uplc.Script.isVersion(1)(script)) {
        return addV1Script(b, script)
      } else if (Uplc.Script.isVersion(2)(script)) {
        return addV2Script(b, script)
      } else if (Uplc.Script.isVersion(3)(script)) {
        return addV3Script(b, script)
      } else {
        throw new Error(`unhandled script version ${script.version}`)
      }
    } else {
      const hash = NativeScript.hash(script)

      if (hasNativeScript(b, hash)) {
        return b
      }

      // assign result before returning so that return type is TxBuilder
      b = {
        ...b,
        nativeScripts: [...b.nativeScripts, { script, hash }]
      }

      return b
    }
  }

export const attachScriptEffect = (
  script: NativeScript.NativeScript | Uplc.Script.Script
) => Effect.map(attachScript(script))

export const delegate =
  (
    credential: Credential.Credential,
    poolId: PubKeyHash.PubKeyHash,
    redeemer: Uplc.Data.Data | RedeemerBuilder | undefined = undefined
  ) =>
  (b: TxBuilder) =>
    Effect.gen(function* () {
      const dcert: DCert.DCert = {
        _tag: "Delegation",
        credential,
        poolId
      }

      b = addDCert(b, dcert)

      if (credential._tag == "Validator") {
        if (redeemer) {
          if (hasNativeScript(b, credential.hash)) {
            return yield* Effect.fail(new RedundantRedeemer())
          }

          if (!hasUplcScript(b, credential.hash)) {
            return yield* Effect.fail(new MissingScript(credential.hash))
          }

          b = yield* addCertifyingRedeemer(b, dcert, redeemer)
        } else {
          if (!hasNativeScript(b, credential.hash)) {
            return yield* Effect.fail(new MissingRedeemer())
          }
        }
      } else if (redeemer) {
        return yield* Effect.fail(new RedundantRedeemer())
      }

      return b
    })

export const delegateEffect = (
  credential: Credential.Credential,
  poolId: PubKeyHash.PubKeyHash,
  redeemer: Uplc.Data.Data | RedeemerBuilder | undefined = undefined
) => Effect.flatMap(delegate(credential, poolId, redeemer))

export const deregister =
  (
    credential: Credential.Credential,
    redeemer: Uplc.Data.Data | RedeemerBuilder | undefined = undefined
  ) =>
  (b: TxBuilder) =>
    Effect.gen(function* () {
      const dcert: DCert.DCert = {
        _tag: "Deregistration",
        credential
      }

      b = addDCert(b, dcert)

      if (credential._tag == "Validator") {
        if (redeemer) {
          if (hasNativeScript(b, credential.hash)) {
            return yield* Effect.fail(new RedundantRedeemer())
          }

          if (!hasUplcScript(b, credential.hash)) {
            return yield* Effect.fail(new MissingScript(credential.hash))
          }

          b = yield* addCertifyingRedeemer(b, dcert, redeemer)
        } else {
          if (!hasNativeScript(b, credential.hash)) {
            return yield* Effect.fail(new MissingRedeemer())
          }
        }
      } else if (redeemer) {
        return yield* Effect.fail(new RedundantRedeemer())
      }

      return b
    })

export const deregisterEffect = (
  credential: Credential.Credential,
  redeemer: Uplc.Data.Data | RedeemerBuilder | undefined = undefined
) => Effect.flatMap(deregister(credential, redeemer))

export const metadata =
  (mdata: Tx.Metadata) =>
  (b: TxBuilder): TxBuilder => {
    // assign result before returning so that return type is TxBuilder
    b = {
      ...b,
      metadata: { ...b.metadata, ...mdata }
    }

    return b
  }

export const metadataEffect = (mdata: Tx.Metadata) =>
  Effect.map(metadata(mdata))

type MintOptions = {
  redeemerDedupe?: "fail" | "keep" | "update"
}

/**
 * Filters out ADA
 * Entries in assets can be negative for burning
 *
 * Assets are added to previously minted values.
 */
export const mint =
  ({ redeemerDedupe = "update" }: MintOptions = {}) =>
  (
    assets: Assets.Assets,
    redeemer: Uplc.Data.Data | RedeemerBuilder | undefined = undefined
  ) =>
  (b: TxBuilder) =>
    Effect.gen(function* () {
      const policies = Assets.nonAdaPolicies(assets)

      for (const policy of policies) {
        // assign result before returning so that return type is TxBuilder
        b = {
          ...b,
          minted: Assets.sort()(
            Assets.add(b.minted, Assets.filterByPolicy(policy)(assets))
          )
        }

        const hash = MintingPolicy.hash(policy)

        if (redeemer) {
          if (hasNativeScript(b, hash)) {
            return yield* Effect.fail(new RedundantRedeemer())
          }

          if (!hasUplcScript(b, hash)) {
            return yield* Effect.fail(new MissingScript(hash))
          }

          b = yield* addMintingRedeemer({ dedupe: redeemerDedupe })(
            b,
            policy,
            redeemer
          )
        } else {
          if (!hasNativeScript(b, hash)) {
            return yield* Effect.fail(new MissingRedeemer())
          }
        }
      }

      return b
    })

export const mintEffect =
  (options: MintOptions = {}) =>
  (
    assets: Assets.Assets,
    redeemer: Uplc.Data.Data | RedeemerBuilder | undefined = undefined
  ) =>
    Effect.flatMap(mint(options)(assets, redeemer))

export const pay =
  (...outputs: TxOutput.TxOutput[]) =>
  (b: TxBuilder) =>
    Effect.gen(function* () {
      for (const output of outputs) {
        b = yield* addOutput(b, output)
      }

      return b
    })

export const payEffect = (...outputs: TxOutput.TxOutput[]) =>
  Effect.flatMap(pay(...outputs))

/**
 * `dedupe` defaults to "ignore", which if UTxO is already referenced refer/referEffect return silently
 */
type ReferOptions = {
  dedupe?: "fail" | "ignore"
}

export const refer =
  ({ dedupe = "ignore" }: ReferOptions = {}) =>
  (...utxos: UTxO.UTxO[]) =>
  (b: TxBuilder) =>
    Effect.gen(function* () {
      for (const utxo of utxos) {
        b = yield* addRefInput({ failIfAlreadyAdded: dedupe === "fail" })(
          b,
          utxo
        )

        const refScript = utxo.output.refScript

        switch (refScript?.version) {
          case 2:
            b = addV2RefScript(b, refScript)
            break
          case 3:
            b = addV3RefScript(b, refScript)
            break
        }
      }

      return b
    })

export const referEffect =
  (options: ReferOptions) =>
  (...utxos: UTxO.UTxO[]) =>
    Effect.flatMap(refer(options)(...utxos))

export const register =
  (credential: Credential.Credential) => (b: TxBuilder) => {
    b = addDCert(b, {
      _tag: "Registration",
      credential
    })

    return b
  }

export const registerEffect = (credential: Credential.Credential) =>
  Effect.map(register(credential))

/**
 * Returns silently if alrady added before
 * @param signers
 * @returns
 */
export const sign =
  (...signers: PubKeyHash.PubKeyHash[]) =>
  (b: TxBuilder) => {
    for (const signer of signers) {
      b = addSigner(b, signer)
    }

    return b
  }

export const signEffect = (...signers: PubKeyHash.PubKeyHash[]) =>
  Effect.map(sign(...signers))

/**
 * `dedupe` defaults to "update". Options:
 *   "fail" means an error is thrown if a UTxO is already being spent
 *   "keep" means the previous redeemer is kept in case the UTxO is already being spent (this only matters for smart contract UTxOs)
 *   "update" means the redeemer is rewritten in case the UTxO is already being spent (this only matters for smart contract UTxOs)
 */
type SpendOptions = {
  dedupe?: "fail" | "keep" | "update"
}

export const spend =
  ({ dedupe = "update" }: SpendOptions = {}) =>
  (
    utxos: UTxO.UTxO | UTxO.UTxO[],
    redeemer: Uplc.Data.Data | RedeemerBuilder | undefined = undefined
  ) =>
  (b: TxBuilder) =>
    Effect.gen(function* () {
      for (const utxo of Array.isArray(utxos) ? utxos : [utxos]) {
        const preexisting = hasInput(b, utxo.ref)

        if (preexisting && dedupe === "keep") {
          continue
        }

        b = yield* addInput({ failIfAlreadyAdded: dedupe === "fail" })(b, utxo)

        const spendingCred = Address.spendingCredential(utxo.output.address)

        if (redeemer) {
          if (spendingCred._tag != "Validator") {
            return yield* Effect.fail(new RedundantRedeemer())
          }

          if (!hasUplcScript(b, spendingCred.hash)) {
            return yield* Effect.fail(new MissingScript(spendingCred.hash))
          }

          b = yield* addSpendingRedeemer({ dedupe })(b, utxo, redeemer)

          const datum = utxo.output.datum

          if (!datum && !hasDatumlessScript(b, spendingCred.hash)) {
            return yield* Effect.fail(new MissingDatum())
          }

          if (datum && "hash" in datum) {
            // provide datum through service
            const getDatum = yield* GetDatum
            const datumData = yield* getDatum(datum.hash)

            b = addDatum(b, datumData)
          }
        } else if (spendingCred._tag == "Validator") {
          if (!hasNativeScript(b, spendingCred.hash)) {
            return yield* Effect.fail(new MissingRedeemer())
          }
        }
      }

      return b
    })

export const spendEffect =
  (options: SpendOptions = {}) =>
  (
    utxos: UTxO.UTxO | UTxO.UTxO[],
    redeemer: Uplc.Data.Data | RedeemerBuilder | undefined = undefined
  ) =>
    Effect.flatMap(spend(options)(utxos, redeemer))

export const validFromSlot =
  (slot: number) =>
  (b: TxBuilder): TxBuilder => {
    // assign result before returning so that return type is TxBuilder
    b = {
      ...b,
      validFrom: { slot }
    }

    return b
  }

export const validFromSlotEffect = (slot: number) =>
  Effect.map(validFromSlot(slot))

/**
 * @param time
 * Milliseconds since 1970
 */
export const validFromTime =
  (time: number) =>
  (b: TxBuilder): TxBuilder => {
    // assign result before returning so that return type is TxBuilder
    b = {
      ...b,
      validFrom: { time }
    }

    return b
  }

export const validFromTimeEffect = (time: number) =>
  Effect.map(validFromTime(time))

export const validToSlot =
  (slot: number) =>
  (b: TxBuilder): TxBuilder => {
    // assign result before returning so that return type is TxBuilder
    b = {
      ...b,
      validTo: { slot }
    }

    return b
  }

export const validToSlotEffect = (slot: number) => Effect.map(validToSlot(slot))

/**
 * @param time
 * Milliseconds since 1970
 */
export const validToTime =
  (time: number) =>
  (b: TxBuilder): TxBuilder => {
    // assign result before returning so that return type is TxBuilder
    b = {
      ...b,
      validTo: { time }
    }

    return b
  }

export const validToTimeEffect = (time: number) => Effect.map(validToTime(time))

export const withdraw =
  (
    rewardAddress: RewardAddress.RewardAddress,
    lovelace: bigint | number,
    redeemer: Uplc.Data.Data | RedeemerBuilder | undefined = undefined
  ) =>
  (b: TxBuilder) =>
    Effect.gen(function* () {
      const i = b.withdrawals.findIndex((w) => w.address == rewardAddress)

      if (redeemer) {
        if (RewardAddress.credential(rewardAddress)._tag != "Validator") {
          throw new Error(
            "can't withdraw using redeemer from non-Validator rewards address"
          )
        }

        b = yield* addRewardingRedeemer(b, rewardAddress, redeemer)
      }

      const withdrawals = b.withdrawals.slice()

      if (i == -1) {
        withdrawals.push({ address: rewardAddress, lovelace: BigInt(lovelace) })
      } else {
        withdrawals[i] = {
          address: rewardAddress,
          lovelace: BigInt(lovelace) + withdrawals[i].lovelace
        }
      }

      withdrawals.sort(({ address: a }, { address: b }) =>
        RewardAddress.compare(a, b)
      )

      // assign result before returning so that return type is TxBuilder
      b = {
        ...b,
        withdrawals
      }

      return b
    })

export const withdrawEffect = (
  rewardAddress: RewardAddress.RewardAddress,
  lovelace: bigint | number,
  redeemer: Uplc.Data.Data | RedeemerBuilder | undefined = undefined
) => Effect.flatMap(withdraw(rewardAddress, lovelace, redeemer))

function addDatum(b: TxBuilder, data: Uplc.Data.Data): TxBuilder {
  if (hasDatum(b, data)) {
    return b
  }

  // assign result before returning so that return type is TxBuilder
  b = {
    ...b,
    datums: [...b.datums, data]
  }

  return b
}

function hasDatum(b: TxBuilder, data: Uplc.Data.Data): boolean {
  return b.datums.some((d) => Uplc.Data.equals(d, data))
}

function addDCert(b: TxBuilder, dcert: DCert.DCert): TxBuilder {
  // assign result before returning so that return type is TxBuilder
  b = {
    ...b,
    dcerts: [...b.dcerts, dcert]
  }

  if (dcert._tag == "Delegation" || dcert._tag == "Deregistration") {
    if (dcert.credential._tag == "PubKey") {
      b = addSigner(b, dcert.credential.hash)
    }
  }

  return b
}

type AddInputOptions = {
  failIfAlreadyAdded: boolean
}

const addInput =
  (options: AddInputOptions) => (b: TxBuilder, input: UTxO.UTxO) =>
    Effect.gen(function* () {
      yield* Assets.assertAllPositive(input.output.assets)

      if (hasInput(b, input.ref)) {
        if (options.failIfAlreadyAdded) {
          return yield* Effect.fail(new UTxOAlreadyAdded(input.ref))
        } else {
          return b
        }
      }

      if (hasRefInput(b, input.ref)) {
        return yield* Effect.fail(new UTxOAlreadyAdded(input.ref))
      }

      // assign result before returning so that return type is TxBuilder
      b = {
        ...b,
        inputs: UTxO.append(b.inputs, input)
      }

      return b
    })

function hasInput(b: TxBuilder, ref: UTxORef.UTxORef): boolean {
  return b.inputs.some((utxo) => utxo.ref == ref)
}

type AddRefInputOptions = {
  failIfAlreadyAdded: boolean
}

const addRefInput =
  (options: AddRefInputOptions) => (b: TxBuilder, refInput: UTxO.UTxO) =>
    Effect.gen(function* () {
      yield* Assets.assertAllPositive(refInput.output.assets)

      if (hasInput(b, refInput.ref)) {
        return yield* Effect.fail(new UTxOAlreadyAdded(refInput.ref))
      }

      if (hasRefInput(b, refInput.ref)) {
        if (options.failIfAlreadyAdded) {
          return yield* Effect.fail(new UTxOAlreadyAdded(refInput.ref))
        } else {
          return b
        }
      }

      // assign result before returning so that return type is TxBuilder
      b = {
        ...b,
        refInputs: UTxO.append(b.refInputs, refInput)
      }

      return b
    })

function hasRefInput(b: TxBuilder, ref: UTxORef.UTxORef): boolean {
  return b.refInputs.some((utxo) => utxo.ref == ref)
}

const addOutput = (b: TxBuilder, output: TxOutput.TxOutput) =>
  Effect.gen(function* () {
    yield* Assets.assertAllPositive(output.assets)

    const outputCred = Address.spendingCredential(output.address)

    if (outputCred._tag == "Validator" && output.datum === undefined) {
      yield* Console.warn(
        "TxOutput is sent to validator but doesn't have a datum"
      )
    }

    // assign result before returning so that return type is TxBuilder
    b = {
      ...b,
      outputs: [...b.outputs, output].map(TxOutput.sortAssets)
    }

    return b
  })

function addCertifyingRedeemer(
  b: TxBuilder,
  dcert: DCert.DCert,
  redeemer: Uplc.Data.Data | RedeemerBuilder
) {
  if (hasCertifyingRedeemer(b, dcert)) {
    return Effect.fail(new RedeemerAlreadyAdded())
  }

  b = {
    ...b,
    certifyingRedeemers: [...b.certifyingRedeemers, { dcert, redeemer }]
  }

  return Effect.succeed(b)
}

function hasCertifyingRedeemer(b: TxBuilder, dcert: DCert.DCert): boolean {
  return b.dcerts.some((d) => DCert.equals(d, dcert))
}

type AddMintingRedeemerOptions = {
  dedupe: "fail" | "keep" | "update"
}

const addMintingRedeemer =
  (options: AddMintingRedeemerOptions) =>
  (
    b: TxBuilder,
    policy: MintingPolicy.MintingPolicy,
    redeemer: Uplc.Data.Data | RedeemerBuilder
  ) => {
    if (hasMintingRedeemer(b, policy)) {
      switch (options.dedupe) {
        case "keep":
          break
        case "update":
          // assign result before returning so that return type is TxBuilder
          b = {
            ...b,
            mintingRedeemers: [
              ...b.mintingRedeemers.filter((r) => r.policy != policy),
              { policy, redeemer }
            ]
          }
          break
        default:
          return Effect.fail(new RedeemerAlreadyAdded())
      }
    } else {
      // assign result before returning so that return type is TxBuilder
      b = {
        ...b,
        mintingRedeemers: [...b.mintingRedeemers, { policy, redeemer }]
      }
    }

    return Effect.succeed(b)
  }

function hasMintingRedeemer(
  b: TxBuilder,
  policy: MintingPolicy.MintingPolicy
): boolean {
  return b.mintingRedeemers.some((r) => r.policy == policy)
}

function addRewardingRedeemer(
  b: TxBuilder,
  addr: RewardAddress.RewardAddress,
  redeemer: Uplc.Data.Data | RedeemerBuilder
) {
  if (hasRewardingRedeemer(b, addr)) {
    return Effect.fail(new RedeemerAlreadyAdded())
  }

  // assign result before returning so that return type is TxBuilder
  b = {
    ...b,
    rewardingRedeemers: [...b.rewardingRedeemers, { addr, redeemer }]
  }

  return Effect.succeed(b)
}

function hasRewardingRedeemer(
  b: TxBuilder,
  addr: RewardAddress.RewardAddress
): boolean {
  return b.rewardingRedeemers.some((r) => r.addr == addr)
}

type AddSpendingRedeemerOptions = {
  dedupe: "fail" | "keep" | "update"
}

const addSpendingRedeemer =
  (options: AddSpendingRedeemerOptions) =>
  (
    b: TxBuilder,
    utxo: UTxO.UTxO,
    redeemer: Uplc.Data.Data | RedeemerBuilder
  ) => {
    if (hasSpendingRedeemer(b, utxo)) {
      switch (options.dedupe) {
        case "keep":
          break
        case "update":
          // assign result before returning so that return type is TxBuilder
          b = {
            ...b,
            spendingRedeemers: [
              ...b.spendingRedeemers.filter((r) => r.utxo.ref != utxo.ref),
              { utxo, redeemer }
            ]
          }
          break
        default:
          return Effect.fail(new RedeemerAlreadyAdded())
      }
    } else {
      // assign result before returning so that return type is TxBuilder
      b = {
        ...b,
        spendingRedeemers: [...b.spendingRedeemers, { utxo, redeemer }]
      }
    }

    return Effect.succeed(b)
  }

function hasSpendingRedeemer(b: TxBuilder, utxo: UTxO.UTxO): boolean {
  return b.spendingRedeemers.some((r) => r.utxo.ref == utxo.ref)
}

function hasRedeemers(b: TxBuilder): boolean {
  return (
    b.certifyingRedeemers.length > 0 ||
    b.mintingRedeemers.length > 0 ||
    b.rewardingRedeemers.length > 0 ||
    b.spendingRedeemers.length > 0
  )
}

function addV1Script(b: TxBuilder, script: Uplc.Script.Script<1>) {
  const hash = Uplc.Script.hash(script)

  if (hasV1Script(b, hash)) {
    return b
  }

  // assign result before returning so that return type is TxBuilder
  b = {
    ...b,
    v1Scripts: [...b.v1Scripts, { script, hash }]
  }

  return b
}

function hasV1Script(b: TxBuilder, hash: ValidatorHash.ValidatorHash): boolean {
  return b.v1Scripts.some((s) => s.hash == hash)
}

function addV2Script(b: TxBuilder, script: Uplc.Script.Script<2>) {
  const hash = Uplc.Script.hash(script)

  if (hasV2Script(b, hash)) {
    return b
  }

  // assign result before returning so that return type is TxBuilder
  b = {
    ...b,
    v2Scripts: [...b.v2Scripts, { script, hash }]
  }

  return b
}

function hasV2Script(b: TxBuilder, hash: ValidatorHash.ValidatorHash): boolean {
  return b.v2Scripts.some((s) => s.hash == hash)
}

function addV3Script(b: TxBuilder, script: Uplc.Script.Script<3>) {
  const hash = Uplc.Script.hash(script)

  if (hasV3Script(b, hash)) {
    return b
  }

  // assign result before returning so that return type is TxBuilder
  b = {
    ...b,
    v3Scripts: [...b.v3Scripts, { script, hash }]
  }

  return b
}

function hasV3Script(b: TxBuilder, hash: ValidatorHash.ValidatorHash): boolean {
  return b.v3Scripts.some((s) => s.hash == hash)
}

function addV2RefScript(
  b: TxBuilder,
  script: Uplc.Script.Script<2>
): TxBuilder {
  const hash = Uplc.Script.hash(script)

  if (hasV2RefScript(b, hash)) {
    return b
  }

  // assign result before returning so that return type is TxBuilder
  b = {
    ...b,
    v2RefScripts: [...b.v2RefScripts, { hash, script }]
  }

  return b
}

function hasV2RefScript(
  b: TxBuilder,
  hash: ValidatorHash.ValidatorHash
): boolean {
  return b.v2RefScripts.some((s) => s.hash == hash)
}

function addV3RefScript(b: TxBuilder, script: Uplc.Script.Script<3>) {
  const hash = Uplc.Script.hash(script)

  if (hasV3RefScript(b, hash)) {
    return b
  }

  // assign result before returning so that return type is TxBuilder
  b = {
    ...b,
    v3RefScripts: [...b.v3RefScripts, { hash, script }]
  }

  return b
}

function hasV3RefScript(
  b: TxBuilder,
  hash: ValidatorHash.ValidatorHash
): boolean {
  return b.v3RefScripts.some((s) => s.hash == hash)
}

function hasDatumlessScript(
  b: TxBuilder,
  hash: ValidatorHash.ValidatorHash
): boolean {
  return (
    hasNativeScript(b, hash) || hasV3Script(b, hash) || hasV3RefScript(b, hash)
  )
}

function hasNativeScript(
  b: TxBuilder,
  hash: ValidatorHash.ValidatorHash
): boolean {
  return b.nativeScripts.some((s) => s.hash == hash)
}

function hasUplcScript(
  b: TxBuilder,
  hash: ValidatorHash.ValidatorHash
): boolean {
  return (
    hasV1Script(b, hash) ||
    hasV2Script(b, hash) ||
    hasV3Script(b, hash) ||
    hasV2RefScript(b, hash) ||
    hasV3RefScript(b, hash)
  )
}

function allUplcScripts(
  b: TxBuilder
): { script: Uplc.Script.Script; hash: ValidatorHash.ValidatorHash }[] {
  return (
    [] as { script: Uplc.Script.Script; hash: ValidatorHash.ValidatorHash }[]
  )
    .concat(b.v1Scripts)
    .concat(b.v2Scripts)
    .concat(b.v3Scripts)
    .concat(b.v2RefScripts)
    .concat(b.v3RefScripts)
}

function getUplcScript(
  b: TxBuilder,
  hash: ValidatorHash.ValidatorHash
): Uplc.Script.Script {
  const script = allUplcScripts(b).find((s) => s.hash == hash)

  if (!script) {
    throw new Error(
      `script with hash '${hash}' not found during redeemer building stage`
    )
  }

  return script.script
}

function addSigner(b: TxBuilder, signer: PubKeyHash.PubKeyHash): TxBuilder {
  if (hasSigner(b, signer)) {
    return b
  }

  // assign result before returning so that return type is TxBuilder
  b = {
    ...b,
    signers: [...b.signers, signer]
  }

  return b
}

function hasSigner(b: TxBuilder, signer: PubKeyHash.PubKeyHash) {
  return b.signers.includes(signer)
}

export interface BuildOptions {
  logger?: Uplc.Cek.Logger | undefined

  /**
   * Optional babel fee settings, using additional UTxOs containing pure lovelace to balance a transaction and pay for fees and min-deposit.
   * The primary tx building agent pays the difference using another asset class at a predetermined price.
   *
   * TODO: actually use this option
   */
  babelFeeOptions?: BabelFeeOptions | undefined

  /**
   * Optional encoding config for Tx.Body
   */
  bodyEncoding?: Tx.BodyEncoding | undefined

  /**
   * Optional encoding config for Tx.Witnesses
   */
  witnessesEncoding?: Tx.WitnessesEncoding | undefined
}

export interface BabelFeeOptions {
  /**
   * Address of the Babel fee agent. The assetclass tokens and any spare lovelace are returned to this address.
   */
  readonly address: Address.Address

  /**
   * UTxOs containing only ADA, which can be used to pay for network fees and min-deposit, and can be used as collateral
   */
  readonly utxos: readonly UTxO.UTxO[]

  /**
   * Price in lovelace per AssetClass (doesn't take into account decimal places)
   */
  readonly price: number

  /**
   * Minimum number of AssetClass tokens per returned babel fee utxo.
   */
  readonly minimum: bigint

  /**
   * AssetClass which can be swapped out of lovelace.
   */
  readonly assetClass: AssetClass.AssetClass
}

class CurrentTxBuilder extends Context.Tag(
  "Cardano.TxBuilder.CurrentTxBuilder"
)<CurrentTxBuilder, TxBuilder>() {}

export const build =
  (options: BuildOptions = {}) =>
  (b: TxBuilder) =>
    Effect.gen(function* () {
      /**
       * Calculate the metadata hash
       */
      const { metadata, metadataHash } = yield* buildMetadata

      /**
       * Calculate the validity time range slots
       */
      const { firstValidSlot, lastValidSlot } = yield* buildValidityTimeRange

      yield* Console.log(
        `Built validatity slots: ${firstValidSlot}:${lastValidSlot}`
      )

      /**
       * Make sure the outputs contain enough lovelace
       */
      const outputs: TxOutput.TxOutput[] = yield* buildNonChangeOutputs

      /**
       * Create an unbalanced tx. In this tx a few fields are not yet final:
       *   - inputs
       *   - outputs
       *   - fee
       *   - scriptDataHash
       *   - redeemers
       */
      let tx: Tx.Tx = {
        body: {
          inputs: b.inputs,
          outputs,
          fee: 0n,
          firstValidSlot,
          lastValidSlot,
          dcerts: b.dcerts,
          scriptDataHash: hasRedeemers(b)
            ? (new Array(32).fill(0) as number[])
            : undefined,
          withdrawals: b.withdrawals.map(
            (w) => [w.address, w.lovelace] as const
          ),
          minted: Assets.sort()(b.minted),
          refInputs: b.refInputs,
          totalCollateral: 0n,
          collateral: [],
          signers: b.signers,
          collateralReturn: undefined,
          metadataHash,
          encoding: options.bodyEncoding
        } satisfies Tx.Body,
        witnesses: {
          signatures: [],
          datums: b.datums,
          redeemers: [],
          nativeScripts: b.nativeScripts.map((s) => s.script),
          v1Scripts: b.v1Scripts.map((s) => s.script),
          v2Scripts: b.v2Scripts.map((s) => s.script),
          v3Scripts: b.v3Scripts.map((s) => s.script),
          v2RefScripts: b.v2RefScripts.map((s) => s.script),
          v3RefScripts: b.v3RefScripts.map((s) => s.script),
          encoding: options.witnessesEncoding
        },
        isValid: false,
        metadata
      }

      yield* Console.log("validating outputs...")
      for (const output of outputs) {
        yield* Console.log(`Output lovelace: ${output.assets[""]?.toString()}`)
      }
      yield* Tx.validateOutputs(true)(tx)

      yield* Console.log(`Initialized tx`)

      /**
       * The redeemer indices depend on some tx body fields, so are initialized after the init tx is created
       */
      tx = yield* buildRedeemersWithoutCost(tx)

      yield* Console.log(`Built redeemers without cost`)

      tx = yield* convergeTx(tx)
      tx = yield* convergeCollateral(tx)

      /**
       * Sign using balancing wallet
       */
      tx = {
        ...tx,
        witnesses: {
          ...tx.witnesses,
          signatures: [
            ...tx.witnesses.signatures,
            ...(yield* (yield* BalancingWallet).signTx(tx))
          ]
        },
        isValid: true
      }

      return tx
    }).pipe(Effect.provideService(CurrentTxBuilder, b))

export const buildEffect = (options: BuildOptions = {}) =>
  Effect.flatMap(build(options))

const buildMetadata = CurrentTxBuilder.pipe(
  Effect.map((b) => {
    if (b.metadata !== undefined) {
      return { metadata: b.metadata, metadataHash: Tx.hashMetadata(b.metadata) }
    } else {
      return { metadata: undefined, metadataHash: undefined }
    }
  })
)

const buildValidityTimeRange = CurrentTxBuilder.pipe(
  Effect.flatMap((b) => {
    const calcSlot = (
      slotOrTime: { slot: number } | { time: number } | undefined
    ) => {
      if (slotOrTime === undefined) {
        return Effect.succeed(undefined)
      } else if ("time" in slotOrTime) {
        return Network.Params.timeToSlot(slotOrTime.time)
      } else {
        return Effect.succeed(slotOrTime.slot)
      }
    }

    return Effect.zip(calcSlot(b.validFrom), calcSlot(b.validTo)).pipe(
      Effect.map(([firstValidSlot, lastValidSlot]) => ({
        firstValidSlot,
        lastValidSlot
      }))
    )
  })
)

const buildNonChangeOutputs = Effect.gen(function* () {
  const b = yield* CurrentTxBuilder
  const outputs: TxOutput.TxOutput[] = b.outputs.slice()

  for (let i = 0; i < outputs.length; i++) {
    let output = outputs[i]
    let lovelace = yield* TxOutput.minLovelace(output)

    // iterate, because including lovelace value requires more lovelace itself
    while (lovelace > (output.assets[""] ?? 0n)) {
      yield* Console.log(
        `Updated output ${i} to contain ${lovelace} lovelace (${"" in output.assets ? `contained only ${output.assets[""]} before` : `didn't contain any lovelace before`})`
      )

      output = {
        ...output,
        assets: {
          ...output.assets,
          "": lovelace
        }
      }

      outputs[i] = output

      lovelace = yield* TxOutput.minLovelace(output)
    }
  }

  // sort all assets
  for (let i = 0; i < outputs.length; i++) {
    outputs[i] = TxOutput.sortAssets(outputs[i])
  }

  return outputs
})

const selectNetworkManagedCollateralInputs = Effect.gen(function* () {
  const b = yield* CurrentTxBuilder

  if (!hasRedeemers(b)) {
    return []
  } else {
    const params = yield* Network.Params.params

    const ref = params.collateralUTXO

    if (!ref) {
      return yield* Effect.fail(new CollateralNotAvailable())
    }

    return [yield* (yield* Network.UTxO)(ref)]
  }
})

const convergeTx = (tx: Tx.Tx) =>
  Effect.gen(function* () {
    yield* Console.log(`Start loop`)

    let previousFingerprint = ""

    while (tx.body.fee < (yield* Tx.minFee(tx))) {
      const fingerprint = txFingerprint(tx)

      if (fingerprint == previousFingerprint) {
        return yield* Effect.fail(
          new Error("TxBuilder balancing made no progress")
        )
      }

      previousFingerprint = fingerprint

      yield* Console.log(`Updating fee`)
      tx = yield* updateFee(tx)

      yield* Console.log(`Updated fee`)

      tx = yield* balanceTx(tx)

      yield* Console.log(`Balanced tx`)

      tx = yield* buildRedeemersWithCost(tx)

      yield* Console.log(`Built redeemers with cost`)

      tx = yield* updateScriptDataHash(tx)

      yield* Console.log(`Updated script hash`)
    }

    yield* Console.log(`End loop`)

    return tx
  })

const convergeCollateral = (tx: Tx.Tx) =>
  Effect.gen(function* () {
    const b = yield* CurrentTxBuilder

    if (!hasRedeemers(b)) {
      return tx
    }

    let previousFingerprint = ""

    for (let i = 0; i < 3; i++) {
      const nextTx = yield* applyCollateral(tx)
      const nextFingerprint = collateralFingerprint(nextTx)

      tx = yield* convergeTx(nextTx)

      if (nextFingerprint == previousFingerprint) {
        return tx
      }

      previousFingerprint = nextFingerprint
    }

    return tx
  })

const collateralFingerprint = (tx: Tx.Tx) =>
  JSON.stringify({
    collateral: tx.body.collateral.map((utxo) => utxo.ref),
    totalCollateral: tx.body.totalCollateral.toString(),
    collateralReturn: tx.body.collateralReturn?.assets[""]?.toString()
  })

const txFingerprint = (tx: Tx.Tx) =>
  JSON.stringify({
    fee: tx.body.fee.toString(),
    inputs: tx.body.inputs.map((utxo) => utxo.ref),
    outputs: tx.body.outputs.map((output) => Assets.pretty(output.assets))
  })

const applyCollateral = (tx: Tx.Tx) =>
  Effect.gen(function* () {
    const b = yield* CurrentTxBuilder

    if (!hasRedeemers(b)) {
      return {
        ...tx,
        body: {
          ...tx.body,
          collateral: [],
          totalCollateral: 0n,
          collateralReturn: undefined
        }
      }
    }

    const params = yield* Network.Params.params

    if (params.collateralUTXO !== undefined) {
      const collateral = yield* selectNetworkManagedCollateralInputs

      return {
        ...tx,
        body: {
          ...tx.body,
          collateral,
          totalCollateral: 0n,
          collateralReturn: undefined
        }
      }
    }

    return yield* applyLocalCollateral(tx)
  })

const applyLocalCollateral = (tx: Tx.Tx) =>
  Effect.gen(function* () {
    const balancingWallet = yield* BalancingWallet
    const changeAddress = yield* balancingWallet.changeAddress
    const required = yield* Tx.minCollateral(tx)
    const selected = yield* selectLocalCollateralInputs(tx, required)
    const selectedLovelace = UTxO.sumAssets(...selected)[""] ?? 0n
    const change = selectedLovelace - required

    return {
      ...tx,
      body: {
        ...tx.body,
        collateral: selected,
        totalCollateral: required,
        collateralReturn:
          change == 0n
            ? undefined
            : {
                address: changeAddress,
                assets: { "": change }
              }
      }
    }
  })

const selectLocalCollateralInputs = (tx: Tx.Tx, required: bigint) =>
  Effect.gen(function* () {
    const balancingWallet = yield* BalancingWallet
    const spareUTxOs = yield* balancingWallet.utxos
    const changeAddress = yield* balancingWallet.changeAddress
    const params = yield* Network.Params.params
    const minReturnLovelace = yield* TxOutput.minLovelace({
      address: changeAddress,
      assets: { "": 1n }
    })

    const preferred = uniqueCollateralCandidates(
      tx.body.inputs.concat(tx.body.refInputs)
    )
    const all = uniqueCollateralCandidates(preferred.concat(spareUTxOs ?? []))

    const pick = (candidates: readonly UTxO.UTxO[]) => {
      for (const target of [required, required + minReturnLovelace]) {
        const selected = selectCollateralCoins(candidates, target)

        if (selected === undefined) {
          continue
        }

        if (selected.length > params.maxCollateralInputs) {
          continue
        }

        const selectedLovelace = UTxO.sumAssets(...selected)[""] ?? 0n
        const change = selectedLovelace - required

        if (change == 0n || change >= minReturnLovelace) {
          return selected
        }
      }

      return undefined
    }

    const selected = pick(preferred) ?? pick(all)

    if (selected === undefined || selected.length == 0) {
      return yield* Effect.fail(new CollateralNotAvailable())
    }

    return selected
  })

const uniqueCollateralCandidates = (utxos: readonly UTxO.UTxO[]) => {
  const unique: UTxO.UTxO[] = []
  const seen = new Set<string>()

  for (const utxo of utxos) {
    if (
      !seen.has(utxo.ref) &&
      Assets.containsOnlyAda(utxo.output.assets) &&
      (utxo.output.assets[""] ?? 0n) > 0n
    ) {
      seen.add(utxo.ref)
      unique.push(utxo)
    }
  }

  return unique
}

const selectCollateralCoins = (
  candidates: readonly UTxO.UTxO[],
  target: bigint
): UTxO.UTxO[] | undefined => {
  if (candidates.length == 0) {
    return undefined
  }

  const sorted = candidates
    .slice()
    .sort(
      (a, b) =>
        Number((a.output.assets[""] ?? 0n) - (b.output.assets[""] ?? 0n)) ||
        UTxO.compare(a, b)
    )

  const single = sorted.find((utxo) => (utxo.output.assets[""] ?? 0n) >= target)

  if (single !== undefined) {
    return [single]
  }

  const selected: UTxO.UTxO[] = []
  let total = 0n

  for (const utxo of sorted) {
    selected.push(utxo)
    total += utxo.output.assets[""] ?? 0n

    if (total >= target) {
      return selected
    }
  }

  return undefined
}

const buildRedeemersWithoutCost = (tx: Tx.Tx) =>
  CurrentTxBuilder.pipe(
    Effect.map((b) => {
      const redeemers = b.mintingRedeemers
        .map(
          (r): Redeemer.Redeemer => ({
            _tag: "Minting",
            policyIndex: Assets.nonAdaPolicies(tx.body.minted).indexOf(
              r.policy
            ),
            data: typeof r.redeemer == "function" ? r.redeemer(tx) : r.redeemer,
            cost: { cpu: 0n, mem: 0n }
          })
        )
        .concat(
          b.spendingRedeemers.map(
            (r): Redeemer.Redeemer => ({
              _tag: "Spending",
              inputIndex: tx.body.inputs.map((u) => u.ref).indexOf(r.utxo.ref),
              data:
                typeof r.redeemer == "function" ? r.redeemer(tx) : r.redeemer,
              cost: { cpu: 0n, mem: 0n }
            })
          )
        )
        .concat(
          b.rewardingRedeemers.map(
            (r): Redeemer.Redeemer => ({
              _tag: "Rewarding",
              withdrawalIndex: tx.body.withdrawals
                .map((w) => w[0])
                .indexOf(r.addr),
              data:
                typeof r.redeemer == "function" ? r.redeemer(tx) : r.redeemer,
              cost: { cpu: 0n, mem: 0n }
            })
          )
        )
        .concat(
          b.certifyingRedeemers.map(
            (r): Redeemer.Redeemer => ({
              _tag: "Certifying",
              dcertIndex: tx.body.dcerts.findIndex((dcert) =>
                DCert.equals(dcert, r.dcert)
              ),
              data:
                typeof r.redeemer == "function" ? r.redeemer(tx) : r.redeemer,
              cost: { cpu: 0n, mem: 0n }
            })
          )
        )

      // assign result before returning so that return type is Tx
      tx = {
        ...tx,
        witnesses: {
          ...tx.witnesses,
          redeemers
        }
      }

      return tx
    })
  )

const redeemerInfos = (b: TxBuilder) =>
  (b.mintingRedeemers as RedeemerInfo[])
    .concat(b.spendingRedeemers)
    .concat(b.rewardingRedeemers)
    .concat(b.certifyingRedeemers)

const buildRedeemersWithCost = (tx: Tx.Tx) =>
  Effect.gen(function* () {
    const b = yield* CurrentTxBuilder

    /**
     * Rebuild the redeemers to make sure the indices point to the correct policy/input/withdrawal/dcert
     */
    tx = yield* buildRedeemersWithoutCost(tx)

    yield* Console.log("rebuilt redeemers without cost")

    /**
     * Now calculate the cost of each redeemer
     */
    const costs = yield* Effect.all(
      redeemerInfos(b).map(redeemerValidatorHash).map(profileRedeemer(b, tx))
    )

    // assign result before returning so that return type is Tx
    tx = {
      ...tx,
      witnesses: {
        ...tx.witnesses,
        redeemers: tx.witnesses.redeemers.map((r, i) => ({
          ...r,
          cost: costs[i]
        }))
      }
    }

    return tx
  })

const redeemerValidatorHash = (redeemer: RedeemerInfo) => {
  if ("policy" in redeemer) {
    return MintingPolicy.hash(redeemer.policy)
  } else if ("utxo" in redeemer) {
    const cred = Address.spendingCredential(redeemer.utxo.output.address)
    if (cred._tag != "Validator") {
      throw new Error(
        "unexpected pubkey address for utxo being spent by redeemer"
      )
    }

    return cred.hash
  } else if ("addr" in redeemer) {
    const cred = RewardAddress.credential(redeemer.addr)
    if (cred._tag != "Validator") {
      throw new Error("unexpected pubkey rewardaddress for redeemer withdrawal")
    }

    return cred.hash
  } else {
    return DCert.validatorHash(redeemer.dcert)
  }
}

const profileRedeemer =
  (b: TxBuilder, tx: Tx.Tx) =>
  (vh: ValidatorHash.ValidatorHash, redeemerIndex: number) =>
    Effect.gen(function* () {
      yield* Console.log(`Profiling redeemer of ${vh}`)

      const script = getUplcScript(b, vh)

      const args: Uplc.Value.Value[] = yield* ScriptContext.makeArgs(
        script.version,
        tx,
        redeemerIndex
      )

      const costModel = yield* Network.Params.costModel(script.version)

      yield* Console.log(`Evaluating script`)
      const profile = yield* Uplc.Script.eval(script, args, costModel)

      yield* Console.log(`Done evaluating script`)

      if (profile.value._tag == "Left") {
        yield* Console.log(profile.value.left)

        yield* Console.error(`Script evaluation failed`)

        yield* Console.log(`Script cborHex: ${Bytes.toHex(script.root)}`)
        for (const arg of args) {
          if (Uplc.Value.isData(arg)) {
            yield* Console.log(Bytes.toHex(Uplc.Data.encode(arg.data)))
          } else {
            yield* Console.log(arg)
          }
        }

        yield* Console.log(``)

        // TODO: return a RuntimeError with nice stack trace
        return yield* Effect.fail(new Error(profile.value.left.error))
      }

      return profile.cost
    })

const updateScriptDataHash = (tx: Tx.Tx) =>
  Effect.gen(function* () {
    const scriptDataHash = yield* Tx.scriptDataHash(tx)

    // assign result before returning so that return type is Tx
    tx = {
      ...tx,
      body: {
        ...tx.body,
        scriptDataHash
      }
    }

    return tx
  })

const updateFee = (tx: Tx.Tx) =>
  Effect.gen(function* () {
    const fee = yield* Tx.minFee(tx)

    // assign result before returning so that return type is Tx
    tx = {
      ...tx,
      body: {
        ...tx.body,
        fee
      }
    }

    return tx
  })

const selectCoinsForBalancing = CoinSelection.smallestFirst({
  allowSelectingUninvolvedAssets: true
})

const balanceTx = (tx: Tx.Tx) =>
  Effect.gen(function* () {
    yield* Console.log("Balancing tx...")

    const balancingWallet = yield* BalancingWallet
    const changeAddress = yield* balancingWallet.changeAddress
    const spareUTxOs = yield* balancingWallet.utxos

    /**
     * Lookup or create the change output (TODO: support multiple change outputs?)
     */
    let changeOutput: TxOutput.TxOutput | undefined = tx.body.outputs.find(
      (output) =>
        output.address == changeAddress &&
        output.datum === undefined &&
        output.refScript === undefined
    )

    const nonChangeOutputs = tx.body.outputs.filter(
      (output) => output != changeOutput
    )

    /**
     * Create the change output if no change output was found
     */
    if (changeOutput === undefined) {
      changeOutput = {
        address: changeAddress,
        assets: {}
      }
    }

    const inputAssets = UTxO.sumAssets(...tx.body.inputs)

    // don't count the changeOutput!
    const outputAssets = Assets.sum(
      ...nonChangeOutputs.map((output) => output.assets)
    )
    const feeAssets = { "": tx.body.fee } as Assets.Assets
    const mintedAssets = tx.body.minted
    const depositAssets = yield* certificateDepositBalance(tx.body.dcerts)

    yield* Console.log("Summing assets...")
    let net = Assets.sum(
      inputAssets,
      mintedAssets,
      depositAssets,
      Assets.negate(outputAssets),
      Assets.negate(feeAssets)
    )

    const selectAndAddInputs = (amount: Assets.Assets) =>
      Effect.gen(function* () {
        yield* Console.log("Selecting coins...")
        const candidates = UTxO.difference(
          spareUTxOs ?? [],
          tx.body.inputs.concat(tx.body.refInputs)
        )
        const available = UTxO.sumAssets(...candidates)

        for (const [assetClass, required] of Object.entries(amount)) {
          if ((available[assetClass] ?? 0n) < required) {
            return yield* Effect.fail(
              new InsufficientBalancingAssets(amount, available)
            )
          }
        }

        const selected = selectCoinsForBalancing(candidates, amount)

        if (selected._tag == "Left") {
          return yield* Effect.fail(
            new InsufficientBalancingAssets(amount, available)
          )
        }

        const extraInputs = selected.right

        net = Assets.add(net, UTxO.sumAssets(...extraInputs))

        tx = {
          ...tx,
          body: {
            ...tx.body,
            inputs: UTxO.append(tx.body.inputs, ...extraInputs)
          }
        }
      })

    /**
     * Any negative assets must be added on the input side by using the spareUTxOs
     */
    if (!Assets.isEmpty(Assets.filterNegative(net))) {
      yield* selectAndAddInputs(Assets.negate(Assets.filterNegative(net)))
    }

    /**
     * `net` must be positive at this point
     */
    if (!Assets.isEmpty(Assets.filterNegative(net))) {
      throw new Error("net not positive")
    }

    if (Address.isValidator(changeAddress)) {
      throw new Error("can't send change to validator")
    }

    changeOutput = {
      ...changeOutput,
      assets: Assets.sort()(net)
    }
    net = {}

    const minLovelace = yield* TxOutput.minLovelace(changeOutput)
    let diff = minLovelace - (changeOutput.assets[""] ?? 0n)

    while (diff > 0n) {
      yield* selectAndAddInputs(
        Assets.add(
          { "": diff },
          Assets.negate(Assets.filterNegative(changeOutput.assets))
        )
      )

      changeOutput = {
        ...changeOutput,
        assets: Assets.sort()(Assets.add(changeOutput.assets, net))
      }

      net = {}

      diff =
        (yield* TxOutput.minLovelace(changeOutput)) -
        (changeOutput.assets[""] ?? 0n)
    }

    // assign result before returning so that return type is Tx
    tx = {
      ...tx,
      body: {
        ...tx.body,
        outputs: [...nonChangeOutputs, changeOutput].map(TxOutput.sortAssets)
      }
    }

    return tx
  })

const certificateDepositBalance = (dcerts: readonly DCert.DCert[]) =>
  Effect.gen(function* () {
    const params = yield* Network.Params.params
    const stakeAddrDeposit = BigInt(params.stakeAddrDeposit)

    return dcerts.reduce(
      (sum, dcert) =>
        dcert._tag == "Deregistration"
          ? Assets.add(sum, { "": stakeAddrDeposit })
          : dcert._tag == "Registration"
            ? Assets.subtract(sum, { "": stakeAddrDeposit })
            : sum,
      {} as Assets.Assets
    )
  })
