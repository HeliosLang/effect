import { Console, Effect, Either, Encoding } from "effect"
import { TaggedError } from "effect/Data"
import * as Bytes from "../../Codecs/Bytes.js"
import * as Cbor from "../../Codecs/Cbor.js"
import * as Crypto from "../../Crypto/index.js"
import * as Params from "../Network/Params.js"
import { Cek, Data, Script } from "../Uplc/index.js"
import * as Address from "./Address.js"
import * as Assets from "./Assets.js"
import * as DCert from "./DCert.js"
import * as NativeScript from "./NativeScript.js"
import * as PubKeyHash from "./PubKeyHash.js"
import * as Redeemer from "./Redeemer.js"
import * as RewardAddress from "./RewardAddress.js"
import * as Signature from "./Signature.js"
import * as TxHash from "./TxHash.js"
import * as TxOutput from "./TxOutput.js"
import * as UTxO from "./UTxO.js"
import * as DatumHash from "./DatumHash.js"

/**
 * Schemas don't make much sense here, because txs will only be (de)serialized using CBOR
 */
export interface Tx {
  readonly body: Body
  readonly witnesses: Witnesses
  readonly metadata?: Metadata | undefined

  /**
   * TODO: should this be generalized to "Unbalanced" | "Balanced" | "Valid" ?
   */
  readonly isValid: boolean
}

export interface Body {
  readonly inputs: readonly UTxO.UTxO[]
  readonly outputs: readonly TxOutput.TxOutput[]
  readonly fee: bigint
  readonly firstValidSlot?: number | undefined
  readonly lastValidSlot?: number | undefined
  readonly dcerts: readonly DCert.DCert[]
  readonly withdrawals: readonly [RewardAddress.RewardAddress, bigint][]
  readonly minted: Assets.Assets
  readonly scriptDataHash?: readonly number[] | undefined
  readonly collateral: readonly UTxO.UTxO[]
  readonly signers: readonly PubKeyHash.PubKeyHash[]
  readonly collateralReturn?: TxOutput.TxOutput | undefined
  readonly totalCollateral: bigint
  readonly refInputs: readonly UTxO.UTxO[]
  readonly metadataHash?: readonly number[] | undefined
  readonly encoding?: BodyEncoding | undefined
}

export interface BodyEncoding {
  /**
   * Defaults to true
   */
  inputsAsSet?: boolean | undefined

  /**
   * Defaults to true
   */
  dcertsAsSet?: boolean | undefined

  /**
   * Defaults to true
   */
  collateralInputsAsSet?: boolean | undefined

  /**
   * Defaults to true
   */
  signersAsSet?: boolean | undefined

  /**
   * Defaults to true
   */
  refInputsAsSet?: boolean | undefined
}

export interface Witnesses {
  readonly signatures: readonly Signature.Signature[]
  readonly datums: readonly Data.Data[]
  readonly redeemers: readonly Redeemer.Redeemer[]
  readonly nativeScripts: readonly NativeScript.NativeScript[]
  readonly v1Scripts: readonly Script.Script<1>[]
  readonly v2Scripts: readonly Script.Script<2>[]
  readonly v3Scripts: readonly Script.Script<3>[]
  readonly v2RefScripts: readonly Script.Script<2>[]
  readonly v3RefScripts: readonly Script.Script<3>[]
  readonly encoding?: WitnessesEncoding | undefined
}

export interface WitnessesEncoding {
  /**
   * Defaults to true
   */
  signaturesAsSet?: boolean | undefined

  /**
   * Defaults to true
   */
  datumsAsSet?: boolean | undefined

  /**
   * Defaults to true
   */
  nativeScriptsAsSet?: boolean | undefined

  /**
   * Defaults to true
   */
  v1ScriptsAsSet?: boolean | undefined

  /**
   * Defaults to true
   */
  v2ScriptsAsSet?: boolean | undefined

  /**
   * Defaults to true
   */
  v3ScriptsAsSet?: boolean | undefined
}

export type Metadata = Record<number, MetadataAttr>

export type MetadataAttr =
  | string
  | number
  | readonly MetadataAttr[]
  | Readonly<{ [key: string]: MetadataAttr }> // the standard permits maps with arbitrary keys, but limiting this to string keys is probably good enough for now

