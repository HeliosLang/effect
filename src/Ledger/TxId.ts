import { Effect, Encoding, Schema } from "effect"
import * as Bytes from "../internal/Bytes.js"
import * as Cbor from "../Cbor.js"
import { Data } from "../Uplc"

export function isValid(txId: string): txId is TxId {
  return txId.length == 64 && /^[0-9a-fA-F]+$/.test(txId)
}

export const TxId = Schema.String.pipe(
  Schema.filter((id: string) => isValid(id) || "Invalid Cardano TxId"),
  Schema.brand("TxId")
)

export type TxId = Schema.Schema.Type<typeof TxId>

export const FromUplcData = Schema.transform(
  Data.EnumVariant(0, {
    bytes: Data.ByteArray
  }),
  TxId,
  {
    strict: true,
    decode: ({ bytes }) => Encoding.encodeHex(bytes),
    encode: (hex) => ({ bytes: Bytes.toUint8Array(hex) })
  }
)

export function make(txId: Bytes.BytesLike) {
  return Schema.decode(TxId)(Bytes.toHex(txId))
}

export const decode = (bytes: Bytes.BytesLike): Cbor.DecodeEffect<TxId> =>
  Cbor.decodeBytes(bytes).pipe(
    Effect.flatMap(make),
    Effect.catchTag(
      "ParseError",
      (e) => new Cbor.DecodeError(Bytes.makeStream(bytes), e.message)
    )
  )

export function encode(txId: TxId): number[] {
  return Cbor.encodeBytes(txId)
}
