import { Encoding, Either } from "effect"
import * as Bits from "./Bits.js"

export interface Base32 {
  readonly alphabet: string
  readonly padChar: string
  readonly strict: boolean

  /**
   * @param encoded
   * @returns array of bytes
   */
  decode(encoded: string): Either.Either<Uint8Array, Encoding.DecodeException>

  /**
   * @param encoded
   * @returns array of numbers in range [0,32)
   */
  decodeRaw(encoded: string): Either.Either<number[], Encoding.DecodeException>

  /**
   * @param bytes
   * @returns base32 encoded string
   */
  encode(bytes: string | Uint8Array | number[]): string

  /**
   *
   * @param bytes
   * @returns array of numbers in range [0,32)
   */
  encodeRaw(bytes: string | Uint8Array | number[]): number[]

  /**
   * Checks if encoded bytes are valid base32
   * @param encoded
   */
  isValid(encoded: string): boolean
}

export type Props =
  | {
      alphabet?: string
    }
  | {
      alphabet?: string
      padChar: string
      strict?: boolean
    }

export const DEFAULT_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567" as const

export const DEFAULT_PAD_CHAR = "=" as const

export const DEFAULT_PROPS: Props = {
  alphabet: DEFAULT_ALPHABET,
  padChar: DEFAULT_PAD_CHAR,
  strict: false
}

export const DEFAULT: Base32 = /* @__PURE__ */ make()

/**
 * @param props
 * @returns
 */
export function make(props: Props = DEFAULT_PROPS): Base32 {
  const alphabet = props.alphabet ?? DEFAULT_ALPHABET
  const padChar = "padChar" in props ? props.padChar : ""
  const strict = "strict" in props ? (props.strict ?? false) : false

  if (alphabet.length != 32) {
    throw new Error(
      `Expected base32 alphabet with 32 characters, got ${alphabet.length} characters`
    )
  }

  if (new Set(alphabet.split("")).size != 32) {
    throw new Error(
      "Invalid base32 alphabet, doesn't consist 32 unique characters"
    )
  }

  if ("padChar" in props && padChar.length != 1) {
    throw new Error("Expected single base32 padChar")
  }

  if ("padChar" in props && alphabet.indexOf(padChar) != -1) {
    throw new Error("Base32 padChar can't be part of alphabet")
  }

  return new Base32Impl(alphabet, padChar, strict)
}

class Base32Impl implements Base32 {
  readonly alphabet: string
  readonly padChar: string
  readonly strict: boolean

  constructor(alphabet: string, padChar: string, strict: boolean) {
    this.alphabet = alphabet
    this.padChar = padChar
    this.strict = strict
  }

  /**
   * Decodes a Base32 string into bytes.
   * @param encoded
   * @returns
   */
  decode(encoded: string): Either.Either<Uint8Array, Encoding.DecodeException> {
    const writer = Bits.makeWriter()

    const rawResult = this.decodeRaw(encoded)

    if (rawResult._tag == "Left") {
      return Either.left(rawResult.left)
    }

    const raw = rawResult.right

    const n = raw.length

    raw.forEach((code, i) => {
      if (i == n - 1) {
        // last, make sure we align to byte

        const nCut = n * 5 - 8 * Math.floor((n * 5) / 8)

        const bits = Bits.pad(code.toString(2), 5)

        writer.writeBits(bits.slice(0, 5 - nCut))
      } else {
        const bits = Bits.pad(code.toString(2), 5)

        writer.writeBits(bits)
      }
    })

    const result = writer.finalize(false)

    return Either.right(new Uint8Array(result))
  }

