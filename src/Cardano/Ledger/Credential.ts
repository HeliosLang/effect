import { Either, Encoding, Schema } from "effect"
import * as Bytes from "../../Codecs/Bytes.js"
import * as Cbor from "../../Codecs/Cbor.js"
import { Data } from "../Uplc"
import * as PubKeyHash from "./PubKeyHash.js"
import * as ValidatorHash from "./ValidatorHash.js"

export const Credential = Schema.Union(
  Schema.TaggedStruct("PubKey", { hash: PubKeyHash.PubKeyHash }),
  Schema.TaggedStruct("Validator", { hash: ValidatorHash.ValidatorHash })
)

export type Credential = Schema.Schema.Type<typeof Credential>

export function makePubKey(pkh: PubKeyHash.PubKeyHash): Credential {
  return { _tag: "PubKey", hash: pkh }
}

export function makeValidator(vh: ValidatorHash.ValidatorHash): Credential {
  return { _tag: "Validator", hash: vh }
}

export const FromUplcData = Schema.transform(
  Data.Enum({ PubKey: { hash: Data.Hex }, Validator: { hash: Data.Hex } }),
  Credential,
  {
    strict: true,
    decode: (cred) => cred,
    encode: (cred) => cred
  }
)

export function bytes(cred: Credential): Uint8Array {
  return Either.getOrThrow(Encoding.decodeHex(cred.hash))
}

export const decode = (bytes: Bytes.BytesLike): Cbor.DecodeResult<Credential> =>
  Either.gen(function* () {
    const [tag, decodeItem] = yield* Cbor.decodeTagged(bytes)

    switch (tag) {
      case 0:
        return {
          _tag: "PubKey",
          hash: yield* decodeItem(PubKeyHash.decode)
        }
      case 1:
        return {
          _tag: "Validator",
          hash: yield* decodeItem(ValidatorHash.decode)
        }
      default:
        return yield* Either.left(
          new Cbor.DecodeError(
            Bytes.makeStream(bytes),
            `unexpected credential tag '${tag}'`
          )
        )
    }
  })

export function encode(cred: Credential): number[] {
  switch (cred._tag) {
    case "PubKey":
      return Cbor.encodeTuple([Cbor.encodeInt(0), PubKeyHash.encode(cred.hash)])
    case "Validator":
      return Cbor.encodeTuple([
        Cbor.encodeInt(1),
        ValidatorHash.encode(cred.hash)
      ])
  }
}

export function equals(a: Credential, b: Credential): boolean {
  return a._tag == b._tag && a.hash == b.hash
}
