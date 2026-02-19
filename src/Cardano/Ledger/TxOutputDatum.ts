import { Either, Schema } from "effect"
import * as Bytes from "../../Codecs/Bytes.js"
import * as Cbor from "../../Codecs/Cbor.js"
import * as Data from "../Uplc/Data.js"
import * as DatumHash from "./DatumHash.js"

export const TxOutputDatum = Schema.Union(
  Schema.TaggedStruct("Inline", { data: Data.Data }),
  Schema.TaggedStruct("Hash", { hash: DatumHash.DatumHash })
)

export type TxOutputDatum = Schema.Schema.Type<typeof TxOutputDatum>

export const FromUplcData = Schema.transform(
  Data.Enum({
    None: {},
    Hash: {
      hash: DatumHash.FromUplcData
    },
    Inline: {
      data: Schema.typeSchema(Data.Data)
    }
  }),
  Schema.Union(TxOutputDatum, Schema.Undefined),
  {
    strict: true,
    decode: (data) => {
      if (data._tag == "None") {
        return undefined
      } else {
        return data
      }
    },
    encode: (datum) => {
      if (datum === undefined) {
        return { _tag: "None" as const }
      } else if (datum._tag == "Inline") {
        return {
          _tag: "Inline" as const,
          data: datum.data
        }
      } else {
        return {
          _tag: "Hash" as const,
          hash: datum.hash as DatumHash.DatumHash
        }
      }
    }
  }
)

export const decode = (
  bytes: Bytes.BytesLike
): Cbor.DecodeResult<TxOutputDatum> =>
  Either.gen(function* () {
    const [type, decodeItem] = yield* Cbor.decodeTagged(bytes)

    switch (type) {
      case 0:
        return { _tag: "Hash", hash: yield* decodeItem(DatumHash.decode) }
      case 1:
        return {
          _tag: "Inline",
          data: yield* decodeItem((stream: Bytes.Stream) =>
            Either.gen(function* () {
              const tag = yield* Cbor.decodeTag(stream)
              if (tag != 24n) {
                return yield* Either.left(
                  new Cbor.DecodeError(stream, `expected 24 as tag, got ${tag}`)
                )
              }

              return yield* Data.decode(yield* Cbor.decodeBytes(stream))
            })
          )
        }
      default:
        return yield* Either.left(
          new Cbor.DecodeError(
            Bytes.makeStream(bytes),
            `unhandled TxOutputDatum type ${type}`
          )
        )
    }
  })

export function encode(txOutputDatum: TxOutputDatum): number[] {
  switch (txOutputDatum._tag) {
    case "Hash":
      return Cbor.encodeTuple([
        Cbor.encodeInt(0n),
        DatumHash.encode(txOutputDatum.hash)
      ])
    case "Inline":
      return Cbor.encodeTuple([
        Cbor.encodeInt(1n),
        Cbor.encodeTag(24n).concat(
          Cbor.encodeBytes(Data.encode(txOutputDatum.data))
        )
      ])
  }
}