/**
 * Used as a starting point for tx building
 */
export const empty: Tx = {
  body: {
    inputs: [],
    outputs: [],
    fee: 0n,
    dcerts: [],
    withdrawals: [],
    minted: {},
    collateral: [],
    signers: [],
    totalCollateral: 0n,
    refInputs: []
  },
  witnesses: {
    signatures: [],
    datums: [],
    redeemers: [],
    nativeScripts: [],
    v1Scripts: [],
    v2Scripts: [],
    v3Scripts: [],
    v2RefScripts: [],
    v3RefScripts: []
  },
  isValid: false
}

export const decode =
  (options: { trusted?: boolean } = {}) =>
  (bytes: Bytes.BytesLike) =>
    Effect.gen(function* () {
      const [body, witnesses, isValid, metadata] = yield* Cbor.decodeTuple([
        decodeUnresolvedBody,
        decodeWitnesses,
        Cbor.decodeBool,
        Cbor.decodeNullOption(decodeMetadata)
      ])(bytes)

      return {
        body: {
          ...body,
          inputs: yield* UTxO.resolveAll(options)(body.inputs),
          collateral: yield* UTxO.resolveAll(options)(body.collateral),
          refInputs: yield* UTxO.resolveAll(options)(body.refInputs)
        } satisfies Body,
        witnesses,
        isValid,
        metadata
      } satisfies Tx
    })

export const encode =
  (options: { forFeeCalculation?: boolean; full?: boolean } = {}) =>
  (tx: Tx): number[] => {
    if (options.forFeeCalculation === true) {
      return Cbor.encodeTuple([
        encodeBody(options)(tx.body),
        encodeWitnesses(tx.witnesses),
        Cbor.encodeNullOption(
          tx.metadata ? encodeMetadata(tx.metadata) : undefined
        )
      ])
    } else {
      return Cbor.encodeTuple([
        encodeBody(options)(tx.body),
        encodeWitnesses(tx.witnesses),
        Cbor.encodeBool(tx.isValid),
        Cbor.encodeNullOption(
          tx.metadata ? encodeMetadata(tx.metadata) : undefined
        )
      ])
    }
  }

const decodeUnresolvedBody = (bytes: Bytes.BytesLike) =>
  Either.gen(function* () {
    let inputsEncodedAsSet = false
    let dcertsEncodedAsSet = false
    let collateralInputsEncodedAsSet = false
    let signersEncodedAsSet = false
    let refInputsEncodedAsSet = false

    const {
      0: inputs,
      1: outputs,
      2: fee,
      3: lastValidSlot,
      4: dcerts,
      5: withdrawals,
      7: metadataHash,
      8: firstValidSlot,
      9: minted,
      11: scriptDataHash,
      13: collateralInputs,
      14: signers,
      16: collateralReturn,
      17: totalCollateral,
      18: refInputs
    } = yield* Cbor.decodeObjectIKey({
      0: (s) => {
        inputsEncodedAsSet = Cbor.isSet(s)
        return Cbor.decodeSet(UTxO.decode)(s)
      },
      1: Cbor.decodeList(TxOutput.decode),
      2: Cbor.decodeInt,
      3: Cbor.decodeIntAsNumber,
      4: (s) => {
        dcertsEncodedAsSet = Cbor.isSet(s)
        return Cbor.decodeSet(DCert.decode)(s)
      },
      5: (s) => Cbor.decodeMap(RewardAddress.decode, Cbor.decodeInt)(s),
      7: Cbor.decodeBytes,
      8: Cbor.decodeIntAsNumber,
      9: Assets.decode,
      11: Cbor.decodeBytes,
      13: (s) => {
        collateralInputsEncodedAsSet = Cbor.isSet(s)
        return Cbor.decodeSet(UTxO.decode)(s)
      },
      14: (s) => {
        signersEncodedAsSet = Cbor.isSet(s)
        return Cbor.decodeSet(PubKeyHash.decode)(s)
      },
      15: Cbor.decodeInt,
      16: TxOutput.decode,
      17: Cbor.decodeInt,
      18: (s) => {
        refInputsEncodedAsSet = Cbor.isSet(s)
        return Cbor.decodeSet(UTxO.decode)(s)
      }
    })(bytes)

    return {
      inputs: inputs ?? [],
      outputs: outputs ?? [],
      fee: fee ?? 0n,
      firstValidSlot,
      lastValidSlot,
      dcerts: dcerts ?? [],
      withdrawals: withdrawals ?? [],
      metadataHash,
      minted: minted ?? {},
      scriptDataHash,
      collateral: collateralInputs ?? [],
      signers: signers ?? [],
      collateralReturn,
      totalCollateral: totalCollateral ?? 0n,
      refInputs: refInputs ?? [],
      encoding: {
        inputsAsSet: inputsEncodedAsSet,
        dcertsAsSet: dcertsEncodedAsSet,
        collateralInputsAsSet: collateralInputsEncodedAsSet,
        signersAsSet: signersEncodedAsSet,
        refInputsAsSet: refInputsEncodedAsSet
      }
    }
  })

