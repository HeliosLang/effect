import { Either, Encoding, Schema } from "effect"
import * as Bytes from "../../Codecs/Bytes.js"
import { decodeBytes, DecodeResult, encodeBytes } from "../../Codecs/Cbor.js"
import { Data } from "../Uplc"

export function isValid(vh: string): boolean {
  return /^[0-9a-fA-F]+$/.test(vh) && vh.length == 56
}

export const ValidatorHash = Schema.String.pipe(
  Schema.filter((vh: string) => isValid(vh) || "Invalid Cardano ValidatorHash"),
  Schema.brand("ValidatorHash")
)

export type ValidatorHash = Schema.Schema.Type<typeof ValidatorHash>

export function make(bytes: Bytes.BytesLike) {
  return Schema.decodeEither(ValidatorHash)(Bytes.toHex(bytes))
}

export const FromUplcData = Schema.transform(Data.ByteArray, ValidatorHash, {
  strict: true,
  decode: Encoding.encodeHex,
  encode: Bytes.toUint8Array
})

export const decode = (bytes: Bytes.BytesLike): DecodeResult<ValidatorHash> =>
  decodeBytes(bytes).pipe(
    Either.map((bytes) => new Uint8Array(bytes)),
    Either.map(Encoding.encodeHex),
    Either.map(Schema.decodeSync(ValidatorHash))
  )

export function encode(vh: ValidatorHash): number[] {
  return encodeBytes(vh)
}
