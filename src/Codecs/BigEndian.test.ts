import { describe, expect, it } from "bun:test"
import { Either } from "effect"
import * as BigEndian from "./BigEndian.js"
import { toHex } from "./Bytes.js"

describe("BigEndian.decode", () => {
  it("returns 255n for [255]", () => {
    expect(BigEndian.decode([255])).toEqual(Either.right(255n))
  })

  it("returns 255n for [0, 0, 0, 255]", () => {
    expect(BigEndian.decode([0, 0, 0, 255])).toEqual(Either.right(255n))
  })

  it("fails for [256] (invalid byte)", () => {
    expect(BigEndian.decode([256])._tag).toBe("Left")
  })

  it("fails for [3.14] (invalid byte)", () => {
    expect(BigEndian.decode([3.14])._tag).toBe("Left")
  })

  it("fails for [-1] (invalid byte)", () => {
    expect(BigEndian.decode([-1])._tag).toBe("Left")
  })

  it("fails for empty bytes", () => {
    expect(BigEndian.decode([])._tag).toBe("Left")
  })

  describe("BigEndian.decode compared to alt formula", () => {
    const alt = (bytes: number[]): bigint => {
      let sum = 0n
      bytes = bytes.slice().reverse()
      bytes.forEach((b, i) => {
        sum += BigInt(b) * (1n << BigInt(i * 8))
      })
      return sum
    }

    const testVector: number[][] = [
      [0x00],
      [0x80],
      [0xff],
      [0xff, 0xff],
      [0xfe, 0xfe],
      [0x80, 0x80],
      [0xab, 0xcd, 0xef, 0x01, 0x23, 0x45, 0x67, 0x89]
    ]

    testVector.forEach((t) => {
      it(`ok for #${toHex(t)}`, () => {
        expect(BigEndian.decode(t)).toEqual(Either.right(alt(t)))
      })
    })
  })
})

describe("BigEndian.encode", () => {
  it("returns [1, 0] for 256", () => {
    expect(BigEndian.encode(256)).toEqual([1, 0])
  })

  it("returns [0] for 0", () => {
    expect(BigEndian.encode(0)).toEqual([0])
  })

  it("returns [0] for 0n", () => {
    expect(BigEndian.encode(0n)).toEqual([0])
  })

  it("fails for a non-whole number", () => {
    expect(() => BigEndian.encode(0.5)).toThrow()
  })

  it("fails for a negative number", () => {
    expect(() => BigEndian.encode(-1n)).toThrow()
  })
})