const encodeBody =
  (options: { full?: boolean }) =>
  (body: Body): number[] => {
    const m: Map<number, number[]> = new Map()

    const encodeInputsAsSet = body.encoding?.inputsAsSet ?? true
    const encodedInputs = body.inputs.map(UTxO.encode(options))
    m.set(
      0,
      encodeInputsAsSet
        ? Cbor.encodeSet(encodedInputs)
        : Cbor.encodeDefList(encodedInputs)
    )

    m.set(1, Cbor.encodeDefList(body.outputs.map(TxOutput.encode)))
    m.set(2, Cbor.encodeInt(body.fee))

    if (body.lastValidSlot !== undefined) {
      m.set(3, Cbor.encodeInt(body.lastValidSlot))
    }

    if (body.dcerts.length != 0) {
      const encodeAsSet = body.encoding?.dcertsAsSet ?? true
      const encodedItems = body.dcerts.map(DCert.encode)

      m.set(
        4,
        encodeAsSet
          ? Cbor.encodeSet(encodedItems)
          : Cbor.encodeDefList(encodedItems)
      )
    }

    if (body.withdrawals.length != 0) {
      const encodedPairs = body.withdrawals.map(
        ([sa, q]) =>
          [RewardAddress.encode(sa), Cbor.encodeInt(q)] as [number[], number[]]
      )

      m.set(5, Cbor.encodeMap(encodedPairs))
    }

    if (body.metadataHash !== undefined) {
      m.set(7, Cbor.encodeBytes(body.metadataHash))
    }

    if (body.firstValidSlot !== undefined) {
      m.set(8, Cbor.encodeInt(body.firstValidSlot))
    }

    if (!Assets.isEmpty(body.minted)) {
      m.set(9, Assets.encode({ withoutLovelace: true })(body.minted))
    }

    if (body.scriptDataHash !== undefined) {
      m.set(11, Cbor.encodeBytes(body.scriptDataHash))
    }

    if (body.collateral.length != 0) {
      const encodeAsSet = body.encoding?.collateralInputsAsSet ?? true
      const encodedItems = body.collateral.map(UTxO.encode(options))
      m.set(
        13,
        encodeAsSet
          ? Cbor.encodeSet(encodedItems)
          : Cbor.encodeDefList(encodedItems)
      )
    }

    if (body.signers.length != 0) {
      const encodeAsSet = body.encoding?.signersAsSet ?? true
      const encodedItems = body.signers.map(PubKeyHash.encode)

      m.set(
        14,
        encodeAsSet
          ? Cbor.encodeSet(encodedItems)
          : Cbor.encodeDefList(encodedItems)
      )
    }

    // what is NetworkId used for, seems a bit useless?
    // object.set(15, encodeInt(2n));

    if (body.collateralReturn !== undefined) {
      m.set(16, TxOutput.encode(body.collateralReturn))
    }

    if (body.totalCollateral > 0n) {
      m.set(17, Cbor.encodeInt(body.totalCollateral))
    }

    if (body.refInputs.length != 0) {
      const encodeAsSet = body.encoding?.refInputsAsSet ?? true
      const encodedItems = body.refInputs.map(UTxO.encode(options))

      m.set(
        18,
        encodeAsSet
          ? Cbor.encodeSet(encodedItems)
          : Cbor.encodeDefList(encodedItems)
      )
    }

    return Cbor.encodeObjectIKey(m)
  }

