import { Effect, Schema } from "effect"
import * as Bytes from "../internal/Bytes.js"
import * as Cbor from "../Cbor.js"

const SuspendedData = Schema.suspend(
  (): Schema.Schema<Data, DataEncoded> => Data
)

export const ByteArray = Schema.Struct({
  bytes: Schema.String
})

export type ByteArray = Schema.Schema.Type<typeof ByteArray>

type ByteArrayEncoded = Schema.Schema.Encoded<typeof ByteArray>

export function makeByteArray(
  bytes: string | number[] | Uint8Array
): ByteArray {
  return { bytes: Bytes.toHex(bytes) }
}

/**
 * No need to serialize
 *
 * Cannot used Branded types due Schema issues.
 */
export const Int = Schema.Struct({
  int: Schema.BigIntFromNumber
})

export type Int = Schema.Schema.Type<typeof Int>

type IntEncoded = Schema.Schema.Encoded<typeof Int>

export function makeInt(value: number | bigint): Int {
  return { int: BigInt(value) }
}

export const List = Schema.Struct({
  list: Schema.Array(SuspendedData)
})

/**
 * Must be defined explicitly to avoid circular reference problems
 */
export type List = {
  readonly list: ReadonlyArray<Data>
}

type ListEncoded = {
  readonly list: ReadonlyArray<DataEncoded>
}

export function makeList(items: Data[]): List {
  return {
    list: items
  }
}

export const Map = Schema.Struct({
  map: Schema.Array(
    Schema.Struct({
      k: SuspendedData,
      v: SuspendedData
    })
  )
})

/**
 * Must be defined explicitly to avoid circular reference problems
 */
export type Map = {
  readonly map: ReadonlyArray<{
    readonly k: Data
    readonly v: Data
  }>
}

type MapEncoded = {
  readonly map: ReadonlyArray<{
    readonly k: DataEncoded
    readonly v: DataEncoded
  }>
}

export function makeMap(entries: [Data, Data][]): Map {
  return {
    map: entries.map(([k, v]) => ({ k, v }))
  }
}

export const Constr = Schema.Struct({
  constructor: Schema.Number,
  fields: Schema.Array(SuspendedData)
})

/**
 * Must be defined explicitly to avoid circular reference problems
 */
export type Constr = {
  readonly constructor: number
  readonly fields: ReadonlyArray<Data>
}

type ConstrEncoded = {
  readonly constructor: number
  readonly fields: ReadonlyArray<DataEncoded>
}

export function makeConstr(tag: bigint | number, fields: Data[]): Constr {
  return {
    constructor: Number(tag),
    fields
  }
}

export const Data = Schema.Union(ByteArray, Constr, Int, List, Map, Constr)

/**
 * Must be defined explicitly to avoid circular reference problems
 */
export type Data = ByteArray | Constr | Int | List | Map

type DataEncoded =
  | ByteArrayEncoded
  | ConstrEncoded
  | IntEncoded
  | ListEncoded
  | MapEncoded

/**
 * Simple recursive CBOR decoder
 * @param bytes
 * @returns
 */
export const decode = (bytes: Bytes.BytesLike): Cbor.DecodeEffect<Data> =>
  Effect.gen(function* () {
    const stream = Bytes.makeStream(bytes)

    if (yield* Cbor.isList(stream)) {
      const items = yield* Cbor.decodeList(decode)(stream)

      return makeList(items)
    } else if (yield* Cbor.isBytes(stream)) {
      return makeByteArray(yield* Cbor.decodeBytes(stream))
    } else if (yield* Cbor.isMap(stream)) {
      const entries = yield* Cbor.decodeMap(decode, decode)(stream)

      return makeMap(entries)
    } else if (yield* Cbor.isConstr(stream)) {
      const [tag, fields] = yield* Cbor.decodeConstr(decode)(stream)
      return makeConstr(tag, fields)
    } else {
      return makeInt(yield* Cbor.decodeInt(stream))
    }
  })

/**
 * Simple recursive CBOR encoder
 * @param data
 * @returns
 */
export function encode(data: Data): number[] {
  if ("bytes" in data) {
    return Cbor.encodeBytes(data.bytes.slice(), true)
  } else if ("fields" in data) {
    return Cbor.encodeConstr(data.constructor, data.fields.map(encode))
  } else if ("int" in data) {
    return Cbor.encodeInt(data.int)
  } else if ("list" in data) {
    return Cbor.encodeList(data.list.map(encode))
  } else if ("map" in data) {
    return Cbor.encodeMap(data.map.map(({ k, v }) => [encode(k), encode(v)]))
  } else {
    throw new Error("Unrecognized Uplc.Data type")
  }
}

export const NODE_MEM_SIZE = 4

/**
 * Simple recursive algorithm
 * @param data
 * @returns
 */
export function memSize(data: Data): number {
  if ("bytes" in data) {
    return NODE_MEM_SIZE + calcBytesMemSize(data.bytes)
  } else if ("fields" in data) {
    return data.fields.reduce(
      (prev, field) => prev + memSize(field),
      NODE_MEM_SIZE
    )
  } else if ("int" in data) {
    return NODE_MEM_SIZE + calcIntMemSize(data.int)
  } else if ("list" in data) {
    return data.list.reduce((prev, item) => prev + memSize(item), NODE_MEM_SIZE)
  } else if ("map" in data) {
    return data.map.reduce(
      (prev, { k, v }) => prev + memSize(k) + memSize(v),
      NODE_MEM_SIZE
    )
  } else {
    throw new Error("Unrecognized Uplc.Data type")
  }
}

/**
 * Calculates the mem size of a byte array without the DATA_NODE overhead.
 * @param bytes
 * @returns
 */
export function calcBytesMemSize(
  bytes: string | readonly number[] | Uint8Array
): number {
  const n = Bytes.toArray(bytes).length

  if (n === 0) {
    return 1 // this is so annoying: haskell reference implementation says it should be 0, but current (20220925) testnet and mainnet settings say it's 1
  } else {
    return Math.floor((n - 1) / 8) + 1
  }
}

/**
 * Calculate the mem size of a integer (without the DATA_NODE overhead)
 * @param value
 * @returns
 */
export function calcIntMemSize(value: bigint) {
  if (value == 0n) {
    return 1
  } else {
    const abs = value > 0n ? value : -value

    return Math.floor(log2i(abs) / 64) + 1
  }
}

/**
 * Math.log2 truncates, but we need a rounding down version
 * @param x positive number
 * @returns
 */
export function log2i(x: bigint): number {
  let p = 0

  while (x > 1n) {
    x >>= 1n
    p++
  }

  return p
}
