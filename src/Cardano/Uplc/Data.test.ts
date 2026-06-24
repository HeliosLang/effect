import { describe, expect, it } from "bun:test"
import { Schema } from "effect"
import * as Data from "./Data.js"

describe("Uplc.DataSchema.BigInt", () => {
  it("succeeds for {int: 0n}", () => {
    expect(Schema.decodeSync(Data.BigInt)({ int: 0n })).toBe(0n)
  })

  it("fails for {int: '0'}", () => {
    expect(() => Schema.decodeUnknownSync(Data.BigInt)({ int: "0" })).toThrow()
  })
})

describe("Uplc.DataSchema.Int", () => {
  it("succeeds for {int: 0n}", () => {
    expect(Schema.decodeSync(Data.Int)({ int: 0n })).toBe(0)
  })

  it("fails for {int: '0'}", () => {
    expect(() => Schema.decodeUnknownSync(Data.Int)({ int: "0" })).toThrow()
  })
})

describe("Uplc.DataSchema.String", () => {
  it("succeeds for {bytes: ''}", () => {
    expect(Schema.decodeSync(Data.String)(Data.makeByteArrayData(""))).toBe("")
  })

  it("fails for {bytes: 'ff'}", () => {
    expect(() =>
      Schema.decodeSync(Data.String)(Data.makeByteArrayData("ff"))
    ).toThrow()
  })

  it("succeeds for {bytes: '48656C6C6F20576F726C64'}", () => {
    expect(
      Schema.decodeSync(Data.String)(
        Data.makeByteArrayData("48656C6C6F20576F726C64")
      )
    ).toBe("Hello World")
  })
})

describe("Uplc.DataSchema.Array", () => {
  it("succeeds for empty ListData", () => {
    expect(Schema.decodeSync(Data.Array(Data.String))({ list: [] })).toEqual([])
  })

  it("succeeds for ListData containg single 'Hello World' string", () => {
    expect(
      Schema.decodeSync(Data.Array(Data.String))({
        list: [Data.makeByteArrayData("48656C6C6F20576F726C64")]
      })
    ).toEqual(["Hello World"])
  })

  it("fails if ListData items are heterogenous", () => {
    expect(() =>
      Schema.decodeSync(Data.Array(Data.String))({
        list: [
          Data.makeByteArrayData("48656C6C6F20576F726C64"),
          Data.makeIntData(0)
        ]
      })
    ).toThrow()
  })
})

describe("Uplc.DataSchema.Struct", () => {
  it("succeeds for empty ListData for empty Struct", () => {
    expect(Schema.decodeSync(Data.Struct({}))({ list: [] })).toEqual({})
  })

  it("fails for empty ListData if one field is defined", () => {
    expect(() =>
      Schema.decodeSync(Data.Struct({ foo: Data.String }))({
        list: []
      })
    ).toThrow()
  })

  it("succeeds for ListData with single entry if one field is defined", () => {
    expect(
      Schema.decodeSync(Data.Struct({ foo: Data.String }))({
        list: [Data.makeByteArrayData("48656C6C6F20576F726C64")]
      })
    ).toEqual({ foo: "Hello World" })
  })

  it("fails for ListData with wrong entry in first place with one field is defined", () => {
    expect(() =>
      Schema.decodeSync(Data.Struct({ foo: Data.String }))({
        list: [{ int: 0n }]
      })
    ).toThrow()
  })

  it("succeeds for ListData with spurious entries at end with one field is defined", () => {
    expect(
      Schema.decodeSync(Data.Struct({ foo: Data.String }))({
        list: [
          Data.makeByteArrayData("48656C6C6F20576F726C64"),
          Data.makeIntData(0)
        ]
      })
    ).toEqual({ foo: "Hello World" })
  })

  it("succeeds for ListData with two entries with two fields", () => {
    expect(
      Schema.decodeSync(Data.Struct({ foo: Data.String, bar: Data.Int }))({
        list: [
          Data.makeByteArrayData("48656C6C6F20576F726C64"),
          Data.makeIntData(0n)
        ]
      })
    ).toEqual({ foo: "Hello World", bar: 0 })
  })

  it("fails for ListData with two entries in wrong order with two fields", () => {
    expect(() =>
      Schema.decodeSync(Data.Struct({ bar: Data.Int, foo: Data.String }))({
        list: [
          Data.makeByteArrayData("48656C6C6F20576F726C64"),
          Data.makeIntData(0n)
        ]
      })
    ).toThrow()
  })
})

