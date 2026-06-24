import { Effect, Either, Schema } from "effect"
import { TaggedError } from "effect/Data" // imported like this to avoid name conflict with Data from Uplc
import * as Bytes from "../../Codecs/Bytes.js"
import * as Cbor from "../../Codecs/Cbor.js"
import * as Data from "../Uplc/Data.js"
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

export const FromUplcData = (sortTokens: boolean = false) =>
  Schema.transform(
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

        return assets
      },
      encode: (assets) => {
        const outer = nestedRecords(assets)

        return Object.entries(outer).map(([policy, inner]) => {
          const tokenQtys = Object.entries(inner)

          if (sortTokens) {
            tokenQtys.sort(([a], [b]) => Bytes.compare(a, b, false))
          }

          return [
            Effect.runSync(MintingPolicy.make(policy)),
            tokenQtys
          ] as const
        })
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
        if (policy == "") {
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

      return assets
    } else if (Cbor.isMap(bytes)) {
      const otherAssets = yield* Cbor.decodeMap(
        MintingPolicy.decode,
        Cbor.decodeMap(Cbor.decodeBytes, Cbor.decodeInt)
      )(stream)

      const assets: Record<string, bigint> = {}

      for (const [policy, inner] of otherAssets) {
        if (policy == "") {
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

      return assets
    } else {
      return { [AssetClass.ADA]: yield* Cbor.decodeInt(stream) }
    }
  })

export const encode =
  ({ withoutLovelace = false }: { withoutLovelace?: boolean }) =>
  (assets: Assets): number[] => {
    const acs = nonAdaAssetClasses(assets)

    if (acs.length == 0) {
      return Cbor.encodeInt(lovelace(assets))
    } else if (withoutLovelace) {
      const obj = nestedRecords(assets)
      if (AssetClass.ADA in obj) {
        delete obj[AssetClass.ADA]
      }

      return Cbor.encodeMap(
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

export function policies(assets: Assets): MintingPolicy.MintingPolicy[] {
  return Array.from(new Set(allAssetClasses(assets).map(AssetClass.policy)))
}

export function nonAdaPolicies(assets: Assets): MintingPolicy.MintingPolicy[] {
  return Array.from(new Set(nonAdaAssetClasses(assets).map(AssetClass.policy)))
}

export function lovelace(assets: Assets): bigint {
  return assets[AssetClass.ADA] ?? 0n
}

export const filterByPolicy =
  (policy: MintingPolicy.MintingPolicy) =>
  (assets: Assets): Assets => {
    return Object.fromEntries(
      Object.entries(assets).filter(
        ([ac]) =>
          (policy == "" && ac == "") || (policy != "" && ac.startsWith(policy))
      )
    )
  }

export const filterPositive = (assets: Assets): Assets => {
  return Object.fromEntries(Object.entries(assets).filter(([, qty]) => qty > 0))
}

export const filterNegative = (assets: Assets): Assets => {
  return Object.fromEntries(Object.entries(assets).filter(([, qty]) => qty < 0))
}

/**
 * Prunes zeroes
 * @param xs
 * @returns
 */
export function sum(...xs: Assets[]): Assets {
  return xs.reduce(
    (prev, x) => {
      const result = { ...prev }

      Object.entries(x).forEach(([ac, qty]) => {
        if (ac in result) {
          const newQty = result[ac] + qty

          if (newQty != 0n) {
            result[ac] = newQty
          } else {
            delete result[ac]
          }
        } else if (qty != 0n) {
          result[ac] = qty
        }
      })

      return result
    },
    {} as Record<string, bigint>
  )
}

export function add(a: Assets, b: Assets): Assets {
  return sum(a, b)
}

/**
 * Prunes zeroes
 * @param a
 * @param b
 * @returns
 */
export function subtract(a: Assets, b: Assets): Assets {
  const result: Record<string, bigint> = { ...a }

  Object.entries(b).forEach(([ac, qty]) => {
    if (ac in result) {
      const newQty = result[ac] - qty

      if (newQty != 0n) {
        result[ac] = newQty
      } else {
        delete result[ac]
      }
    } else if (qty != 0n) {
      result[ac] = -qty
    }
  })

  return result
}

/**
 * Prunes zeroes
 * @param x
 * @returns
 */
export function negate(x: Assets): Assets {
  const result: Record<string, bigint> = {}

  Object.entries(x).forEach(([ac, qty]) => {
    if (qty != 0n) {
      result[ac] = -qty
    }
  })

  return result
}

export function isEmpty(assets: Assets): boolean {
  return Object.keys(assets).length == 0
}

export function containsOnlyAda(assets: Assets): boolean {
  for (const key in assets) {
    if (key != "") {
      return false
    }
  }

  return true
}

export function allPositive(assets: Assets): boolean {
  return Object.values(assets).every((qty) => qty > 0n)
}

export class SomeNonPositive extends TaggedError(
  "Cardano.Ledger.Assets.SomeNonPositive"
)<{ message: string }> {
  constructor() {
    super({ message: `Some assets have quantities <= 0` })
  }
}

export function assertAllPositive(assets: Assets) {
  if (!allPositive(assets)) {
    return Effect.fail(new SomeNonPositive())
  } else {
    return Effect.void
  }
}

/**
 * Ignores ADA
 * @param assets
 * @returns
 */
export function countTokens(assets: Assets): number {
  return Object.keys(assets).filter((name) => name != "").length
}

export function pretty(assets: Assets): string {
  let s = "{"

  for (const key in assets) {
    s += key + ":" + assets[key].toString() + ","
  }

  s += "}"

  return s
}

export const isSorted = (
  assets: Assets,
  { shortestFirst = true }: { shortestFirst?: boolean } = {}
): boolean => {
  const keys = Object.keys(assets)

  for (let i = 1; i < keys.length; i++) {
    const key0 = keys[i - 1] as AssetClass.AssetClass
    const key1 = keys[i] as AssetClass.AssetClass

    const policy0 = AssetClass.policy(key0)
    const policy1 = AssetClass.policy(key1)

    if (MintingPolicy.compare(policy0, policy1) > 0) {
      // policies not sorted
      return false
    }

    if (policy0 == policy1) {
      const tokenName0 = AssetClass.tokenName(key0)
      const tokenName1 = AssetClass.tokenName(key1)

      if (Bytes.compare(tokenName0, tokenName1, shortestFirst) >= 0) {
        // tokens not sorted
        return false
      }
    }
  }

  return true
}

/**
 * Makes sure minting policies are in correct order, and for each minting policy make sure the tokens are in the correct order
 * `shortestFirst` defaults to true (canonical sort)
 */
export const sort =
  ({ shortestFirst = true }: { shortestFirst?: boolean } = {}) =>
  (assets: Assets): Assets => {
    const keys = Object.keys(assets)

    keys.sort((a, b) => {
      const c = MintingPolicy.compare(
        AssetClass.policy(a),
        AssetClass.policy(b)
      )

      if (c != 0) {
        return c
      }

      return Bytes.compare(
        AssetClass.tokenName(a),
        AssetClass.tokenName(b),
        shortestFirst
      )
    })

    return Object.fromEntries(keys.map((key) => [key, assets[key]]))
  }
