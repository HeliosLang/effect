import { Data, Either } from "effect"
import * as BigEndian from "./internal/BigEndian.js"
import * as Bytes from "./internal/Bytes.js"
import * as Float from "./internal/Float.js"
import * as Utf8 from "./internal/Utf8.js"

export type Decoder<T> = (
  stream: Bytes.Stream
) => Either.Either<T, Bytes.EndOfStreamError | DecodeError>

export type IndexedDecoder<T> = (
  stream: Bytes.Stream,
  index: number
) => Either.Either<T, Bytes.EndOfStreamError | DecodeError>

export type DecodeResult<T> = Either.Either<
  T,
  Bytes.EndOfStreamError | DecodeError
>

export type PeekResult<T> = Either.Either<T, Bytes.EndOfStreamError>

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
export const decodeBool = (bytes: Bytes.BytesLike): DecodeResult<boolean> => {
  const stream = Bytes.makeStream(bytes)

  return stream.shiftOne().pipe(
    Either.flatMap((b) => {
      if (b == TRUE_BYTE) {
        return Either.right(true)
      } else if (b == FALSE_BYTE) {
        return Either.right(false)
      } else {
        return Either.left(
          new DecodeError(stream, "unexpected non-boolean cbor object")
        )
      }
    })
  )
}

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
export const isBool = (bytes: Bytes.BytesLike): boolean => {
  const head = Bytes.makeStream(bytes).peekOne()

  if (Either.isLeft(head)) {
    return false
  }

  return head.right == FALSE_BYTE || head.right == TRUE_BYTE
}

const decodeIndefBytes = (stream: Bytes.Stream): DecodeResult<number[]> =>
  Either.gen(function* () {
    yield* stream.shiftOne()

    // multiple chunks

    let res: number[] = []

    let next = yield* stream.peekOne()

    while (next != 255) {
      const [, n] = yield* decodeDefHead(stream)

      if (n > 64n) {
        return yield* Either.left(
          new DecodeError(stream, "Bytearray chunk too large")
        )
      }

      const chunk = yield* stream.shiftMany(Number(n))

      res = res.concat(chunk)

      next = yield* stream.peekOne()
    }

    const last = yield* stream.shiftOne()

    if (last != 255) {
      return yield* Either.left(
        new DecodeError(stream, "invalid indef bytes termination byte")
      )
    }

    return res
  })

const decodeDefBytes = (stream: Bytes.Stream): DecodeResult<number[]> =>
  decodeDefHead(stream).pipe(
    Either.flatMap(([m, n]): DecodeResult<number[]> => {
      if (m != 2) {
        return Either.left(new DecodeError(stream, "Invalid def bytes"))
      }

      return stream.shiftMany(Number(n))
    })
  )

/**
 * Unwraps a CBOR encoded list of bytes
 * @param bytes
 * cborbytes, mutated to form remaining
 * @returns byteArray
 */
export const decodeBytes = (bytes: Bytes.BytesLike): DecodeResult<number[]> => {
  const stream = Bytes.makeStream(bytes)

  if (isIndefBytes(bytes)) {
    return decodeIndefBytes(stream)
  } else {
    return decodeDefBytes(stream)
  }
}

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
export const isBytes = (bytes: Bytes.BytesLike): boolean => {
  const m = peekMajorType(bytes)

  if (Either.isLeft(m)) {
    return false
  }

  return m.right == 2
}

/**
 * @param bytes
 * @returns
 */
export const isDefBytes = (bytes: Bytes.BytesLike): boolean => {
  const stream = Bytes.makeStream(bytes)

  const m = peekMajorType(stream)

  if (Either.isLeft(m)) {
    return false
  }

  const n = stream.peekOne()

  if (Either.isLeft(n)) {
    return false
  }

  return m.right == 2 && n.right != 2 * 32 + 31
}

/**
 * @param bytes
 * @returns
 */
