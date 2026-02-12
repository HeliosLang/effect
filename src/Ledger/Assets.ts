import { Effect, Either, Schema } from "effect"
import * as Bytes from "../internal/Bytes.js"
import * as Cbor from "../Cbor.js"
import { Data } from "../Uplc"
import * as AssetClass from "./AssetClass.js"
import * as MintingPolicy from "./MintingPolicy.js"

export const Assets = Schema.Record({
  key: Schema.String, // can sadly not use AssetClass.AssetClass here
  value: Schema.BigIntFromSelf
}).pipe(
  Schema.filter((assets) => {
    for (const key in assets) {
      if (!AssetClass.isValid(key)) {
        return `Invalid AssetClass ${key}`
      }
    }

    return true
  })
)

export type Assets = Schema.Schema.Type<typeof Assets>

export const FromUplcData = Schema.transform(
  Data.PairArray(
    MintingPolicy.FromUplcData,
    Data.PairArray(Data.Hex, Data.BigInt)
  ),
  Assets,
  {
    strict: true,
    decode: (outer) => {
      const assets: Record<string, bigint> = {}

      for (const [policy, inner] of outer) {
        for (const [tokenName, quantity] of inner) {
          assets[AssetClass.make(policy, tokenName)] = quantity
        }
      }

      return assets as Assets
    },
    encode: (assets) => {
      const outer = nestedRecords(assets)

      return Object.entries(outer).map(
        ([policy, inner]) =>
          [
            Effect.runSync(MintingPolicy.make(policy)),
            Object.entries(inner)
          ] as const
      )
    }
  }
)

function nestedRecords(assets: Assets): Record<string, Record<string, bigint>> {
  const outer: Record<string, Record<string, bigint>> = {}

  Object.entries(assets).forEach(([assetClass, quantity]) => {
    if (assetClass.length == 0) {
      outer[assetClass] = { "": quantity }
    } else {
      const policy = assetClass.slice(0, 56)
      const tokenName = assetClass.slice(56)

      if (policy in outer) {
        outer[policy] = {
          ...outer[policy],
          [tokenName]: quantity
        }
      } else {
        outer[policy] = {
          [tokenName]: quantity
        }
      }
    }
  })

  return outer
}

export const decode = (bytes: Bytes.BytesLike): Cbor.DecodeResult<Assets> =>
  Either.gen(function* () {
    const stream = Bytes.makeStream(bytes)

    if (Cbor.isTuple(bytes)) {
      const [lovelace, otherAssets] = yield* Cbor.decodeTuple([
        Cbor.decodeInt,
        Cbor.decodeMap(
          MintingPolicy.decode,
          Cbor.decodeMap(Cbor.decodeBytes, Cbor.decodeInt)
        )
      ])(stream)

      const assets: Record<string, bigint> = {}

      if (lovelace != 0n) {
        assets[AssetClass.ADA] = lovelace
      }

      for (const [policy, inner] of otherAssets) {
        if (policy._tag == "None") {
          return yield* Either.left(
            new Cbor.DecodeError(
              stream,
              "unexpected ADA assetclass in encoded non-ADA assets"
            )
          )
        }

        for (const [tokenName, quantity] of inner) {
          const assetClass = AssetClass.make(policy, tokenName)

          assets[assetClass] = quantity
        }
      }

      return assets as Assets
    } else {
      return { [AssetClass.ADA]: yield* Cbor.decodeInt(stream) }
    }
  })

export function encode(assets: Assets): number[] {
  const acs = nonAdaAssetClasses(assets)

  if (acs.length == 0) {
    return Cbor.encodeInt(lovelace(assets))
  } else {
    const obj = nestedRecords(assets)
    if (AssetClass.ADA in obj) {
      delete obj[AssetClass.ADA]
    }

    return Cbor.encodeTuple([
      Cbor.encodeInt(lovelace(assets)),
      Cbor.encodeMap(
        Object.entries(obj).map(([mph, tokens]) => {
          return [
            Cbor.encodeBytes(mph),
            Cbor.encodeMap(
              Object.entries(tokens).map(([tokenName, qty]) => [
                Cbor.encodeBytes(tokenName),
                Cbor.encodeInt(qty)
              ])
            )
          ]
        })
      )
    ])
  }
}

export function allAssetClasses(assets: Assets): AssetClass.AssetClass[] {
  return Object.keys(assets) as AssetClass.AssetClass[]
}

export function nonAdaAssetClasses(assets: Assets): AssetClass.AssetClass[] {
  return allAssetClasses(assets).filter((ac) => ac != AssetClass.ADA)
}

export function lovelace(assets: Assets): bigint {
  return assets[AssetClass.ADA] ?? 0n
}
