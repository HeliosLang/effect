import { Either, Encoding, Schema } from "effect"
import * as Bytes from "../../Codecs/Bytes.js"
import * as Cbor from "../../Codecs/Cbor.js"
import * as Data from "../Uplc/Data.js"
import * as ValidatorHash from "./ValidatorHash.js"

export function isValid(mph: string): mph is MintingPolicy {
  const n = mph.length

  if (n == 0) {
    return true
  } else {
    return /^[0-9a-fA-F]+$/.test(mph) && n == 56
  }
}

export const MintingPolicy = Schema.String.pipe(
  Schema.filter(
    (mph: string) => isValid(mph) || "Invalid Cardano MintingPolicy"
  ),
  Schema.brand("MintingPolicy")
)

export type MintingPolicy = Schema.Schema.Type<typeof MintingPolicy>

export const FromUplcData = Schema.transform(Data.ByteArray, MintingPolicy, {
  strict: true,
  decode: Encoding.encodeHex,
  encode: Bytes.toUint8Array
})

export function make(policy: Bytes.BytesLike) {
  return Schema.decodeEither(MintingPolicy)(Bytes.toHex(policy))
}

export const decode = (
  bytes: Bytes.BytesLike
): Cbor.DecodeResult<MintingPolicy> =>
  Cbor.decodeBytes(bytes).pipe(
    Either.flatMap(make),
    Either.mapLeft((e) => {
      if (e._tag == "ParseError") {
        return new Cbor.DecodeError(Bytes.makeStream(bytes), e.message)
      } else {
        return e
      }
    })
  )

export function encode(policy: MintingPolicy): number[] {
  return Cbor.encodeBytes(policy)
}

export function hash(policy: MintingPolicy): ValidatorHash.ValidatorHash {
  if (policy == "") {
    throw new Error("can't convert Ada policy to hash")
  }

  return policy as string as ValidatorHash.ValidatorHash
}
