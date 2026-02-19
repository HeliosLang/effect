import { Either, Encoding, Schema } from "effect"
import * as Bits from "../../Codecs/Bits.js"
import { toArray, toUint8Array } from "../../Codecs/Bytes.js"
import * as Flat from "../../Codecs/Flat.js"
import * as Utf8 from "../../Codecs/Utf8.js"
import * as ZigZag from "../../Codecs/ZigZag.js"
import * as Data from "./Data.js"
import * as Type from "./Type.js"

// these value Schemas don't encode to JSON

const SuspendedValue = Schema.suspend((): Schema.Schema<Value, Value> => Value)

export const Bool = Schema.Boolean

export type Bool = Schema.Schema.Type<typeof Bool>

export const ByteArray = Schema.Uint8ArrayFromSelf

export type ByteArray = Schema.Schema.Type<typeof ByteArray>

const Data$ = Schema.Struct({
  data: Data.Data
})

type Data$ = Schema.Schema.Type<typeof Data$>

export { Data$ as Data }

export function isData(v: Value): v is Data$ {
  return typeof v == "object" && v != null && "data" in v
}

export const Int = Schema.BigIntFromSelf

export type Int = Schema.Schema.Type<typeof Int>

export const String = Schema.String

export type String = Schema.Schema.Type<typeof String>

export const Unit = Schema.Null

export type Unit = Schema.Schema.Type<typeof Unit>

export type List = {
  readonly itemType: Type.Type // needed for empty lists
  readonly items: readonly Value[]
}

export const List = Schema.Struct({
  itemType: Schema.typeSchema(Type.Type),
  items: Schema.Array(SuspendedValue)
})

export function isList(v: Value): v is List {
  return typeof v == "object" && v != null && "items" in v
}

export type Pair = {
  readonly first: Value
  readonly second: Value
}

export const Pair = Schema.Struct({
  first: SuspendedValue,
  second: SuspendedValue
})

export function isPair(v: Value): v is Pair {
  return typeof v == "object" && v != null && "first" in v
}

export const Bls12_381_G1Element = Schema.Struct({
  g1Element: Schema.Tuple(
    Schema.BigIntFromSelf,
    Schema.BigIntFromSelf,
    Schema.BigIntFromSelf
  )
})

export type Bls12_381_G1Element = Schema.Schema.Type<typeof Bls12_381_G1Element>

export const Bls12_381_G2Element = Schema.Struct({
  g2Element: Schema.Tuple(
    Schema.Tuple(Schema.BigIntFromSelf, Schema.BigIntFromSelf),
    Schema.Tuple(Schema.BigIntFromSelf, Schema.BigIntFromSelf),
    Schema.Tuple(Schema.BigIntFromSelf, Schema.BigIntFromSelf)
  )
})

export type Bls12_381_G2Element = Schema.Schema.Type<typeof Bls12_381_G2Element>

export const Bls12_381_MlResult = Schema.Struct({
  mlResult: Schema.Tuple(
    Schema.Tuple(
      Schema.Tuple(Schema.BigIntFromSelf, Schema.BigIntFromSelf),
      Schema.Tuple(Schema.BigIntFromSelf, Schema.BigIntFromSelf),
      Schema.Tuple(Schema.BigIntFromSelf, Schema.BigIntFromSelf)
    ),
    Schema.Tuple(
      Schema.Tuple(Schema.BigIntFromSelf, Schema.BigIntFromSelf),
      Schema.Tuple(Schema.BigIntFromSelf, Schema.BigIntFromSelf),
      Schema.Tuple(Schema.BigIntFromSelf, Schema.BigIntFromSelf)
    )
  )
})

export type Bls12_381_MlResult = Schema.Schema.Type<typeof Bls12_381_MlResult>

/**
 * TODO: add Bls values
 */
export type Value =
  | Bool
  | ByteArray
  | Data$
  | Int
  | List
  | Pair
  | String
  | Unit
  | Bls12_381_G1Element
  | Bls12_381_G2Element
  | Bls12_381_MlResult

/**
 * TODO: add Bls values
 */
export const Value = Schema.Union(
  Bool,
  ByteArray,
  Data$,
  Int,
  List,
  Pair,
  String,
  Unit,
  Bls12_381_G1Element,
  Bls12_381_G2Element,
  Bls12_381_MlResult
)

