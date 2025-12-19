import { describe, expect, it } from "bun:test"
import { Either } from "effect"
import * as Bits from "./Bits.js"

describe("Bits.Reader", () => {
  describe("initialized with [255]", () => {
    const bytes = [255]

    it("returns 7 when reading the first 3 bits", () => {
      const r = Bits.makeReader(bytes)
      expect(r.readBits(3)).toBe(7)
    })

    it("is NOT at EOF when reading the first 7 bits", () => {
      const r = Bits.makeReader(bytes)
      r.readBits(7)
      expect(r.isAtEnd()).toBe(false)
    })

    it("is at EOF when reading the first 8 bits", () => {
      const r = Bits.makeReader(bytes)
      r.readBits(8)
      expect(r.isAtEnd()).toBe(true)
    })

    it("fails when reading 9 bits", () => {
      const r = Bits.makeReader(bytes)
      expect(() => r.readBits(9)).toThrow()
    })
  })

  describe("initialized with an empty Uint8Array", () => {
    it(`fails when reading a single bit`, () => {
      const r = Bits.makeReader(new Uint8Array(0))
      expect(() => r.readBits(1)).toThrow()
    })

    it(`fails when reading a single byte`, () => {
      const r = Bits.makeReader(new Uint8Array(0))
      expect(() => r.readByte()).toThrow()
    })
  })

  describe("initialized with [255, 255] and truncate set to false", () => {
    const bytes = [255, 255]

    describe("discard 14 bits", () => {
      it("returns 3 when reading 2 bits", () => {
        const r = Bits.makeReader(bytes, false)
        r.readBits(7)
        r.readBits(7)
        expect(r.readBits(2)).toBe(3)
      })

      it("returns 0b11000000 when reading 8 bits", () => {
        const r = Bits.makeReader(bytes, false)
        r.readBits(7)
        r.readBits(7)
        expect(r.readBits(8)).toBe(0b11000000)
      })
    })
  })

  describe("initialized with [0, 1, 2, ...] so that never at end", () => {
    const bytes: number[] = []

    for (let i = 0; i < 1000; i++) {
      bytes.push(i % 256)
    }

    it("fails when reading more than 8 bits at a time", () => {
      const r = Bits.makeReader(bytes)
      expect(() => r.readBits(9)).toThrow()
    })

    it("after reading 8 bits and moving to byte boundary (which has no effect), returns 1 when reading a byte ", () => {
      const r = Bits.makeReader(bytes)
      r.readBits(8)
      r.moveToByteBoundary()
      expect(r.readByte()).toBe(1)
    })

    it("after reading 7 bits and moving to byte boundary, returns 1 when reading a byte", () => {
      const r = Bits.makeReader(bytes)
      r.readBits(7)
      r.moveToByteBoundary()
      expect(r.readByte()).toBe(1)
    })

    it("after forcing a move to byte boundary from start, returns 1 when reading a byte", () => {
      const r = Bits.makeReader(bytes)
      r.moveToByteBoundary(true)
      expect(r.readByte()).toBe(1)
    })
  })
})

describe("Bits.Writer", () => {
  describe("initialized without writing any bits", () => {
    it("finalizes as []", () => {
      expect(Bits.makeWriter().finalize(false)).toEqual([])
    })

    it("finalizes as [] after writing an empty bit-string", () => {
      expect(Bits.makeWriter().writeBits("").finalize(false)).toEqual([])
    })

    it('fails when writing a bit-string not consisting of only "0"s and "1"s', () => {
      const w = Bits.makeWriter()
      expect(() => {
        w.writeBits("2")
      }).toThrow()
    })

    it("fails when writing -1 as a byte", () => {
      const w = Bits.makeWriter()
      expect(() => w.writeByte(-1)).toThrow()
    })

    it("fails when writing 256 as a byte", () => {
      const w = Bits.makeWriter()
      expect(() => w.writeByte(256)).toThrow()
    })
  })

  describe('initialized by writing "0", "" (empty string), and then "1"', () => {
    it("finalizes as [0b01000001]", () => {
      expect(
        Bits.makeWriter().writeBits("0").writeBits("1").finalize(false)
      ).toEqual([0b01000001])
    })

    it("finalizes as [] after popping 2 bits", () => {
      const w = Bits.makeWriter()
      w.writeBits("0").writeBits("").writeBits("1").pop(2)
      expect(w.finalize(false)).toEqual([])
    })

    it("fails when popping 3 bits", () => {
      const w = Bits.makeWriter()
      expect(() =>
        w.writeBits("0").writeBits("").writeBits("1").pop(3)
      ).toThrow()
    })

    it("finalizes as a bit-string with length divisible by 8", () => {
      const w = Bits.makeWriter()
      w.writeBits("0").writeBits("1").finalize(false)
      expect(w.length % 8).toBe(0)
    })
  })

  describe("initialized by writing 7 as a single byte", () => {
    it("finalizes as [7]", () => {
      const w = Bits.makeWriter()
      expect(w.writeByte(7).finalize(false)).toEqual([7])
    })

    it("finalizes as [7, 1] if force is set to true", () => {
      const w = Bits.makeWriter()
      expect(w.writeByte(7).finalize(true)).toEqual([7, 1])
    })

    it('returns "111" when popping 3 bits', () => {
      const w = Bits.makeWriter()
      w.writeByte(7)
      expect(w.pop(3)).toBe("111")
    })

    it("fails when popping a negative number of bits", () => {
      const w = Bits.makeWriter()
      w.writeByte(7)
      expect(() => w.pop(-1)).toThrow()
    })

    it("returns an empty string when when popping 0 bits", () => {
      const w = Bits.makeWriter()
      w.writeByte(7)
      expect(w.pop(0)).toBe("")
    })

    it("after popping 3 bits, finalizes as [1]", () => {
      const w = Bits.makeWriter()
      w.writeByte(7).pop(3)
      expect(w.finalize(false)).toEqual([1])
    })
  })
})

