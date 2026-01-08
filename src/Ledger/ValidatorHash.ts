import { Effect, Encoding, Schema } from "effect"
import * as Bytes from "../internal/Bytes.js"
import { decodeBytes, DecodeEffect, encodeBytes } from "../Cbor.js"
import { Data } from "../Uplc/index.js"

export function isValid(vh: string): boolean {
  return /^[0-9a-fA-F]+$/.test(vh) && vh.length == 56
}

export const ValidatorHash = Schema.String.pipe(
  Schema.filter((vh: string) => isValid(vh) || "Invalid Cardano ValidatorHash"),
  Schema.brand("ValidatorHash")
)

export type ValidatorHash = Schema.Schema.Type<typeof ValidatorHash>

export function make(bytes: Bytes.BytesLike) {
  return Schema.decode(ValidatorHash)(Bytes.toHex(bytes))
}

export const FromUplcData = Schema.transform(Data.ByteArray, ValidatorHash, {
  strict: true,
  decode: Encoding.encodeHex,
  encode: Bytes.toUint8Array
})

export const decode = (bytes: Bytes.BytesLike): DecodeEffect<ValidatorHash> =>
  decodeBytes(bytes).pipe(
    Effect.map((bytes) => new Uint8Array(bytes)),
    Effect.map(Encoding.encodeHex),
    Effect.map(Schema.decodeSync(ValidatorHash))
  )

export function encode(vh: ValidatorHash): number[] {
  return encodeBytes(vh)
}
