import { Data, Effect, Either } from "effect"
import * as BigEndian from "./internal/BigEndian.js"
import * as Bytes from "./internal/Bytes.js"
import * as Float from "./internal/Float.js"
import * as Utf8 from "./internal/Utf8.js"

export type Decoder<T> = (
  stream: Bytes.Stream
) => Effect.Effect<T, Bytes.EndOfStreamError | DecodeError>

export type IndexedDecoder<T> = (
  stream: Bytes.Stream,
  index: number
) => Effect.Effect<T, Bytes.EndOfStreamError | DecodeError>

export type DecodeEffect<T> = Effect.Effect<
  T,
  Bytes.EndOfStreamError | DecodeError
>
export type PeekEffect<T> = Effect.Effect<T, Bytes.EndOfStreamError>

const FALSE_BYTE = 244 // m = 7, n = 20
const TRUE_BYTE = 245 // m = 7, n = 21

export class DecodeError extends Data.TaggedError("Cbor.DecodeError")<{
  message: string
}> {
  constructor(_stream: Bytes.Stream, message: string) {
    super({ message: message })
  }
}

/**
 * Decodes a CBOR encoded `boolean`.
 * Throws an error if the next element in bytes isn't a `boolean`.
 * @param bytes
 * @returns
 */
export const decodeBool = (bytes: Bytes.BytesLike): DecodeEffect<boolean> =>
  Effect.gen(function* () {
    const stream = Bytes.makeStream(bytes)

    const b = yield* stream.shiftOne()

    if (b == TRUE_BYTE) {
      return true
    } else if (b == FALSE_BYTE) {
      return false
    } else {
      return yield* new DecodeError(
        stream,
        "unexpected non-boolean cbor object"
      )
    }
  })

/**
 * Encodes a `boolean` into its CBOR representation.
 * @param b
 * @returns
 */
export function encodeBool(b: boolean): number[] {
  if (b) {
    return [TRUE_BYTE]
  } else {
    return [FALSE_BYTE]
  }
}

/**
 * @param bytes
 * @returns
 */
export const isBool = (bytes: Bytes.BytesLike): PeekEffect<boolean> =>
  Bytes.makeStream(bytes)
    .peekOne()
    .pipe(Effect.map((head) => head == FALSE_BYTE || head == TRUE_BYTE))

/**
 * Unwraps a CBOR encoded list of bytes
 * @param bytes
 * cborbytes, mutated to form remaining
 * @returns byteArray
 */
export const decodeBytes = (bytes: Bytes.BytesLike): DecodeEffect<number[]> =>
  Effect.gen(function* () {
    const stream = Bytes.makeStream(bytes)

    if (yield* isIndefBytes(bytes)) {
      yield* stream.shiftOne()

      // multiple chunks

      let res: number[] = []

      while ((yield* stream.peekOne()) != 255) {
        const [, n] = yield* decodeDefHead(stream)
        if (n > 64n) {
          return yield* new DecodeError(stream, "Bytearray chunk too large")
        }

        res = res.concat(yield* stream.shiftMany(Number(n)))
      }

      if ((yield* stream.shiftOne()) != 255) {
        throw new Error("invalid indef bytes termination byte")
      }

      return res
    } else {
      const [m, n] = yield* decodeDefHead(stream)

      if (m != 2) {
        return yield* new DecodeError(stream, "Invalid def bytes")
      }

      return yield* stream.shiftMany(Number(n))
    }
  })

/**
 * Wraps a list of bytes using CBOR. Optionally splits the bytes into chunks.
 * @example
 * bytesToHex(Cbor.encodeBytes("4d01000033222220051200120011")) == "4e4d01000033222220051200120011"
 * @param bytes
 * @param splitIntoChunks
 * @returns
 * cbor bytes
 */
export function encodeBytes(
  bytes: string | number[] | Uint8Array,
  splitIntoChunks: boolean = false
): number[] {
  bytes = Bytes.toArray(bytes).slice()

  if (bytes.length <= 64 || !splitIntoChunks) {
    const head = encodeDefHead(2, BigInt(bytes.length))
    return head.concat(bytes)
  } else {
    let res = encodeIndefHead(2)

    while (bytes.length > 0) {
      const chunk = bytes.splice(0, 64)

      res = res.concat(encodeDefHead(2, BigInt(chunk.length))).concat(chunk)
    }

    res.push(255)

    return res
  }
}

/**
 * @param bytes
 * @returns
 */
export const isBytes = (bytes: Bytes.BytesLike): PeekEffect<boolean> =>
  peekMajorType(bytes).pipe(Effect.map((m) => m == 2))

/**
 * @param bytes
 * @returns
 */
export const isDefBytes = (bytes: Bytes.BytesLike): PeekEffect<boolean> =>
  Effect.gen(function* () {
    const stream = Bytes.makeStream(bytes)

    const m = yield* peekMajorType(stream)

    return m == 2 && (yield* stream.peekOne()) != 2 * 32 + 31
  })

/**
 * @param bytes
 * @returns
 */
export const isIndefBytes = (bytes: Bytes.BytesLike): PeekEffect<boolean> =>
  Bytes.makeStream(bytes)
    .peekOne()
    .pipe(Effect.map((head) => head == 2 * 32 + 31))

/**
 * The homogenous field type case is used by the uplc ConstrData (undetermined number of UplcData items)
 * @template Decoders
 * Note: the conditional tuple check loses the tupleness if we just check against array, hence first we check against a tuple, and then an array (needed for the empty case)
 * @param fieldDecoder
 * Array for heterogenous item types, single function for homogenous item types
 * @returns
 */
