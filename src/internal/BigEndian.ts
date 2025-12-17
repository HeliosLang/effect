import { Either, Encoding } from "effect"
import { makeUint8Array } from "./Bytes.js"

/**
 * Converts a list of big endian uint8 numbers into an unbounded int
 * @param bytes
 * @returns
 * @throws
 * If `bytes` is empty
 * @throws
 * If any input number is out of range [0,256) or not a whole number
 */
export function decode(bytes: number[] | Uint8Array): Either.Either<bigint, Encoding.DecodeException> {
    if (bytes.length == 0) {
        return Either.left(
            Encoding.DecodeException(Encoding.encodeHex(makeUint8Array(bytes)), "Empty bytes")
        )
    }

    let p = 1n
    let total = 0n

    for (let i = bytes.length - 1; i >= 0; i--) {
        const b = bytes[i]

        if (b < 0 || b > 255 || b % 1.0 != 0.0) {
            return Either.left(
                Encoding.DecodeException(Encoding.encodeHex(makeUint8Array(bytes)), `Invalide bytes '${b}' at position ${i}`)
            )
        }

        total += BigInt(b) * p

        p *= 256n
    }

    return Either.right(total)
}

/**
 * Converts an unbounded integer into a list of big endian uint8 numbers.
 * @param x
 * @returns
 * @throws
 * If `x` isn't a whole number
 * @throws
 * If `x` is negative.
 */
export function encode(x: number | bigint): number[] {
    if (typeof x == "number") {
        return encode(BigInt(x))
    } else if (x < 0n) {
        throw new RangeError(`Unexpected negative number: ${x}`)
    } else if (x == 0n) {
        return [0]
    } else {
        const res: number[] = []

        while (x > 0n) {
            res.unshift(Number(x % 256n))

            x = x / 256n
        }

        return res
    }
}