import { describe, expect, it } from "bun:test"
import { makeWriter as makeBitWriter } from "./Bits.js"
import * as Flat from "./Flat.js"

describe("Flat.encodeInt()", () => {
  it("writes 8 bits for 0", () => {
    const bw = makeBitWriter()

    Flat.encodeInt(bw, 0n)

    expect(bw.length).toBe(8)
  })

  it("writes 8 bits for 127", () => {
    const bw = makeBitWriter()

    Flat.encodeInt(bw, 127n)

    expect(bw.length).toBe(8)
  })

  it("writes 16 bits for 128", () => {
    const bw = makeBitWriter()

    Flat.encodeInt(bw, 128n)

    expect(bw.length).toBe(16)
  })
})
