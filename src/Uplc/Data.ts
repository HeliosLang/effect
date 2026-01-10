import { Effect, Encoding, ParseResult, Schema } from "effect"
import * as Bytes from "../internal/Bytes.js"
import { decode as decodeUtf8, encode as encodeUtf8 } from "../internal/Utf8.js"
import * as Cbor from "../Cbor.js"

const SuspendedDataFromJSON = Schema.suspend(
  (): Schema.Schema<Data, DataJSON> => DataFromJSON
)

export const ByteArrayDataFromJSON = Schema.Struct({
  bytes: Schema.Uint8ArrayFromHex
})

export type ByteArrayData = Schema.Schema.Type<typeof ByteArrayDataFromJSON>
export type ByteArrayDataJSON = Schema.Schema.Encoded<
  typeof ByteArrayDataFromJSON
>

export function makeByteArrayData(
  bytes: string | number[] | Uint8Array
): ByteArrayData {
  return { bytes: Bytes.toUint8Array(bytes) }
}

/**
 * No need to serialize
 *
 * Cannot used Branded types due Schema issues.
 */
export const IntDataFromJSON = Schema.Struct({
  int: Schema.BigIntFromNumber
})

export type IntData = Schema.Schema.Type<typeof IntDataFromJSON>
export type IntDataJSON = Schema.Schema.Encoded<typeof IntDataFromJSON>

export function makeIntData(value: number | bigint): IntData {
  return { int: BigInt(value) }
}

export const ListDataFromJSON = Schema.Struct({
  list: Schema.Array(SuspendedDataFromJSON)
})

/**
 * Must be defined explicitly to avoid circular reference problems
 */
export type ListData = {
  readonly list: ReadonlyArray<Data>
}

export type ListDataJSON = {
  readonly list: ReadonlyArray<DataJSON>
}

export function makeListData(items: Data[]): ListData {
  return {
    list: items
  }
}

export const MapDataFromJSON = Schema.Struct({
  map: Schema.Array(
    Schema.Struct({
      k: SuspendedDataFromJSON,
      v: SuspendedDataFromJSON
    })
  )
})

/**
 * Must be defined explicitly to avoid circular reference problems
 */
export type MapData = {
  readonly map: ReadonlyArray<{
    readonly k: Data
    readonly v: Data
  }>
}

export type MapDataJSON = {
  readonly map: ReadonlyArray<{
    readonly k: DataJSON
    readonly v: DataJSON
  }>
}

export function makeMapData(entries: [Data, Data][]): MapData {
  return {
    map: entries.map(([k, v]) => ({ k, v }))
  }
}

export const ConstrDataFromJSON = Schema.Struct({
  constructor: Schema.Number,
  fields: Schema.Array(SuspendedDataFromJSON)
})

/**
 * Must be defined explicitly to avoid circular reference problems
 */
export type ConstrData = {
  readonly constructor: number
  readonly fields: ReadonlyArray<Data>
}

export type ConstrDataJSON = {
  readonly constructor: number
  readonly fields: ReadonlyArray<DataJSON>
}

export function makeConstrData(
  tag: bigint | number,
  fields: Data[]
): ConstrData {
  return {
    constructor: Number(tag),
    fields
  }
}

export const DataFromJSON = Schema.Union(
  ByteArrayDataFromJSON,
  IntDataFromJSON,
  ListDataFromJSON,
  MapDataFromJSON,
  ConstrDataFromJSON
)

export const Data = Schema.typeSchema(DataFromJSON)

/**
 * Must be defined explicitly to avoid circular reference problems
 */
export type Data = ByteArrayData | ConstrData | IntData | ListData | MapData

export type DataJSON =
  | ByteArrayDataJSON
  | ConstrDataJSON
  | IntDataJSON
  | ListDataJSON
  | MapDataJSON

/**
 * Simple recursive CBOR decoder
 * @param bytes
 * @returns
 */
