import { Effect, Encoding } from "effect"
import * as Bytes from "./Bytes.js"

/**
 * Decodes a list of uint8 bytes into a string using UTF-8 encoding.
 * @example
 * bytesToUtf8([104, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100]) == "hello world"
 * @param bytes
 * @returns
 */
export function decode(
  bytes: string | number[] | Uint8Array
): Effect.Effect<string, Encoding.DecodeException> {
  return Effect.sync(() =>
    new TextDecoder("utf-8", { fatal: true }).decode(
      Bytes.toUint8Array(bytes).buffer
    )
  ).pipe(
    Effect.catchAll(() =>
      Effect.fail(Bytes.DecodeException(bytes, "Invalid utf-8 encoding"))
    )
  )
}

/**
 * Encodes a string into a list of uint8 bytes using UTF-8 encoding.
 * @example
 * utf8ToBytes("hello world") == [104, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100]
 * @param str
 * @returns
 */
export function encode(str: string): Uint8Array {
  return new TextEncoder().encode(str)
}

/**
 * Tests if a uint8 array is valid utf8 encoding.
 * @param {number[]} bytes
 * @returns {boolean}
 */
export function isValid(bytes: string | number[] | Uint8Array): boolean {
  /**
   * Bytes.toArray() doesn't fail if any of the bytes are out of range
   */
  const bs = Bytes.toArray(bytes)

  if (bs.some((b) => b < 0 || b > 255)) {
    return false
  }

  try {
    new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bs).buffer)

    return true
  } catch (_e) {
    return false
  }
}
