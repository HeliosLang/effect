import { Either, Encoding, Schema } from "effect"
import * as Bytes from "../../Codecs/Bytes.js"
import {
  decodeBytes,
  type DecodeResult,
  encodeBytes
} from "../../Codecs/Cbor.js"
import * as Crypto from "../../Crypto/index.js"
import * as Data from "../Uplc/Data.js"

export function isValid(dh: string): boolean {
  return /^[0-9a-fA-F]+$/.test(dh) && dh.length == 64
}

export const DatumHash = Schema.String.pipe(
  Schema.filter((dh: string) => isValid(dh) || "Invalid Cardano DatumHash"),
  Schema.brand("DatumHash")
)

export type DatumHash = Schema.Schema.Type<typeof DatumHash>

export function make(bytes: Bytes.BytesLike) {
  return Schema.decodeEither(DatumHash)(Bytes.toHex(bytes))
}

export const FromUplcData = Schema.transform(Data.ByteArray, DatumHash, {
  strict: true,
  decode: Encoding.encodeHex,
  encode: Bytes.toUint8Array
})

export const decode = (bytes: Bytes.BytesLike): DecodeResult<DatumHash> =>
  decodeBytes(bytes).pipe(
    Either.map((bytes) => new Uint8Array(bytes)),
    Either.map(Encoding.encodeHex),
    Either.map(Schema.decodeSync(DatumHash))
  )

export function encode(dh: DatumHash): number[] {
  return encodeBytes(dh)
}

export function hash(d: Data.Data): DatumHash {
  return Encoding.encodeHex(
    Crypto.Blake2b.hashSync(Data.encode(d))
  ) as DatumHash
}