export const decodeConstr =
  <
    Decoders extends
      | [Decoder<any>, ...Decoder<any>[]]
      | Array<Decoder<any>>
      | Decoder<any>
  >(
    fieldDecoder: Decoders extends [Decoder<any>, ...Decoder<any>[]]
      ? [...Decoders]
      : Decoders extends Array<any>
        ? [...Decoders]
        : Decoders
  ) =>
  (
    bytes: Bytes.BytesLike
  ): DecodeEffect<
    [
      number,
      Decoders extends Array<any>
        ? {
            [D in keyof Decoders]: Decoders[D] extends Decoder<infer T>
              ? T
              : never
          }
        : Decoders extends Decoder<infer T>
          ? T[]
          : never
    ]
  > =>
    Effect.gen(function* () {
      const stream = Bytes.makeStream(bytes)

      const tag = yield* decodeConstrTag(stream)

      const res: any[] = yield* decodeList(
        (itemStream: Bytes.Stream, i: number) =>
          Effect.gen(function* () {
            if (Array.isArray(fieldDecoder)) {
              const decoder: Decoder<any> | undefined = fieldDecoder[i]

              if (decoder === undefined) {
                return yield* new DecodeError(
                  stream,
                  `expected ${fieldDecoder.length} fields, got more than ${i}`
                )
              }

              // eslint-disable-next-line @typescript-eslint/no-unsafe-return
              return yield* decoder(itemStream)
            } else {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-return
              return yield* fieldDecoder(itemStream)
            }
          })
      )(stream)

      if (Array.isArray(fieldDecoder)) {
        if (res.length < fieldDecoder.length) {
          return yield* new DecodeError(
            stream,
            `expected ${fieldDecoder.length} fields, only got ${res.length}`
          )
        }
      }

      return [tag, res] as [
        number,
        Decoders extends Array<any>
          ? {
              [D in keyof Decoders]: Decoders[D] extends Decoder<infer T>
                ? T
                : never
            }
          : Decoders extends Decoder<infer T>
            ? T[]
            : never
      ]
    })

/**
 * @param bytes
 * @returns
 */
export const decodeConstrLazy = (
  bytes: Bytes.BytesLike
): DecodeEffect<[number, <T>(itemDecoder: Decoder<T>) => DecodeEffect<T>]> =>
  Effect.gen(function* () {
    const stream = Bytes.makeStream(bytes)
    const tag = yield* decodeConstrTag(stream)
    const decodeField = yield* decodeListLazy(bytes)

    return [tag, decodeField] as [number, typeof decodeField]
  })

/**
 * @param bytes
 * @returns
 */
const decodeConstrTag = (bytes: Bytes.BytesLike): DecodeEffect<number> =>
  Effect.gen(function* () {
    const stream = Bytes.makeStream(bytes)

    // constr
    const [m, n] = yield* decodeDefHead(stream)

    if (m != 6) {
      return yield* new DecodeError(stream, "Unexpected constr tag head")
    }

    if (n < 102n) {
      return yield* new DecodeError(
        stream,
        `unexpected encoded constr tag ${n}`
      )
    } else if (n == 102n) {
      const [mCheck, nCheck] = yield* decodeDefHead(stream)
      if (mCheck != 4 || nCheck != 2n) {
        return yield* new DecodeError(
          stream,
          "Unexpected constr tag nested head"
        )
      }

      return Number(yield* decodeInt(stream))
    } else if (n < 121n) {
      return yield* new DecodeError(
        stream,
        `unexpected encoded constr tag ${n}`
      )
    } else if (n <= 127n) {
      return Number(n - 121n)
    } else if (n < 1280n) {
      return yield* new DecodeError(
        stream,
        `unexpected encoded constr tag ${n}`
      )
    } else if (n <= 1400n) {
      return Number(n - 1280n + 7n)
    } else {
      return yield* new DecodeError(
        stream,
        `unexpected encoded constr tag ${n}`
      )
    }
  })

/**
 * Note: internally the indef list format is used if the number of fields is > 0, if the number of fields is 0 the def list format is used
 *   see [well-typed/cborg/serialise/src/Codec/Serialise/Class.hs](https://github.com/well-typed/cborg/blob/4bdc818a1f0b35f38bc118a87944630043b58384/serialise/src/Codec/Serialise/Class.hs#L181).
 * @param tag
 * @param fields
 * @returns
 */
export function encodeConstr(
  tag: number,
  fields: readonly number[][]
): number[] {
  return encodeConstrTag(tag).concat(encodeList(fields))
}

/**
 * Encode a constructor tag of a ConstrData type
 * @param tag
 * @returns
 * @throws
 * If the tag is negative or not a whole number
 */
function encodeConstrTag(tag: number): number[] {
  if (tag < 0 || tag % 1.0 != 0.0) {
    throw new Error("invalid tag")
  } else if (tag >= 0 && tag <= 6) {
    return encodeDefHead(6, 121n + BigInt(tag))
  } else if (tag >= 7 && tag <= 127) {
    return encodeDefHead(6, 1280n + BigInt(tag - 7))
  } else {
    return encodeDefHead(6, 102n)
      .concat(encodeDefHead(4, 2n))
      .concat(encodeInt(BigInt(tag)))
  }
}

/**
 * @param bytes
 * @returns
 */
export const isConstr = (bytes: Bytes.BytesLike): PeekEffect<boolean> =>
  decodeDefHead(Bytes.makeStream(bytes).copy()).pipe(
    Effect.map(([m, n]) => {
      if (m == 6) {
        return (
          n == 102n || (n >= 121n && n <= 127n) || (n >= 1280n && n <= 1400n)
        )
      } else {
        return false
      }
    }),
    Effect.catchTag("Cbor.DecodeError", () => {
      return Effect.succeed(false)
    })
  )

const FLOAT16_HEAD = 249
const FLOAT32_HEAD = 250
const FLOAT64_HEAD = 251

/**
 * @param bytes
 * @returns
 */
