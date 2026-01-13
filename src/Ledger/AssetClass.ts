import { Encoding, Option, Schema } from "effect"
import * as Bytes from "../internal/Bytes.js"
import { Data } from "../Uplc"
import * as MintingPolicy from "./MintingPolicy.js"
import * as ValidatorHash from "./ValidatorHash.js"

export function isValid(assetClass: string): assetClass is AssetClass {
  const n = assetClass.length
  return (
    /^[0-9a-fA-F]+$/.test(assetClass) &&
    n < 120 &&
    (n == 0 || (n >= 56 && n % 2 == 0))
  )
}

export const AssetClass = Schema.transform(
  Schema.String,
  Schema.String.pipe(
    Schema.filter((ac: string) => isValid(ac) || "Invalid Cardano AssetClass"),
    Schema.brand("AssetClass")
  ),
  {
    strict: false,
    decode: (s) => s.split(".").join(""),
    encode: (s) => s
  }
)

export type AssetClass = Schema.Schema.Type<typeof AssetClass>

export const ADA = "" as AssetClass

export function make(
  policy: MintingPolicy.MintingPolicy,
  tokenName: Bytes.BytesLike
) {
  if (policy._tag == "None") {
    return ADA
  } else {
    return (policy.value + Encoding.encodeHex(Bytes.toUint8Array(tokenName))) as AssetClass
  }
}

export const FromUplcData = Schema.transform(
  Data.EnumVariant(0, {
    policy: MintingPolicy.FromUplcData,
    tokenName: Data.ByteArray
  }),
  AssetClass,
  {
    strict: true,
    decode: ({ policy, tokenName }) => {
      if (policy._tag == "None") {
        return ADA
      } else {
        return policy.value + Encoding.encodeHex(tokenName)
      }
    },
    encode: (assetClass) => {
      return {
        policy: policy(assetClass),
        tokenName: Bytes.toUint8Array(tokenName(assetClass))
      }
    }
  }
)

export function pretty(assetClass: string): string {
  if (assetClass.length == 0) {
    return "."
  } else {
    return assetClass.slice(0, 56) + "." + assetClass.slice(56)
  }
}

export function policy(assetClass: string): MintingPolicy.MintingPolicy {
  if (assetClass.length == 0) {
    return Option.none()
  } else {
    return Option.some(assetClass.slice(0, 56) as ValidatorHash.ValidatorHash)
  }
}

export function tokenName(assetClass: string): string {
  if (assetClass.length == 0) {
    return ""
  } else {
    return assetClass.slice(56)
  }
}
