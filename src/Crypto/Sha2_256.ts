import { Effect } from "effect"
import * as BigEndian from "../Codecs/BigEndian.js"
import * as Bytes from "../Codecs/Bytes.js"
import { NativeUnavailable } from "./errors.js"

/**
 * Prefers the WebCrypto hashing function and is more performant than `hashSync`,
 *   but must be run async
 * @param bytes
 * @returns
 */
export const hash = (
  bytes: Bytes.BytesLike
): Effect.Effect<Uint8Array, Error> =>
  hashWebCrypto(bytes).pipe(
    Effect.catchTag("NativeUnavailable", () => hashNode(bytes)),
    Effect.catchTag("NativeUnavailable", () => Effect.succeed(hashSync(bytes)))
  )

/**
 * Hash using WebCrypto primitives
 * (browser, Node >= 16, Deno, Bun, etc.)
 * @param bytes
 * @returns
 */
export const hashWebCrypto = (
  bytes: Bytes.BytesLike
): Effect.Effect<Uint8Array, Error | NativeUnavailable> => {
  if (globalThis.crypto?.subtle !== undefined) {
    return Effect.tryPromise({
      try: () =>
        globalThis.crypto.subtle.digest("SHA-256", Bytes.toUint8Array(bytes)),
      catch: (e) => new Error(`${(e as Error).message}`)
    }).pipe(Effect.map((buffer: ArrayBuffer) => new Uint8Array(buffer)))
  } else {
    return Effect.fail(new NativeUnavailable("SHA-256"))
  }
}

/**
 * Hash using nodejs crypto library
 * @param bytes
 * @returns
 */
export const hashNode = (
  bytes: Bytes.BytesLike
): Effect.Effect<Uint8Array, Error | NativeUnavailable> => {
  return Effect.tryPromise({
    try: () => import("crypto"),
    catch: (_e) => new NativeUnavailable("SHA-256")
  }).pipe(
    Effect.flatMap((m) =>
      Effect.sync(() =>
        m.createHash("sha256").update(Bytes.toUint8Array(bytes)).digest()
      )
    )
  )
}

/**
 * Calculates sha2-256 (32bytes) hash of a list of bytes.
 * Result is also a list of bytes.
 * @example
 * sha2_256(textToBytes("Hello, World!")) == [223, 253, 96, 33, 187, 43, 213, 176, 175, 103, 98, 144, 128, 158, 195, 165, 49, 145, 221, 129, 199, 247, 10, 75, 40, 104, 138, 54, 33, 130, 152, 111]
 * @param bytes
 * List of uint8 numbers
 * @returns
 * List of uint8 numbers.
 * TODO: should we return a hex string instead?
 */
export function hashSync(bytes: Bytes.BytesLike): Uint8Array {
  const bs = pad(Bytes.toArray(bytes))

  const hash = IV.slice()

  // break message in successive 64 byte chunks
  for (let chunkStart = 0; chunkStart < bs.length; chunkStart += 64) {
    const chunk = bs.slice(chunkStart, chunkStart + 64)

    const w = new Array(64).fill(0) as number[] // array of 32 bit numbers!

    // copy chunk into first 16 positions of w
    for (let i = 0; i < 16; i++) {
      w[i] =
        (chunk[i * 4 + 0] << 24) |
        (chunk[i * 4 + 1] << 16) |
        (chunk[i * 4 + 2] << 8) |
        chunk[i * 4 + 3]
    }

    // extends the first 16 positions into the remaining 48 positions
    for (let i = 16; i < 64; i++) {
      w[i] = (w[i - 16] + sigma0(w[i - 15]) + w[i - 7] + sigma1(w[i - 2])) >>> 0
    }

    // intialize working variables to current hash value
    let a = hash[0]
    let b = hash[1]
    let c = hash[2]
    let d = hash[3]
    let e = hash[4]
    let f = hash[5]
    let g = hash[6]
    let h = hash[7]

    // compression function main loop
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const temp1 = (h + S1 + ch + K[i] + w[i]) >>> 0
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (S0 + maj) >>> 0

      h = g
      g = f
      f = e
      e = (d + temp1) >>> 0
      d = c
      c = b
      b = a
      a = (temp1 + temp2) >>> 0
    }

    // update the hash
    hash[0] = (hash[0] + a) >>> 0
    hash[1] = (hash[1] + b) >>> 0
    hash[2] = (hash[2] + c) >>> 0
    hash[3] = (hash[3] + d) >>> 0
    hash[4] = (hash[4] + e) >>> 0
    hash[5] = (hash[5] + f) >>> 0
    hash[6] = (hash[6] + g) >>> 0
    hash[7] = (hash[7] + h) >>> 0
  }

  // produce the final digest of uint8 numbers
  const result = []
  for (let i = 0; i < 8; i++) {
    const item = hash[i]

    result.push((item >> 24) & 0xff)
    result.push((item >> 16) & 0xff)
    result.push((item >> 8) & 0xff)
    result.push((item >> 0) & 0xff)
  }

  return new Uint8Array(result)
}

/**
 * 64 uint32 numbers
 */
const K: number[] = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]

/**
 * Initialization vector
 * 8 uint32 number
 */
const IV: number[] = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
  0x1f83d9ab, 0x5be0cd19
]

/**
 * Pad a bytearray so its size is a multiple of 64 (512 bits).
 * Internal method.
 * @param src
 * List of uint8 numbers
 * @returns
 * @throws
 * If input data is too large
 */
function pad(src: number[]): number[] {
  const nBits = src.length * 8

  let dst = src.slice()

  dst.push(0x80)

  if ((dst.length + 8) % 64 != 0) {
    let nZeroes = 64 - (dst.length % 64) - 8
    if (nZeroes < 0) {
      nZeroes += 64
    }

    for (let i = 0; i < nZeroes; i++) {
      dst.push(0)
    }
  }

  if ((dst.length + 8) % 64 != 0) {
    throw new Error("bad padding")
  }

  const lengthPadding = BigEndian.encode(BigInt(nBits))

  if (lengthPadding.length > 8) {
    throw new Error("input data too big")
  }

  while (lengthPadding.length < 8) {
    lengthPadding.unshift(0)
  }

  dst = dst.concat(lengthPadding)

  return dst
}

/**
 * 32 bit number rotation
 * @param x
 * originally uint32
 * @param n
 * @returns originally uint32
 */
function rotr(x: number, n: number): number {
  return ((x >>> n) | (x << (32 - n))) >>> 0
}

/**
 * @param x
 * @returns
 */
function sigma0(x: number): number {
  return rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3)
}

/**
 * @param x
 * @returns
 */
function sigma1(x: number): number {
  return rotr(x, 17) ^ rotr(x, 19) ^ (x >>> 10)
}