export const decodeFloat = (bytes: Bytes.BytesLike): DecodeEffect<number> =>
  Effect.gen(function* () {
    const stream = Bytes.makeStream(bytes)

    const head = yield* stream.shiftOne()

    switch (head) {
      case FLOAT16_HEAD:
        return yield* Either.mapLeft(
          Float.decodeFloat16(yield* stream.shiftMany(2)),
          (e) =>
            new DecodeError(stream, `failed to decode float16 (${e.message})`)
        )
      case FLOAT32_HEAD:
        return yield* Either.mapLeft(
          Float.decodeFloat32(yield* stream.shiftMany(4)),
          (e) =>
            new DecodeError(stream, `failed to decode float32 (${e.message})`)
        )
      case FLOAT64_HEAD:
        return yield* Either.mapLeft(
          Float.decodeFloat64(yield* stream.shiftMany(8)),
          (e) =>
            new DecodeError(stream, `faild to decode float64 (${e.message})`)
        )
      default:
        return yield* new DecodeError(stream, "invalid float header")
    }
  })

/**
 * @param bytes
 * @returns
 */
export const decodeFloat16 = (bytes: Bytes.BytesLike): DecodeEffect<number> =>
  Effect.gen(function* () {
    const stream = Bytes.makeStream(bytes)

    const head = yield* stream.shiftOne()

    if (head != FLOAT16_HEAD) {
      return yield* new DecodeError(stream, "invalid Float16 header")
    }

    return yield* Either.mapLeft(
      Float.decodeFloat16(yield* stream.shiftMany(2)),
      (e) => new DecodeError(stream, `failed to decode float16 (${e.message})`)
    )
  })

/**
 * @param bytes
 * @returns
 */
export const decodeFloat32 = (bytes: Bytes.BytesLike): DecodeEffect<number> =>
  Effect.gen(function* () {
    const stream = Bytes.makeStream(bytes)

    const head = yield* stream.shiftOne()

    if (head != FLOAT32_HEAD) {
      return yield* new DecodeError(stream, "invalid Float32 header")
    }

    return yield* Either.mapLeft(
      Float.decodeFloat32(yield* stream.shiftMany(4)),
      (e) => new DecodeError(stream, `failed to decode float32 (${e.message})`)
    )
  })

/**
 * @param bytes
 * @returns
 */
export const decodeFloat64 = (bytes: Bytes.BytesLike): DecodeEffect<number> =>
  Effect.gen(function* () {
    const stream = Bytes.makeStream(bytes)

    const head = yield* stream.shiftOne()

    if (head != FLOAT64_HEAD) {
      return yield* new DecodeError(stream, "invalid Float64 header")
    }

    return yield* Either.mapLeft(
      Float.decodeFloat64(yield* stream.shiftMany(8)),
      (e) => new DecodeError(stream, `failed to decode float32 (${e.message})`)
    )
  })

/**
 * @param f
 * @returns
 */
export function encodeFloat16(f: number): number[] {
  return [FLOAT16_HEAD].concat(Float.encodeFloat16(f))
}

/**
 * @param f
 * @returns
 */
export function encodeFloat32(f: number): number[] {
  return [FLOAT32_HEAD].concat(Float.encodeFloat32(f))
}

/**
 * @param f
 * @returns
 */
export function encodeFloat64(f: number): number[] {
  return [FLOAT64_HEAD].concat(Float.encodeFloat64(f))
}

/**
 * @param bytes
 * @returns
 */
export const isFloat = (bytes: Bytes.BytesLike): PeekEffect<boolean> =>
  Bytes.makeStream(bytes)
    .peekOne()
    .pipe(
      Effect.map(
        (head) =>
          head == FLOAT16_HEAD || head == FLOAT32_HEAD || head == FLOAT64_HEAD
      )
    )

/**
 * @param bytes
 * @returns
 */
export const isFloat16 = (bytes: Bytes.BytesLike): PeekEffect<boolean> =>
  Bytes.makeStream(bytes)
    .peekOne()
    .pipe(Effect.map((head) => head == FLOAT16_HEAD))

/**
 * @param bytes
 * @returns
 */
export const isFloat32 = (bytes: Bytes.BytesLike): PeekEffect<boolean> =>
  Bytes.makeStream(bytes)
    .peekOne()
    .pipe(Effect.map((head) => head == FLOAT32_HEAD))

/**
 * @param bytes
 * @returns
 */
export const isFloat64 = (bytes: Bytes.BytesLike): PeekEffect<boolean> =>
  Bytes.makeStream(bytes)
    .peekOne()
    .pipe(Effect.map((head) => head == FLOAT64_HEAD))

/**
 * @param b0
 * @returns
 */
function decodeFirstHeadByte(b0: number): [number, number] {
  const m = Math.trunc(b0 / 32)
  const n0 = b0 % 32

  return [m, n0]
}

/**
 * @param bytes
 * @returns
 * [majorType, n]
 */
export const decodeDefHead = (
  bytes: Bytes.BytesLike
): DecodeEffect<[number, bigint]> =>
  Effect.gen(function* () {
    const stream = Bytes.makeStream(bytes)

    if (stream.isAtEnd()) {
      return yield* new DecodeError(stream, "Empty CBOR head")
    }

    const first = yield* stream.shiftOne()

    const [m, n0] = decodeFirstHeadByte(first)

    if (n0 <= 23) {
      return [m, BigInt(n0)]
    } else if (n0 == 24) {
      const l = yield* decodeIntInternal(stream, 1)

      return [m, l]
    } else if (n0 == 25) {
      if (m == 7) {
        return yield* new DecodeError(
          stream,
          "Unexpected float16 (hint: decode float16 by calling decodeFloat16 directly)"
        )
      }

      const n = yield* decodeIntInternal(stream, 2)
      return [m, n]
    } else if (n0 == 26) {
      if (m == 7) {
        return yield* new DecodeError(
          stream,
          "Unexpected float32 (hint: decode float32 by calling decodeFloat32 directly)"
        )
      }

      return [m, yield* decodeIntInternal(stream, 4)]
    } else if (n0 == 27) {
      if (m == 7) {
        return yield* new DecodeError(
          stream,
          "Unexpected float64 (hint: decode float64 by calling decodeFloat64 directly)"
        )
      }

      return [m, yield* decodeIntInternal(stream, 8)]
    } else if ((m == 2 || m == 3 || m == 4 || m == 5 || m == 7) && n0 == 31) {
      // head value 31 is used an indefinite length marker for 2,3,4,5,7 (never for 0,1,6)
      return yield* new DecodeError(
        stream,
        `Unexpected header m=${m} n0=${n0} (expected def instead of indef)`
      )
    } else {
      return yield* new DecodeError(stream, "Bad CBOR header")
    }
  })

