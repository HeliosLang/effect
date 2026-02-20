import { Either, Encoding } from "effect"
import * as BigEndian from "./BigEndian.js"
import * as Bytes from "./Bytes.js"

/**
 * @import { IntLike } from "../index.js"
 */

/**
 * Little Endian bytes to bigint (doesnt need to be 32 bytes long)
 * @param bytes
 * @returns
 */
export function decode(
  bytes: Bytes.BytesLike
): Either.Either<bigint, Encoding.DecodeException> {
  return BigEndian.decode(Bytes.toArray(bytes).reverse())
}

export function decodeOrThrow(bytes: Bytes.BytesLike): bigint {
  return Either.getOrThrow(decode(bytes))
}

/**
 * Little Endian 32 bytes
 * @param {IntLike} x
 * @returns {number[]}
 */
export function encode32(x: number | bigint): number[] {
  if (typeof x == "number") {
    return encode32(BigInt(x))
  } else {
    return Bytes.pad(BigEndian.encode(x).reverse(), 32)
  }
}