describe("Uplc.DataSchema.EnumVariant", () => {
  it("succeeds for empty ConstrData for empty EnumVariant", () => {
    expect(
      Schema.decodeSync(Data.EnumVariant(0, {}))({
        constructor: 0,
        fields: []
      })
    ).toEqual({})
  })

  it("fields for ConstrData with wrong tag", () => {
    expect(() =>
      Schema.decodeSync(Data.EnumVariant(0, {}))({
        constructor: 1,
        fields: []
      })
    ).toThrow()
  })

  it("fails for empty ConstrData if one field is defined", () => {
    expect(() =>
      Schema.decodeSync(Data.EnumVariant(0, { foo: Data.String }))({
        constructor: 0,
        fields: []
      })
    ).toThrow()
  })

  it("succeeds for ConstrData with single entry if one field is defined", () => {
    expect(
      Schema.decodeSync(Data.EnumVariant(0, { foo: Data.String }))({
        constructor: 0,
        fields: [Data.makeByteArrayData("48656C6C6F20576F726C64")]
      })
    ).toEqual({ foo: "Hello World" })
  })

  it("fails for ConstrData with wrong entry in first place with one field is defined", () => {
    expect(() =>
      Schema.decodeSync(Data.EnumVariant(0, { foo: Data.String }))({
        constructor: 0,
        fields: [{ int: 0n }]
      })
    ).toThrow()
  })

  it("succeeds for EnumVariant with spurious entries at end with one field is defined", () => {
    expect(
      Schema.decodeSync(Data.EnumVariant(0, { foo: Data.String }))({
        constructor: 0,
        fields: [
          Data.makeByteArrayData("48656C6C6F20576F726C64"),
          Data.makeIntData(0n)
        ]
      })
    ).toEqual({ foo: "Hello World" })
  })

  it("succeeds for EnumVariant with two entries with two fields", () => {
    expect(
      Schema.decodeSync(
        Data.EnumVariant(0, {
          foo: Data.String,
          bar: Data.Int
        })
      )({
        constructor: 0,
        fields: [
          Data.makeByteArrayData("48656C6C6F20576F726C64"),
          Data.makeIntData(0n)
        ]
      })
    ).toEqual({ foo: "Hello World", bar: 0 })
  })

  it("fails for EnumVariant with two entries in wrong order with two fields", () => {
    expect(() =>
      Schema.decodeSync(
        Data.EnumVariant(0, {
          bar: Data.Int,
          foo: Data.String
        })
      )({
        constructor: 0,
        fields: [
          Data.makeByteArrayData("48656C6C6F20576F726C64"),
          Data.makeIntData(0n)
        ]
      })
    ).toThrow()
  })

  it("order is maintained when encoding", () => {
    const result = Schema.encodeSync(
      Data.EnumVariant(0, {
        a: Data.Array(Data.Int),
        b: Data.Array(Data.Int),
        c: Data.Array(Data.Int),
        d: Data.Array(Data.Int),
        e: Data.Array(Data.Int),
        f: Data.Array(Data.Int),
        g: Data.Array(Data.Int),
        h: Data.Array(Data.Int),
        i: Data.Array(Data.Int),
        j: Data.Array(Data.Int),
        k: Data.Array(Data.Int),
        l: Data.Array(Data.Int)
      })
    )({
      f: [0, 1, 2, 3, 4],
      h: [0, 1, 2, 3, 4, 5, 6],
      j: [0, 1, 2, 3, 4, 5, 6, 7, 8],
      l: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      c: [0, 1],
      g: [0, 1, 2, 3, 4, 5],
      a: [],
      b: [0],
      d: [0, 1, 2],
      e: [0, 1, 2, 3],
      i: [0, 1, 2, 3, 4, 5, 6, 7],
      k: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    })

    if (!("fields" in result)) {
      throw new Error("unexpected data kind")
    }

    for (let i = 1; i < result.fields.length; i++) {
      const prev = result.fields[i - 1]
      const item = result.fields[i]

      if (!("list" in prev)) {
        throw new Error("prev not a list")
      }

      if (!("list" in item)) {
        throw new Error("item not a list")
      }

      expect(prev.list.length).toBeLessThan(item.list.length)
    }
  })
})

