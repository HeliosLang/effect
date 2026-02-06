import { Effect, Either, Encoding, Schema } from "effect"
import * as Bytes from "../internal/Bytes.js"
import { decodeBytes, DecodeResult, encodeBytes } from "../Cbor.js"
import { Data } from "../Uplc"

export function isValid(pkh: string): pkh is PubKeyHash {
  return /^[0-9a-fA-F]+$/.test(pkh) && pkh.length == 56
}

export const PubKeyHash = Schema.String.pipe(
  Schema.filter((pkh: string) => isValid(pkh) || "Invalid Cardano PubKeyHash"),
  Schema.brand("PubKeyHash")
)

export type PubKeyHash = Schema.Schema.Type<typeof PubKeyHash>

export function make(bytes: Bytes.BytesLike) {
  return Schema.decode(PubKeyHash)(Bytes.toHex(bytes))
}

export const FromUplcData = Schema.transform(Data.ByteArray, PubKeyHash, {
  strict: true,
  decode: Encoding.encodeHex,
  encode: (s) => Effect.runSync(Encoding.decodeHex(s))
})

export const decode = (bytes: Bytes.BytesLike): DecodeResult<PubKeyHash> =>
  decodeBytes(bytes).pipe(
    Either.map((bytes) => new Uint8Array(bytes)),
    Either.map(Encoding.encodeHex),
    Either.map(Schema.decodeSync(PubKeyHash))
  )

export function encode(pkh: PubKeyHash): number[] {
  return encodeBytes(pkh)
}