export const decode = (bytes: Bytes.BytesLike): Cbor.DecodeEffect<Data> =>
  Effect.gen(function* () {
    const stream = Bytes.makeStream(bytes)

    if (yield* Cbor.isList(stream)) {
      const items = yield* Cbor.decodeList(decode)(stream)

      return makeListData(items)
    } else if (yield* Cbor.isBytes(stream)) {
      return makeByteArrayData(yield* Cbor.decodeBytes(stream))
    } else if (yield* Cbor.isMap(stream)) {
      const entries = yield* Cbor.decodeMap(decode, decode)(stream)

      return makeMapData(entries)
    } else if (yield* Cbor.isConstr(stream)) {
      const [tag, fields] = yield* Cbor.decodeConstr(decode)(stream)
      return makeConstrData(tag, fields)
    } else {
      return makeIntData(yield* Cbor.decodeInt(stream))
    }
  })

/**
 * Simple recursive CBOR encoder
 * @param data
 * @returns
 */
export function encode(data: Data): number[] {
  if ("bytes" in data) {
    return Cbor.encodeBytes(data.bytes.slice(), true)
  } else if ("fields" in data) {
    return Cbor.encodeConstr(data.constructor, data.fields.map(encode))
  } else if ("int" in data) {
    return Cbor.encodeInt(data.int)
  } else if ("list" in data) {
    return Cbor.encodeList(data.list.map(encode))
  } else if ("map" in data) {
    return Cbor.encodeMap(data.map.map(({ k, v }) => [encode(k), encode(v)]))
  } else {
    throw new Error("Unrecognized Uplc.Data type")
  }
}

export const NODE_MEM_SIZE = 4

/**
 * Simple recursive algorithm
 * @param data
 * @returns
 */
export function memSize(data: Data): number {
  if ("bytes" in data) {
    return NODE_MEM_SIZE + calcBytesMemSize(data.bytes)
  } else if ("fields" in data) {
    return data.fields.reduce(
      (prev, field) => prev + memSize(field),
      NODE_MEM_SIZE
    )
  } else if ("int" in data) {
    return NODE_MEM_SIZE + calcIntMemSize(data.int)
  } else if ("list" in data) {
    return data.list.reduce((prev, item) => prev + memSize(item), NODE_MEM_SIZE)
  } else if ("map" in data) {
    return data.map.reduce(
      (prev, { k, v }) => prev + memSize(k) + memSize(v),
      NODE_MEM_SIZE
    )
  } else {
    throw new Error("Unrecognized Uplc.Data type")
  }
}

/**
 * Calculates the mem size of a byte array without the DATA_NODE overhead.
 * @param bytes
 * @returns
 */
export function calcBytesMemSize(
  bytes: string | readonly number[] | Uint8Array
): number {
  const n = Bytes.toArray(bytes).length

  if (n === 0) {
    return 1 // this is so annoying: haskell reference implementation says it should be 0, but current (20220925) testnet and mainnet settings say it's 1
  } else {
    return Math.floor((n - 1) / 8) + 1
  }
}

/**
 * Calculate the mem size of a integer (without the DATA_NODE overhead)
 * @param value
 * @returns
 */
export function calcIntMemSize(value: bigint) {
  if (value == 0n) {
    return 1
  } else {
    const abs = value > 0n ? value : -value

    return Math.floor(log2i(abs) / 64) + 1
  }
}

/**
 * Math.log2 truncates, but we need a rounding down version
 * @param x positive number
 * @returns
 */
export function log2i(x: bigint): number {
  let p = 0

  while (x > 1n) {
    x >>= 1n
    p++
  }

  return p
}

const BigInt$ = Schema.transformOrFail(Data, Schema.BigIntFromSelf, {
  strict: true,
  decode: (data) => {
    if ("int" in data) {
      return ParseResult.succeed(data.int)
    } else {
      return ParseResult.fail(
        new ParseResult.Unexpected(data, "expected IntData")
      )
    }
  },
  encode: (value) => ParseResult.succeed({ int: value })
})

export { BigInt$ as BigInt }

export const Int = Schema.transformOrFail(Data, Schema.Int, {
  strict: true,
  decode: (data) => {
    if ("int" in data) {
      return ParseResult.succeed(Number(data.int))
    } else {
      return ParseResult.fail(
        new ParseResult.Unexpected(data, "expected IntData")
      )
    }
  },
  encode: (value) => {
    if (value % 1.0 != 0) {
      return ParseResult.fail(
        new ParseResult.Unexpected(value, "not an integer")
      )
    } else {
      return ParseResult.succeed({ int: BigInt(Math.round(value)) })
    }
  }
})

