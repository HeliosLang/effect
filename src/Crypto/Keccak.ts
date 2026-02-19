import * as Bytes from "../internal/Bytes.js"
import * as Uint64 from "../internal/Uint64.js"

/**
 * Keccak is a family of hashing functions, of which Sha3 is the most well-known
 *
 * Keccak_256 refers to the older implementation, using 0x01 as a padByte (Sha3 uses 0x06 as a padyte)
 */

/**
 * @param bytes
 * List of uint8 numbers
 * @param padByte
 * 0x06 for sha3 or 0x01 for keccak
 * @returns
 * List of uint8 numbers.
 */
export function hashSync(
  bs: Bytes.BytesLike,
  padByte: number = 0x01
): Uint8Array {
  /**
   * Sha3 uses only bit-wise operations, so 64-bit operations can easily be replicated using 2 32-bit operations instead.
   */

  const bytes = pad(Bytes.toArray(bs), padByte)

  /**
   * Initialize the state
   */
  const state = new Array(WIDTH / 8).fill(Uint64.Zero) as Uint64.Uint64[]

  for (let chunkStart = 0; chunkStart < bytes.length; chunkStart += RATE) {
    // extend the chunk to become length WIDTH
    const chunk = bytes
      .slice(chunkStart, chunkStart + RATE)
      .concat(new Array(CAP).fill(0))

    // element-wise xor with 'state'
    for (let i = 0; i < WIDTH; i += 8) {
      state[i / 8] = Uint64.xor(
        state[i / 8],
        Uint64.fromBytes(chunk.slice(i, i + 8))
      )

      // beware: a uint32 is stored as little endian, but a pair of uint32s that form a uin64 are stored in big endian format!
    }

    // apply block permutations
    permute(state)
  }

  let hash: number[] = []

  for (let i = 0; i < 4; i++) {
    hash = hash.concat(Uint64.toBytes(state[i]))
  }

  return new Uint8Array(hash)
}

/**
 * State width (1600 bits, )
 */
const WIDTH = 200

/**
 * Rate (1088 bits, 136 bytes)
 */
const RATE = 136

/**
 * Capacity
 */
const CAP: number = /* @__PURE__ */ (() => WIDTH - RATE)()

/**
 * 24 numbers used in the sha3 permute function
 */
const OFFSETS: number[] = [
  6, 12, 18, 24, 3, 9, 10, 16, 22, 1, 7, 13, 19, 20, 4, 5, 11, 17, 23, 2, 8, 14,
  15, 21
]

/**
 * 24 numbers used in the sha3 permute function
 */
const SHIFTS: number[] = [
  -12, -11, 21, 14, 28, 20, 3, -13, -29, 1, 6, 25, 8, 18, 27, -4, 10, 15, -24,
  -30, -23, -7, -9, 2
]

/**
 * Round constants used in the sha3 permute function
 */
const RC: Uint64.Uint64[] = [
  { high: 0x00000000, low: 0x00000001 },
  { high: 0x00000000, low: 0x00008082 },
  { high: 0x80000000, low: 0x0000808a },
  { high: 0x80000000, low: 0x80008000 },
  { high: 0x00000000, low: 0x0000808b },
  { high: 0x00000000, low: 0x80000001 },
  { high: 0x80000000, low: 0x80008081 },
  { high: 0x80000000, low: 0x00008009 },
  { high: 0x00000000, low: 0x0000008a },
  { high: 0x00000000, low: 0x00000088 },
  { high: 0x00000000, low: 0x80008009 },
  { high: 0x00000000, low: 0x8000000a },
  { high: 0x00000000, low: 0x8000808b },
  { high: 0x80000000, low: 0x0000008b },
  { high: 0x80000000, low: 0x00008089 },
  { high: 0x80000000, low: 0x00008003 },
  { high: 0x80000000, low: 0x00008002 },
  { high: 0x80000000, low: 0x00000080 },
  { high: 0x00000000, low: 0x0000800a },
  { high: 0x80000000, low: 0x8000000a },
  { high: 0x80000000, low: 0x80008081 },
  { high: 0x80000000, low: 0x00008080 },
  { high: 0x00000000, low: 0x80000001 },
  { high: 0x80000000, low: 0x80008008 }
]

/**
 * Apply 1000...1 padding until size is multiple of r.
 * If already multiple of r then add a whole block of padding.
 * @param src
 * List of uint8 numbers
 * @param {number} padByte 0x06 for sha3, 0x01 for keccak
 * @returns {number[]} - list of uint8 numbers
 */
function pad(src: number[], padByte: number): number[] {
  const dst = src.slice()

  let nZeroes: number = RATE - 2 - (dst.length % RATE)
  if (nZeroes < -1) {
    nZeroes += RATE - 2
  }

  if (nZeroes == -1) {
    dst.push(0x80 + padByte)
  } else {
    dst.push(padByte)

    for (let i = 0; i < nZeroes; i++) {
      dst.push(0)
    }

    dst.push(0x80)
  }

  if (dst.length % RATE != 0) {
    throw new Error("bad padding")
  }

  return dst
}

/**
 * Change `s` in-place
 * @param s
 */
function permute(s: Uint64.Uint64[]) {
  const c = new Array(5) as Uint64.Uint64[]
  const b = new Array(25) as Uint64.Uint64[]

  for (let round = 0; round < 24; round++) {
    for (let i = 0; i < 5; i++) {
      c[i] = Uint64.xor(
        Uint64.xor(
          Uint64.xor(Uint64.xor(s[i], s[i + 5]), s[i + 10]),
          s[i + 15]
        ),
        s[i + 20]
      )
    }

    for (let i = 0; i < 5; i++) {
      const i1 = (i + 1) % 5
      const i2 = (i + 4) % 5

      const tmp = Uint64.xor(c[i2], Uint64.rotr(c[i1], 63))

      for (let j = 0; j < 5; j++) {
        s[i + 5 * j] = Uint64.xor(s[i + 5 * j], tmp)
      }
    }

    b[0] = s[0]

    for (let i = 1; i < 25; i++) {
      const offset = OFFSETS[i - 1]

      const left = Math.abs(SHIFTS[i - 1])
      const right = 32 - left

      if (SHIFTS[i - 1] < 0) {
        b[i] = Uint64.rotr(s[offset], right)
      } else {
        b[i] = Uint64.rotr(s[offset], right + 32)
      }
    }

    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        s[i * 5 + j] = Uint64.xor(
          b[i * 5 + j],
          Uint64.and(
            Uint64.not(b[i * 5 + ((j + 1) % 5)]),
            b[i * 5 + ((j + 2) % 5)]
          )
        )
      }
    }

    s[0] = Uint64.xor(s[0], RC[round])
  }
}