/**
 * @param m major type
 * @param n size parameter
 * @returns uint8 bytes
 * @throws
 * If n is out of range (i.e. very very large)
 */
export function encodeDefHead(m: number, n: number | bigint): number[] {
  if (n <= 23n) {
    return [32 * m + Number(n)]
  } else if (n >= 24n && n <= 255n) {
    return [32 * m + 24, Number(n)]
  } else if (n >= 256n && n <= 256n * 256n - 1n) {
    return [
      32 * m + 25,
      Number((BigInt(n) / 256n) % 256n),
      Number(BigInt(n) % 256n)
    ]
  } else if (n >= 256n * 256n && n <= 256n * 256n * 256n * 256n - 1n) {
    const e4 = BigEndian.encode(n)

    while (e4.length < 4) {
      e4.unshift(0)
    }
    return [32 * m + 26].concat(e4)
  } else if (
    n >= 256n * 256n * 256n * 256n &&
    n <= 256n * 256n * 256n * 256n * 256n * 256n * 256n * 256n - 1n
  ) {
    const e8 = BigEndian.encode(n)

    while (e8.length < 8) {
      e8.unshift(0)
    }
    return [32 * m + 27].concat(e8)
  } else {
    throw new Error("n out of range")
  }
}

/**
 * @param m
 * @returns
 */
export function encodeIndefHead(m: number): number[] {
  return [32 * m + 31]
}

/**
 * @param bytes
 * @returns
 */
export const peekMajorType = (bytes: Bytes.BytesLike): PeekEffect<number> =>
  Bytes.makeStream(bytes)
    .peekOne()
    .pipe(Effect.map((head) => Math.trunc(head / 32)))

/**
 * @param bytes
 * @returns
 */
export const peekMajorAndSimpleMinorType = (
  bytes: Bytes.BytesLike
): PeekEffect<[number, number]> =>
  Bytes.makeStream(bytes).peekOne().pipe(Effect.map(decodeFirstHeadByte))

/**
 * Decodes a CBOR encoded bigint integer.
 * @param bytes
 * @returns
 */
export const decodeInt = (bytes: Bytes.BytesLike): DecodeEffect<bigint> =>
  Effect.gen(function* () {
    const stream = Bytes.makeStream(bytes)

    const [m, n] = yield* decodeDefHead(stream)

    if (m == 0) {
      return n
    } else if (m == 1) {
      return -n - 1n
    } else if (m == 6) {
      if (n == 2n) {
        return yield* decodeIntInternal(stream)
      } else if (n == 3n) {
        return -(yield* decodeIntInternal(stream)) - 1n
      } else {
        return yield* new DecodeError(stream, `Unexpected tag m:${m}`)
      }
    } else {
      return yield* new DecodeError(stream, `Unexpected tag m:${m}`)
    }
  })

const decodeIntInternal = (
  stream: Bytes.Stream,
  nBytes: number | undefined = undefined
): DecodeEffect<bigint> => {
  return (
    nBytes === undefined ? decodeBytes(stream) : stream.shiftMany(nBytes)
  ).pipe(
    Effect.map(BigEndian.decode),
    Effect.flatMap((result) => {
      if (result._tag == "Left") {
        return Effect.fail(
          new DecodeError(
            stream,
            `failed to decode BigEndian int (${result.left.message})`
          )
        )
      } else {
        return Effect.succeed(result.right)
      }
    })
  )
}

/**
 * Encodes a bigint integer using CBOR.
 * @param n
 * @returns
 */
export function encodeInt(n: number | bigint): number[] {
  if (typeof n == "number") {
    return encodeInt(BigInt(n))
  } else if (n >= 0n && n <= (2n << 63n) - 1n) {
    return encodeDefHead(0, n)
  } else if (n >= 2n << 63n) {
    return encodeDefHead(6, 2).concat(encodeBytes(BigEndian.encode(n)))
  } else if (n <= -1n && n >= -(2n << 63n)) {
    return encodeDefHead(1, -n - 1n)
  } else {
    return encodeDefHead(6, 3).concat(encodeBytes(BigEndian.encode(-n - 1n)))
  }
}

/**
 * @param bytes
 * @returns
 */
export const isInt = (bytes: Bytes.BytesLike): PeekEffect<boolean> =>
  peekMajorAndSimpleMinorType(bytes).pipe(
    Effect.map(([m, n0]) => {
      if (m == 0 || m == 1) {
        return true
      } else if (m == 6) {
        return n0 == 2 || n0 == 3
      } else {
        return false
      }
    })
  )

/**
 * Decodes a CBOR encoded list.
 * A decoder function is called with the bytes of every contained item (nothing is returning directly).
 * @template T
 * @param itemDecoder
 * @returns
 */