export function flatSize(v: Value): number {
  if (typeof v == "boolean") {
    return 5
  } else if (v === null) {
    return 4
  } else if (v instanceof Uint8Array) {
    return Flat.bytesSize(v.length)
  } else if (typeof v === "string") {
    return Flat.bytesSize(Utf8.encode(v).length)
  } else if (typeof v === "bigint") {
    return Flat.intSize(v)
  } else if ("data" in v) {
    return Flat.bytesSize(Data.encode(v.data).length)
  } else if ("first" in v) {
    // 16 additional type bits on top of first and second bits
    return 16 + flatSize(v.first) + flatSize(v.second)
  } else if ("items" in v) {
    const nItemTypeBits = v.itemType.length
    return (
      10 +
      nItemTypeBits +
      v.items.reduce((prev, item) => flatSize(item) - nItemTypeBits + prev, 0)
    )
  } else {
    throw new Error(
      `unhandled value kind in Uplc.Value.flatSize() (got: ${v as unknown as any})`
    )
  }
}

export function memSize(v: Value): number {
  if (typeof v == "boolean" || v === null) {
    return 1
  } else if (v instanceof Uint8Array) {
    return Data.memSizeOfByteArray(v)
  } else if (typeof v === "string") {
    return v.length
  } else if (typeof v === "bigint") {
    return Data.memSizeOfInt(v) // TODO: should ZigZag encoding be taken into account here?
  } else if ("data" in v) {
    return Data.memSize(v.data)
  } else if ("first" in v) {
    return memSize(v.first) + memSize(v.second)
  } else if ("items" in v) {
    return v.items.reduce((prev, item) => prev + memSize(item), 0)
  } else {
    throw new Error(
      `unhandled value kind in Uplc.Value.memSize() (got: ${v as unknown as any})`
    )
  }
}

/**
 * Doesn't include type bits
 * Simple recursive algorithm (containers are expected to be that big anyway)
 * @param v
 * @param w
 */
export const toFlat =
  (w: Flat.Writer) =>
  (v: Value): void => {
    if (typeof v == "boolean") {
      w.writeBool(v)
    } else if (v === null) {
      // doesn't do anything, handled by type bits
    } else if (v instanceof Uint8Array) {
      w.writeBytes(toArray(v))
    } else if (typeof v == "string") {
      w.writeBytes(toArray(Utf8.encode(v)))
    } else if (typeof v == "bigint") {
      // assumes the number is signed
      w.writeInt(ZigZag.toUnsigned(v))
    } else if ("data" in v) {
      w.writeBytes(Data.encode(v.data))
    } else if ("first" in v) {
      toFlat(w)(v.first)
      toFlat(w)(v.second)
    } else if ("items" in v) {
      v.items.forEach((item) => {
        w.writeListCons()
        toFlat(w)(item)
      })

      w.writeListNil()
    } else {
      throw new Error(
        `unhandled value kind in Uplc.Value.toFlat() (got: ${v as unknown as any})`
      )
    }
  }

type TypeDecodingError = Error
type ValueDecodingError = Error
type ValueDecoder = () => Either.Either<Value, ValueDecodingError>

/**
 * Simple recursive function which return a lazy decoder
 */
const makeTypedDecoder = (
  r: Flat.Reader,
  typeList: number[]
): Either.Either<ValueDecoder, TypeDecodingError> =>
  Either.gen(function* () {
    const type = typeList.shift()

    if (type === undefined) {
      return yield* Either.left(new Error("empty type list"))
    }

    switch (type) {
      case 0: // signed Integer
        return () => Either.right(ZigZag.toSigned(r.readInt()))
      case 1: // bytearray
        return () => Either.right(toUint8Array(r.readBytes()))
      case 2: // utf-8 string
        return () =>
          Utf8.decode(r.readBytes()).pipe(
            Either.mapLeft((e) => new Error(e.message))
          )
      case 3: // unit
        return () => Either.right(null)
      case 4: // boolean
        return () => Either.right(r.readBool())
      case 5:
      case 6:
        return yield* Either.left(
          new Error("unexpected type tag without type application")
        )
      case 7: {
        const containerType = typeList.shift()

        if (containerType === undefined) {
          return yield* Either.left(
            new Error("expected nested type for container")
          )
        }

        switch (containerType) {
          case 5: {
            return yield* makeTypedListDecoder(r, typeList)
          }
          case 7: {
            const nestedContainerType = typeList.shift()

            if (nestedContainerType === undefined) {
              return yield* Either.left(
                new Error("expected nested type for container")
              )
            } else if (nestedContainerType != 6) {
              return yield* Either.left(
                new Error(
                  `unexpected nested container type tag (expected 6, got ${nestedContainerType})`
                )
              )
            }

            const firstReader = yield* makeTypedDecoder(r, typeList)
            const secondReader = yield* makeTypedDecoder(r, typeList)

            return () =>
              Either.zipWith(
                firstReader(),
                secondReader(),
                (first, second) => ({ first, second })
              )
          }
          default:
            return yield* Either.left(
              new Error(`unexpected container type tag ${containerType}`)
            )
        }
      }
      case 8:
        return () =>
          Data.decode(r.readBytes()).pipe(
            Either.map((d) => ({ data: d })),
            Either.mapLeft((e) => new Error(e.message))
          )
      case 9:
        return yield* Either.left(
          new Error("Bls12_381_G1Element can't be deserialized")
        )
      case 10:
        return yield* Either.left(
          new Error("Bls12_381_G2Element can't be deserialized")
        )
      case 11:
        return yield* Either.left(
          new Error("Bls12_381_MlResult can't be deserialized")
        )
      default:
        return yield* Either.left(
          new Error(`unhandled value type ${type.toString()}`)
        )
    }
  })

