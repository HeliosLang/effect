import { Effect, Either, Encoding, Schema } from "effect"
import * as Bytes from "../internal/Bytes.js"
import { decodeBytes, DecodeResult, encodeBytes } from "../Cbor.js"
import { Data } from "../Uplc"

export function isValid(pk: string): pk is PubKey {
  return /^[0-9a-fA-F]+$/.test(pk) && pk.length == 64
}
export const PubKey = Schema.String.pipe(
  Schema.filter((pk: string) => isValid(pk) || "Invalid Cardano PubKey"),
  Schema.brand("PubKey")
)

export type PubKey = Schema.Schema.Type<typeof PubKey>

export function make(bytes: Bytes.BytesLike) {
  return Schema.decode(PubKey)(Bytes.toHex(bytes))
}

export const FromUplcData = Schema.transform(Data.ByteArray, PubKey, {
  strict: true,
  decode: Encoding.encodeHex,
  encode: (s) => Effect.runSync(Encoding.decodeHex(s))
})

export const decode = (bytes: Bytes.BytesLike): DecodeResult<PubKey> =>
  decodeBytes(bytes).pipe(
    Either.map((bytes) => new Uint8Array(bytes)),
    Either.map(Encoding.encodeHex),
    Either.map(Schema.decodeSync(PubKey))
  )

export function encode(pkh: PubKey): number[] {
  return encodeBytes(pkh)
}

export const dummy: PubKey = Encoding.encodeHex(
  new Uint8Array(new Array(32).fill(0))
) as PubKey