const decodeWitnesses = (
  bytes: Bytes.BytesLike
): Cbor.DecodeResult<Witnesses> =>
  Either.gen(function* () {
    let signaturesEncodedAsSet = false
    let nativeScriptsEncodedAsSet = false
    let v1ScriptsEncodedAsSet = false
    let datumsEncodedAsSet = false
    let v2ScriptsEncodedAsSet = false
    let v3ScriptsEncodedAsSet = false

    const {
      0: signatures,
      1: nativeScripts,
      3: v1Scripts,
      4: datums,
      5: redeemers,
      6: v2Scripts,
      7: v3Scripts
    } = yield* Cbor.decodeObjectIKey({
      0: (s) => {
        signaturesEncodedAsSet = Cbor.isSet(s)
        return Cbor.decodeSet(Signature.decode)(s)
      },
      1: (s) => {
        nativeScriptsEncodedAsSet = Cbor.isSet(s)
        return Cbor.decodeSet(NativeScript.decode)(s)
      },
      3: (s) => {
        v1ScriptsEncodedAsSet = Cbor.isSet(s)
        return Cbor.decodeSet(Script.decode(1))(s)
      },
      4: (s) => {
        datumsEncodedAsSet = Cbor.isSet(s)
        return Cbor.decodeSet(Data.decode)(s)
      },
      5: Cbor.decodeList(Redeemer.decode),
      6: (s) => {
        v2ScriptsEncodedAsSet = Cbor.isSet(s)
        return Cbor.decodeSet(Script.decode(2))(s)
      },
      7: (s) => {
        v3ScriptsEncodedAsSet = Cbor.isSet(s)
        return Cbor.decodeSet(Script.decode(3))(s)
      }
    })(bytes)

    return {
      signatures: signatures ?? [],
      nativeScripts: nativeScripts ?? [],
      v1Scripts: v1Scripts ?? [],
      datums: datums ?? [],
      redeemers: redeemers ?? [],
      v2Scripts: v2Scripts ?? [],
      v2RefScripts: [],
      v3Scripts: v3Scripts ?? [],
      v3RefScripts: [],
      encoding: {
        signaturesAsSet: signaturesEncodedAsSet,
        nativeScriptsAsSet: nativeScriptsEncodedAsSet,
        v1ScriptsAsSet: v1ScriptsEncodedAsSet,
        datumsAsSet: datumsEncodedAsSet,
        v2ScriptsAsSet: v2ScriptsEncodedAsSet,
        v3ScriptsAsSet: v3ScriptsEncodedAsSet
      }
    } satisfies Witnesses
  })

function encodeWitnesses(witnesses: Witnesses): number[] {
  const m = new Map<number, number[]>()

  if (witnesses.signatures.length > 0) {
    const encodeAsSet = witnesses.encoding?.signaturesAsSet ?? true
    const encodedItems = witnesses.signatures.map(Signature.encode)

    m.set(
      0,
      encodeAsSet
        ? Cbor.encodeSet(encodedItems)
        : Cbor.encodeDefList(encodedItems)
    )
  }

  if (witnesses.nativeScripts.length > 0) {
    const encodeAsSet = witnesses.encoding?.nativeScriptsAsSet ?? true
    const encodedItems = witnesses.nativeScripts.map(NativeScript.encode)

    m.set(
      1,
      encodeAsSet
        ? Cbor.encodeSet(encodedItems)
        : Cbor.encodeDefList(encodedItems)
    )
  }

  if (witnesses.v1Scripts.length > 0) {
    const encodeAsSet = witnesses.encoding?.v1ScriptsAsSet ?? true
    const encodedItems = witnesses.v1Scripts.map(Script.encode)

    m.set(
      3,
      encodeAsSet
        ? Cbor.encodeSet(encodedItems)
        : Cbor.encodeDefList(encodedItems)
    )
  }

  if (witnesses.datums.length > 0) {
    const encodeAsSet = witnesses.encoding?.datumsAsSet ?? true
    const encodedItems = witnesses.datums.map(Data.encode)

    m.set(
      4,
      encodeAsSet
        ? Cbor.encodeSet(encodedItems)
        : Cbor.encodeDefList(encodedItems)
    )
  }

  if (witnesses.redeemers.length > 0) {
    m.set(5, Cbor.encodeDefList(witnesses.redeemers.map(Redeemer.encode)))
  }

  if (witnesses.v2Scripts.length > 0) {
    const encodeAsSet = witnesses.encoding?.v2ScriptsAsSet ?? true
    const encodedItems = witnesses.v2Scripts.map(Script.encode)

    m.set(
      6,
      encodeAsSet
        ? Cbor.encodeSet(encodedItems)
        : Cbor.encodeDefList(encodedItems)
    )
  }

  if (witnesses.v3Scripts.length > 0) {
    const encodeAsSet = witnesses.encoding?.v3ScriptsAsSet ?? true
    const encodedItems = witnesses.v3Scripts.map(Script.encode)

    m.set(
      7,
      encodeAsSet
        ? Cbor.encodeSet(encodedItems)
        : Cbor.encodeDefList(encodedItems)
    )
  }

  return Cbor.encodeObjectIKey(m)
}