export const decodeList =
  <T>(
    itemDecoder: IndexedDecoder<T>
  ): ((bytes: Bytes.BytesLike) => DecodeEffect<T[]>) =>
  (bytes: Bytes.BytesLike) =>
    Effect.gen(function* () {
      const stream = Bytes.makeStream(bytes)

      const res: T[] = []

      if (yield* isIndefList(stream)) {
        yield* stream.shiftOne()

        let i = 0
        while ((yield* stream.peekOne()) != 255) {
          res.push(yield* itemDecoder(stream, i))
          i++
        }

        const last = yield* stream.shiftOne()
        if (last != 255) {
          return yield* new DecodeError(stream, "Invalid def list head byte")
        }
      } else {
        const [m, n] = yield* decodeDefHead(stream)

        if (m != 4) {
          return yield* new DecodeError(stream, "invalid def list head byte")
        }

        for (let i = 0; i < Number(n); i++) {
          res.push(yield* itemDecoder(stream, i))
        }
      }

      return res
    })

/**
 * @param bytes
 * @returns
 *
 *
 */
export const decodeListLazy = (
  bytes: Bytes.BytesLike
): DecodeEffect<<T>(itemDecoder: IndexedDecoder<T>) => DecodeEffect<T>> =>
  Effect.gen(function* () {
    const stream = Bytes.makeStream(bytes)

    let i = 0
    let done = false
    let checkDone: () => Effect.Effect<void, Bytes.EndOfStreamError>

    if (yield* isIndefList(stream)) {
      yield* stream.shiftOne()

      checkDone = () =>
        Effect.gen(function* () {
          if ((yield* stream.peekOne()) == 255) {
            yield* stream.shiftOne()
            done = true
          }
        })
    } else {
      const [m, n] = yield* decodeDefHead(stream)

      if (m != 4) {
        return yield* new DecodeError(stream, "Unexpected header major type")
      }

      checkDone = () => {
        if (i >= n) {
          done = true
        }

        return Effect.void
      }
    }

    yield* checkDone()

    const decodeItem = <T>(itemDecoder: IndexedDecoder<T>): DecodeEffect<T> =>
      Effect.gen(function* () {
        if (done) {
          return yield* new DecodeError(stream, "end-of-list")
        }

        const res = yield* itemDecoder(stream, i)

        i++

        yield* checkDone()

        return res
      })

    return decodeItem
  })

/**
 * @param bytes
 * @returns
 */
export const decodeListLazyOption = (
  bytes: Bytes.BytesLike
): DecodeEffect<
  <T>(itemDecoder: IndexedDecoder<T>) => DecodeEffect<T | undefined>
> =>
  Effect.gen(function* () {
    const stream = Bytes.makeStream(bytes)

    let i = 0
    let done = false
    let checkDone: () => Effect.Effect<void, Bytes.EndOfStreamError>

    if (yield* isIndefList(stream)) {
      yield* stream.shiftOne()

      checkDone = () =>
        Effect.gen(function* () {
          if ((yield* stream.peekOne()) == 255) {
            yield* stream.shiftOne()
            done = true
          }
        })
    } else {
      const [m, n] = yield* decodeDefHead(stream)

      if (m != 4) {
        return yield* new DecodeError(stream, "Unexpected major type for list")
      }

      checkDone = () => {
        if (i >= n) {
          done = true
        }

        return Effect.void
      }
    }

    yield* checkDone()

    const decodeItem = <T>(
      itemDecoder: IndexedDecoder<T>
    ): DecodeEffect<T | undefined> =>
      Effect.gen(function* () {
        if (done) {
          return undefined
        }

        const res = yield* itemDecoder(stream, i)

        i++

        yield* checkDone()

        return res
      })

    return decodeItem
  })

/**
 * This follows the serialization format that the Haskell input-output-hk/plutus UPLC evaluator (i.e. empty lists use `encodeDefList`, non-empty lists use `encodeIndefList`).
 * See [well-typed/cborg/serialise/src/Codec/Serialise/Class.hs](https://github.com/well-typed/cborg/blob/4bdc818a1f0b35f38bc118a87944630043b58384/serialise/src/Codec/Serialise/Class.hs#L181).
 * @param items already encoded
 * @returns
 */
export function encodeList(items: readonly number[][]): number[] {
  return items.length > 0 ? encodeIndefList(items) : encodeDefList(items)
}

/**
 * @returns
 */
function encodeIndefListStart(): number[] {
  return encodeIndefHead(4)
}

/**
 * @param list
 * @returns
 */
function encodeListInternal(list: readonly number[][]): number[] {
  /**
   * @type {number[]}
   */
  let res: number[] = []
  for (const item of list) {
    res = res.concat(item)
  }

  return res
}

const INDEF_LIST_END = [255]

/**
 * Encodes a list of CBOR encodeable items using CBOR indefinite length encoding.
 * @param list Each item is either already serialized.
 * @returns
 */
export function encodeIndefList(list: readonly number[][]): number[] {
  return encodeIndefListStart()
    .concat(encodeListInternal(list))
    .concat(INDEF_LIST_END)
}

/**
 * @param n
 * @returns
 */
function encodeDefListStart(n: bigint): number[] {
  return encodeDefHead(4, n)
}

/**
 * Encodes a list of CBOR encodeable items using CBOR definite length encoding
 * (i.e. header bytes of the element represent the length of the list).
 * @param items Each item is already serialized
 * @returns
 */
export function encodeDefList(items: readonly number[][]): number[] {
  return encodeDefListStart(BigInt(items.length)).concat(
    encodeListInternal(items)
  )
}

/**
 * @param bytes
 * @returns
 */
export const isList = (bytes: Bytes.BytesLike): PeekEffect<boolean> =>
  peekMajorType(bytes).pipe(Effect.map((m) => m == 4))

/**
 * @param bytes
 * @returns
 */
export const isDefList = (bytes: Bytes.BytesLike): PeekEffect<boolean> =>
  Effect.gen(function* () {
    const stream = Bytes.makeStream(bytes)

    return (
      (yield* peekMajorType(stream)) == 4 &&
      (yield* stream.peekOne()) != 4 * 32 + 31
    )
  })