describe("Uplc.DataSchema.Enum", () => {
  it("succeeds for empty ConstrData for empty EnumVariant", () => {
    expect(
      Schema.decodeSync(Data.Enum({ foo: {} }))({
        constructor: 0,
        fields: []
      })
    ).toEqual({ _tag: "foo" })
  })

  it("fields for ConstrData with wrong tag", () => {
    expect(() =>
      Schema.decodeSync(Data.Enum({ foo: {} }))({
        constructor: 1,
        fields: []
      })
    ).toThrow()
  })

  it("fails for empty ConstrData if one field is defined", () => {
    expect(() =>
      Schema.decodeSync(Data.Enum({ foo: { bar: Data.String } }))({
        constructor: 0,
        fields: []
      })
    ).toThrow()
  })

  it("succeeds for ConstrData with single entry if one field is defined", () => {
    expect(
      Schema.decodeSync(Data.Enum({ foo: { bar: Data.String } }))({
        constructor: 0,
        fields: [Data.makeByteArrayData("48656C6C6F20576F726C64")]
      })
    ).toEqual({ _tag: "foo", bar: "Hello World" })
  })

  it("fails for ConstrData with wrong entry in first place with one field is defined", () => {
    expect(() =>
      Schema.decodeSync(Data.Enum({ foo: { bar: Data.String } }))({
        constructor: 0,
        fields: [{ int: 0n }]
      })
    ).toThrow()
  })

  it("succeeds for Enum with spurious entries at end with one field is defined", () => {
    expect(
      Schema.decodeSync(Data.Enum({ foo: { bar: Data.String } }))({
        constructor: 0,
        fields: [
          Data.makeByteArrayData("48656C6C6F20576F726C64"),
          Data.makeIntData(0n)
        ]
      })
    ).toEqual({ _tag: "foo", bar: "Hello World" })
  })

  it("succeeds for Enum with two entries with two fields", () => {
    expect(
      Schema.decodeSync(
        Data.Enum({
          foo: {
            a: Data.String,
            b: Data.Int
          }
        })
      )({
        constructor: 0,
        fields: [
          Data.makeByteArrayData("48656C6C6F20576F726C64"),
          Data.makeIntData(0n)
        ]
      })
    ).toEqual({ _tag: "foo", a: "Hello World", b: 0 })
  })

  it("fails for Enum with two entries in wrong order with two fields", () => {
    expect(() =>
      Schema.decodeSync(
        Data.Enum({
          foo: {
            a: Data.Int,
            b: Data.String
          }
        })
      )({
        constructor: 0,
        fields: [
          Data.makeByteArrayData("48656C6C6F20576F726C64"),
          Data.makeIntData(0n)
        ]
      })
    ).toThrow()
  })
})

const largeInt = 6610121099553669211n

describe("large int encoding/decoding", () => {
  it("encodes BigInt values above Number.MAX_SAFE_INTEGER", () => {
    expect(Schema.encodeSync(Data.BigInt)(largeInt)).toEqual({ int: largeInt })
  })

  it("decodes nested ListData with large BigInt values", () => {
    expect(
      Schema.decodeSync(Data.Array(Data.BigInt))({
        list: [{ int: largeInt }]
      })
    ).toEqual([largeInt])
  })

  it("encodes EnumVariant fields with large BigInt values", () => {
    const Datum = Data.EnumVariant(0, {
      recipientHash: Data.BigInt,
      encodedAction: Data.ByteArray
    })

    const encoded = Schema.encodeSync(Datum)({
      recipientHash: largeInt,
      encodedAction: new Uint8Array(32)
    })

    expect(encoded).toEqual({
      constructor: 0,
      fields: [{ int: largeInt }, { bytes: new Uint8Array(32) }]
    })
  })
})
  