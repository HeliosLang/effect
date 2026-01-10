import { Effect, Schema } from "effect"
import * as Bytes from "../internal/Bytes.js"
import * as Cbor from "../Cbor.js"
import * as Uplc from "../Uplc"
import * as TxId from "./TxId.js"

export function isValid(txOutputId: string): txOutputId is TxOutputId {
  if (txOutputId.length < 65) {
    return false
  }

  const txId = txOutputId.slice(0, 64)

  const utxoIdx = parseInt(txOutputId.slice(64))

  if (utxoIdx.toString() != txOutputId.slice(64)) {
    return false
  }

  return /^[0-9a-fA-F]+$/.test(txId)
}

export const TxOutputId = Schema.transform(
  Schema.String,
  Schema.String.pipe(
    Schema.filter((id: string) => isValid(id) || "Invalid Cardano TxOutputId"),
    Schema.brand("TxOutputId")
  ),
  {
    strict: false,
    decode: (s) => s.split("#").join(""),
    encode: (s) => s
  }
)

export type TxOutputId = Schema.Schema.Type<typeof TxOutputId>

export function make(txId: TxId.TxId, utxoIdx: number | bigint): TxOutputId {
  return (txId + utxoIdx.toString()) as TxOutputId
}

export const FromUplcData = Schema.transform(
  Uplc.Data.EnumVariant(0, {
    txId: TxId.FromUplcData,
    utxoIdx: Uplc.Data.Int
  }),
  TxOutputId,
  {
    strict: true,
    decode: ({ txId, utxoIdx }) => {
      return make(txId, utxoIdx)
    },
    encode: (txOutputId) => {
      return {
        txId: txId(txOutputId as TxOutputId),
        utxoIdx: utxoIdx(txOutputId as TxOutputId)
      }
    }
  }
)

export const decode = (bytes: Bytes.BytesLike): Cbor.DecodeEffect<TxOutputId> =>
  Cbor.decodeTuple([TxId.decode, Cbor.decodeInt])(bytes).pipe(
    Effect.map(([txId, utxoIdx]) => make(txId, utxoIdx))
  )

export function encode(txOutputId: TxOutputId): number[] {
  return Cbor.encodeTuple([
    TxId.encode(txId(txOutputId)),
    Cbor.encodeInt(utxoIdx(txOutputId))
  ])
}

export function pretty(txOutputId: TxOutputId): string {
  return txId(txOutputId) + "#" + utxoIdx(txOutputId).toString()
}

export function txId(txOutputId: TxOutputId): TxId.TxId {
  return txOutputId.slice(0, 64) as TxId.TxId
}

export function utxoIdx(txOutputId: TxOutputId): number {
  return parseInt(txOutputId.slice(64))
}