const decodeMetadata = (
  bytes: Bytes.BytesLike
): Cbor.DecodeResult<Metadata> => {
  return Cbor.decodeMap(
    Cbor.decodeIntAsNumber,
    decodeMetadataAttr
  )(bytes).pipe(Either.map(Object.fromEntries))
}

function encodeMetadata(metadata: Metadata): number[] {
  return Cbor.encodeMap(
    Object.entries(metadata).map(([k, v]) => [
      Cbor.encodeInt(Number(k)),
      encodeMetadataAttr(v)
    ])
  )
}

export function hashMetadata(metadata: Metadata): number[] {
  return Bytes.toArray(Crypto.Blake2b.hashSync(encodeMetadata(metadata)))
}

const decodeMetadataAttr = (
  bytes: Bytes.BytesLike
): Cbor.DecodeResult<MetadataAttr> => {
  const stream = Bytes.makeStream(bytes)

  if (Cbor.isString(stream)) {
    return Cbor.decodeString(stream)
  } else if (Cbor.isList(stream)) {
    return Cbor.decodeList(decodeMetadataAttr)(stream)
  } else if (Cbor.isMap(stream)) {
    return Cbor.decodeMap(
      Cbor.decodeString,
      decodeMetadataAttr
    )(stream).pipe(Either.map(Object.fromEntries))
  } else {
    return Cbor.decodeInt(stream).pipe(Either.map(Number))
  }
}

function encodeMetadataAttr(attr: MetadataAttr): number[] {
  if (typeof attr == "string") {
    return Cbor.encodeString(attr, true)
  } else if (typeof attr == "number") {
    return Cbor.encodeInt(attr)
  } else if (Array.isArray(attr)) {
    return Cbor.encodeDefList(attr.map(encodeMetadataAttr))
  } else {
    return Cbor.encodeMap(
      Object.entries(attr).map(([k, v]) => [
        Cbor.encodeString(k),
        encodeMetadataAttr(v)
      ])
    )
  }
}

export function hash(tx: Tx): TxHash.TxHash {
  return Encoding.encodeHex(
    Crypto.Blake2b.hashSync(encodeBody({ full: false })(tx.body))
  ) as TxHash.TxHash
}

const countUniqueSigners = (body: Body): number => {
  const set = new Set<PubKeyHash.PubKeyHash>()

  body.inputs.concat(body.collateral).forEach((utxo) => {
    const address = utxo.output.address
    const credential = Address.spendingCredential(address)
    if (credential._tag == "PubKey") {
      set.add(credential.hash)
    }
  })

  body.signers.forEach((s) => set.add(s))

  return set.size
}

const countNonDummySignatures = (witnesses: Witnesses): number => {
  return witnesses.signatures.reduce(
    (count, s) => count + (Signature.isDummy(s) ? 0 : 1),
    0
  )
}

const countMissingSignatures = (tx: Tx): number =>
  countUniqueSigners(tx.body) - countNonDummySignatures(tx.witnesses)

