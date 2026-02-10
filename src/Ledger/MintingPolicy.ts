import { Effect, Either, Encoding, Option, Schema } from "effect"
import * as Bytes from "../internal/Bytes.js"
import * as Cbor from "../Cbor.js"
import { Data } from "../Uplc"
import * as ValidatorHash from "./ValidatorHash.js"

// None is used for ADA
export const MintingPolicy = Schema.Option(ValidatorHash.ValidatorHash)

export type MintingPolicy = Schema.Schema.Type<typeof MintingPolicy>

export const FromUplcData = Schema.transform(Data.ByteArray, MintingPolicy, {
  strict: true,
  decode: (bs) => {
    if (bs.length == 0) {
      return Option.none()
    } else {
      return Option.some(Encoding.encodeHex(bs))
    }
  },
  encode: (opt) => {
    if (opt._tag == "None") {
      return new Uint8Array()
    } else {
      return Effect.runSync(Encoding.decodeHex(opt.value))
    }
  }
})

export function make(policy: Bytes.BytesLike) {
  const p = Bytes.toHex(policy)

  if (p.length == 0) {
    return Either.right(Option.none())
  } else {
    return ValidatorHash.make(p).pipe(Either.map(Option.some))
  }
}

export const decode = (
  bytes: Bytes.BytesLike
): Cbor.DecodeResult<MintingPolicy> =>
  Cbor.decodeBytes(bytes).pipe(
    Either.flatMap(make),
    Either.mapLeft(
      (e) => {
        if (e._tag == "ParseError") {
          return new Cbor.DecodeError(Bytes.makeStream(bytes), e.message)
        } else {
          return e
        }
      }
    )
  )

export function encode(policy: MintingPolicy): number[] {
  if (policy._tag == "None") {
    return Cbor.encodeBytes([])
  } else {
    return Cbor.encodeBytes(policy.value)
  }
}