function makeTypedListDecoder(
  r: Flat.Reader,
  itemTypeList: number[]
): Either.Either<ValueDecoder, TypeDecodingError> {
  const itemTypeParts = Either.all(
    itemTypeList.map((x) => Bits.fromByte(x, 4, false))
  )

  if (Either.isLeft(itemTypeParts)) {
    return Either.left(itemTypeParts.left)
  }

  const itemType = itemTypeParts.right.join("1") as Type.Type
  const itemDecoder = makeTypedDecoder(r, itemTypeList)

  if (Either.isLeft(itemDecoder)) {
    return Either.left(itemDecoder.left)
  }

  return Either.right(() => {
    const items: Value[] = []

    while (r.readBool()) {
      const item = itemDecoder.right()

      if (item._tag == "Left") {
        return Either.left(item.left)
      }

      items.push(item.right)
    }

    return Either.right({ items, itemType })
  })
}
/**
 * Mutates the Flat.Reader
 * Takes the type bits into account
 * @param r
 */
export const decode = (r: Flat.Reader): Either.Either<Value, Error> =>
  Either.gen(function* () {
    const typeList = r.readList((r) => r.readBits(4))

    const callback = yield* makeTypedDecoder(r, typeList)

    if (typeList.length != 0) {
      return yield* Either.left(new Error("did not consume all type bits"))
    }

    return yield* callback()
  })

/**
 * Simple recursive algorithm
 * @param v
 * @returns
 */
export function toString(v: Value): string {
  if (typeof v == "boolean") {
    return v ? "true" : "false"
  } else if (v === null) {
    return "()"
  } else if (v instanceof Uint8Array) {
    return `#${Encoding.encodeHex(v)}`
  } else if (typeof v == "string") {
    return `"${v}"`
  } else if (typeof v == "bigint") {
    return v.toString()
  } else if ("data" in v) {
    return Data.toString(v.data)
  } else if ("first" in v) {
    return `(${toString(v.first)}, ${toString(v.second)})`
  } else if ("items" in v) {
    if (v.items.length == 0) {
      return `[]${Type.toString(v.itemType)}`
    } else {
      return `[${v.items.map(toString).join(", ")}]`
    }
  } else {
    throw new Error(
      `unhandled value kind in Uplc.Value.toString() (got: ${v as unknown as any})`
    )
  }
}

export function toType(v: Value): Type.Type {
  if (typeof v == "boolean") {
    return Type.Bool
  } else if (v === null) {
    return Type.Unit
  } else if (v instanceof Uint8Array) {
    return Type.ByteArray
  } else if (typeof v == "string") {
    return Type.String
  } else if (typeof v == "bigint") {
    return Type.Int
  } else if ("data" in v) {
    return Type.Data
  } else if ("first" in v) {
    return Type.Pair(toType(v.first), toType(v.second))
  } else if ("items" in v) {
    return Type.List(v.itemType)
  } else {
    throw new Error(
      `unhandled value kind in Uplc.Value.toType() (got: ${v as unknown as any})`
    )
  }
}

export function describeType(v: Value): string {
  return Type.toString(toType(v))
}
