import { Either, Schema } from "effect"
import * as Bytes from "../internal/Bytes.js"
import * as Cbor from "../Cbor.js"
import * as Address from "./Address.js"
import * as Assets from "./Assets.js"
import * as DatumHash from "./DatumHash.js"
import * as TxOutputDatum from "./TxOutputDatum.js"

export const TxOutputEncodingConfig = Schema.Struct({
  strictBabbage: Schema.optional(Schema.Boolean)
})

export type TxOutputEncodingConfig = Schema.Schema.Type<
  typeof TxOutputEncodingConfig
>

export const DEFAULT_TX_OUTPUT_ENCODING_CONFIG: TxOutputEncodingConfig = {
  strictBabbage: true
}

// TODO: add ref script
export const TxOutput = Schema.Struct({
  address: Address.Address,
  assets: Assets.Assets,
  datum: Schema.optional(TxOutputDatum.TxOutputDatum),
  refScript: Schema.optional(Schema.Uint8ArrayFromSelf),
  encodingConfig: Schema.optional(
    Schema.Struct({
      strictBabbage: Schema.optional(Schema.Boolean)
    })
  )
})

export type TxOutput = Schema.Schema.Type<typeof TxOutput>

export function make({
  address,
  assets,
  datum = undefined,
  refScript = undefined,
  encodingConfig = DEFAULT_TX_OUTPUT_ENCODING_CONFIG
}: {
  address: Address.Address
  assets: Assets.Assets
  datum?: TxOutputDatum.TxOutputDatum
  refScript?: Uint8Array
  encodingConfig?: TxOutputEncodingConfig
}): TxOutput {
  return {
    address,
    assets,
    datum,
    refScript,
    encodingConfig
  }
}

export const decode = (bytes: Bytes.BytesLike): Cbor.DecodeResult<TxOutput> =>
  Either.gen(function* () {
    const stream = Bytes.makeStream(bytes)
    if (Cbor.isObject(bytes)) {
      const {
        0: address,
        1: assets,
        2: datum,
        3: refScript
      } = yield* Cbor.decodeObjectIKey({
        0: Address.decode,
        1: Assets.decode,
        2: TxOutputDatum.decode,
        3: (stream): Cbor.DecodeResult<number[]> =>
          Either.gen(function* () {
            if ((yield* Cbor.decodeTag(stream)) != 24n) {
              return yield* Either.left(new Cbor.DecodeError(
                stream,
                "unexpected reference script tag"
              ))
            }

            return yield* Cbor.decodeBytes(stream)
          })
      })(stream)

      if (!address) {
        return yield* Either.left(new Cbor.DecodeError(stream, "address field missing"))
      }

      if (!assets) {
        return yield* Either.left(new Cbor.DecodeError(stream, "assets field missing"))
      }

      return make({
        address,
        assets,
        ...(datum ? { datum } : {}),
        ...(refScript ? { refScript: new Uint8Array(refScript) } : {}),
        encodingConfig: { strictBabbage: true }
      })
    } else if (Cbor.isTuple(bytes)) {
      const [address, assets, datumHash] = yield* Cbor.decodeTuple(
        [Address.decode, Assets.decode],
        [DatumHash.decode]
      )(stream)

      return make({
        address,
        assets,
        ...(datumHash ? { _tag: "Hash", hash: datumHash } : {}),
        encodingConfig: {
          strictBabbage: false
        }
      })
    } else {
      return yield* Either.left(new Cbor.DecodeError(stream, "unexpected TxOutput encoding"))
    }
  })

export function encode(txOutput: TxOutput): number[] {
  if (
    (!txOutput.datum || txOutput.datum._tag == "Hash") &&
    !txOutput.refScript &&
    (!txOutput.encodingConfig ||
      txOutput.encodingConfig.strictBabbage == null ||
      !txOutput.encodingConfig.strictBabbage)
  ) {
    // this is needed to match eternl wallet (de)serialization (annoyingly eternl deserializes the tx and then signs its own serialization)
    // hopefully cardano-cli signs whatever serialization we choose (so we use the eternl variant in order to be compatible with both)

    const fields = [
      Address.encode(txOutput.address),
      Assets.encode(txOutput.assets)
    ]

    if (txOutput.datum && txOutput.datum._tag == "Hash") {
      fields.push(DatumHash.encode(txOutput.datum.hash))
    }

    return Cbor.encodeTuple(fields)
  } else {
    const object: Map<number, number[]> = new Map()

    object.set(0, Address.encode(txOutput.address))
    object.set(1, Assets.encode(txOutput.assets))

    if (txOutput.datum) {
      object.set(2, TxOutputDatum.encode(txOutput.datum))
    }

    if (txOutput.refScript) {
      throw new Error("not yet implemented")
      //object.set(
      //    3,
      //    Cbor.encodeTag(24n).concat(
      //        Cbor.encodeBytes(
      //            Cbor.encodeTuple([
      //                Cbor.encodeInt(
      //                    BigInt(this.refScript.plutusVersionTag)
      //                ),
      //                txOutput.refScript
      //            ])
      //        )
      //    )
      //)
    }

    return Cbor.encodeObjectIKey(object)
  }
}
