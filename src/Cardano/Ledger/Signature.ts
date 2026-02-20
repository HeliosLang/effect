import { Either, Schema } from "effect"
import * as Bytes from "../../Codecs/Bytes.js"
import {
  decodeBytes,
  DecodeResult,
  decodeTuple,
  encodeBytes,
  encodeTuple
} from "../../Codecs/Cbor.js"
import * as Bip32 from "../../Crypto/Bip32.js"
import * as PubKey from "./PubKey.js"

export const Signature = Schema.Struct({
  pubKey: PubKey.PubKey,
  bytes: Schema.Uint8ArrayFromHex
})

export type Signature = Schema.Schema.Type<typeof Signature>

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type AssertExtends<A, _B extends A> = never

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _LedgerSignatureExtendsBip32Signature = AssertExtends<
  Bip32.Signature,
  Signature
>

export const decode = (bytes: Bytes.BytesLike): DecodeResult<Signature> =>
  decodeTuple([PubKey.decode, decodeBytes])(bytes).pipe(
    Either.map(([pubKey, bytes]) => ({
      pubKey,
      bytes: new Uint8Array(bytes)
    }))
  )

export function encode(s: Signature): number[] {
  return encodeTuple([PubKey.encode(s.pubKey), encodeBytes(s.bytes)])
}

export const dummy: Signature = {
  pubKey: PubKey.dummy,
  bytes: new Uint8Array(new Array(64).fill(0))
}

export function isDummy(s: Signature): boolean {
  return Bytes.equals(s.bytes, dummy.bytes)
}
