import { Encoding, Schema } from "effect"
import * as Bytes from "../../Codecs/Bytes.js"
import * as Data from "../Uplc/Data.js"
import * as MintingPolicy from "./MintingPolicy.js"

export function isValid(assetClass: string): assetClass is AssetClass {
  const n = assetClass.length

  if (n == 0) {
    return true
  } else {
    return (
      /^[0-9a-fA-F]+$/.test(assetClass) && n <= 120 && n >= 56 && n % 2 == 0
    )
  }
}

export const AssetClass = Schema.transform(
  Schema.String,
  Schema.String.pipe(
    Schema.filter((ac: string): true | string => {
      if (isValid(ac)) {
        return true
      }

      const issues: string[] = []

      if (!/^[0-9a-fA-F]+$/.test(ac)) {
        issues.push("must contain only hexadecimal characters")
      }

      if (ac.length > 0 && ac.length < 56) {
        issues.push(
          `is too short to contain a full 28-byte policy id (${ac.length} hex chars)`
        )
      }

      if (ac.length > 120) {
        issues.push(`is too long (${ac.length} hex chars); expected <= 120`)
      }

      if (ac.length % 2 !== 0) {
        issues.push(`must contain an even number of hex chars (${ac.length})`)
      }

      if (issues.length === 0) {
        issues.push("failed Ledger.AssetClass validation")
      }

      return `Invalid Cardano AssetClass '${JSON.stringify(ac)}': ${issues.join("; ")}`
    }),
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
  if (policy == "") {
    if (Bytes.toArray(tokenName).length != 0) {
      throw new Error(
        "Unexpected tokenName for ADA policy in AssetClass.make()"
      )
    }

    return ADA
  } else {
    return (policy +
      Encoding.encodeHex(Bytes.toUint8Array(tokenName))) as AssetClass
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
      if (policy == "") {
        if (tokenName.length != 0) {
          throw new Error(
            "Unexpected tokenName for ADA policy in AssetClass.FromUplcData.decode()"
          )
        }

        return ADA
      } else {
        return policy + Encoding.encodeHex(tokenName)
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
    return ""
  } else {
    const policy = assetClass.slice(0, 56)

    if (!MintingPolicy.isValid(policy)) {
      throw new Error("invalid policy in asset class")
    }

    return policy
  }
}

/**
 * @param assetClass
 * @returns
 * The hex-encoded token name
 */
export function tokenName(assetClass: string): string {
  if (assetClass.length == 0) {
    return ""
  } else {
    return assetClass.slice(56)
  }
}