export const Real = (decimals: number = 6) => {
  if (decimals < 0) {
    throw new Error("decimals can't be negative")
  }

  const precision = Math.pow(10, decimals)

  return Schema.transformOrFail(Data, Schema.Number, {
    strict: true,
    decode: (data) => {
      if ("int" in data) {
        return ParseResult.succeed(Number(data.int) / precision)
      } else {
        return ParseResult.fail(
          new ParseResult.Unexpected(data, "expected IntData")
        )
      }
    },
    encode: (value) => {
      return ParseResult.succeed({ int: BigInt(Math.round(value * precision)) })
    }
  })
}

export const ByteArray = Schema.transformOrFail(
  Data,
  Schema.Uint8ArrayFromSelf,
  {
    strict: true,
    decode: (data) => {
      if ("bytes" in data) {
        return ParseResult.succeed(data.bytes)
      } else {
        return ParseResult.fail(
          new ParseResult.Unexpected(data, "expected ByteArrayData")
        )
      }
    },
    encode: (hex) => ParseResult.succeed({ bytes: hex })
  }
)

export const Hex = Schema.transformOrFail(Data, Schema.String, {
  strict: true,
  decode: (data) => {
    if ("bytes" in data) {
      return ParseResult.succeed(Encoding.encodeHex(data.bytes))
    } else {
      return ParseResult.fail(
        new ParseResult.Unexpected(data, "expected ByteArrayData")
      )
    }
  },
  encode: (hex) =>
    Encoding.decodeHex(hex).pipe(
      Effect.map((bs) => ({ bytes: bs })),
      Effect.mapError(
        (_e) => new ParseResult.Unexpected(hex, "invalid Hex string")
      )
    )
})

export const Option = <SomeType>(
  someSchema: Schema.Schema<SomeType, Schema.Schema.Encoded<typeof Data>>
) =>
  Schema.transformOrFail(Data, Schema.Option(someSchema), {
    strict: true,
    decode: (data) => {
      if ("fields" in data) {
        if (data.constructor == 0) {
          if (data.fields.length < 1) {
            return ParseResult.fail(
              new ParseResult.Unexpected(
                data,
                "expected at least one field in ConstrData"
              )
            )
          }

          return ParseResult.succeed({
            _tag: "Some" as const,
            value: data.fields[0]
          })
        } else if (data.constructor == 1) {
          return ParseResult.succeed({ _tag: "None" as const })
        } else {
          return ParseResult.fail(
            new ParseResult.Unexpected(
              data,
              "expected ConstrData with tag 0 or 1"
            )
          )
        }
      } else {
        return ParseResult.fail(
          new ParseResult.Unexpected(data, "expected ConstrData")
        )
      }
    },
    encode: (value) => {
      if (value._tag == "None") {
        return ParseResult.succeed({ constructor: 1, fields: [] })
      } else {
        return ParseResult.succeed({ constructor: 0, fields: [value.value] })
      }
    }
  })

const String$ = Schema.transformOrFail(Data, Schema.String, {
  strict: true,
  decode: (data) => {
    if ("bytes" in data) {
      return decodeUtf8(data.bytes).pipe(
        Effect.mapError((e) => {
          return new ParseResult.Unexpected(data.bytes, e.message)
        })
      )
    } else {
      return ParseResult.fail(
        new ParseResult.Unexpected(data, "expected ByteArrayData")
      )
    }
  },
  encode: (s) => ParseResult.succeed({ bytes: encodeUtf8(s) })
})

export { String$ as String }

export const LiteralString = <T extends string>(value: T) => {
  const valueBytes = encodeUtf8(value)

  return Schema.transformOrFail(Data, Schema.Literal(value), {
    strict: true,
    decode: (data) => {
      if ("bytes" in data) {
        if (
          data.bytes.length == valueBytes.length &&
          data.bytes.every((b, i) => b == valueBytes[i])
        ) {
          return ParseResult.succeed(value)
        } else {
          return ParseResult.fail(
            new ParseResult.Unexpected(data, `expected '${value}'`)
          )
        }
      } else {
        return ParseResult.fail(
          new ParseResult.Unexpected(data, "expected ByteArrayData")
        )
      }
    },
    encode: (s) => ParseResult.succeed({ bytes: encodeUtf8(s) })
  })
}