  /**
   * @param encoded
   * @returns array with numbers in range [0,32)
   */
  decodeRaw(
    encoded: string
  ): Either.Either<number[], Encoding.DecodeException> {
    const trimResult = trim(encoded, this.padChar, this.strict)

    if (trimResult._tag == "Left") {
      return Either.left(trimResult.left)
    }

    encoded = trimResult.right

    const n = encoded.length

    const res: number[] = []

    for (let i = 0; i < n; i++) {
      const c = encoded[i]

      if (c == this.padChar) {
        // TODO: yield with Effect
        return Either.left(
          Encoding.DecodeException(
            encoded,
            `Unexpected padding character '${c}' at position ${i}`
          )
        )
      }

      const code = this.alphabet.indexOf(c.toLowerCase())

      if (code < 0) {
        return Either.left(
          Encoding.DecodeException(
            encoded,
            `Invalid base32 character '${c}' at position ${i}`
          )
        )
      } else if (i == n - 1) {
        const nBitsExtra = n * 5 - Math.floor((n * 5) / 8) * 8

        if ((((1 << nBitsExtra) - 1) & code) != 0) {
          return Either.left(
            Encoding.DecodeException(
              encoded,
              `Invalid base32 final character '${c}'`
            )
          )
        }
      }

      res.push(code)
    }

    return Either.right(res)
  }

  /**
   * Encodes bytes in using Base32.
   * @param bytes hex encoded or list of uint8 numbers
   * @returns
   */
  encode(bytes: string | number[] | Uint8Array): string {
    const s = this.encodeRaw(bytes)
      .map((c) => this.alphabet[c])
      .join("")

    const n = s.length

    if (n % 8 != 0 && this.padChar.length != 0) {
      return s + new Array(8 - (n % 8)).fill(this.padChar).join("")
    } else {
      return s
    }
  }

  /**
   * @param bytes
   * @returns {number[]} list of numbers between 0 and 32
   */
  encodeRaw(bytes: string | number[] | Uint8Array): number[] {
    const result: number[] = []

    const reader = Bits.makeReader(bytes, false)

    while (!reader.isAtEnd()) {
      result.push(reader.readBits(5))
    }

    return result
  }

  /**
   * Checks if all the characters in `encoded` are in the given base32 alphabet.
   * Checks lengths if their pad characters at the end
   * @param encoded
   * @returns
   */
  isValid(encoded: string): boolean {
    let n = encoded.length

    if (
      this.padChar.length == 1 &&
      (this.strict || encoded.endsWith(this.padChar))
    ) {
      if (encoded.length % 8 != 0) {
        return false
      }

      const iPad = encoded.indexOf(this.padChar)

      for (let i = iPad + 1; i < n; i++) {
        if (encoded.at(i) != this.padChar) {
          return false
        }
      }

      const nPad = n - iPad

      if (nPad != 6 && nPad != 4 && nPad != 3 && nPad != 1) {
        return false
      }

      encoded = encoded.slice(0, iPad)

      n = iPad
    }

    // the last char can't be any possible number

    return encoded.split("").every((c, i) => {
      const code = this.alphabet.indexOf(c.toLowerCase())

      if (code < 0) {
        return false
      }

      if (i == n - 1) {
        const nBitsExtra = n * 5 - Math.floor((n * 5) / 8) * 8

        return (((1 << nBitsExtra) - 1) & code) == 0
      } else {
        return true
      }
    })
  }
}

/**
 * Trims the padding, asserting it is correctly formed
 * @param encoded
 * @param padChar
 * @returns
 */
function trim(
  encoded: string,
  padChar: string,
  strict: boolean
): Either.Either<string, Encoding.DecodeException> {
  if (padChar.length == 1) {
    let n = encoded.length

    while (n >= 0 && encoded.at(n - 1) == padChar) {
      n -= 1
    }

    // length alignment is only checked if there are some padding characters at the end
    if ((strict || n < encoded.length) && encoded.length % 8 != 0) {
      return Either.left(
        Encoding.DecodeException(
          encoded,
          "Invalid length (expected multiple of 8)"
        )
      )
    }

    const nPad = encoded.length - n

    if (nPad != 0) {
      if (nPad != 6 && nPad != 4 && nPad != 3 && nPad != 1) {
        return Either.left(
          Encoding.DecodeException(
            encoded,
            "Invalid number of base32 padding characters"
          )
        )
      }
    }

    return Either.right(encoded.slice(0, n))
  } else {
    return Either.right(encoded)
  }
}
