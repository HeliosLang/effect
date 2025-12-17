import { Encoding } from "effect"
import { encode as encodeIntBE } from "./BigEndian"

export type BytesLike = string | number[] | Uint8Array | Stream

/**
 * Doesn't throw an error if any input number is outside the range [0,256)
 * @param bytes 
 * @returns 
 */
export function makeArray(bytes: string | number[] | Uint8Array | Stream): number[] {
    if (bytes instanceof Uint8Array) {
        return Array.from(bytes)
    } else if (typeof bytes == "string") {
        const result = Encoding.decodeHex(bytes)
        if (result._tag == "Left") {
            throw result.left
        }

        return Array.from(result.right)
    } else if (Array.isArray(bytes)) {
        return bytes
    } else if ("peekRemaining" in bytes) {
        return bytes.peekRemaining()
    } else {
        throw new Error(`Expected BytesLike, got ${bytes}`)
    }
}

/**
 * Doesn't throw an error if any input number is outside the range [0,256)
 * @param bytes
 * @returns
 */
export function makeUint8Array(bytes: string | number[] | Uint8Array | Stream): Uint8Array {
    if (bytes instanceof Uint8Array) {
        return bytes
    } else if (typeof bytes == "string") {
        const result = Encoding.decodeHex(bytes)
        if (result._tag == "Left") {
            throw result.left
        }

        return result.right
    } else if (Array.isArray(bytes)) {
        return Uint8Array.from(bytes)
    } else if ("peekRemaining" in bytes) {
        return bytes.bytes.slice(bytes.pos)
    } else {
        throw new Error(`Expected BytesLike, got ${bytes}`)
    }
}

export interface Stream {
    readonly bytes: Uint8Array
    readonly pos: number
    copy(): Stream
    isAtEnd(): boolean
    peekOne(): number
    peekMany(n: number): number[]
    peekRemaining(): number[]
    shiftOne(): number
    shiftMany(n: number): number[]
    shiftRemaining(): number[]
}

/**
 * @param arg
 * @returns
 */
export function makeStream(arg: string | number[] | Uint8Array | Stream | {bytes: string | number[] | Uint8Array | Stream }): Stream {
    if (arg instanceof StreamImpl) {
        // most common case
        return arg
    } else if (typeof arg == "string" || Array.isArray(arg)) {
        return new StreamImpl(makeUint8Array(arg))
    } else if ("pos" in arg && "bytes" in arg) {
        return arg
    } else if (arg instanceof Uint8Array) {
        return new StreamImpl(arg)
    }

    return makeStream(arg.bytes)
}

class StreamImpl implements Stream {
    readonly bytes: Uint8Array

    pos: number

    /**
     * @param bytes
     * @param pos
     */
    constructor(bytes: Uint8Array, pos: number = 0) {
        this.bytes = bytes
        this.pos = pos
    }

    /**
     * Copy ByteStream so mutations doesn't change original ByteStream
     * @returns
     */
    copy(): Stream {
        return new StreamImpl(this.bytes, this.pos)
    }

    isAtEnd(): boolean {
        return this.pos >= this.bytes.length
    }

    /**
     * @returns 
     * The byte at the current position
     * 
     * @throws
     * If at end
     */
    peekOne(): number {
        if (this.pos < this.bytes.length) {
            return this.bytes[this.pos]
        } else {
            throw new Error("ByteStream is at end")
        }
    }

    /**
     * @param n
     * @returns
     * @throws
     * If at end
     */
    peekMany(n: number): number[] {
        if (n < 0) {
            throw new RangeError(`Unexpected negative n: ${n}`)
        }

        if (this.pos + n <= this.bytes.length) {
            return Array.from(this.bytes.slice(this.pos, this.pos + n))
        } else {
            throw new Error("ByteStream is at end")
        }
    }

    peekRemaining(): number[] {
        return Array.from(this.bytes.slice(this.pos))
    }

    /**
     * @returns 
     * @throws
     * If at end
     */
    shiftOne(): number {
        if (this.pos < this.bytes.length) {
            const b = this.bytes[this.pos]
            this.pos += 1
            return b
        } else {
            throw new Error("ByteStream is at end")
        }
    }

    /**
     * @param n
     * @returns {number[]}
     * @throws
     * If at end
     */
    shiftMany(n: number): number[] {
        if (n < 0) {
            throw new RangeError(`Unexpected negative n: ${n}`)
        }

        if (this.pos + n <= this.bytes.length) {
            const res = Array.from(this.bytes.slice(this.pos, this.pos + n))
            this.pos += n
            return res
        } else {
            throw new Error("ByteStream is at end")
        }
    }

    shiftRemaining(): number[] {
        const res = Array.from(this.bytes.slice(this.pos))
        this.pos = this.bytes.length
        return res
    }
}

/**
 * @param a
 * @param b
 * @param shortestFirst defaults to false (strictly lexicographic comparison)
 * @returns
 * -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compare(a: string | number[] | Uint8Array | Stream, b: string | number[] | Uint8Array | Stream, shortestFirst: boolean = false): -1 | 0 | 1 {
    const la = makeArray(a)
    const lb = makeArray(b)
    const na = la.length
    const nb = lb.length

    if (shortestFirst && na != nb) {
        return na < nb ? -1 : 1
    }

    for (let i = 0; i < Math.min(na, nb); i++) {
        if (la[i] < lb[i]) {
            return -1
        } else if (la[i] > lb[i]) {
            return 1
        }
    }

    if (na != nb) {
        return na < nb ? -1 : 1
    } else {
        return 0
    }
}

/**
 * Used to create dummy hashes for testing
 * @param n
 * @param seed
 * @returns
 */
export function dummy(n: number, seed: number = 0): number[] {
    return pad(encodeIntBE(seed), n).slice(0, n)
}

/**
 * @param a
 * @param b
 * @returns
 */
export function equals(a: string | number[] | Uint8Array | Stream, b: string | number[] | Uint8Array | Stream): boolean {
    return compare(a, b) == 0
}

/**
 * Pad by appending zeroes.
 * If `n < nCurrent`, pad to next multiple of `n`.
 * @param bytes
 * @param n pad length
 * @returns
 * @throws 
 * If pad length is zero or negative
 */
export function pad(bytes: number[], n: number): number[] {
    const nBytes = bytes.length

    if (nBytes == n) {
        return bytes
    } else if (n <= 0) {
        throw new Error(`Invalid pad length (must be > 0, got ${n})`)
    } else if (nBytes % n != 0 || nBytes == 0) {
        // padded to multiple of n
        const nPad = n - (nBytes % n)

        bytes = bytes.concat(new Array(nPad).fill(0))
    }

    return bytes
}

/**
 * Pad by prepending zeroes.
 * Throws an error 
 * @param bytes
 * @param n prepad length
 * @returns
 * @throws
 * If prepad length is zero or negative
 * @throws
 * if bytes.length > n
 */
export function prepad(bytes: number[], n: number) {
    const nBytes = bytes.length

    if (nBytes == n) {
        return bytes
    } else if (n <= 0) {
        throw new Error(`Invalid prepad length (must be > 0, got ${n})`)
    } else if (nBytes > n) {
        throw new Error(
            `Padding goal length smaller than bytes length (${n} < ${nBytes})`
        )
    } else {
        const nPad = n - nBytes

        return new Array(nPad).fill(0).concat(bytes)
    }
}