/**
 * @param bytes
 * @returns
 */
export const isIndefList = (bytes: Bytes.BytesLike): PeekEffect<boolean> =>
  Bytes.makeStream(bytes)
    .peekOne()
    .pipe(Effect.map((head) => head == 4 * 32 + 31))

/**
 * Decodes a CBOR encoded map.
 * Calls a decoder function for each key-value pair (nothing is returned directly).
 *
 * The decoder function is responsible for separating the key from the value,
 * which are simply stored as consecutive CBOR elements.
 * @param keyDecoder
 * @param valueDecoder
 * @returns
 */
export const decodeMap =
  <TKey, TValue>(keyDecoder: Decoder<TKey>, valueDecoder: Decoder<TValue>) =>
  (bytes: Bytes.BytesLike): DecodeEffect<[TKey, TValue][]> =>
    Effect.gen(function* () {
      const stream = Bytes.makeStream(bytes)

      if (yield* isIndefMap(stream)) {
        yield* stream.shiftOne()

        return yield* decodeIndefMap<TKey, TValue>(
          stream,
          keyDecoder,
          valueDecoder
        )
      } else {
        const [m, n] = yield* decodeDefHead(stream)

        if (m != 5) {
          return yield* new DecodeError(stream, "invalid def map")
        }

        return yield* decodeDefMap<TKey, TValue>(
          stream,
          Number(n),
          keyDecoder,
          valueDecoder
        )
      }
    })

/**
 * Internal use only, header already decoded
 * @param stream
 * @param n
 * @param keyDecoder
 * @param valueDecoder
 * @returns
 */
const decodeDefMap = <TKey, TValue>(
  stream: Bytes.Stream,
  n: number,
  keyDecoder: Decoder<TKey>,
  valueDecoder: Decoder<TValue>
): DecodeEffect<[TKey, TValue][]> =>
  Effect.gen(function* () {
    const res: [TKey, TValue][] = []

    for (let i = 0; i < n; i++) {
      res.push([yield* keyDecoder(stream), yield* valueDecoder(stream)])
    }

    return res
  })

/**
 * Used internally, head already decoded
 * @template TKey
 * @template TValue
 * @param stream
 * @param keyDecoder
 * @param valueDecoder
 * @returns
 */
const decodeIndefMap = <TKey, TValue>(
  stream: Bytes.Stream,
  keyDecoder: Decoder<TKey>,
  valueDecoder: Decoder<TValue>
): DecodeEffect<[TKey, TValue][]> =>
  Effect.gen(function* () {
    const res: [TKey, TValue][] = []

    while ((yield* stream.peekOne()) != 255) {
      res.push([yield* keyDecoder(stream), yield* valueDecoder(stream)])
    }

    yield* stream.shiftOne()

    return res
  })

/**
 * Unlike lists, the default serialization format for maps seems to always be the defined format
 * @param pairs already encoded
 * @returns
 */
export function encodeMap(pairs: [number[], number[]][]): number[] {
  return encodeDefMap(pairs)
}

/**
 * Encodes a list of key-value pairs.
 * @param pairs
 * Each key and each value is an already encoded list of CBOR bytes.
 * @returns
 */
export function encodeDefMap(pairs: [number[], number[]][]): number[] {
  return encodeDefHead(5, BigInt(pairs.length)).concat(encodeMapInternal(pairs))
}

/**
 * Encodes a list of key-value pairs using the length undefined format.
 * @param pairs
 * Each key and each value is an already encoded list of CBOR bytes.
 * @returns
 */
export function encodeIndefMap(pairs: [number[], number[]][]): number[] {
  return encodeIndefHead(5).concat(encodeMapInternal(pairs)).concat([255])
}

/**
 * @param pairs already encoded
 * @returns
 */
function encodeMapInternal(pairs: [number[], number[]][]): number[] {
  let res: number[] = []

  for (const pair of pairs) {
    const key = pair[0]
    const value = pair[1]

    res = res.concat(key)
    res = res.concat(value)
  }

  return res
}

/**
 * @param bytes
 * @returns
 */
export const isMap = (bytes: Bytes.BytesLike): PeekEffect<boolean> =>
  peekMajorType(bytes).pipe(Effect.map((m) => m == 5))

/**
 * @param bytes
 * @returns
 */
const isIndefMap = (bytes: Bytes.BytesLike): PeekEffect<boolean> =>
  Bytes.makeStream(bytes)
    .peekOne()
    .pipe(Effect.map((head) => head == 5 * 32 + 31))

const NULL_BYTE = 246 // m = 7, n = 22

/**
 * Checks if next element in `bytes` is a `null`.
 * Throws an error if it isn't.
 * @param bytes
 * @returns
 */
export const decodeNull = (bytes: Bytes.BytesLike): DecodeEffect<null> =>
  Effect.gen(function* () {
    const stream = Bytes.makeStream(bytes)

    const b = yield* stream.shiftOne()

    if (b != NULL_BYTE) {
      return yield* new DecodeError(stream, "not null")
    }

    return null
  })

/**
 * Encode `null` into its CBOR representation.
 * @param _null ignored
 * @returns
 */
export function encodeNull(_null: null = null): number[] {
  return [NULL_BYTE]
}

/**
 * @param bytes
 * @returns
 */
export const isNull = (bytes: Bytes.BytesLike): PeekEffect<boolean> =>
  Bytes.makeStream(bytes)
    .peekOne()
    .pipe(Effect.map((head) => head == NULL_BYTE))

/**
 * Decodes a CBOR encoded object with integer keys.
 * For each field a decoder is called which takes the field index and the field bytes as arguments.
 * @template Decoders
 * @param fieldDecoders
 * @returns
 */
