import { Either, Schema } from "effect"
import * as Bytes from "../internal/Bytes.js"
import * as PubKey from "./PubKey.js"
import {
  decodeBytes,
  DecodeResult,
  decodeTuple,
  encodeBytes,
  encodeTuple
} from "../Cbor"

export const Signature = Schema.Struct({
  pubKey: PubKey.PubKey,
  bytes: Schema.Uint8ArrayFromHex
})

export type Signature = Schema.Schema.Type<typeof Signature>

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
