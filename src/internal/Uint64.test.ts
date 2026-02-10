import { describe, expect, it } from "bun:test"
import * as Uint64 from "./Uint64.js"

describe("Uint64.fromBytes()/toBytes() roundtrip", () => {
  it(`roundtrip returns the same for [0, 1, 2, 3, 4, 5, 6, 7] if littleEndian==true`, () => {
    expect(
      Uint64.toBytes(Uint64.fromBytes([0, 1, 2, 3, 4, 5, 6, 7]), true)
    ).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })

  it(`roundtrip returns the same for [0, 1, 2, 3, 4, 5, 6, 7] if littleEndian==false`, () => {
    expect(
      Uint64.toBytes(Uint64.fromBytes([0, 1, 2, 3, 4, 5, 6, 7], false), false)
    ).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })
})

describe("Uint64.fromHex()", () => {
  it(`returns [0, 0, 0, 0, 255, 255, 255, 255] for "00000000ffffffff"`, () => {
    expect(Uint64.toBytes(Uint64.fromHex("00000000ffffffff"), false)).toEqual([
      0, 0, 0, 0, 255, 255, 255, 255
    ])
  })
})

describe("Uint64 zero", () => {
  it(`returns [0, 0, 0, 0, 0, 0, 0, 0]`, () => {
    expect(Uint64.toBytes(Uint64.Zero, false)).toEqual([0, 0, 0, 0, 0, 0, 0, 0])
  })
})

describe("Uint64.equals()", () => {
  it(`returns true for UInt64.zero() && UInt64.zero()`, () => {
    expect(Uint64.equals(Uint64.Zero, Uint64.Zero)).toBe(true)
  })

  it(`returns false for UInt64.zero() && UInt64.fromBytes([0, 0, 0, 0, 255, 255, 255, 255])`, () => {
    expect(
      Uint64.equals(
        Uint64.Zero,
        Uint64.fromBytes([0, 0, 0, 0, 255, 255, 255, 255])
      )
    ).toBe(false)
  })
})

describe("Uint64.not()", () => {
  it(`returns [255, 255, 255, 255, 255, 255, 255, 255] for UInt64.zero().not()`, () => {
    expect(Uint64.toBytes(Uint64.not(Uint64.Zero))).toEqual([
      255, 255, 255, 255, 255, 255, 255, 255
    ])
  })
})
