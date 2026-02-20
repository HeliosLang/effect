import { Either, Schema } from "effect"
import * as Bytes from "../../Codecs/Bytes.js"
import * as Cbor from "../../Codecs/Cbor.js"
import * as Data from "../Uplc/Data.js"
import * as DatumHash from "./DatumHash.js"

/**
 * Keep things simple by not requiring a tag here
 */
export const TxOutputDatum = Schema.Union(
  Data.Data,
  Schema.Struct({ hash: DatumHash.DatumHash })
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
  Schema.typeSchema(Schema.Union(TxOutputDatum, Schema.Undefined)),
  {
    strict: true,
    decode: (data) => {
      switch (data._tag) {
        case "None":
          return undefined
        case "Inline":
          return data.data
        case "Hash":
          return { hash: data.hash }
      }
    },
    encode: (datum) => {
      if (datum === undefined) {
        return { _tag: "None" as const }
      } else if ("hash" in datum) {
        return {
          _tag: "Hash" as const,
          hash: datum.hash
        }
      } else {
        return {
          _tag: "Inline" as const,
          data: datum
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
        return { hash: yield* decodeItem(DatumHash.decode) }
      case 1:
        return yield* decodeItem((stream: Bytes.Stream) =>
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
  if ("hash" in txOutputDatum) {
    return Cbor.encodeTuple([
      Cbor.encodeInt(0n),
      DatumHash.encode(txOutputDatum.hash)
    ])
  } else {
    return Cbor.encodeTuple([
      Cbor.encodeInt(1n),
      Cbor.encodeTag(24n).concat(Cbor.encodeBytes(Data.encode(txOutputDatum)))
    ])
  }
}
