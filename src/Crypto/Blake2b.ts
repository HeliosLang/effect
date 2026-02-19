import * as Bytes from "../internal/Bytes.js"
import * as Uint64 from "../internal/Uint64.js"

/**
 * Calculates blake2b hash of a list of uint8 numbers (variable digest size).
 * Result is also a list of uint8 numbers.
 * @example
 * bytesToHex(Blake2b.hash([0, 1])) == "01cf79da4945c370c68b265ef70641aaa65eaa8f5953e3900d97724c2c5aa095"
 * @example
 * bytesToHex(Blake2b.hash(textToBytes("abc"), 64)) == "ba80a53f981c4d0d6a2797b69f12f6e94c212f14685ac4b74b12bb6fdbffa2d17d87c5392aab792dc252d5de4533cc9518d38aa8dbf1925ab92386edd4009923"
 * @param bytes
 * @param digestSize
 * Defaults to 32. Can't be greater than 64.
 * @returns
 * List of uint8 numbers.
 */
export function hashSync(bytes: Bytes.BytesLike, digestSize = 32): Uint8Array {
  let bs = Bytes.toArray(bytes)

  /**
   * Blake2b is a 64bit algorithm, so we need to be careful when replicating 64-bit operations with 2 32-bit numbers
   * (low-word overflow must spill into high-word, and shifts must go over low/high boundary).
   */

  const nBytes = bs.length

  bs = pad(bs)

  // init hash vector
  const h = IV.slice()

  // setup the param block
  const paramBlock = new Uint8Array(64)
  paramBlock[0] = digestSize // n output  bytes
  paramBlock[1] = 0 // key-length (always zero in our case)
  paramBlock[2] = 1 // fanout
  paramBlock[3] = 1 // depth

  //mix in the parameter block
  const paramBlockView = new DataView(paramBlock.buffer)
  for (let i = 0; i < 8; i++) {
    h[i] = Uint64.xor(h[i], {
      high: paramBlockView.getUint32(i * 8 + 4, true),
      low: paramBlockView.getUint32(i * 8, true)
    })
  }

  // loop all chunks
  for (let chunkStart = 0; chunkStart < bs.length; chunkStart += WIDTH) {
    const chunkEnd = chunkStart + WIDTH // exclusive
    const chunk = bs.slice(chunkStart, chunkStart + WIDTH)

    const chunk64 = new Array(WIDTH / 8) as Uint64.Uint64[]

    for (let i = 0; i < WIDTH; i += 8) {
      chunk64[i / 8] = Uint64.fromBytes(chunk.slice(i, i + 8))
    }

    if (chunkStart == bs.length - WIDTH) {
      // last block
      compress(h, chunk64, nBytes, true)
    } else {
      compress(h, chunk64, chunkEnd, false)
    }
  }

  // extract lowest BLAKE2B_DIGEST_SIZE bytes from h

  let final: number[] = []

  for (let i = 0; i < digestSize / 8; i++) {
    final = final.concat(Uint64.toBytes(h[i]))
  }

  return new Uint8Array(final.slice(0, digestSize))
}

/**
 * 128 bytes (16*8 byte words)
 */
const WIDTH: number = 128

/**
 * Initialization vector
 */
const IV: Uint64.Uint64[] = [
  { high: 0x6a09e667, low: 0xf3bcc908 },
  { high: 0xbb67ae85, low: 0x84caa73b },
  { high: 0x3c6ef372, low: 0xfe94f82b },
  { high: 0xa54ff53a, low: 0x5f1d36f1 },
  { high: 0x510e527f, low: 0xade682d1 },
  { high: 0x9b05688c, low: 0x2b3e6c1f },
  { high: 0x1f83d9ab, low: 0xfb41bd6b },
  { high: 0x5be0cd19, low: 0x137e2179 }
]

const SIGMA: number[][] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  [14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3],
  [11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4],
  [7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8],
  [9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13],
  [2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9],
  [12, 5, 1, 15, 14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8, 11],
  [13, 11, 7, 14, 12, 1, 3, 9, 5, 0, 15, 4, 8, 6, 2, 10],
  [6, 15, 14, 9, 11, 3, 0, 8, 12, 2, 13, 7, 1, 4, 10, 5],
  [10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14, 3, 12, 13, 0]
]

/**
 * @param src
 * list of uint8 bytes
 * @returns
 * list of uint8 bytes
 */
function pad(src: number[]): number[] {
  const dst = src.slice()

  const nZeroes =
    dst.length == 0 ? WIDTH : (WIDTH - (dst.length % WIDTH)) % WIDTH

  // just padding with zeroes, the actual message length is used during compression stage of final block in order to uniquely hash messages of different lengths
  for (let i = 0; i < nZeroes; i++) {
    dst.push(0)
  }

  return dst
}

/**
 * @param {UInt64[]} v
 * @param {UInt64[]} chunk
 * @param a - index
 * @param b - index
 * @param c - index
 * @param d - index
 * @param i - index in chunk for low word 1
 * @param j - index in chunk for low word 2
 */
function mix(
  v: Uint64.Uint64[],
  chunk: Uint64.Uint64[],
  a: number,
  b: number,
  c: number,
  d: number,
  i: number,
  j: number
) {
  const x = chunk[i]
  const y = chunk[j]

  v[a] = Uint64.add(Uint64.add(v[a], v[b]), x)
  v[d] = Uint64.rotr(Uint64.xor(v[d], v[a]), 32)
  v[c] = Uint64.add(v[c], v[d])
  v[b] = Uint64.rotr(Uint64.xor(v[b], v[c]), 24)
  v[a] = Uint64.add(Uint64.add(v[a], v[b]), y)
  v[d] = Uint64.rotr(Uint64.xor(v[d], v[a]), 16)
  v[c] = Uint64.add(v[c], v[d])
  v[b] = Uint64.rotr(Uint64.xor(v[b], v[c]), 63)
}

/**
 * @param {UInt64[]} h - state vector
 * @param {UInt64[]} chunk
 * @param {number} t - chunkEnd (expected to fit in uint32)
 * @param {boolean} last
 */
function compress(
  h: Uint64.Uint64[],
  chunk: Uint64.Uint64[],
  t: number,
  last: boolean
) {
  // work vectors
  const v = h.slice().concat(IV.slice())

  v[12] = Uint64.xor(v[12], { high: 0, low: t >>> 0 }) // v[12].high unmodified
  // v[13] unmodified

  if (last) {
    v[14] = Uint64.xor(v[14], { high: 0xffffffff, low: 0xffffffff })
  }

  for (let round = 0; round < 12; round++) {
    const s = SIGMA[round % 10]

    for (let i = 0; i < 4; i++) {
      mix(v, chunk, i, i + 4, i + 8, i + 12, s[i * 2], s[i * 2 + 1])
    }

    for (let i = 0; i < 4; i++) {
      mix(
        v,
        chunk,
        i,
        ((i + 1) % 4) + 4,
        ((i + 2) % 4) + 8,
        ((i + 3) % 4) + 12,
        s[8 + i * 2],
        s[8 + i * 2 + 1]
      )
    }
  }

  for (let i = 0; i < 8; i++) {
    h[i] = Uint64.xor(h[i], Uint64.xor(v[i], v[i + 8]))
  }
}