describe("Bits.fromByte", () => {
  describe("calling with 7 as the input byte", () => {
    it('returns "0b00000111"', () => {
      expect(Bits.fromByte(7)).toEqual(Either.right("0b00000111"))
    })

    it('returns "00000111" if prefix=false', () => {
      expect(Bits.fromByte(7, 8, false)).toEqual(Either.right("00000111"))
    })

    it('returns "111" if n=3 and prefix=false', () => {
      expect(Bits.fromByte(7, 3, false)).toEqual(Either.right("111"))
    })

    it("fails if n=2", () => {
      expect(Bits.fromByte(7, 2)._tag).toBe("Left")
    })
  })

  it("fails for 0 if n=0", () => {
    expect(Bits.fromByte(0, 0, false)._tag).toBe("Left")
  })

  it("fails for a negative number", () => {
    expect(Bits.fromByte(-1)._tag).toBe("Left")
  })

  it("fails for a non-whole number", () => {
    expect(Bits.fromByte(3.14)._tag).toBe("Left")
  })

  it("fails for a number larger than 255", () => {
    expect(Bits.fromByte(256)._tag).toBe("Left")
  })
})

describe("Bits.getBit", () => {
  it("get first bit of #00ff returns 0", () => {
    expect(Bits.getBit([0x00, 0xff], 0)).toBe(0)
  })

  it("get last bit of #00ff returns 1", () => {
    expect(Bits.getBit([0x00, 0xff], 15)).toBe(1)
  })

  it("returns 0 when getting indexing past bytes", () => {
    expect(Bits.getBit([0x00, 0xff], 16)).toBe(0)
  })

  it("returns 0 when calling with negative index", () => {
    expect(Bits.getBit([0x00, 0xff], -1)).toBe(0)
  })
})

describe("Bits.mask", () => {
  describe("calling with 0b11111111 as the input byte", () => {
    it("returns 0b0111 if range=[1, 4)", () => {
      expect(Bits.mask(0b11111111, 1, 4)).toBe(0b0111)
    })

    it("returns 0b11111111 if range=[0, 8)", () => {
      const bits = 0b11111111
      expect(Bits.mask(bits, 0, 8)).toBe(bits)
    })

    it("fails for range=[1, 1)", () => {
      expect(() => Bits.mask(0b11111111, 1, 1)).toThrow()
    })

    it("fails for a range starting with a negative number", () => {
      expect(() => Bits.mask(0b11111111, -1, 8)).toThrow()
    })

    it("fails for a range starting after 7", () => {
      expect(() => Bits.mask(0b11111111, 8, 9)).toThrow()
    })

    it("fails for a range ending after 8", () => {
      expect(() => Bits.mask(0b11111111, 0, 9)).toThrow()
    })
  })

  it("fails for a negative input number", () => {
    expect(() => Bits.mask(-1, 0, 8)).toThrow()
  })

  it("fails for an input number larger than 255", () => {
    expect(() => Bits.mask(256, 0, 8)).toThrow()
  })
})

describe("Bits.pad", () => {
  describe('calling with "1111" as a bit-string', () => {
    it('returns "00001111" if n=8', () => {
      expect(Bits.pad("1111", 8)).toBe("00001111")
    })

    it('returns "001111" if n=3 (pads to next multiple of n if n is less than the number of bits)', () => {
      expect(Bits.pad("1111", 3)).toBe("001111")
    })

    it('returns "1111" if n=4 (does nothing if n is equal to the input number of bits)', () => {
      const bits = "1111"
      expect(Bits.pad(bits, bits.length)).toBe(bits)
    })

    it("fails for negative n", () => {
      expect(() => Bits.pad("1111", -1)).toThrow()
    })
  })
})
