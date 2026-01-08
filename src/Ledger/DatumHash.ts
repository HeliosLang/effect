import { Effect, Encoding, Schema } from "effect"
import * as Bytes from "../internal/Bytes.js"
import { decodeBytes, DecodeEffect, encodeBytes } from "../Cbor.js"
import { Data } from "../Uplc"

export function isValid(dh: string): boolean {
  return /^[0-9a-fA-F]+$/.test(dh) && dh.length == 64
}

export const DatumHash = Schema.String.pipe(
  Schema.filter((dh: string) => isValid(dh) || "Invalid Cardano DatumHash"),
  Schema.brand("DatumHash")
)

export type DatumHash = Schema.Schema.Type<typeof DatumHash>

export function make(bytes: Bytes.BytesLike) {
  return Schema.decode(DatumHash)(Bytes.toHex(bytes))
}

export const FromUplcData = Schema.transform(Data.ByteArray, DatumHash, {
  strict: true,
  decode: Encoding.encodeHex,
  encode: Bytes.toUint8Array
})

export const decode = (bytes: Bytes.BytesLike): DecodeEffect<DatumHash> =>
  decodeBytes(bytes).pipe(
    Effect.map((bytes) => new Uint8Array(bytes)),
    Effect.map(Encoding.encodeHex),
    Effect.map(Schema.decodeSync(DatumHash))
  )

export function encode(dh: DatumHash): number[] {
  return encodeBytes(dh)
}
