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
