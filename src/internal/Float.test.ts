import { describe, expect, it } from "bun:test"
import { Either } from "effect"
import { toHex } from "./Bytes.js"
import * as Float from "./Float.js"

/**
 * Taken from https://en.wikipedia.org/wiki/Half-precision_floating-point_format
 * [encoded, original number]
 */
const testVector: [number[], number][] = [
  [[0, 0], 0],
  [[0, 1], 0.000000059604645],
  [[0x03, 0xff], 0.000060975552],
  [[4, 0], 0.00006103515625],
  [[0x35, 0x55], 0.33325195],
  [[0x3b, 0xff], 0.99951172],
  [[0x3c, 0x00], 1],
  [[0x3c, 0x01], 1.00097656],
  [[0x7b, 0xff], 65504],
  [[0x7c, 0x00], Number.POSITIVE_INFINITY],
  [[0x7c, 0x01], Number.NaN],
  [[0x80, 0x00], -0],
  [[0xc0, 0x00], -2],
  [[0xfc, 0x00], Number.NEGATIVE_INFINITY]
]

describe("Float.decodeFloat16()", () => {
  testVector.forEach(([bytes, f]) => {
    it(`decodes #${toHex(bytes)} as ${f}`, () => {
      expect(
        Either.map(Float.decodeFloat16(bytes), (x) => x.toExponential(7))
      ).toEqual(Either.right(f.toExponential(7)))
    })
  })

  it("fails for more than 2 input bytes", () => {
    expect(Float.decodeFloat16([0, 0, 0])._tag).toBe("Left")
  })

  it("fails for less than 2 input bytes", () => {
    expect(Float.decodeFloat16([0])._tag).toBe("Left")
  })
})

describe("Float.encodeFloat16()", () => {
  testVector.forEach(([bytes, f]) => {
    it(`encodes ${f} as #${toHex(bytes)}`, () => {
      expect(Float.encodeFloat16(f)).toEqual(bytes)
    })
  })
})
