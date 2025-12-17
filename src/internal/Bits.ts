import { Either } from "effect"
import * as Bytes from "./Bytes.js"

/**
 * Read non-byte aligned numbers
 */
export interface Reader {
    isAtEnd(): boolean
    moveToByteBoundary(force?: boolean): void
    readBits(n: number): number
    readByte(): number 
}

/**
 * @param bytes
 * @param truncate defaults to true
 * @returns {BitReader}
 */
export function makeReader(bytes: string | number[] | Uint8Array, truncate: boolean = true): Reader {
    return new ReaderImpl(bytes, truncate ?? true)
}


class ReaderImpl implements Reader {
    private readonly view: Uint8Array

    /**
     * bit position, not byte position
     */
    private pos: number

    /**
     * If true then read last bits as low part of number, if false pad with zero bits (only applies when trying to read more bits than there are left )
     */
    private readonly truncate: boolean

    /**
     * @param bytes
     * @param truncate determines behavior when reading too many bits
     */
    constructor(bytes: string | number[] | Uint8Array, truncate: boolean = true) {
        this.view = Bytes.makeUint8Array(bytes)

        this.pos = 0
        this.truncate = truncate
    }

    isAtEnd(): boolean {
        return Math.trunc(this.pos / 8) >= this.view.length
    }

    /**
     * Moves position to next byte boundary
     * @param force
     * If true then move to next byte boundary if already at byte boundary
     */
    moveToByteBoundary(force: boolean = false): void {
        if (this.pos % 8 != 0) {
            let n = 8 - (this.pos % 8)

            void this.readBits(n)
        } else if (force) {
            this.readBits(8)
        }
    }

    /**
     * Reads a number of bits (<= 8) and returns the result as an unsigned number
     * @param n number of bits to read
     * @returns
     * @throws
     * If at end
     * @throws
     * If n is larger than 8
     */
    readBits(n: number): number {
        if (n > 8) {
            throw new RangeError(`Reading more than 1 byte (trying to read ${n} bits)`)
        }

        let leftShift = 0
        if (this.pos + n > this.view.length * 8) {
            const newN = this.view.length * 8 - this.pos

            if (!this.truncate) {
                leftShift = n - newN
            }

            n = newN
        }

        if (n == 0) {
            throw new Error("Bits.Reader is at end")
        }

        // it is assumed we don't need to be at the byte boundary

        let res = 0
        let i0 = this.pos

        for (let i = this.pos + 1; i <= this.pos + n; i++) {
            if (i % 8 == 0) {
                const nPart = i - i0

                res +=
                    mask(this.view[Math.trunc(i / 8) - 1], i0 % 8, 8) <<
                    (n - nPart)

                i0 = i
            } else if (i == this.pos + n) {
                res += mask(this.view[Math.trunc(i / 8)], i0 % 8, i % 8)
            }
        }

        this.pos += n
        return res << leftShift
    }

    /**
     * Reads 8 bits
     * @returns
     */
    readByte(): number {
        return this.readBits(8)
    }
}

/**
 * BitWriter turns a string of '0's and '1's into a list of bytes.
 * Finalization pads the bits using '0*1' if not yet aligned with the byte boundary.
 */
export interface Writer {
    readonly length: number
    finalize(force?: boolean): number[]
    padToByteBoundary(force?: boolean): void
    pop(n: number): string
    writeBits(bitChars: string): Writer
    writeByte(byte: number): Writer
}

/**
 * @returns
 * Writer instance
 */
export function makeWriter() {
    return new WriterImpl()
}

class WriterImpl implements Writer {
    /**
     * Concatenated and padded upon finalization
     */
    private readonly parts: string[]

    /**
     * Number of bits written so far
     */
    private n: number

    constructor() {
        this.parts = []
        this.n = 0
    }

    get length(): number {
        return this.n
    }

    /**
     * Pads the Bits.Writer to align with the byte boundary and returns the resulting bytes.
     * @param force force padding (will add one byte if already aligned)
     * @returns
     */
    finalize(force: boolean = true): number[] {
        this.padToByteBoundary(force)

        const chars = this.parts.join("")

        const bytes = []

        for (let i = 0; i < chars.length; i += 8) {
            const byteChars = chars.slice(i, i + 8)
            const byte = parseInt(byteChars, 2)

            bytes.push(byte)
        }

        return bytes
    }

    /**
     * Add padding to the BitWriter in order to align with the byte boundary.
     * @param force
     * If 'force == true' then 8 bits are added if the Writer is already aligned.
     */
    padToByteBoundary(force: boolean = false): void {
        let nPad = 0
        if (this.n % 8 != 0) {
            nPad = 8 - (this.n % 8)
        } else if (force) {
            nPad = 8
        }

        if (nPad != 0) {
            let padding = new Array(nPad).fill("0")
            padding[nPad - 1] = "1"

            this.parts.push(padding.join(""))

            this.n += nPad
        }
    }

