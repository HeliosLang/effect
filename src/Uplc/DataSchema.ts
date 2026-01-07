import { Effect, Encoding, ParseResult, Schema } from "effect"
import { decode as decodeUtf8, encode as encodeUtf8 } from "../internal/Utf8.js"
import { DataUnencoded as Data } from "./Data.js"

const BigIntSchema = Schema.transformOrFail(Data, Schema.BigIntFromSelf, {
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

export { BigIntSchema as BigInt }

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

export const ByteArray = Schema.transformOrFail(
  Data,
  Schema.Uint8ArrayFromHex,
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

const StringSchema = Schema.transformOrFail(Data, Schema.String, {
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
  encode: (s) =>
    ParseResult.succeed({ bytes: Encoding.encodeHex(encodeUtf8(s)) })
})

export { StringSchema as String }

const ArraySchema = <ItemType>(
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

export { ArraySchema as Array }

export const Struct = <
  FieldTypes extends { [key: string]: any }
>(fieldSchemas: {
  [FieldName in keyof FieldTypes]: Schema.Schema<FieldTypes[FieldName], Data>
}) =>
  Schema.transformOrFail(Data, Schema.Struct(fieldSchemas), {
    strict: true,
    decode: (data) => {
      if ("list" in data) {
        return Effect.all(
          Object.entries(fieldSchemas).map(([fieldName], i) => {
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

export const EnumVariant = <FieldTypes extends { [key: string]: any }>(
  tag: number | bigint,
  fieldSchemas: {
    [FieldName in keyof FieldTypes]: Schema.Schema<FieldTypes[FieldName], Data>
  }
) =>
  Schema.transformOrFail(Data, Schema.Struct(fieldSchemas), {
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
          Object.entries(fieldSchemas).map(([fieldName], i) => {
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
