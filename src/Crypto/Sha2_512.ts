import { Effect } from "effect"
import * as BigEndian from "../internal/BigEndian.js"
import * as Bytes from "../internal/Bytes.js"
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
        globalThis.crypto.subtle.digest("SHA-512", Bytes.toUint8Array(bytes)),
      catch: (e) => new Error(`${(e as Error).message}`)
    }).pipe(Effect.map((buffer: ArrayBuffer) => new Uint8Array(buffer)))
  } else {
    return Effect.fail(new NativeUnavailable("SHA-512"))
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
    catch: (_e) => new NativeUnavailable("SHA-512")
  }).pipe(
    Effect.flatMap((m) =>
      Effect.sync(() =>
        m.createHash("sha512").update(Bytes.toUint8Array(bytes)).digest()
      )
    )
  )
}

/**
 * Calculates sha2-512 (64bytes) hash of a list of uint8 numbers.
 * Result is also a list of uint8 number.
 * @param bs List of uint8 numbers
 * @returns List of uint8 numbers.
 */
export function hashSync(bytes: Bytes.BytesLike): Uint8Array {
  const bs = pad(Bytes.toArray(bytes))

  const hash = IV.slice()

  // break message in successive 64 byte chunks
  for (let chunkStart = 0; chunkStart < bs.length; chunkStart += 128) {
    const chunk = bs.slice(chunkStart, chunkStart + 128)

    const w = new Array(160).fill(0) as number[] // array of 32 bit numbers!

    // copy chunk into first 16 hi/lo positions of w (i.e. into first 32 uint32 positions)
    for (let i = 0; i < 32; i += 2) {
      const bs = chunk.slice(i * 4, i * 4 + 8)
      w[i + 0] =
        ((bs[0] << 24) | (bs[1] << 16) | (bs[2] << 8) | (bs[3] << 0)) >>> 0
      w[i + 1] =
        ((bs[4] << 24) | (bs[5] << 16) | (bs[6] << 8) | (bs[7] << 0)) >>> 0
    }

    // extends the first 16 uint64 positions into the remaining 80 uint64 positions (so first 32 uint32 into remaining 160 uint32 positions)
    for (let i = 32; i < 160; i += 2) {
      let h = w[i - 30]
      let l = w[i - 29]

      const sigma0h =
        (((h >>> 1) | (l << 31)) ^ ((h >>> 8) | (l << 24)) ^ (h >>> 7)) >>> 0
      const sigma0l =
        (((l >>> 1) | (h << 31)) ^
          ((l >>> 8) | (h << 24)) ^
          ((l >>> 7) | (h << 25))) >>>
        0

      h = w[i - 4]
      l = w[i - 3]

      const sigma1h =
        (((h >>> 19) | (l << 13)) ^ ((l >>> 29) | (h << 3)) ^ (h >>> 6)) >>> 0
      const sigma1l =
        (((l >>> 19) | (h << 13)) ^
          ((h >>> 29) | (l << 3)) ^
          ((l >>> 6) | (h << 26))) >>>
        0

      h = sigma1h + w[i - 14] + sigma0h + w[i - 32]
      l = sigma1l + w[i - 13] + sigma0l + w[i - 31]

      w[i] = (h + Math.floor(l / 4294967296)) >>> 0
      w[i + 1] = l >>> 0
    }

    // intialize working variables to current hash value
    let ah = hash[0]
    let al = hash[1]
    let bh = hash[2]
    let bl = hash[3]
    let ch = hash[4]
    let cl = hash[5]
    let dh = hash[6]
    let dl = hash[7]
    let eh = hash[8]
    let el = hash[9]
    let fh = hash[10]
    let fl = hash[11]
    let gh = hash[12]
    let gl = hash[13]
    let hh = hash[14]
    let hl = hash[15]

    // compression function main loop
    for (let i = 0; i < 160; i += 2) {
      const S0h =
        (((ah >>> 28) | (al << 4)) ^
          ((al >>> 2) | (ah << 30)) ^
          ((al >>> 7) | (ah << 25))) >>>
        0
      const S0l =
        (((al >>> 28) | (ah << 4)) ^
          ((ah >>> 2) | (al << 30)) ^
          ((ah >>> 7) | (al << 25))) >>>
        0

      const S1h =
        (((eh >>> 14) | (el << 18)) ^
          ((eh >>> 18) | (el << 14)) ^
          ((el >>> 9) | (eh << 23))) >>>
        0
      const S1l =
        (((el >>> 14) | (eh << 18)) ^
          ((el >>> 18) | (eh << 14)) ^
          ((eh >>> 9) | (el << 23))) >>>
        0

      const majh = ((ah & bh) ^ (ah & ch) ^ (bh & ch)) >>> 0
      const majl = ((al & bl) ^ (al & cl) ^ (bl & cl)) >>> 0

      const chh = ((eh & fh) ^ (~eh & gh)) >>> 0
      const chl = ((el & fl) ^ (~el & gl)) >>> 0

      let temp1l = hl + S1l + chl + K[i + 1] + w[i + 1]
      const temp1h =
        (hh + S1h + chh + K[i] + w[i] + Math.floor(temp1l / 4294967296)) >>> 0
      temp1l = temp1l >>> 0

      let temp2l = S0l + majl
      const temp2h = (S0h + majh + Math.floor(temp2l / 4294967296)) >>> 0
      temp2l = temp2l >>> 0

      hh = gh
      hl = gl
      gh = fh
      gl = fl
      fh = eh
      fl = el
      el = dl + temp1l
      eh = (dh + temp1h + Math.floor(el / 4294967296)) >>> 0
      el = el >>> 0
      dh = ch
      dl = cl
      ch = bh
      cl = bl
      bh = ah
      bl = al
      al = temp1l + temp2l
      ah = (temp1h + temp2h + Math.floor(al / 4294967296)) >>> 0
      al = al >>> 0
    }

    updateHash(hash, 0, ah, al)
    updateHash(hash, 2, bh, bl)
    updateHash(hash, 4, ch, cl)
    updateHash(hash, 6, dh, dl)
    updateHash(hash, 8, eh, el)
    updateHash(hash, 10, fh, fl)
    updateHash(hash, 12, gh, gl)
    updateHash(hash, 14, hh, hl)
  }

  // produce the final digest of uint8 numbers
  let result: number[] = []

  for (let i = 0; i < 16; i += 2) {
    const h = hash[i]
    const l = hash[i + 1]
    const bs = [
      (0xff000000 & h) >>> 24,
      (0x00ff0000 & h) >>> 16,
      (0x0000ff00 & h) >>> 8,
      0x000000ff & h,
      (0xff000000 & l) >>> 24,
      (0x00ff0000 & l) >>> 16,
      (0x0000ff00 & l) >>> 8,
      0x000000ff & l
    ]

    result = result.concat(bs)
  }

  return new Uint8Array(result)
}

