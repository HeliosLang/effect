import { Effect, Either, Encoding, Schema } from "effect"
import * as Bytes from "../../Codecs/Bytes.js"
import {
  decodeBytes,
  DecodeError,
  DecodeResult,
  encodeBytes
} from "../../Codecs/Cbor.js"
import * as Bip32 from "../../Crypto/Bip32.js"
import * as Blake2b from "../../Crypto/Blake2b.js"
import { Data } from "../Uplc"
import type { PubKeyHash } from "./PubKeyHash.js"

export const isValid = Bip32.isValidVerificationKey

export const PubKey = Bip32.VerificationKey
export type PubKey = Bip32.VerificationKey

export const make = Bip32.makeVerificationKey

export const FromUplcData = Schema.transformOrFail(
  Data.ByteArray,
  Schema.typeSchema(PubKey),
  {
    strict: true,
    decode: make,
    encode: (vk: PubKey) => Effect.succeed(Bip32.vkBytes(vk))
  }
)

export const decode = (bytes: Bytes.BytesLike): DecodeResult<PubKey> =>
  decodeBytes(bytes).pipe(
    Either.flatMap(make),
    Either.mapLeft(
      (e) =>
        new DecodeError(Bytes.makeStream(bytes), e.message ?? "Invalid Pub Key")
    )
  )

export const bytes = Bip32.vkBytes

export function encode(pkh: PubKey): number[] {
  return encodeBytes(Bip32.vkBytes(pkh))
}

export const dummy: PubKey = Bip32.makeVerificationKeyUnsafe(
  new Uint8Array(new Array(32).fill(0))
) as PubKey

export function hash(pk: PubKey): PubKeyHash {
  return Encoding.encodeHex(Blake2b.hashSync(bytes(pk), 28)) as PubKeyHash
}