/**
 * Number of bytes of CBOR encoding of Tx
 *
 * Is used for two things:
 *   - tx fee calculation
 *   - tx size validation
 *
 * @param forFeeCalc
 */
export const size =
  (forFeeCalculation: boolean = false) =>
  (tx: Tx) => {
    // add dummy signatures to make sure the tx has the correct size
    let nDummy = 0

    if (forFeeCalculation) {
      nDummy = countMissingSignatures(tx)
      tx = {
        ...tx,
        witnesses: {
          ...tx.witnesses,
          signatures: tx.witnesses.signatures.concat(
            new Array(nDummy).fill(Signature.dummy)
          )
        }
      }
    }

    return encode({ forFeeCalculation, full: false })(tx).length
  }

const refScriptsSize = (tx: Tx): number => {
  const utxos = tx.body.inputs.concat(tx.body.refInputs)

  const unique = {} as Record<string, UTxO.UTxO>

  utxos.forEach((utxo) => {
    unique[utxo.ref] = utxo
  })

  return Object.values(unique).reduce((prev, utxo) => {
    if (utxo.output.refScript) {
      return prev + Script.encode(utxo.output.refScript).length
    } else {
      return prev
    }
  }, 0)
}

const refScriptsFee =
  (feePerByte: number, growthIncrement = 25600, growthFactor = 1.2) =>
  (tx: Tx): bigint => {
    let s = refScriptsSize(tx)

    let multiplier = 1.0
    let fee = 0n

    while (s > growthIncrement) {
      fee += BigInt(Math.floor(growthIncrement * multiplier * feePerByte))
      s -= growthIncrement
      multiplier *= growthFactor
    }

    fee += BigInt(Math.floor(s * multiplier * feePerByte))
    return fee
  }

export const minFee = (tx: Tx) =>
  Effect.gen(function* () {
    const p = yield* Params.params

    if (p.txFeeFixed === undefined) {
      throw new Error(
        `Network.Params.params.txFeeFixed undefined in Cardano.Ledger.Tx.minFee()`
      )
    }

    if (p.txFeePerByte === undefined) {
      throw new Error(
        `Network.Params.params.txFeePerByte undefined in Cardano.Ledger.Tx.minFee()`
      )
    }

    const s = size(true)(tx)

    if (!Number.isFinite(s)) {
      throw new Error(`tx size not finite in Cardano.Ledger.Tx.minFee()`)
    }

    const sizeFee =
      BigInt(p.txFeeFixed) + BigInt(size(true)(tx)) * BigInt(p.txFeePerByte)

    const { mem: totalMem, cpu: totalCpu } = tx.witnesses.redeemers.reduce(
      (cost, r) => ({ cpu: cost.cpu + r.cost.cpu, mem: cost.mem + r.cost.mem }),
      { cpu: 0n, mem: 0n }
    )

    if (p.exMemFeePerUnit === undefined) {
      throw new Error(
        `Network.Params.params.exMemFeePerUnit undefined in Cardano.Ledger.Tx.minFee()`
      )
    }

    if (p.exCpuFeePerUnit === undefined) {
      throw new Error(
        `Network.Params.params.exCpuFeePerUnit undefined in Cardano.Ledger.Tx.minFee()`
      )
    }

    const exFee = BigInt(
      Math.ceil(
        Number(totalMem) * p.exMemFeePerUnit +
          Number(totalCpu) * p.exCpuFeePerUnit
      )
    )

    if (p.refScriptsFeePerByte === undefined) {
      throw new Error(
        `Network.Params.params.refScriptsFeePerByte undefined in Cardano.Ledger.Tx.minFee()`
      )
    }

    const rsFee = refScriptsFee(p.refScriptsFeePerByte)(tx)

    return sizeFee + exFee + rsFee
  })

export const minCollateral = (tx: Tx) =>
  Effect.gen(function* () {
    if (!isSmart(tx)) {
      return 0n
    }

    const p = yield* Params.params

    if (p.collateralPercentage === undefined) {
      throw new Error(
        `Network.Params.params.collateralPercentage undefined in Cardano.Ledger.Tx.minFee()`
      )
    }

    const fee = tx.body.fee
    const pct = p.collateralPercentage

    const mc = BigInt(Math.ceil((pct * Number(fee)) / 100.0))

    return mc
  })

