import { Effect, Either, Option, Schema } from "effect"
import * as Bytes from "../../Codecs/Bytes.js"
import * as Cbor from "../../Codecs/Cbor.js"
import * as Params from "../Network/Params.js"
import * as Uplc from "../Uplc/index.js"
import * as Address from "./Address.js"
import * as Assets from "./Assets.js"
import * as DatumHash from "./DatumHash.js"
import * as TxOutputDatum from "./TxOutputDatum.js"
import * as ValidatorHash from "./ValidatorHash.js"

export const TxOutputEncodingConfig = Schema.Struct({
  strictBabbage: Schema.optional(Schema.Boolean)
})

export type TxOutputEncodingConfig = Schema.Schema.Type<
  typeof TxOutputEncodingConfig
>

export const DEFAULT_TX_OUTPUT_ENCODING_CONFIG: TxOutputEncodingConfig = {
  strictBabbage: true
}

export const TxOutput = Schema.Struct({
  address: Address.Address,
  assets: Assets.Assets,
  datum: Schema.optional(TxOutputDatum.TxOutputDatum),
  refScript: Schema.optional(
    Schema.Union(Uplc.Script.ScriptV2, Uplc.Script.ScriptV3)
  ),
  encodingConfig: Schema.optional(
    Schema.Struct({
      strictBabbage: Schema.optional(Schema.Boolean)
    })
  )
})

export type TxOutput = Schema.Schema.Type<typeof TxOutput>

export const FromUplcData = Schema.transform(
  Uplc.Data.EnumVariant(0, {
    address: Address.FromUplcData,
    assets: Assets.FromUplcData(true),
    datum: TxOutputDatum.FromUplcData,
    refScript: Uplc.Data.Option(ValidatorHash.FromUplcData)
  }),
  Schema.typeSchema(TxOutput),
  {
    strict: true,
    decode: ({ address, assets, datum }): TxOutput => ({
      address,
      assets,
      datum,
      refScript: undefined
    }),
    encode: ({ address, assets, datum, refScript }: TxOutput) => ({
      address,
      assets,
      datum,
      refScript: refScript
        ? Option.some(Uplc.Script.hash(refScript))
        : Option.none()
    })
  }
)

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
  refScript?: Uplc.Script.Script<2> | Uplc.Script.Script<3>
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
        3: refScriptBytes
      } = yield* Cbor.decodeObjectIKey({
        0: Address.decode,
        1: Assets.decode,
        2: TxOutputDatum.decode,
        3: (stream): Cbor.DecodeResult<number[]> =>
          Either.gen(function* () {
            if ((yield* Cbor.decodeTag(stream)) != 24n) {
              return yield* Either.left(
                new Cbor.DecodeError(stream, "unexpected reference script tag")
              )
            }

            return yield* Cbor.decodeBytes(stream)
          })
      })(stream)

      if (!address) {
        return yield* Either.left(
          new Cbor.DecodeError(stream, "address field missing")
        )
      }

      if (!assets) {
        return yield* Either.left(
          new Cbor.DecodeError(stream, "assets field missing")
        )
      }

      let refScript: Uplc.Script.Script<2> | Uplc.Script.Script<3> | undefined =
        undefined

      if (refScriptBytes) {
        const [scriptType, decodeScript] =
          yield* Cbor.decodeTagged(refScriptBytes)

        switch (scriptType) {
          case 0:
            return yield* Either.left(
              new Cbor.DecodeError(stream, "unexpected Native ref script")
            )
          case 1:
            return yield* Either.left(
              new Cbor.DecodeError(
                stream,
                "unexpected Uplc ScriptV1 ref script"
              )
            )
          case 2:
            // apparently tag 2 can also be used for V3 scripts
            refScript = yield* decodeScript((stream) =>
              Either.gen(function* () {
                const { uplcVersion, root } =
                  yield* Uplc.Script.decodeRoot(stream)

                if (uplcVersion == "1.1.0") {
                  return { version: 3, root } satisfies Uplc.Script.Script<3>
                } else {
                  return { version: 2, root } satisfies Uplc.Script.Script<2>
                }
              })
            )
            break
          case 3:
            refScript = yield* decodeScript(Uplc.Script.decode(3))
            break
          default:
            return yield* Either.left(
              new Cbor.DecodeError(
                stream,
                `unexpected script type ${scriptType}`
              )
            )
        }
      }

      return make({
        address,
        assets,
        ...(datum ? { datum } : {}),
        ...(refScript ? { refScript } : {}),
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
      return yield* Either.left(
        new Cbor.DecodeError(stream, "unexpected TxOutput encoding")
      )
    }
  })

export function encode(output: TxOutput): number[] {
  if (
    (!output.datum || "hash" in output.datum) &&
    !output.refScript &&
    (!output.encodingConfig ||
      output.encodingConfig.strictBabbage == null ||
      !output.encodingConfig.strictBabbage)
  ) {
    // this is needed to match eternl wallet (de)serialization (annoyingly eternl deserializes the tx and then signs its own serialization)
    // hopefully cardano-cli signs whatever serialization we choose (so we use the eternl variant in order to be compatible with both)

    const fields = [
      Address.encode(output.address),
      Assets.encode(output.assets)
    ]

    if (output.datum && "hash" in output.datum) {
      fields.push(DatumHash.encode(output.datum.hash))
    }

    return Cbor.encodeTuple(fields)
  } else {
    const object: Map<number, number[]> = new Map()

    object.set(0, Address.encode(output.address))
    object.set(1, Assets.encode(output.assets))

    if (output.datum) {
      object.set(2, TxOutputDatum.encode(output.datum))
    }

    if (output.refScript) {
      object.set(
        3,
        Cbor.encodeTag(24n).concat(
          Cbor.encodeBytes(
            Cbor.encodeTuple([
              Cbor.encodeInt(BigInt(output.refScript.version)),
              Uplc.Script.encode(output.refScript)
            ])
          )
        )
      )
    }

    return Cbor.encodeObjectIKey(object)
  }
}

export const minLovelace = (output: TxOutput) =>
  Params.params.pipe(
    Effect.map((p) => {
      const lovelacePerByte = p.utxoDepositPerByte

      if (p.utxoDepositPerByte === undefined) {
        throw new Error(
          `Network.Params.params.utxoDepositPerByte undefined in Cardano.Ledger.TxOutput.minLovelace()`
        )
      }

      // 160 accounts for some database overhead?
      const correctedSize = encode(output).length + 160

      if (!Number.isFinite) {
        throw new Error(
          "correctedSize isn't finite in Cardano.Ledger.TxOutput.minLovelace()"
        )
      }

      return BigInt(correctedSize) * BigInt(lovelacePerByte)
    })
  )

export const sumAssets = (...outputs: TxOutput[]) =>
  Assets.sum(...outputs.map((output) => output.assets))
