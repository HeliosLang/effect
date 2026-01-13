import { Effect, Encoding, Schema } from "effect"
import * as Bytes from "../internal/Bytes.js"
import * as Cbor from "../Cbor.js"
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

export function make(txId: Bytes.BytesLike) {
  return Schema.decode(TxHash)(Bytes.toHex(txId))
}

export const decode = (bytes: Bytes.BytesLike): Cbor.DecodeEffect<TxHash> =>
  Cbor.decodeBytes(bytes).pipe(
    Effect.flatMap(make),
    Effect.catchTag(
      "ParseError",
      (e) => new Cbor.DecodeError(Bytes.makeStream(bytes), e.message)
    )
  )

export function encode(txId: TxHash): number[] {
  return Cbor.encodeBytes(txId)
}