    /**
     * Pop n bits of the end
     * @param n
     * @returns
     */
    pop(n: number): string {
        if (n > this.n) {
            throw new Error(
                `Too many bits to pop, only have ${this.n} bits, but want n=${n}`
            )
        }

        const n0 = n

        const parts: string[] = []

        while (n > 0) {
            const last = this.parts.pop()

            if (last) {
                if (last.length <= n) {
                    parts.unshift(last)
                    n -= last.length
                } else {
                    parts.unshift(last.slice(last.length - n))
                    this.parts.push(last.slice(0, last.length - n))
                    n = 0
                }
            }
        }

        this.n -= n0

        const bits = parts.join("")

        if (bits.length != n0) {
            throw new Error(`Internal error: expected ${n0} bits popped, but popped ${bits.length}`)
        }

        return bits
    }

    /**
     * Write a string of '0's and '1's to the BitWriter.
     * Returns the BitWriter to enable chaining
     * @param bitChars
     * @returns
     * Self so these calls can be chain
     */
    writeBits(bitChars: string): Writer {
        for (let c of bitChars) {
            if (c != "0" && c != "1") {
                throw new Error(
                    `Bit string contains invalid chars: ${bitChars}`
                )
            }
        }

        this.parts.push(bitChars)
        this.n += bitChars.length

        return this
    }

    /**
     * Returns the BitWriter to enable chaining
     * @param byte
     * @returns
     * Self so these calls can be chain
     */
    writeByte(byte: number): Writer {
        if (byte < 0 || byte > 255) {
            throw new Error(`Invalid byte: ${byte}`)
        }

        this.writeBits(pad(byte.toString(2), 8))

        return this
    }
}

/**
 * Converts a 8 bit integer number into a bit string with an optional "0b" prefix.
 * The result is padded with leading zeroes to become 'n' chars long ('2 + n' chars long if you count the "0b" prefix).
 * @example
 * byteToBits(7) == "0b00000111"
 * @param {number} b
 * @param {number} n
 * @param {boolean} prefix
 * @returns {string}
 */
export function fromByte(b: number, n: number = 8, prefix: boolean = true): Either.Either<string, RangeError> {
    if (b < 0 || b > 255) {
        return Either.left(new RangeError(`Invalid byte: ${b}`))
    }

    const bits = b.toString(2)

    if (n < bits.length) {
        return Either.left(new RangeError(`n is smaller than the number of bits: ${n} < ${bits.length}`))
    }

    const s = pad(bits, n)

    if (prefix) {
        return Either.right("0b" + s)
    } else {
        return Either.right(s)
    }
}

/**
 * @param bytes
 * @param i
 * bit index
 * @returns
 * 0 or 1
 */
export function getBit(bytes: number[], i: number): 0 | 1 {
    return ((bytes[Math.floor(i / 8)] >> i % 8) & 1) as 0 | 1
}

const BIT_MASKS = [
    0b11111111, 0b01111111, 0b00111111, 0b00011111, 0b00001111, 0b00000111,
    0b00000011, 0b00000001
]

/**
 * Masks bits of `b` by setting bits outside the range `[i0, i1)` to 0.
 * `b` is an 8 bit integer (i.e. number between 0 and 255).
 * The return value is also an 8 bit integer, shifted right by `i1`.
 * @example
 * maskBits(0b11111111, 1, 4) == 0b0111 // (i.e. 7)
 * @param b
 * @param i0
 * @param i1
 * @returns
 */
export function mask(b: number, i0: number, i1: number): number {
    if (i0 >= i1 || i0 < 0 || i0 > 7 || i1 > 8 || b < 0 || b > 255) {
        throw new RangeError(`Invalid Bits.mask arguments: b=${b}, i0=${i0}, i1=${i1}`)
    }

    return (b & BIT_MASKS[i0]) >> (8 - i1)
}

/**
 * Prepends zeroes to a bit-string so that 'result.length == n'.
 * If `n < nCurrent`, pad to next multiple of `n`.
 * @example
 * padBits("1111", 8) == "00001111"
 * @param bits
 * @param n
 * @returns
 * @throws 
 * If n is zero or negative
 */
export function pad(bits: string, n: number): string {
    const nBits = bits.length

    if (nBits == n) {
        return bits
    } else if (n <= 0) {
        throw new RangeError(`Expected pad length n to be > 0, got n=${n}`)
    } else if (nBits % n != 0) {
        // padded to multiple of n
        const nPad = n - (nBits % n)

        bits = new Array(nPad).fill("0").join("") + bits
    }

    return bits
}
