import { Either, Encoding } from "effect"
import * as Base32 from "./internal/Base32.js"

/**
 * Bech32 base32 alphabet
 */
const ALPHABET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l" as const

const PAYLOAD_CODEC = /* @__PURE__ */ Base32.make({
  alphabet: ALPHABET
})

/**
 * Decomposes a Bech32 checksummed string (eg. a Cardano address), and returns the human readable part and the original bytes
 * Throws an error if checksum is invalid.
 * @param encoded
 * @returns
 * `prefix` part is the human-readable part, `bytes` part is a list containing the underlying bytes.
 */
export function decode(
  encoded: string
): Either.Either<
  { prefix: string; bytes: number[] },
  Encoding.DecodeException
> {
  const [prefix, payload] = split(encoded)

  if (!verifySplit(prefix, payload)) {
    return Either.left(
      Encoding.DecodeException(encoded, "invalid bech32 encoding")
    )
  }

  const bytes = PAYLOAD_CODEC.decode(payload.slice(0, payload.length - 6))

  if (bytes._tag == "Left") {
    return Either.left(bytes.left)
  }

  return Either.right({ prefix, bytes: Array.from(bytes.right) })
}

/**
 * Creates a Bech32 checksummed string (eg. used to represent Cardano addresses).
 * @param prefix
 * human-readable part (eg. "addr")
 * @param payload
 * Hex encoded or a list of uint8 bytes
 * @returns
 * @throws
 * If prefix is empty
 */
export function encode(
  prefix: string,
  payload: string | number[] | Uint8Array
): string {
  if (prefix.length == 0) {
    throw new Error("human-readable-part must have non-zero length")
  }

  payload = PAYLOAD_CODEC.encodeRaw(payload)

  const chkSum = calcChecksum(prefix, payload)

  return (
    prefix +
    "1" +
    payload
      .concat(chkSum)
      .map((i) => ALPHABET[i])
      .join("")
  )
}

/**
 * Verifies a Bech32 checksum. Prefix must be checked externally
 * @param {string} encoded
 * @returns {boolean}
 */
export function isValid(encoded: string): boolean {
  const [prefix, payload] = split(encoded)

  return verifySplit(prefix, payload)
}

/**
 * Expand human readable prefix of the bech32 encoding so it can be used in the checkSum.
 * @param prefix
 * @returns
 */
function expandPrefix(prefix: string): number[] {
  const bytes = []
  for (const c of prefix) {
    bytes.push(c.charCodeAt(0) >> 5)
  }

  bytes.push(0)

  for (const c of prefix) {
    bytes.push(c.charCodeAt(0) & 31)
  }

  return bytes
}

/**
 * Split bech32 encoded string into human-readable-part and payload part.
 * @param encoded
 * @returns
 * First item is human-readable-part, second part is payload part
 */
function split(encoded: string): [string, string] {
  const i = encoded.indexOf("1")

  if (i == -1 || i == 0) {
    return ["", encoded]
  } else {
    return [encoded.slice(0, i), encoded.slice(i + 1)]
  }
}

/**
 * Used as part of the bech32 checksum.
 * @param bytes
 * @returns
 */
function polymod(bytes: number[]): number {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]

  let chk = 1
  for (const b of bytes) {
    const c = chk >> 25
    chk = ((chk & 0x1fffffff) << 5) ^ b

    for (let i = 0; i < 5; i++) {
      if (((c >> i) & 1) != 0) {
        chk ^= GEN[i]
      }
    }
  }

  return chk
}

/**
 * Generate the bech32 checksum.
 * @param prefix
 * @param payload
 * numbers between 0 and 32
 * @returns
 * 6 numbers between 0 and 32
 */
function calcChecksum(prefix: string, payload: number[]): number[] {
  const bytes = expandPrefix(prefix).concat(payload)

  const chk = polymod(bytes.concat([0, 0, 0, 0, 0, 0])) ^ 1

  const chkSum: number[] = []
  for (let i = 0; i < 6; i++) {
    chkSum.push((chk >> (5 * (5 - i))) & 31)
  }

  return chkSum
}

/**
 * @param prefix
 * @param payload
 * @returns
 */
function verifySplit(prefix: string, payload: string): boolean {
  if (prefix.length == 0) {
    return false
  }

  const data: number[] = []

  for (const c of payload) {
    const j = ALPHABET.indexOf(c)
    if (j == -1) {
      return false
    }

    data.push(j)
  }

  const chkSumA = data.slice(data.length - 6)

  const chkSumB = calcChecksum(prefix, data.slice(0, data.length - 6))

  for (let j = 0; j < 6; j++) {
    if (chkSumA[j] != chkSumB[j]) {
      return false
    }
  }

  return true
}