/**
 * 80 uint64 numbers as 160 uint32 numbers
 */
const K: number[] = [
  0x428a2f98, 0xd728ae22, 0x71374491, 0x23ef65cd, 0xb5c0fbcf, 0xec4d3b2f,
  0xe9b5dba5, 0x8189dbbc, 0x3956c25b, 0xf348b538, 0x59f111f1, 0xb605d019,
  0x923f82a4, 0xaf194f9b, 0xab1c5ed5, 0xda6d8118, 0xd807aa98, 0xa3030242,
  0x12835b01, 0x45706fbe, 0x243185be, 0x4ee4b28c, 0x550c7dc3, 0xd5ffb4e2,
  0x72be5d74, 0xf27b896f, 0x80deb1fe, 0x3b1696b1, 0x9bdc06a7, 0x25c71235,
  0xc19bf174, 0xcf692694, 0xe49b69c1, 0x9ef14ad2, 0xefbe4786, 0x384f25e3,
  0x0fc19dc6, 0x8b8cd5b5, 0x240ca1cc, 0x77ac9c65, 0x2de92c6f, 0x592b0275,
  0x4a7484aa, 0x6ea6e483, 0x5cb0a9dc, 0xbd41fbd4, 0x76f988da, 0x831153b5,
  0x983e5152, 0xee66dfab, 0xa831c66d, 0x2db43210, 0xb00327c8, 0x98fb213f,
  0xbf597fc7, 0xbeef0ee4, 0xc6e00bf3, 0x3da88fc2, 0xd5a79147, 0x930aa725,
  0x06ca6351, 0xe003826f, 0x14292967, 0x0a0e6e70, 0x27b70a85, 0x46d22ffc,
  0x2e1b2138, 0x5c26c926, 0x4d2c6dfc, 0x5ac42aed, 0x53380d13, 0x9d95b3df,
  0x650a7354, 0x8baf63de, 0x766a0abb, 0x3c77b2a8, 0x81c2c92e, 0x47edaee6,
  0x92722c85, 0x1482353b, 0xa2bfe8a1, 0x4cf10364, 0xa81a664b, 0xbc423001,
  0xc24b8b70, 0xd0f89791, 0xc76c51a3, 0x0654be30, 0xd192e819, 0xd6ef5218,
  0xd6990624, 0x5565a910, 0xf40e3585, 0x5771202a, 0x106aa070, 0x32bbd1b8,
  0x19a4c116, 0xb8d2d0c8, 0x1e376c08, 0x5141ab53, 0x2748774c, 0xdf8eeb99,
  0x34b0bcb5, 0xe19b48a8, 0x391c0cb3, 0xc5c95a63, 0x4ed8aa4a, 0xe3418acb,
  0x5b9cca4f, 0x7763e373, 0x682e6ff3, 0xd6b2b8a3, 0x748f82ee, 0x5defb2fc,
  0x78a5636f, 0x43172f60, 0x84c87814, 0xa1f0ab72, 0x8cc70208, 0x1a6439ec,
  0x90befffa, 0x23631e28, 0xa4506ceb, 0xde82bde9, 0xbef9a3f7, 0xb2c67915,
  0xc67178f2, 0xe372532b, 0xca273ece, 0xea26619c, 0xd186b8c7, 0x21c0c207,
  0xeada7dd6, 0xcde0eb1e, 0xf57d4f7f, 0xee6ed178, 0x06f067aa, 0x72176fba,
  0x0a637dc5, 0xa2c898a6, 0x113f9804, 0xbef90dae, 0x1b710b35, 0x131c471b,
  0x28db77f5, 0x23047d84, 0x32caab7b, 0x40c72493, 0x3c9ebe0a, 0x15c9bebc,
  0x431d67c4, 0x9c100d4c, 0x4cc5d4be, 0xcb3e42b6, 0x597f299c, 0xfc657e2a,
  0x5fcb6fab, 0x3ad6faec, 0x6c44198c, 0x4a475817
]