export const decodeObjectIKey =
  <Decoders extends { [key: number]: Decoder<any> }>(fieldDecoders: Decoders) =>
  (
    bytes: Bytes.BytesLike
  ): DecodeEffect<{
    [D in keyof Decoders]+?: Decoders[D] extends Decoder<infer T> ? T : never
  }> => {
    const stream = Bytes.makeStream(bytes)

    const res: Record<number, any> = {}

    return decodeMap(
      () => Effect.succeed(null),
      (pairStream) =>
        Effect.gen(function* () {
          const key = Number(yield* decodeInt(pairStream))

          const decoder: Decoder<any> | undefined = fieldDecoders[key]

          if (decoder === undefined) {
            return yield* new DecodeError(
              pairStream,
              `unhandled object field ${key}`
            )
          }

          /* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */
          res[key] = yield* decoder(pairStream)

          return Effect.void
        })
    )(stream).pipe(
      Effect.map(() => {
        return res as {
          [D in keyof Decoders]+?: Decoders[D] extends Decoder<infer T>
            ? T
            : never
        }
      })
    )
  }

/**
 * Decodes a CBOR encoded object with string keys.
 * For each field a decoder is called which takes the field index and the field bytes as arguments.
 * @template Decoders
 * @param fieldDecoders
 * @returns
 */
export const decodeObjectSKey =
  <Decoders extends { [key: string]: Decoder<any> }>(fieldDecoders: Decoders) =>
  (
    bytes: Bytes.BytesLike
  ): DecodeEffect<{
    [D in keyof Decoders]+?: Decoders[D] extends Decoder<infer T> ? T : never
  }> => {
    const stream = Bytes.makeStream(bytes)

    const res: Record<string, any> = {}

    return decodeMap(
      () => Effect.succeed(null),
      (pairStream) =>
        Effect.gen(function* () {
          const key = yield* decodeString(pairStream)

          const decoder: Decoder<any> | undefined = fieldDecoders[key]

          if (decoder === undefined) {
            return yield* new DecodeError(
              pairStream,
              `unhandled object field ${key}`
            )
          }

          /* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */
          res[key] = yield* decoder(pairStream)

          return Effect.void
        })
    )(stream).pipe(
      Effect.map(() => {
        return res as {
          [D in keyof Decoders]+?: Decoders[D] extends Decoder<infer T>
            ? T
            : never
        }
      })
    )
  }

/**
 * Encodes an object with optional fields using integer keys.
 * @param object
 * A `Map` with integer keys representing the field indices.
 * @returns
 */
export function encodeObjectIKey(
  object: Map<number, number[]> | Record<number, number[]>
): number[] {
  const entries: [number[], number[]][] =
    object instanceof Map
      ? Array.from(object.entries()).map((pair) => [
          encodeInt(pair[0]),
          pair[1]
        ])
      : Object.entries(object).map((pair) => [
          encodeInt(parseInt(pair[0])),
          pair[1]
        ])

  return encodeDefMap(entries)
}

/**
 * Encodes an object with optional fields using string keys.
 * @param object
 * A `Map` with string keys representing the field indices.
 * @returns
 */
export function encodeObjectSKey(
  object: Map<string, number[]> | Record<string, number[]>
): number[] {
  const entries: [number[], number[]][] =
    object instanceof Map
      ? Array.from(object.entries()).map((pair) => [
          encodeString(pair[0]),
          pair[1]
        ])
      : Object.entries(object).map((pair) => [encodeString(pair[0]), pair[1]])

  return encodeDefMap(entries)
}

/**
 * @param bytes
 * @returns
 */
export const isObject = (bytes: Bytes.BytesLike): PeekEffect<boolean> =>
  isMap(bytes)

const SET_TAG = 258n

/**
 * Like a list, but with an optional 258 tag
 * See: https://github.com/Emurgo/cardano-serialization-lib/releases/tag/13.0.0
 * @template T
 * @param itemDecoder
 * @returns
 */
export const decodeSet =
  <T>(itemDecoder: Decoder<T>) =>
  (bytes: Bytes.BytesLike): DecodeEffect<T[]> =>
    Effect.gen(function* () {
      const stream = Bytes.makeStream(bytes)

      if (yield* isTag(stream)) {
        const tag = yield* decodeTag(stream)
        if (tag != SET_TAG) {
          return yield* new DecodeError(
            stream,
            `expected tag ${SET_TAG} for set, got tag ${tag}`
          )
        }
      }

      return yield* decodeList(itemDecoder)(stream)
    })

/**
 * A tagged def list (tag 258n)
 * @param items
 * @returns
 */
export function encodeSet(items: number[][]): number[] {
  return encodeTag(SET_TAG).concat(encodeDefList(items))
}

/**
 * @param bytes
 * @returns
 */
export const isSet = (bytes: Bytes.BytesLike): PeekEffect<boolean> =>
  peekTag(bytes).pipe(Effect.map((t) => t == SET_TAG))

/**
 * @param bytes
 * @returns
 */
export const decodeString = (bytes: Bytes.BytesLike): DecodeEffect<string> =>
  Effect.gen(function* () {
    const stream = Bytes.makeStream(bytes)

    if (yield* isDefList(stream)) {
      let result = ""

      yield* decodeList((itemBytes) =>
        decodeStringInternal(itemBytes).pipe(
          Effect.tap((s) => {
            result += s
          })
        )
      )(stream)

      return result
    } else {
      return yield* decodeStringInternal(stream)
    }
  })

/**
 * @param bytes
 * @returns
 */
const decodeStringInternal = (bytes: Bytes.BytesLike): DecodeEffect<string> =>
  Effect.gen(function* () {
    const stream = Bytes.makeStream(bytes)

    const [m, n] = yield* decodeDefHead(stream)

    if (m !== 3) {
      return yield* new DecodeError(stream, "unexpected")
    }

    return yield* Utf8.decode(yield* stream.shiftMany(Number(n))).pipe(
      Effect.mapError(
        (e) => new DecodeError(stream, `invalid utf8 (${e.message})`)
      )
    )
  })

