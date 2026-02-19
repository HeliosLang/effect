import { Encoding, Either } from "effect"
import { toHex } from "./Bytes.js"

const SPECIAL_EXPONENT = 31
const LARGEST_SIGNIFICAND = 1024
const POW2 = [
  0.00006103515625, // 2^-14
  0.0001220703125, // 2^-13
  0.000244140625, // 2^-12
  0.00048828125, // 2^-11
  0.0009765625, // 2^-10
  0.001953125, // 2^-9
  0.00390625, // 2^-8
  0.0078125, // 2^-7
  0.015625, // 2^-6
  0.03125, // 2^-5
  0.0625, // 2^-4
  0.125, // 2^-3
  0.25, // 2^-2
  0.5, // 2^-1
  1, // 2^0
  2, // 2^1
  4, // 2^2
  8, // 2^3
  16, // 2^4
  32, // 2^5
  64, // 2^6
  128, // 2^7
  256, // 2^8
  512, // 2^9
  1024, // 2^10
  2048, // 2^11
  4096, // 2^12
  8192, // 2^13
  16384, // 2^14
  32768, // 2^15
  65536 // 2^16
]

/**
 * Custom IEEE 754 Float16 implementation, not fast, but easy to audit
 * @param {number[]} bytes
 * @returns {number}
 */
export function decodeFloat16(
  bytes: number[]
): Either.Either<number, Encoding.DecodeException> {
  if (bytes.length != 2) {
    return Either.left(
      Encoding.DecodeException(
        toHex(bytes),
        `expected 2 bytes for IEEE 754 encoded Float16 number, got ${bytes.length}`
      )
    )
  }

  const sign = bytes[0] >> 7 ? -1 : 1
  const exponent = (bytes[0] & 0b01111100) >> 2
  const significand = (bytes[0] & 0b00000011) * 256 + bytes[1]

  if (exponent === 0) {
    if (significand == 0) {
      return Either.right(sign < 0 ? -0 : 0)
    } else {
      return Either.right((sign * POW2[0] * significand) / LARGEST_SIGNIFICAND)
    }
  } else if (exponent === SPECIAL_EXPONENT) {
    if (significand == 0) {
      return Either.right(
        sign < 0 ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY
      )
    } else {
      return Either.right(Number.NaN)
    }
  } else {
    return Either.right(
      sign * POW2[exponent - 1] * (1.0 + significand / LARGEST_SIGNIFICAND)
    )
  }
}

/**
 * Custom IEEE 754 Float16 implementation, not fast, but easy to audit
 * @param f
 * @returns
 */
export function encodeFloat16(f: number): number[] {
  if (Object.is(f, 0)) {
    return [0, 0]
  } else if (Object.is(f, -0)) {
    return [0x80, 0]
  } else if (f === Number.NEGATIVE_INFINITY) {
    return [0xfc, 0]
  } else if (f === Number.POSITIVE_INFINITY) {
    return [0x7c, 0]
  } else if (Number.isNaN(f)) {
    return [0x7c, 1]
  } else {
    const sign = Math.sign(f)
    const signBit = sign > 0 ? 0 : 0b10000000
    f = Math.abs(f)

    if (f < POW2[0]) {
      const significand = Math.floor((f / POW2[0]) * LARGEST_SIGNIFICAND)

      return [signBit | (significand >> 8), significand & 0xff]
    } else {
      const unbiasedExponent = Math.floor(Math.log2(f))
      const exponent = (unbiasedExponent + 15) & 0b00011111

      const significand = Math.round(
        (f / POW2[exponent - 1] - 1) * LARGEST_SIGNIFICAND
      )

      return [
        signBit | (exponent << 2) | (significand >> 8),
        significand & 0xff
      ]
    }
  }
}

/**
 * Leverages the builtin DataView class to decode a IEEE 754 float32 number
 * @param {number[]} bytes
 * @returns
 */
export function decodeFloat32(
  bytes: number[]
): Either.Either<number, Encoding.DecodeException> {
  if (bytes.length != 4) {
    return Either.left(
      Encoding.DecodeException(
        toHex(bytes),
        `expected 4 bytes for IEEE 754 encoded Float32, got ${bytes.length} bytes`
      )
    )
  }

  const view = new DataView(Uint8Array.from(bytes).buffer)

  return Either.right(view.getFloat32(0))
}

/**
 * Leverages the builtin DataView class to encode a floating point number using IEEE 754 float32 encoding
 * @param f
 * @returns
 */
export function encodeFloat32(f: number): number[] {
  const view = new DataView(new ArrayBuffer(4))

  view.setFloat32(0, f)

  return Array.from(new Uint8Array(view.buffer))
}

/**
 * Leverages the builtin DataView class to decode a IEEE 754 float64 number
 * @param bytes
 * @returns
 */
export function decodeFloat64(
  bytes: number[]
): Either.Either<number, Encoding.DecodeException> {
  if (bytes.length != 8) {
    return Either.left(
      Encoding.DecodeException(
        `expected 8 bytes for IEEE 754 encoded Float64, got ${bytes.length} bytes`
      )
    )
  }

  const view = new DataView(Uint8Array.from(bytes).buffer)

  return Either.right(view.getFloat64(0))
}

/**
 * Leverages the builtin DataView class to encode a floating point number using IEEE 754 float64 encoding
 * @param f
 * @returns
 */
export function encodeFloat64(f: number): number[] {
  const view = new DataView(new ArrayBuffer(8))

  view.setFloat64(0, f)

  return Array.from(new Uint8Array(view.buffer))
}
