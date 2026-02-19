import { Either, Encoding, Schema } from "effect"
import * as Bytes from "../../Codecs/Bytes.js"
import * as Cbor from "../../Codecs/Cbor.js"
import { Data } from "../Uplc/index.js"

export function isValid(hash: string): hash is TxHash {
  return hash.length == 64 && /^[0-9a-fA-F]+$/.test(hash)
}

export const TxHash = Schema.String.pipe(
  Schema.filter((id: string) => isValid(id) || "Invalid Cardano TxHash"),
  Schema.brand("TxHash")
)

export type TxHash = Schema.Schema.Type<typeof TxHash>

export const FromUplcData = Schema.transform(
  Data.EnumVariant(0, {
    bytes: Data.ByteArray
  }),
  TxHash,
  {
    strict: true,
    decode: ({ bytes }) => Encoding.encodeHex(bytes),
    encode: (hex) => ({ bytes: Bytes.toUint8Array(hex) })
  }
)

export const FromUplcDataV3 = Schema.transform(Data.Hex, TxHash, {
  strict: true,
  decode: (hex) => hex,
  encode: (hex) => hex
})

export function make(txId: Bytes.BytesLike) {
  return Schema.decodeEither(TxHash)(Bytes.toHex(txId))
}

export const decode = (bytes: Bytes.BytesLike): Cbor.DecodeResult<TxHash> =>
  Cbor.decodeBytes(bytes).pipe(
    Either.flatMap(make),
    Either.mapLeft((e) => {
      if (e._tag == "ParseError") {
        return new Cbor.DecodeError(Bytes.makeStream(bytes), e.message)
      } else {
        return e
      }
    })
  )

export function encode(txId: TxHash): number[] {
  return Cbor.encodeBytes(txId)
}

export function compare(a: TxHash, b: TxHash): number {
  return Bytes.compare(a, b)
}
