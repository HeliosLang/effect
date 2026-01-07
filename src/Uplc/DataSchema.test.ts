import { describe, expect, it } from "bun:test"
import { Schema } from "effect"
import * as DataSchema from "./DataSchema.js"

describe("Uplc.DataSchema.BigInt", () => {
  it("succeeds for {int: 0n}", () => {
    expect(Schema.decodeSync(DataSchema.BigInt)({ int: 0n })).toBe(0n)
  })

  it("fails for {int: '0'}", () => {
    expect(() =>
      Schema.decodeUnknownSync(DataSchema.BigInt)({ int: "0" })
    ).toThrow()
  })
})

describe("Uplc.DataSchema.Int", () => {
  it("succeeds for {int: 0n}", () => {
    expect(Schema.decodeSync(DataSchema.Int)({ int: 0n })).toBe(0)
  })

  it("fails for {int: '0'}", () => {
    expect(() =>
      Schema.decodeUnknownSync(DataSchema.Int)({ int: "0" })
    ).toThrow()
  })
})

describe("Uplc.DataSchema.String", () => {
  it("succeeds for {bytes: ''}", () => {
    expect(Schema.decodeSync(DataSchema.String)({ bytes: "" })).toBe("")
  })

  it("fails for {bytes: 'ff'}", () => {
    expect(() =>
      Schema.decodeSync(DataSchema.String)({ bytes: "ff" })
    ).toThrow()
  })

  it("succeeds for {bytes: '48656C6C6F20576F726C64'}", () => {
    expect(
      Schema.decodeSync(DataSchema.String)({ bytes: "48656C6C6F20576F726C64" })
    ).toBe("Hello World")
  })
})

describe("Uplc.DataSchema.Array", () => {
  it("succeeds for empty ListData", () => {
    expect(
      Schema.decodeSync(DataSchema.Array(DataSchema.String))({ list: [] })
    ).toEqual([])
  })

  it("succeeds for ListData containg single 'Hello World' string", () => {
    expect(
      Schema.decodeSync(DataSchema.Array(DataSchema.String))({
        list: [{ bytes: "48656C6C6F20576F726C64" }]
      })
    ).toEqual(["Hello World"])
  })

  it("fails if ListData items are heterogenous", () => {
    expect(() =>
      Schema.decodeSync(DataSchema.Array(DataSchema.String))({
        list: [{ bytes: "48656C6C6F20576F726C64" }, { int: 0n }]
      })
    ).toThrow()
  })
})

describe("Uplc.DataSchema.Struct", () => {
  it("succeeds for empty ListData for empty Struct", () => {
    expect(Schema.decodeSync(DataSchema.Struct({}))({ list: [] })).toEqual({})
  })

  it("fails for empty ListData if one field is defined", () => {
    expect(() =>
      Schema.decodeSync(DataSchema.Struct({ foo: DataSchema.String }))({
        list: []
      })
    ).toThrow()
  })

  it("succeeds for ListData with single entry if one field is defined", () => {
    expect(
      Schema.decodeSync(DataSchema.Struct({ foo: DataSchema.String }))({
        list: [{ bytes: "48656C6C6F20576F726C64" }]
      })
    ).toEqual({ foo: "Hello World" })
  })

  it("fails for ListData with wrong entry in first place with one field is defined", () => {
    expect(() =>
      Schema.decodeSync(DataSchema.Struct({ foo: DataSchema.String }))({
        list: [{ int: 0n }]
      })
    ).toThrow()
  })

  it("succeeds for ListData with spurious entries at end with one field is defined", () => {
    expect(
      Schema.decodeSync(DataSchema.Struct({ foo: DataSchema.String }))({
        list: [{ bytes: "48656C6C6F20576F726C64" }, { int: 0n }]
      })
    ).toEqual({ foo: "Hello World" })
  })

  it("succeeds for ListData with two entries with two fields", () => {
    expect(
      Schema.decodeSync(
        DataSchema.Struct({ foo: DataSchema.String, bar: DataSchema.Int })
      )({ list: [{ bytes: "48656C6C6F20576F726C64" }, { int: 0n }] })
    ).toEqual({ foo: "Hello World", bar: 0 })
  })

  it("fails for ListData with two entries in wrong order with two fields", () => {
    expect(() =>
      Schema.decodeSync(
        DataSchema.Struct({ bar: DataSchema.Int, foo: DataSchema.String })
      )({ list: [{ bytes: "48656C6C6F20576F726C64" }, { int: 0n }] })
    ).toThrow()
  })
})

describe("Uplc.DataSchema.EnumVariant", () => {
  it("succeeds for empty ConstrData for empty EnumVariant", () => {
    expect(
      Schema.decodeSync(DataSchema.EnumVariant(0, {}))({
        constructor: 0,
        fields: []
      })
    ).toEqual({})
  })

  it("fields for ConstrData with wrong tag", () => {
    expect(() =>
      Schema.decodeSync(DataSchema.EnumVariant(0, {}))({
        constructor: 1,
        fields: []
      })
    ).toThrow()
  })

  it("fails for empty ConstrData if one field is defined", () => {
    expect(() =>
      Schema.decodeSync(DataSchema.EnumVariant(0, { foo: DataSchema.String }))({
        constructor: 0,
        fields: []
      })
    ).toThrow()
  })

  it("succeeds for ConstrData with single entry if one field is defined", () => {
    expect(
      Schema.decodeSync(DataSchema.EnumVariant(0, { foo: DataSchema.String }))({
        constructor: 0,
        fields: [{ bytes: "48656C6C6F20576F726C64" }]
      })
    ).toEqual({ foo: "Hello World" })
  })

  it("fails for ConstrData with wrong entry in first place with one field is defined", () => {
    expect(() =>
      Schema.decodeSync(DataSchema.EnumVariant(0, { foo: DataSchema.String }))({
        constructor: 0,
        fields: [{ int: 0n }]
      })
    ).toThrow()
  })

  it("succeeds for EnumVariant with spurious entries at end with one field is defined", () => {
    expect(
      Schema.decodeSync(DataSchema.EnumVariant(0, { foo: DataSchema.String }))({
        constructor: 0,
        fields: [{ bytes: "48656C6C6F20576F726C64" }, { int: 0n }]
      })
    ).toEqual({ foo: "Hello World" })
  })

  it("succeeds for EnumVariant with two entries with two fields", () => {
    expect(
      Schema.decodeSync(
        DataSchema.EnumVariant(0, {
          foo: DataSchema.String,
          bar: DataSchema.Int
        })
      )({
        constructor: 0,
        fields: [{ bytes: "48656C6C6F20576F726C64" }, { int: 0n }]
      })
    ).toEqual({ foo: "Hello World", bar: 0 })
  })

  it("fails for EnumVariant with two entries in wrong order with two fields", () => {
    expect(() =>
      Schema.decodeSync(
        DataSchema.EnumVariant(0, {
          bar: DataSchema.Int,
          foo: DataSchema.String
        })
      )({
        constructor: 0,
        fields: [{ bytes: "48656C6C6F20576F726C64" }, { int: 0n }]
      })
    ).toThrow()
  })
})