/**
 * Encodes a Utf8 string into Cbor bytes.
 * Strings can be split into lists with chunks of up to 64 bytes
 * to play nice with Cardano tx metadata constraints.
 * @param str
 * @param split
 * @returns
 */
export function encodeString(str: string, split: boolean = false): number[] {
  const bytes = Bytes.toArray(Utf8.encode(str))

  if (split && bytes.length > 64) {
    const chunks: number[][] = []

    let i = 0
    while (i < bytes.length) {
      // We encode the largest chunk up to 64 bytes
      // that is valid UTF-8
      let maxChunkLength = 64
      let chunk: number[]
      while (true) {
        chunk = bytes.slice(i, i + maxChunkLength)
        if (Utf8.isValid(chunk)) {
          break
        }
        maxChunkLength--
      }

      chunks.push(encodeDefHead(3, BigInt(chunk.length)).concat(chunk))
      i += chunk.length
    }

    return encodeDefList(chunks)
  } else {
    return encodeDefHead(3, BigInt(bytes.length)).concat(bytes)
  }
}

/**
 * @param bytes
 * @returns
 */
export const isString = (bytes: Bytes.BytesLike): PeekEffect<boolean> =>
  peekMajorType(bytes).pipe(Effect.map((m) => m == 3))

/**
 * @param bytes
 * @returns
 */
export const decodeTag = (bytes: Bytes.BytesLike): DecodeEffect<bigint> =>
  Effect.gen(function* () {
    const stream = Bytes.makeStream(bytes)

    const [m, n] = yield* decodeDefHead(stream)

    if (m != 6) {
      return yield* new DecodeError(stream, "unexpected major type for tag")
    }

    return n
  })

/**
 * Unrelated to constructor
 * @param tag
 * @returns
 */
export function encodeTag(tag: number | bigint): number[] {
  if (typeof tag == "number") {
    return encodeTag(BigInt(tag))
  } else if (tag < 0) {
    throw new Error("can't encode negative tag")
  }

  return encodeDefHead(6, tag)
}

/**
 * @param bytes
 * @returns
 */
export const isTag = (bytes: Bytes.BytesLike): PeekEffect<boolean> =>
  peekMajorType(bytes).pipe(Effect.map((m) => m == 6))

/**
 * @param bytes
 * @returns
 */
export const peekTag = (
  bytes: Bytes.BytesLike
): PeekEffect<bigint | undefined> =>
  decodeTag(Bytes.makeStream(bytes).copy()).pipe(
    Effect.catchTag("Cbor.DecodeError", () => Effect.succeed(undefined))
  )

/**
 * @param bytes
 * @returns
 */
export const decodeTagged = (
  bytes: Bytes.BytesLike
): DecodeEffect<[number, <T>(itemDecoder: Decoder<T>) => DecodeEffect<T>]> =>
  Effect.gen(function* () {
    const stream = Bytes.makeStream(bytes)

    if (yield* isList(stream)) {
      const decodeItem = yield* decodeListLazy(stream)

      const tag = Number(yield* decodeItem(decodeInt))

      return [tag, decodeItem]
    } else {
      return yield* decodeConstrLazy(stream)
    }
  })

/**
 * @template Decoders
 * @template OptionalDecoders
 * @param itemDecoders
 * @param optionalDecoders
 * Defaults to empty tuple
 * @returns
 */
export const decodeTuple =
  <
    Decoders extends Array<Decoder<any>>,
    OptionalDecoders extends Array<Decoder<any>>
  >(
    itemDecoders: [...Decoders],
    optionalDecoders: [...OptionalDecoders] | [] = []
  ) =>
  (
    bytes: Bytes.BytesLike
  ): DecodeEffect<
    [
      ...{
        [D in keyof Decoders]: Decoders[D] extends Decoder<infer T> ? T : never
      },
      ...{
        [D in keyof OptionalDecoders]: OptionalDecoders[D] extends Decoder<
          infer T
        >
          ? T | undefined
          : never
      }
    ]
  > =>
    Effect.gen(function* () {
      const stream = Bytes.makeStream(bytes)

      /**
       * decodeList is the right decoder, but has the wrong type interface
       * Cast the result to `any` to avoid type errors
       */
      const res: any[] = yield* decodeList((itemStream, i) =>
        Effect.gen(function* () {
          let decoder: Decoder<any> | undefined = itemDecoders[i]

          if (decoder === undefined) {
            decoder = optionalDecoders[i - itemDecoders.length]

            if (decoder === undefined) {
              return yield* new DecodeError(
                itemStream,
                `expected at most ${
                  itemDecoders.length + optionalDecoders.length
                } items, got more than ${i}`
              )
            }
          }

          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return yield* decoder(itemStream)
        })
      )(stream)

      if (res.length < itemDecoders.length) {
        return yield* new DecodeError(
          stream,
          `expected at least ${itemDecoders.length} items, only got ${res.length}`
        )
      }

      return res as [
        ...{
          [D in keyof Decoders]: Decoders[D] extends Decoder<infer T>
            ? T
            : never
        },
        ...{
          [D in keyof OptionalDecoders]: OptionalDecoders[D] extends Decoder<
            infer T
          >
            ? T | undefined
            : never
        }
      ]
    })

/**
 * @param bytes
 * @returns
 */
export function decodeTupleLazy(
  bytes: Bytes.BytesLike
): DecodeEffect<<T>(itemDecoder: Decoder<T>) => DecodeEffect<T>> {
  return decodeListLazy(bytes)
}

/**
 * @param tuple
 * @returns
 */
export function encodeTuple(tuple: number[][]): number[] {
  return encodeDefList(tuple)
}

/**
 * @param bytes
 * @returns
 */
export function isTuple(bytes: Bytes.BytesLike): PeekEffect<boolean> {
  return isList(bytes)
}
