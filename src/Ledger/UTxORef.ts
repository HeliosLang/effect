import { Either, Schema } from "effect"
import * as Bytes from "../internal/Bytes.js"
import * as Cbor from "../Cbor.js"
import * as Data from "../Uplc/Data.js"
import * as TxHash from "./TxHash.js"

export function isValid(ref: string): ref is UTxORef {
  if (ref.length < 65) {
    return false
  }

  const txHash = ref.slice(0, 64)
  const index = parseInt(ref.slice(64))

  if (index.toString() != ref.slice(64)) {
    return false
  }

  return /^[0-9a-fA-F]+$/.test(txHash)
}

export const UTxORef = Schema.transform(
  Schema.String,
  Schema.String.pipe(
    Schema.filter((id: string) => isValid(id) || "Invalid Cardano UTxORef"),
    Schema.brand("UTxORef")
  ),
  {
    strict: false,
    decode: (s) => s.split("#").join(""),
    encode: (s) => s
  }
)

export type UTxORef = Schema.Schema.Type<typeof UTxORef>

export function make(txHash: TxHash.TxHash, index: number | bigint): UTxORef {
  return (txHash + index.toString()) as UTxORef
}

export const FromUplcData = Schema.transform(
  Data.EnumVariant(0, {
    txHash: TxHash.FromUplcData,
    index: Data.Int
  }),
  UTxORef,
  {
    strict: true,
    decode: ({ txHash, index: index }) => {
      return make(txHash, index)
    },
    encode: (ref) => {
      return {
        txHash: txHash(ref as UTxORef),
        index: index(ref as UTxORef)
      }
    }
  }
)

export const FromUplcDataV3 = Schema.transform(
  Data.EnumVariant(0, {
    txHash: TxHash.FromUplcDataV3,
    index: Data.Int
  }),
  UTxORef,
  {
    strict: true,
    decode: ({ txHash, index: index }) => {
      return make(txHash, index)
    },
    encode: (ref) => {
      return {
        txHash: txHash(ref as UTxORef),
        index: index(ref as UTxORef)
      }
    }
  }
)

export const decode = (bytes: Bytes.BytesLike): Cbor.DecodeResult<UTxORef> =>
  Cbor.decodeTuple([TxHash.decode, Cbor.decodeInt])(bytes).pipe(
    Either.map(([txId, utxoIdx]) => make(txId, utxoIdx))
  )

export function encode(ref: UTxORef): number[] {
  return Cbor.encodeTuple([
    TxHash.encode(txHash(ref)),
    Cbor.encodeInt(index(ref))
  ])
}

export function pretty(ref: UTxORef): string {
  return txHash(ref) + "#" + index(ref).toString()
}

export function txHash(ref: UTxORef): TxHash.TxHash {
  return ref.slice(0, 64) as TxHash.TxHash
}

export function index(ref: UTxORef): number {
  return parseInt(ref.slice(64))
}

export function compare(a: UTxORef, b: UTxORef): number {
  const d = TxHash.compare(txHash(a), txHash(b))

  if (d != 0) {
    return d
  }

  return index(a) - index(b)
}