export const isIndefBytes = (bytes: Bytes.BytesLike): boolean => {
  const head = Bytes.makeStream(bytes).peekOne()

  if (Either.isLeft(head)) {
    return false
  }

  return head.right == 2 * 32 + 31
}

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
  ): DecodeResult<
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
    Either.gen(function* () {
      const stream = Bytes.makeStream(bytes)

      const tag = yield* decodeConstrTag(stream)

      const res: any[] = yield* decodeList(
        (itemStream: Bytes.Stream, i: number) => {
          if (Array.isArray(fieldDecoder)) {
            const decoder: Decoder<any> | undefined = fieldDecoder[i]

            if (decoder === undefined) {
              return Either.left(
                new DecodeError(
                  stream,
                  `expected ${fieldDecoder.length} fields, got more than ${i}`
                )
              )
            }

            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return decoder(itemStream)
          } else {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return fieldDecoder(itemStream)
          }
        }
      )(stream)

      if (Array.isArray(fieldDecoder)) {
        if (res.length < fieldDecoder.length) {
          return yield* Either.left(
            new DecodeError(
              stream,
              `expected ${fieldDecoder.length} fields, only got ${res.length}`
            )
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
): DecodeResult<[number, <T>(itemDecoder: Decoder<T>) => DecodeResult<T>]> => {
  const stream = Bytes.makeStream(bytes)

  return Either.zipWith(
    decodeConstrTag(stream),
    decodeListLazy(bytes),
    (tag, decodeField) => [tag, decodeField] as [number, any]
  )
}

/**
 * @param bytes
 * @returns
 */
const decodeConstrTag = (bytes: Bytes.BytesLike): DecodeResult<number> => {
  const stream = Bytes.makeStream(bytes)

  // constr
  const head = decodeDefHead(stream)

  if (Either.isLeft(head)) {
    return Either.left(head.left)
  }

  const [m, n] = head.right

  if (m != 6) {
    return Either.left(new DecodeError(stream, "Unexpected constr tag head"))
  }

  if (n < 102n) {
    return Either.left(
      new DecodeError(stream, `unexpected encoded constr tag ${n}`)
    )
  } else if (n == 102n) {
    const check = decodeDefHead(stream)

    if (Either.isLeft(check)) {
      return Either.left(check.left)
    }

    const [mCheck, nCheck] = check.right

    if (mCheck != 4 || nCheck != 2n) {
      return Either.left(
        new DecodeError(stream, "Unexpected constr tag nested head")
      )
    }

    return decodeInt(stream).pipe(Either.map(Number))
  } else if (n < 121n) {
    return Either.left(
      new DecodeError(stream, `unexpected encoded constr tag ${n}`)
    )
  } else if (n <= 127n) {
    return Either.right(Number(n - 121n))
  } else if (n < 1280n) {
    return Either.left(
      new DecodeError(stream, `unexpected encoded constr tag ${n}`)
    )
  } else if (n <= 1400n) {
    return Either.right(Number(n - 1280n + 7n))
  } else {
    return Either.left(
      new DecodeError(stream, `unexpected encoded constr tag ${n}`)
    )
  }
}

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
export const isConstr = (bytes: Bytes.BytesLike): boolean => {
  const head = decodeDefHead(Bytes.makeStream(bytes).copy())

  if (Either.isLeft(head)) {
    return false
  }

  const [m, n] = head.right

  if (m != 6) {
    return false
  }

  return n == 102n || (n >= 121n && n <= 127n) || (n >= 1280n && n <= 1400n)
}

const FLOAT16_HEAD = 249
const FLOAT32_HEAD = 250
const FLOAT64_HEAD = 251

const decodeFloat16Body = (stream: Bytes.Stream): DecodeResult<number> =>
  stream.shiftMany(2).pipe(
    Either.flatMap(Float.decodeFloat16),
    Either.mapLeft((e) => {
      return e._tag == "DecodeException"
        ? new DecodeError(stream, `failed to decode float16 (${e.message})`)
        : e
    })
  )

const decodeFloat32Body = (stream: Bytes.Stream): DecodeResult<number> =>
  stream.shiftMany(4).pipe(
    Either.flatMap(Float.decodeFloat32),
    Either.mapLeft((e) => {
      return e._tag == "DecodeException"
        ? new DecodeError(stream, `failed to decode float32 (${e.message})`)
        : e
    })
  )

const decodeFloat64Body = (stream: Bytes.Stream): DecodeResult<number> =>
  stream.shiftMany(8).pipe(
    Either.flatMap(Float.decodeFloat64),
    Either.mapLeft((e) => {
      return e._tag == "DecodeException"
        ? new DecodeError(stream, `failed to decode float64 (${e.message})`)
        : e
    })
  )

/**
 * @param bytes
 * @returns
 */
export const decodeFloat = (bytes: Bytes.BytesLike): DecodeResult<number> => {
  const stream = Bytes.makeStream(bytes)

  return stream.shiftOne().pipe(
    Either.flatMap((head) => {
      switch (head) {
        case FLOAT16_HEAD:
          return decodeFloat16Body(stream)
        case FLOAT32_HEAD:
          return decodeFloat32Body(stream)
        case FLOAT64_HEAD:
          return decodeFloat64Body(stream)
        default:
          return Either.left(new DecodeError(stream, "invalid float header"))
      }
    })
  )
}

/**
 * @param bytes
 * @returns
 */
export const decodeFloat16 = (bytes: Bytes.BytesLike): DecodeResult<number> => {
  const stream = Bytes.makeStream(bytes)

  return stream.shiftOne().pipe(
    Either.flatMap((head) => {
      if (head != FLOAT16_HEAD) {
        return Either.left(new DecodeError(stream, "invalid Float16 header"))
      }

      return decodeFloat16Body(stream)
    })
  )
}

/**
 * @param bytes
 * @returns
 */
export const decodeFloat32 = (bytes: Bytes.BytesLike): DecodeResult<number> => {
  const stream = Bytes.makeStream(bytes)

  return stream.shiftOne().pipe(
    Either.flatMap((head) => {
      if (head != FLOAT32_HEAD) {
        return Either.left(new DecodeError(stream, "invalid Float32 header"))
      }

      return decodeFloat32Body(stream)
    })
  )
}

/**
 * @param bytes
 * @returns
 */
export const decodeFloat64 = (bytes: Bytes.BytesLike): DecodeResult<number> => {
  const stream = Bytes.makeStream(bytes)

  return stream.shiftOne().pipe(
    Either.flatMap((head) => {
      if (head != FLOAT64_HEAD) {
        return Either.left(new DecodeError(stream, "invalid Float64 header"))
      }

      return decodeFloat64Body(stream)
    })
  )
}

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
export const isFloat = (bytes: Bytes.BytesLike): boolean => {
  const head = Bytes.makeStream(bytes).peekOne()

  if (Either.isLeft(head)) {
    return false
  }

  return (
    head.right == FLOAT16_HEAD ||
    head.right == FLOAT32_HEAD ||
    head.right == FLOAT64_HEAD
  )
}

/**
 * @param bytes
 * @returns
 */
export const isFloat16 = (bytes: Bytes.BytesLike): boolean => {
  const head = Bytes.makeStream(bytes).peekOne()

  if (Either.isLeft(head)) {
    return false
  }

  return head.right == FLOAT16_HEAD
}

/**
 * @param bytes
 * @returns
 */
export const isFloat32 = (bytes: Bytes.BytesLike): boolean => {
  const head = Bytes.makeStream(bytes).peekOne()

  if (Either.isLeft(head)) {
    return false
  }

  return head.right == FLOAT32_HEAD
}

/**
 * @param bytes
 * @returns
 */
export const isFloat64 = (bytes: Bytes.BytesLike): boolean => {
  const head = Bytes.makeStream(bytes).peekOne()

  if (Either.isLeft(head)) {
    return false
  }

  return head.right == FLOAT64_HEAD
}

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
): DecodeResult<[number, bigint]> => {
  const stream = Bytes.makeStream(bytes)

  if (stream.isAtEnd()) {
    return Either.left(new DecodeError(stream, "Empty CBOR head"))
  }

  const first = stream.shiftOne()

  if (Either.isLeft(first)) {
    return Either.left(first.left)
  }

  const [m, n0] = decodeFirstHeadByte(first.right)

  if (n0 <= 23) {
    return Either.right([m, BigInt(n0)])
  } else if (n0 == 24) {
    const l = decodeIntInternal(stream, 1)

    if (Either.isLeft(l)) {
      return Either.left(l.left)
    }

    return Either.right([m, l.right])
  } else if (n0 == 25) {
    if (m == 7) {
      return Either.left(
        new DecodeError(
          stream,
          "Unexpected float16 (hint: decode float16 by calling decodeFloat16 directly)"
        )
      )
    }

    const n = decodeIntInternal(stream, 2)

    if (Either.isLeft(n)) {
      return Either.left(n.left)
    }

    return Either.right([m, n.right])
  } else if (n0 == 26) {
    if (m == 7) {
      return Either.left(
        new DecodeError(
          stream,
          "Unexpected float32 (hint: decode float32 by calling decodeFloat32 directly)"
        )
      )
    }

    const n = decodeIntInternal(stream, 4)

    if (Either.isLeft(n)) {
      return Either.left(n.left)
    }

    return Either.right([m, n.right])
  } else if (n0 == 27) {
    if (m == 7) {
      return Either.left(
        new DecodeError(
          stream,
          "Unexpected float64 (hint: decode float64 by calling decodeFloat64 directly)"
        )
      )
    }

    const n = decodeIntInternal(stream, 8)
    if (Either.isLeft(n)) {
      return Either.left(n.left)
    }

    return Either.right([m, n.right])
  } else if ((m == 2 || m == 3 || m == 4 || m == 5 || m == 7) && n0 == 31) {
    // head value 31 is used an indefinite length marker for 2,3,4,5,7 (never for 0,1,6)
    return Either.left(
      new DecodeError(
        stream,
        `Unexpected header m=${m} n0=${n0} (expected def instead of indef)`
      )
    )
  } else {
    return Either.left(new DecodeError(stream, "Bad CBOR header"))
  }
}

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
export const peekMajorType = (bytes: Bytes.BytesLike): PeekResult<number> =>
  Bytes.makeStream(bytes)
    .peekOne()
    .pipe(Either.map((head) => Math.trunc(head / 32)))

/**
 * @param bytes
 * @returns
 */
export const peekMajorAndSimpleMinorType = (
  bytes: Bytes.BytesLike
): PeekResult<[number, number]> =>
  Bytes.makeStream(bytes).peekOne().pipe(Either.map(decodeFirstHeadByte))

/**
 * Decodes a CBOR encoded bigint integer.
 * @param bytes
 * @returns
 */
export const decodeInt = (bytes: Bytes.BytesLike): DecodeResult<bigint> => {
  const stream = Bytes.makeStream(bytes)

  return decodeDefHead(stream).pipe(
    Either.flatMap(([m, n]) => {
      if (m == 0) {
        return Either.right(n)
      } else if (m == 1) {
        return Either.right(-n - 1n)
      } else if (m == 6) {
        if (n == 2n) {
          return decodeIntInternal(stream)
        } else if (n == 3n) {
          return decodeIntInternal(stream).pipe(Either.map((x) => -x - 1n))
        } else {
          return Either.left(new DecodeError(stream, `Unexpected tag m:${m}`))
        }
      } else {
        return Either.left(new DecodeError(stream, `Unexpected tag m:${m}`))
      }
    })
  )
}

const decodeIntInternal = (
  stream: Bytes.Stream,
  nBytes: number | undefined = undefined
): DecodeResult<bigint> => {
  return (
    nBytes === undefined ? decodeBytes(stream) : stream.shiftMany(nBytes)
  ).pipe(
    Either.flatMap(BigEndian.decode),
    Either.mapLeft((e) =>
      e._tag == "DecodeException"
        ? new DecodeError(
            stream,
            `failed to decode BigEndian int (${e.message})`
          )
        : e
    )
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
export const isInt = (bytes: Bytes.BytesLike): boolean => {
  const mn0 = peekMajorAndSimpleMinorType(bytes)

  if (Either.isLeft(mn0)) {
    return false
  }

  const [m, n0] = mn0.right

  if (m == 0 || m == 1) {
    return true
  } else if (m == 6) {
    return n0 == 2 || n0 == 3
  } else {
    return false
  }
}

const decodeIndefList = <T>(
  stream: Bytes.Stream,
  itemDecoder: IndexedDecoder<T>
): DecodeResult<T[]> =>
  Either.gen(function* () {
    const res: T[] = []

    yield* stream.shiftOne()

    let i = 0
    while ((yield* stream.peekOne()) != 255) {
      res.push(yield* itemDecoder(stream, i))
      i++
    }

    const last = yield* stream.shiftOne()
    if (last != 255) {
      return yield* Either.left(
        new DecodeError(stream, "Invalid def list head byte")
      )
    }

    return res
  })

const decodeDefList = <T>(
  stream: Bytes.Stream,
  itemDecoder: IndexedDecoder<T>
): DecodeResult<T[]> =>
  Either.gen(function* () {
    const res: T[] = []

    const [m, n] = yield* decodeDefHead(stream)

    if (m != 4) {
      return yield* Either.left(
        new DecodeError(stream, "invalid def list head byte")
      )
    }

    for (let i = 0; i < Number(n); i++) {
      res.push(yield* itemDecoder(stream, i))
    }

    return res
  })

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
  ): ((bytes: Bytes.BytesLike) => DecodeResult<T[]>) =>
  (bytes: Bytes.BytesLike) => {
    const stream = Bytes.makeStream(bytes)

    if (isIndefList(stream)) {
      return decodeIndefList(stream, itemDecoder)
    } else {
      return decodeDefList(stream, itemDecoder)
    }
  }

const decodeIndefListLazy = <T>(stream: Bytes.Stream) =>
  Either.gen(function* () {
    let i = 0
    let done = false

    yield* stream.shiftOne()

    if ((yield* stream.peekOne()) == 255) {
      yield* stream.shiftOne()
      done = true
    }

    const decodeItem = <T>(itemDecoder: IndexedDecoder<T>) =>
      Either.gen(function* () {
        if (done) {
          return yield* Either.left(new DecodeError(stream, "end-of-list"))
        }

        const res = yield* itemDecoder(stream, i)

        i++

        if ((yield* stream.peekOne()) == 255) {
          yield* stream.shiftOne()
          done = true
        }

        return res
      })

    return decodeItem
  })

const decodeDefListLazy = <T>(stream: Bytes.Stream) =>
  Either.gen(function* () {
    let i = 0
    let done = false

    const [m, n] = yield* decodeDefHead(stream)

    if (m != 4) {
      return yield* Either.left(
        new DecodeError(stream, "Unexpected header major type")
      )
    }

    if (i >= n) {
      done = true
    }

    const decodeItem = <T>(itemDecoder: IndexedDecoder<T>): DecodeResult<T> =>
      Either.gen(function* () {
        if (done) {
          return yield* Either.left(new DecodeError(stream, "end-of-list"))
        }

        const res = yield* itemDecoder(stream, i)

        i++

        if (i >= n) {
          done = true
        }

        return res
      })

    return decodeItem
  })

/**
 * @param bytes
 * @returnsW
 */
export const decodeListLazy = (
  bytes: Bytes.BytesLike
): DecodeResult<<T>(itemDecoder: IndexedDecoder<T>) => DecodeResult<T>> => {
  const stream = Bytes.makeStream(bytes)

  if (isIndefList(stream)) {
    return decodeIndefListLazy(stream)
  } else {
    return decodeDefListLazy(stream)
  }
}

const decodeIndefListLazyOption = (stream: Bytes.Stream) =>
  Either.gen(function* () {
    let i = 0
    let done = false

    yield* stream.shiftOne()

    if ((yield* stream.peekOne()) == 255) {
      yield* stream.shiftOne()
      done = true
    }

    const decodeItem = <T>(
      itemDecoder: IndexedDecoder<T>
    ): DecodeResult<T | undefined> =>
      Either.gen(function* () {
        if (done) {
          return undefined
        }

        const res = yield* itemDecoder(stream, i)

        i++

        if ((yield* stream.peekOne()) == 255) {
          yield* stream.shiftOne()
          done = true
        }

        return res
      })

    return decodeItem
  })

const decodeDefListLazyOption = (stream: Bytes.Stream) =>
  Either.gen(function* () {
    let i = 0
    let done = false

    const [m, n] = yield* decodeDefHead(stream)

    if (m != 4) {
      return yield* Either.left(
        new DecodeError(stream, "Unexpected major type for list")
      )
    }

    if (i >= n) {
      done = true
    }

    const decodeItem = <T>(
      itemDecoder: IndexedDecoder<T>
    ): DecodeResult<T | undefined> =>
      Either.gen(function* () {
        if (done) {
          return undefined
        }

        const res = yield* itemDecoder(stream, i)

        i++

        if (i >= n) {
          done = true
        }

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
): DecodeResult<
  <T>(itemDecoder: IndexedDecoder<T>) => DecodeResult<T | undefined>
> => {
  const stream = Bytes.makeStream(bytes)

  if (isIndefList(stream)) {
    return decodeIndefListLazyOption(stream)
  } else {
    return decodeDefListLazyOption(stream)
  }
}

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
export const isList = (bytes: Bytes.BytesLike): boolean => {
  const m = peekMajorType(bytes)

  if (Either.isLeft(m)) {
    return false
  }

  return m.right == 4
}

/**
 * @param bytes
 * @returns
 */
export const isDefList = (bytes: Bytes.BytesLike): boolean => {
  const stream = Bytes.makeStream(bytes)

  const m = peekMajorType(stream)

  if (Either.isLeft(m)) {
    return false
  }

  const n = stream.peekOne()

  if (Either.isLeft(n)) {
    return false
  }

  return m.right == 4 && n.right != 4 * 32 + 31
}

/**
 * @param bytes
 * @returns
 */
export const isIndefList = (bytes: Bytes.BytesLike): boolean => {
  const head = Bytes.makeStream(bytes).peekOne()

  if (Either.isLeft(head)) {
    return false
  }

  return head.right == 4 * 32 + 31
}

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
  (bytes: Bytes.BytesLike): DecodeResult<[TKey, TValue][]> =>
    Either.gen(function* () {
      const stream = Bytes.makeStream(bytes)

      if (isIndefMap(stream)) {
        yield* stream.shiftOne()

        return yield* decodeIndefMap<TKey, TValue>(
          stream,
          keyDecoder,
          valueDecoder
        )
      } else {
        const [m, n] = yield* decodeDefHead(stream)

        if (m != 5) {
          return yield* Either.left(new DecodeError(stream, "invalid def map"))
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
): DecodeResult<[TKey, TValue][]> =>
  Either.gen(function* () {
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
): DecodeResult<[TKey, TValue][]> =>
  Either.gen(function* () {
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
export const isMap = (bytes: Bytes.BytesLike): boolean => {
  const m = peekMajorType(bytes)

  if (Either.isLeft(m)) {
    return false
  }

  return m.right == 5
}

/**
 * @param bytes
 * @returns
 */
const isIndefMap = (bytes: Bytes.BytesLike): boolean => {
  const head = Bytes.makeStream(bytes).peekOne()

  if (Either.isLeft(head)) {
    return false
  }

  return head.right == 5 * 32 + 31
}

const NULL_BYTE = 246 // m = 7, n = 22

/**
 * Checks if next element in `bytes` is a `null`.
 * Throws an error if it isn't.
 * @param bytes
 * @returns
 */
export const decodeNull = (bytes: Bytes.BytesLike): DecodeResult<null> => {
  const stream = Bytes.makeStream(bytes)

  return stream.shiftOne().pipe(
    Either.flatMap((b) => {
      if (b != NULL_BYTE) {
        return Either.left(new DecodeError(stream, "not null"))
      }

      return Either.right(null)
    })
  )
}

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
export const isNull = (bytes: Bytes.BytesLike): boolean => {
  const head = Bytes.makeStream(bytes).peekOne()

  if (Either.isLeft(head)) {
    return false
  }

  return head.right == NULL_BYTE
}

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
  ): DecodeResult<{
    [D in keyof Decoders]+?: Decoders[D] extends Decoder<infer T> ? T : never
  }> => {
    const stream = Bytes.makeStream(bytes)

    const res: Record<number, any> = {}

    return decodeMap(
      () => Either.right(null),
      (pairStream) =>
        Either.gen(function* () {
          const key = Number(yield* decodeInt(pairStream))

          const decoder: Decoder<any> | undefined = fieldDecoders[key]

          if (decoder === undefined) {
            return yield* Either.left(
              new DecodeError(pairStream, `unhandled object field ${key}`)
            )
          }

          /* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */
          res[key] = yield* decoder(pairStream)
        })
    )(stream).pipe(
      Either.map(() => {
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
  ): DecodeResult<{
    [D in keyof Decoders]+?: Decoders[D] extends Decoder<infer T> ? T : never
  }> => {
    const stream = Bytes.makeStream(bytes)

    const res: Record<string, any> = {}

    return decodeMap(
      () => Either.right(null),
      (pairStream) =>
        Either.gen(function* () {
          const key = yield* decodeString(pairStream)

          const decoder: Decoder<any> | undefined = fieldDecoders[key]

          if (decoder === undefined) {
            return yield* Either.left(
              new DecodeError(pairStream, `unhandled object field ${key}`)
            )
          }

          /* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */
          res[key] = yield* decoder(pairStream)
        })
    )(stream).pipe(
      Either.map(() => {
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
export const isObject = (bytes: Bytes.BytesLike): boolean => isMap(bytes)

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
  (bytes: Bytes.BytesLike): DecodeResult<T[]> => {
    const stream = Bytes.makeStream(bytes)

    if (isTag(stream)) {
      const tag = decodeTag(stream)

      if (Either.isLeft(tag)) {
        return Either.left(tag.left)
      }

      if (tag.right != SET_TAG) {
        return Either.left(
          new DecodeError(
            stream,
            `expected tag ${SET_TAG} for set, got tag ${tag}`
          )
        )
      }
    }

    return decodeList(itemDecoder)(stream)
  }

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
export const isSet = (bytes: Bytes.BytesLike): boolean => {
  const t = peekTag(bytes)

  if (Either.isLeft(t)) {
    return false
  }

  return t.right == SET_TAG
}

const decodeSplitString = (stream: Bytes.Stream): DecodeResult<string> =>
  decodeList((itemBytes) => decodeStringInternal(itemBytes))(stream).pipe(
    Either.map((parts) => parts.join(""))
  )

/**
 * @param bytes
 * @returns
 */
export const decodeString = (bytes: Bytes.BytesLike): DecodeResult<string> => {
  const stream = Bytes.makeStream(bytes)

  if (isDefList(stream)) {
    return decodeSplitString(stream)
  } else {
    return decodeStringInternal(stream)
  }
}

/**
 * @param bytes
 * @returns
 */
const decodeStringInternal = (bytes: Bytes.BytesLike): DecodeResult<string> => {
  const stream = Bytes.makeStream(bytes)

  return decodeDefHead(stream).pipe(
    Either.flatMap(([m, n]): DecodeResult<number[]> => {
      if (m != 3) {
        return Either.left(new DecodeError(stream, "unexpected"))
      }

      return stream.shiftMany(Number(n))
    }),
    Either.flatMap(Utf8.decode),
    Either.mapLeft((e) => {
      if (e._tag == "DecodeException") {
        return new DecodeError(stream, `invalid utf8 (${e.message})`)
      }

      return e
    })
  )
}

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
export const isString = (bytes: Bytes.BytesLike): boolean => {
  const m = peekMajorType(bytes)

  if (Either.isLeft(m)) {
    return false
  }

  return m.right == 3
}

/**
 * @param bytes
 * @returns
 */
export const decodeTag = (bytes: Bytes.BytesLike): DecodeResult<bigint> => {
  const stream = Bytes.makeStream(bytes)

  return decodeDefHead(stream).pipe(
    Either.flatMap(([m, n]): DecodeResult<bigint> => {
      if (m != 6) {
        return Either.left(
          new DecodeError(stream, "unexpected major type for tag")
        )
      }

      return Either.right(n)
    })
  )
}

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
export const isTag = (bytes: Bytes.BytesLike): boolean => {
  const m = peekMajorType(bytes)

  if (Either.isLeft(m)) {
    return false
  }

  return m.right == 6
}

/**
 * @param bytes
 * @returns
 */
export const peekTag = (
  bytes: Bytes.BytesLike
): PeekResult<bigint | undefined> => {
  const t = decodeTag(Bytes.makeStream(bytes).copy())

  if (Either.isLeft(t)) {
    if (t.left._tag == "Cbor.DecodeError") {
      return Either.right(undefined)
    } else {
      return Either.left(t.left)
    }
  }

  return Either.right(t.right)
}

/**
 * @param bytes
 * @returns
 */
export const decodeTagged = (
  bytes: Bytes.BytesLike
): DecodeResult<[number, <T>(itemDecoder: Decoder<T>) => DecodeResult<T>]> =>
  Either.gen(function* () {
    const stream = Bytes.makeStream(bytes)

    if (isList(stream)) {
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
  ): DecodeResult<
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
    Either.gen(function* () {
      const stream = Bytes.makeStream(bytes)

      /**
       * decodeList is the right decoder, but has the wrong type interface
       * Cast the result to `any` to avoid type errors
       */
      const res: any[] = yield* decodeList((itemStream, i) =>
        Either.gen(function* () {
          let decoder: Decoder<any> | undefined = itemDecoders[i]

          if (decoder === undefined) {
            decoder = optionalDecoders[i - itemDecoders.length]

            if (decoder === undefined) {
              return yield* Either.left(
                new DecodeError(
                  itemStream,
                  `expected at most ${
                    itemDecoders.length + optionalDecoders.length
                  } items, got more than ${i}`
                )
              )
            }
          }

          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return yield* decoder(itemStream)
        })
      )(stream)

      if (res.length < itemDecoders.length) {
        return yield* Either.left(
          new DecodeError(
            stream,
            `expected at least ${itemDecoders.length} items, only got ${res.length}`
          )
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
): DecodeResult<<T>(itemDecoder: Decoder<T>) => DecodeResult<T>> {
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
export function isTuple(bytes: Bytes.BytesLike): boolean {
  return isList(bytes)
}