export const inputDatum = (inputIndex: number) => (tx: Tx) => {
  const datum = tx.body.inputs[inputIndex]?.output?.datum

  if (datum === undefined) {
    return datum
  } else if ("hash" in datum) {
    const resolvedDatum = tx.witnesses.datums.find(
      (d) => DatumHash.hash(d) == datum.hash
    )

    if (resolvedDatum === undefined) {
      throw new Error(
        `Datum for hash '${datum.hash}' not found in tx.witnesses.datums`
      )
    }

    return resolvedDatum
  } else {
    return datum
  }
}

function isSmart(tx: Tx): boolean {
  return (
    tx.witnesses.v1Scripts.length > 0 ||
    tx.witnesses.v2Scripts.length > 0 ||
    tx.witnesses.v2RefScripts.length > 0 ||
    tx.witnesses.v3Scripts.length > 0 ||
    tx.witnesses.v3RefScripts.length > 0
  )
}

export const scriptDataHash = (tx: Tx) =>
  Effect.gen(function* () {
    if (tx.witnesses.redeemers.length == 0) {
      return undefined
    }

    let bytes = Cbor.encodeDefList(tx.witnesses.redeemers.map(Redeemer.encode))

    if (tx.witnesses.datums.length > 0) {
      bytes = bytes.concat(Data.encode(Data.makeListData(tx.witnesses.datums)))
    }

    const encodedCostModels: [number[], number[]][] = []

    if (isSmart(tx)) {
      const params = yield* Params.params

      if (tx.witnesses.v1Scripts.length > 0) {
        encodedCostModels.push([
          Cbor.encodeInt(0),
          Cbor.encodeDefList(params.costModelParamsV1.map(Cbor.encodeInt))
        ] as const)
      }

      if (
        tx.witnesses.v2Scripts.length > 0 ||
        tx.witnesses.v2RefScripts.length > 0
      ) {
        encodedCostModels.push([
          Cbor.encodeInt(1),
          Cbor.encodeDefList(params.costModelParamsV2.map(Cbor.encodeInt))
        ] as const)
      }

      if (
        tx.witnesses.v3Scripts.length > 0 ||
        tx.witnesses.v3RefScripts.length > 0
      ) {
        encodedCostModels.push([
          Cbor.encodeInt(2),
          Cbor.encodeDefList(params.costModelParamsV3.map(Cbor.encodeInt))
        ] as const)
      }
    }

    bytes = bytes.concat(Cbor.encodeMap(encodedCostModels))

    return Bytes.toArray(Crypto.Blake2b.hashSync(bytes))
  })

export class InvalidTx extends TaggedError("Cardano.Ledger.Tx.InvalidTx")<{
  message: string
}> {
  constructor(reason: string) {
    super({ message: `Invalid tx (${reason})` })
  }
}
export type ValidationOptions = {
  strict?: boolean | undefined
  verbose?: boolean | undefined
  logger?: Cek.Logger | undefined
}

export const validate =
  ({
    strict = false,
    verbose: _verbose = false,
    logger: _logger = undefined
  }: ValidationOptions = {}) =>
  (tx: Tx) =>
    Effect.gen(function* () {
      yield* validateSize(tx)

      yield* validateFee(tx)

      yield* validateConservation(tx)

      yield* validateCollateral(strict)(tx)

      yield* validateOutputs(strict)(tx)
    })

/**
 * The guards throwing defects help during debugging
 */
const validateSize = (tx: Tx) =>
  Effect.gen(function* () {
    const p = yield* Params.params

    if (p.maxTxSize === undefined) {
      throw new Error(
        `Network.Params.params.maxTxSize undefined in Cardano.Ledger.Tx.validateSize()`
      )
    }

    const s = size()(tx)
    if (s > p.maxTxSize) {
      return yield* new InvalidTx(`size too big, ${s} > ${p.maxTxSize}`)
    }
  })

/**
 * The guards throwing defects help during debugging
 */
const validateFee = (tx: Tx) =>
  Effect.gen(function* () {
    const f = yield* minFee(tx)

    if (tx.body.fee < f) {
      return yield* new InvalidTx(
        `fee too small, expected at least ${f} but got ${tx.body.fee}`
      )
    }
  })