const Array$ = <ItemType>(
  itemSchema: Schema.Schema<ItemType, Schema.Schema.Encoded<typeof Data>>
) =>
  Schema.transformOrFail(Data, Schema.Array(itemSchema), {
    strict: true,
    decode: (data) => {
      if ("list" in data) {
        return ParseResult.succeed(data.list)
      } else {
        return ParseResult.fail(
          new ParseResult.Unexpected(data, "expected ListData")
        )
      }
    },
    encode: (items) => ParseResult.succeed({ list: items })
  })

export { Array$ as Array }

export const PairArray = <KeyType, ValueType>(
  keySchema: Schema.Schema<KeyType, Schema.Schema.Encoded<typeof Data>>,
  valueSchema: Schema.Schema<ValueType, Schema.Schema.Encoded<typeof Data>>
) =>
  Schema.transformOrFail(
    Data,
    Schema.Array(Schema.Tuple(keySchema, valueSchema)),
    {
      strict: true,
      decode: (data) => {
        if ("map" in data) {
          return ParseResult.succeed(
            data.map.map(({ k, v }) => [k, v] as const)
          )
        } else {
          return ParseResult.fail(
            new ParseResult.Unexpected(data, "expected MapData")
          )
        }
      },
      encode: (pairs) =>
        ParseResult.succeed({ map: pairs.map(([k, v]) => ({ k, v })) })
    }
  )

export const Struct = <
  FieldTypes extends { [fieldName: string]: Schema.Schema<any, Data> }
>(
  fields: FieldTypes
) =>
  Schema.transformOrFail(Data, Schema.Struct(fields), {
    strict: true,
    decode: (data) => {
      if ("list" in data) {
        return Effect.all(
          Object.entries(fields).map(([fieldName], i) => {
            if (i >= data.list.length) {
              return Effect.fail(
                new ParseResult.Unexpected(
                  data,
                  `expected at least ${i + 1} entries in ListData`
                )
              )
            }

            const itemData = data.list[i]

            return Effect.succeed([fieldName, itemData] as [string, Data])
          })
        ).pipe(Effect.map(Object.fromEntries))
      } else {
        return ParseResult.fail(
          new ParseResult.Unexpected(data, "expected ListData")
        )
      }
    },
    encode: (fields) => ParseResult.succeed({ list: Object.values(fields) })
  })

export const StructFromMap = <
  FieldTypes extends { [fieldName: string]: Schema.Schema<any, Data> }
>(
  fields: FieldTypes
) =>
  Schema.transformOrFail(Data, Schema.Struct(fields), {
    strict: true,
    decode: (data) => {
      if ("map" in data) {
        return Effect.all(
          Object.entries(fields).map(([fieldName]) => {
            const fieldNameBytes = encodeUtf8(fieldName)
            const pairData = data.map.find(
              ({ k }) =>
                "bytes" in k &&
                k.bytes.length == fieldNameBytes.length &&
                k.bytes.every((b, i) => b == fieldNameBytes[i])
            )

            if (!pairData) {
              return Effect.fail(
                new ParseResult.Unexpected(
                  data,
                  `couldn't find field '${fieldName}' in MapData`
                )
              )
            }

            return Effect.succeed([fieldName, pairData.v] as [string, Data])
          })
        ).pipe(Effect.map(Object.fromEntries))
      } else {
        return ParseResult.fail(
          new ParseResult.Unexpected(data, "expected MapData")
        )
      }
    },
    encode: (fields) =>
      ParseResult.succeed({
        map: Object.entries(fields).map(([key, field]) => ({
          k: { bytes: encodeUtf8(key) },
          v: field as Data
        }))
      })
  })

export const EnumVariant = <
  FieldTypes extends { [fieldName: string]: Schema.Schema<any, Data> }