/**
 * Initialization vector
 * 8 uint64 numbers as 16 uint32 number
 */
const IV: number[] = [
  0x6a09e667, 0xf3bcc908, 0xbb67ae85, 0x84caa73b, 0x3c6ef372, 0xfe94f82b,
  0xa54ff53a, 0x5f1d36f1, 0x510e527f, 0xade682d1, 0x9b05688c, 0x2b3e6c1f,
  0x1f83d9ab, 0xfb41bd6b, 0x5be0cd19, 0x137e2179
]

/**
 * Pad a bytearray so its size is a multiple of 128 (1024 bits).
 * Internal method.
 * @param src
 * List of uint8 numbers
 * @returns
 */
function pad(src: number[]): number[] {
  const nBits = src.length * 8

  let dst = src.slice()

  dst.push(0x80)

  if ((dst.length + 16) % 128 != 0) {
    let nZeroes = 128 - (dst.length % 128) - 16
    if (nZeroes < 0) {
      nZeroes += 128
    }

    for (let i = 0; i < nZeroes; i++) {
      dst.push(0)
    }
  }

  if ((dst.length + 16) % 128 != 0) {
    throw new Error("bad padding")
  }

  // assume nBits fits in 32 bits
  const lengthPadding = BigEndian.encode(BigInt(nBits))

  if (lengthPadding.length > 16) {
    throw new Error("input data too big")
  }

  while (lengthPadding.length < 16) {
    lengthPadding.unshift(0)
  }

  dst = dst.concat(lengthPadding)

  if (dst.length % 128 != 0) {
    throw new Error("bad length padding")
  }

  return dst
}

/**
 * Changes hash in-place
 * @param hash
 * @param i
 * @param h
 * @param l
 */
function updateHash(hash: number[], i: number, h: number, l: number): void {
  l = hash[i + 1] + l
  hash[i] = (hash[i] + h + Math.floor(l / 4294967296)) >>> 0
  hash[i + 1] = l >>> 0
}