/**
 * The guards throwing defects help during debugging
 */
const validateConservation = (tx: Tx) =>
  Effect.gen(function* () {
    const p = yield* Params.params

    if (p.stakeAddrDeposit === undefined) {
      throw new Error(
        `Network.Params.params.stakeAddrDeposit undefined in Cardano.Ledger.Tx.validateConservation()`
      )
    }

    let sum: Assets.Assets = UTxO.sumAssets(...tx.body.inputs)
    sum = tx.body.dcerts.reduce(
      (prev, dcert) =>
        dcert._tag == "Deregistration"
          ? Assets.add(prev, { "": BigInt(p.stakeAddrDeposit) })
          : dcert._tag == "Registration"
            ? Assets.subtract(prev, { "": BigInt(p.stakeAddrDeposit) })
            : prev,
      sum
    )
    sum = Assets.subtract(sum, { "": tx.body.fee })
    sum = Assets.add(sum, tx.body.minted)
    sum = Assets.subtract(sum, TxOutput.sumAssets(...tx.body.outputs))

    if (!Assets.isEmpty(sum)) {
      return yield* new InvalidTx(
        `value not conserved (diff: ${Assets.pretty(sum)})`
      )
    }
  })

/**
 * The guards throwing defects help during debugging
 */
const validateCollateral = (strict: boolean) => (tx: Tx) =>
  Effect.gen(function* () {
    const p = yield* Params.params

    if (p.maxCollateralInputs === undefined) {
      throw new Error(
        `Network.Params.params.maxCollateralInputs undefined in Cardano.Ledger.Tx.validateCollateral()`
      )
    }

    if (tx.body.collateral.length > p.maxCollateralInputs) {
      return yield* new InvalidTx(
        `too many collateral inputs (${tx.body.collateral.length} > ${p.maxCollateralInputs})`
      )
    }

    if (!isSmart(tx)) {
      if (strict && tx.body.collateral.length != 0) {
        return yield* new InvalidTx(`unnecessary collateral included`)
      }

      return
    }

    // skip this validation if the NetworkParams.collateralUTXO is used (we can assume that such a UTXO is always clean and contains enough lovelace)
    if (
      p.collateralUTXO !== undefined &&
      tx.body.collateral.some((utxo) => utxo.ref == p.collateralUTXO)
    ) {
      return
    }

    const mc = yield* minCollateral(tx)

    let sum: bigint = 0n

    for (const utxo of tx.body.collateral) {
      if (!Assets.containsOnlyAda(utxo.output.assets)) {
        return yield* new InvalidTx(
          `collateral can only contain lovelace (collateral utxo ${utxo.ref} contains ${Object.keys(utxo.output.assets).join(", ")})`
        )
      }

      sum += utxo.output.assets[""] ?? 0n
    }

    if (tx.body.collateralReturn !== undefined) {
      if (!Assets.containsOnlyAda(tx.body.collateralReturn.assets)) {
        return yield* new InvalidTx(
          `collateral return can only contain lovelace (collateral return contains ${Object.keys(tx.body.collateralReturn.assets).join(", ")})`
        )
      }

      sum -= tx.body.collateralReturn.assets[""] ?? 0n
    }

    if (sum < mc) {
      return yield* new InvalidTx(
        `insufficient collateral lovelace (${sum} < ${mc})`
      )
    }

    if (sum > mc * 5n) {
      yield* Console.warn(`way too much collateral (${sum} >> ${mc})`)
    }
  })

export const validateOutputs = (strict: boolean) => (tx: Tx) =>
  Effect.gen(function* () {
    for (const output of tx.body.outputs) {
      const minLovelace = yield* TxOutput.minLovelace(output)

      if (minLovelace > (output.assets[""] ?? 0n)) {
        return yield* new InvalidTx(
          `not enough lovelace in output (expected at least ${minLovelace.toString()}, got ${output.assets[""] ?? 0n})`
        )
      }

      if (strict && !Assets.isSorted(output.assets)) {
        return yield* new InvalidTx(`output assets not sorted`)
      }
    }
  })