>(
  tag: number | bigint,
  fields: FieldTypes
) =>
  Schema.transformOrFail(Data, Schema.Struct(fields), {
    strict: true,
    decode: (data) => {
      if ("fields" in data) {
        if (data.constructor != Number(tag)) {
          return ParseResult.fail(
            new ParseResult.Unexpected(
              data,
              `expected ConstrData with constructor tag ${tag}`
            )
          )
        }

        return Effect.all(
          Object.entries(fields).map(([fieldName], i) => {
            if (i >= data.fields.length) {
              return Effect.fail(
                new ParseResult.Unexpected(
                  data,
                  `expected at least ${i + 1} entries in ConstrData`
                )
              )
            }

            const itemData = data.fields[i]

            return Effect.succeed([fieldName, itemData] as [string, Data])
          })
        ).pipe(Effect.map(Object.fromEntries))
      } else {
        return ParseResult.fail(
          new ParseResult.Unexpected(data, "expected ConstrData")
        )
      }
    },
    encode: (fields) =>
      ParseResult.succeed({
        constructor: Number(tag),
        fields: Object.values(fields)
      })
  })

type EnumUnionTypeInternal<
  VariantName,
  VariantTypes extends {
    [variantName: string]: { [fieldName: string]: Schema.Schema<any, Data> }
  }
> = VariantName extends string
  ? { _tag: VariantName } & {
      [FieldName in keyof VariantTypes[VariantName]]: Schema.Schema.Type<
        VariantTypes[VariantName][FieldName]
      >
    }
  : never
type EnumUnionType<
  VariantTypes extends {
    [variantName: string]: { [fieldName: string]: Schema.Schema<any, Data> }
  }
> = EnumUnionTypeInternal<keyof VariantTypes, VariantTypes>
type EnumUnionDataInternal<
  VariantName,
  VariantTypes extends {
    [variantName: string]: { [fieldName: string]: Schema.Schema<any, Data> }
  }
> = VariantName extends string
  ? { _tag: VariantName } & {
      [FieldName in keyof VariantTypes[VariantName]]: Data
    }
  : never
type EnumUnionData<
  VariantTypes extends {
    [variantName: string]: { [fieldName: string]: Schema.Schema<any, Data> }
  }
> = EnumUnionDataInternal<keyof VariantTypes, VariantTypes>

export const Enum = <
  VariantTypes extends {
    [variantName: string]: { [fieldName: string]: Schema.Schema<any, Data> }
  }
>(
  variants: VariantTypes
): Schema.Schema<EnumUnionType<VariantTypes>, Data> =>
  Schema.transformOrFail(
    Data,
    Schema.Union(
      ...Object.entries(variants).map(
        ([variantName, fieldSchemas]) =>
          Schema.TaggedStruct(
            variantName,
            fieldSchemas
          ) as unknown as Schema.Schema<
            EnumUnionType<VariantTypes>,
            EnumUnionData<VariantTypes>
          >
      )
    ),
    {
      strict: true,
      decode: (
        data
      ): Effect.Effect<EnumUnionData<VariantTypes>, ParseResult.ParseIssue> => {
        if ("fields" in data) {
          const tag = data.constructor

          const variantName: keyof VariantTypes = Object.keys(variants)[tag]

          if ((variantName as string | undefined) == undefined) {
            return ParseResult.fail(
              new ParseResult.Unexpected(
                data,
                `no variant defined for tag ${tag}`
              )
            )
          }

          const fields = variants[variantName]

          return Effect.all(
            Object.entries(fields).map(([fieldName], i) => {
              if (i >= data.fields.length) {
                return Effect.fail(
                  new ParseResult.Unexpected(
                    data,
                    `expected at least ${i + 1} entries in ConstrData of ${variantName as unknown as string}`
                  )
                )
              }

              const itemData = data.fields[i]

              return Effect.succeed([fieldName, itemData] as [string, Data])
            })
          ).pipe(
            Effect.map(
              (entries) =>
                ({
                  _tag: variantName,
                  ...Object.fromEntries(entries)
                }) as unknown as EnumUnionData<VariantTypes>
            )
          )
        } else {
          return ParseResult.fail(
            new ParseResult.Unexpected(data, "expected ConstrData")
          )
        }
      },
      encode: (value) => {
        const variantName = value._tag

        const tag = Object.keys(variants).indexOf(
          variantName as unknown as string
        )

        return ParseResult.succeed({
          constructor: tag,
          fields: Object.entries(value)
            .filter(([key]) => key != "_tag")
            .map(([, field]) => field) as Data[]
        })
      }
    }
  )
