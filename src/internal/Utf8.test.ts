import { describe, expect, it } from "bun:test"
import { Effect } from "effect"
import * as Utf8 from "./Utf8.js"

describe("Utf8.isValid", () => {
  it("returns true for []", () => {
    expect(Utf8.isValid([])).toBe(true)
  })

  it("returns true for [104, 101, 108, ...]", () => {
    expect(
      Utf8.isValid([104, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100])
    ).toBe(true)
  })

  it("returns false for [256] (invalid byte)", () => {
    expect(Utf8.isValid([256])).toBe(false)
  })

  it("returns false for [255, 255, 255, 255] (invalid utf-8 sequence)", () => {
    expect(Utf8.isValid([255, 255, 255, 255])).toBe(false)
  })

  it("returns true for [0xf0, 0xb1, 0x8d, 0x90]", () => {
    expect(Utf8.isValid([0xf0, 0xb1, 0x8d, 0x90])).toBe(true)
  })
})

describe("Utf8.encode", () => {
  it("returns [] for an empty string", () => {
    expect(Array.from(Utf8.encode(""))).toEqual([])
  })

  it('returns [104, 101, 108, ...] for "hello world"', () => {
    expect(Array.from(Utf8.encode("hello world"))).toEqual([
      104, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100
    ])
  })

  it('returns [0xf0, 0xb1, 0x8d, 0x90] for "\ud884\udf50"', () => {
    expect(Array.from(Utf8.encode("\ud884\udf50"))).toEqual([
      0xf0, 0xb1, 0x8d, 0x90
    ])
  })
})

describe("Utf8.decode", () => {
  it("returns an empty string for []", () => {
    expect(Effect.runSync(Utf8.decode([]))).toBe("")
  })

  it('returns "hello world" for [104, 101, 108, ...]', () => {
    expect(
      Effect.runSync(
        Utf8.decode([104, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100])
      )
    ).toBe("hello world")
  })

  it('returns "\ud884\udf50" for [0xf0, 0xb1, 0x8d, 0x90]', () => {
    expect(Effect.runSync(Utf8.decode([0xf0, 0xb1, 0x8d, 0x90]))).toBe(
      "\ud884\udf50"
    )
  })

  it("fails for [255, 255, 255, 255] (invalid utf-8 sequence)", () => {
    expect(() => Effect.runSync(Utf8.decode([255, 255, 255, 255]))).toThrow()
  })
})
