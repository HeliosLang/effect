import { describe, expect, it } from "bun:test"
import { Effect } from "effect"
import * as Bytes from "./Bytes.js"

describe("Bytes.toArray()", () => {
  it("converts [255] into [255]", () => {
    expect(Bytes.toArray([255])).toEqual([255])
  })

  it("converts #ff into [255]", () => {
    expect(Bytes.toArray("ff")).toEqual([255])
  })

  it("converts Uint8Array([255]) into [255]", () => {
    expect(Bytes.toArray(new Uint8Array([255]))).toEqual([255])
  })

  it("converts ByteStream([255]) into [255]", () => {
    expect(Bytes.toArray(Bytes.makeStream({ bytes: [255] }))).toEqual([255])
  })

  it("converts ByteStream([255]) into [255]", () => {
    expect(Bytes.toArray(Bytes.makeStream([255]))).toEqual([255])
  })

  it("fails for wrong type", () => {
    expect(() => Bytes.toArray({} as string)).toThrow()
  })
})

describe("Bytes.toUint8Array()", () => {
  it("returns [] for #", () => {
    expect(Bytes.toUint8Array("")).toEqual(new Uint8Array([]))
  })

  it("returns [] for []", () => {
    expect(Bytes.toUint8Array([])).toEqual(new Uint8Array([]))
  })

  it("returns [] for empty Uint8Array", () => {
    expect(Bytes.toUint8Array(new Uint8Array([]))).toEqual(new Uint8Array([]))
  })

  it("returns [255] for #ff", () => {
    expect(Bytes.toUint8Array("ff")).toEqual(new Uint8Array([255]))
  })

  it("returns [255] for [255]", () => {
    expect(Bytes.toUint8Array([255])).toEqual(new Uint8Array([255]))
  })

  it("returns [0] for [256]", () => {
    expect(Bytes.toUint8Array([256])).toEqual(new Uint8Array([0]))
  })

  it("returns [255] for Uint8Array([255])", () => {
    expect(Bytes.toUint8Array(new Uint8Array([255]))).toEqual(
      new Uint8Array([255])
    )
  })
})

describe("Bytes.Stream", () => {
  describe("initialized with [255]", () => {
    it("returns 255 when peeking a single byte", () => {
      const bs = Bytes.makeStream({ bytes: [255] })

      expect(Effect.runSync(bs.peekOne())).toBe(255)
    })

    it("returns Uint8Array([255]) when inspecting all bytes", () => {
      const bs = Bytes.makeStream([255])

      expect(bs.bytes).toEqual(new Uint8Array([255]))
    })

    it("returns pos == 0 right after initialization", () => {
      const bs = Bytes.makeStream([255])

      expect(bs.pos).toBe(0)
    })

    it(`returns 255 when shifting a single byte`, () => {
      const bs = Bytes.makeStream([255])

      expect(Effect.runSync(bs.shiftOne())).toBe(255)
      expect(bs.pos).toBe(1)
      expect(bs.shiftRemaining()).toEqual([])
    })

    it(`after shifting a single byte, stream is at end`, () => {
      const bs = Bytes.makeStream([255])
      bs.shiftOne()

      expect(bs.isAtEnd()).toBe(true)
    })

    it("fails after shifting two bytes", () => {
      const bs = Bytes.makeStream([255])
      Effect.runSync(bs.shiftOne())

      expect(() => Effect.runSync(bs.shiftOne())).toThrow()
    })

    it("after shifting a single byte, fails when peeking", () => {
      const bs = Bytes.makeStream([255])
      Effect.runSync(bs.shiftOne())

      expect(() => Effect.runSync(bs.peekOne())).toThrow()
    })

    it(`returns [255] when calling shiftMany(1)`, () => {
      const bs = Bytes.makeStream([255])

      expect(Effect.runSync(bs.shiftMany(1))).toEqual([255])
    })

    it(`returns [] when calling shiftMany(0)`, () => {
      const bs = Bytes.makeStream([255])

      expect(Effect.runSync(bs.shiftMany(0))).toEqual([])
    })

    it(`fails when calling shiftMany(-1)`, () => {
      const bs = Bytes.makeStream([255])

      expect(() => Effect.runSync(bs.shiftMany(-1))).toThrow()
    })

    it(`fails when calling shiftMany(2)`, () => {
      const bs = Bytes.makeStream([255])

      expect(() => Effect.runSync(bs.shiftMany(2))).toThrow()
    })

    it(`returns [255] when calling peekMany(1)`, () => {
      const bs = Bytes.makeStream([255])

      expect(Effect.runSync(bs.peekMany(1))).toEqual([255])
    })

    it(`returns [] when calling peekMany(0)`, () => {
      const bs = Bytes.makeStream([255])

      expect(Effect.runSync(bs.peekMany(0))).toEqual([])
    })

    it(`fails when calling peekMany(-1)`, () => {
      const bs = Bytes.makeStream([255])

      expect(() => Effect.runSync(bs.peekMany(-1))).toThrow()
    })

    it(`fails when calling peekMany(2)`, () => {
      const bs = Bytes.makeStream([255])

      expect(() => Effect.runSync(bs.peekMany(2))).toThrow()
    })
  })

  describe(`initialized using makeByteStream({bytes: [255]})`, () => {
    it("returns 255 when peeking a single byte", () => {
      const bs = Bytes.makeStream([255])

      expect(Effect.runSync(bs.peekOne())).toBe(255)
    })
  })

  describe(`initialized using makeByteStream({bytes: [255]}).copy()`, () => {
    it("returns 255 when peeking a single byte", () => {
      const bs = Bytes.makeStream([255]).copy()

      expect(Effect.runSync(bs.peekOne())).toBe(255)
    })
  })

  describe(`initialized using makeByteStream({bytes: Uint8Array.from([255])})`, () => {
    it("returns 255 when peeking a single byte", () => {
      const bs = Bytes.makeStream(Uint8Array.from([255]))

      expect(Effect.runSync(bs.peekOne())).toBe(255)
    })
  })

  describe(`initialized using makeByteStream({bytes: makeByteStream({bytes: [255]})})`, () => {
    it("returns 255 when peeking a single byte", () => {
      const bs = Bytes.makeStream({
        bytes: Bytes.makeStream([255])
      })
      expect(Effect.runSync(bs.peekOne())).toBe(255)
    })
  })

  describe("initialized with [255, 1]", () => {
    it(`after shifting a single byte, stream is NOT at end`, () => {
      const bs = Bytes.makeStream([255, 1])
      bs.shiftOne()

      expect(bs.isAtEnd()).toBe(false)
    })
  })

  describe("typecheck of makeByteStream", () => {
    it("must be able to pass BytesLike to makeByteStream", () => {
      const bytes: string | number[] | Uint8Array | Bytes.Stream =
        /** @type {any} */ []

      Bytes.makeStream({ bytes })
    })
  })
})

describe("Bytes.pad", () => {
  describe("padding with n=0", () => {
    it("returns [] for []", () => {
      expect(Bytes.pad([], 0)).toEqual([])
    })

    it("fails for [1]", () => {
      expect(() => Bytes.pad([1], 0)).toThrow()
    })
  })

  describe("padding with n=2", () => {
    it("returns [0, 0] for []", () => {
      expect(Bytes.pad([], 2)).toEqual([0, 0])
    })

    it("returns [1, 0] for [1]", () => {
      expect(Bytes.pad([1], 2)).toEqual([1, 0])
    })
  })

  describe("padding [0, 1, 2]", () => {
    it("fails if n=-1", () => {
      expect(() => Bytes.pad([0, 1, 2], -1)).toThrow()
    })

    it("returns [0, 1, 2, 0, 0, ...] if n=32", () => {
      const expected = new Array(32).fill(0) as number[]
      expected[1] = 1
      expected[2] = 2
      expect(Bytes.pad([0, 1, 2], 32)).toEqual(expected)
    })
  })
})

describe("Bytes.prepad", () => {
  describe("prepadding with n=0", () => {
    it("returns [] for []", () => {
      expect(Bytes.prepad([], 0)).toEqual([])
    })

    it("fails for [1]", () => {
      expect(() => Bytes.prepad([1], 0)).toThrow()
    })
  })

  describe("prepadding with n=2", () => {
    it("returns [0, 0] for []", () => {
      expect(Bytes.prepad([], 2)).toEqual([0, 0])
    })

    it("returns [0, 1] for [1]", () => {
      expect(Bytes.prepad([1], 2)).toEqual([0, 1])
    })

    it("returns [1, 1] for [1, 1]", () => {
      expect(Bytes.prepad([1, 1], 2)).toEqual([1, 1])
    })

    it("fails for [1, 1, 1]", () => {
      expect(() => {
        Bytes.prepad([1, 1, 1], 2)
      }).toThrow()
    })
  })

  describe("prepadding [0, 1, 2]", () => {
    it("fails if n=-1", () => {
      expect(() => Bytes.prepad([0, 1, 2], -1)).toThrow()
    })

    it("returns [0, 0, ..., 0, 1, 2] if n=32", () => {
      const expected = new Array(32).fill(0) as number[]
      expected[30] = 1
      expected[31] = 2
      expect(Bytes.prepad([0, 1, 2], 32)).toEqual(expected)
    })
  })
})

describe("Bytes.compare", () => {
  it("returns -1 when comparing #01010101 to #02020202", () => {
    expect(
      Bytes.compare([0x01, 0x01, 0x01, 0x01], [0x02, 0x02, 0x02, 0x02])
    ).toBe(-1)
  })

  it("returns 1 when comparing #02020202 to #02010202", () => {
    expect(Bytes.compare("02020202", "02010202")).toBe(1)
  })

  it("returns 1 when comparing #01010101 to #020202 with shortestFirst=true", () => {
    expect(
      Bytes.compare([0x01, 0x01, 0x01, 0x01], Bytes.toArray("020202"), true)
    ).toBe(1)
  })

  it("returns 1 when comparing #010101 to #02020202 with shortestFirst=true", () => {
    expect(
      Bytes.compare(
        Bytes.toArray("010101"),
        Bytes.toUint8Array("02020202"),
        true
      )
    ).toBe(-1)
  })

  it("returns 0 when comparing #01010101 to #01010101", () => {
    expect(Bytes.compare(Bytes.toArray("01010101"), "01010101")).toBe(0)
  })

  it("returns 1 when comparing #01010101 to #010101", () => {
    expect(Bytes.compare("01010101", "010101")).toBe(1)
  })

  it("returns 1 when comparing #010101 to #01010101", () => {
    expect(
      Bytes.compare(Bytes.toUint8Array("010101"), Bytes.makeStream("01010101"))
    ).toBe(-1)
  })
})

describe("Bytes.dummy", () => {
  it("returns all 0 with default 2nd arg", () => {
    expect(Bytes.dummy(28)).toEqual(new Array(28).fill(0) as number[])
  })
})

describe("Bytes.equals", () => {
  it("returns false for [] and [1]", () => {
    expect(Bytes.equals([], [1])).toBe(false)
  })

  it("returns true for [1] and [1]", () => {
    expect(Bytes.equals([1], [1])).toBe(true)
  })

  it("returns true of Uint8Array([1]) and Uint8Array([1])", () => {
    expect(Bytes.equals(new Uint8Array([1]), new Uint8Array([1]))).toBe(true)
  })

  it("returns true for Uint8Array([1]) and [1]", () => {
    expect(Bytes.equals(new Uint8Array([1]), [1])).toBe(true)
  })

  it("returns true for [1] and Uint8Array([1])", () => {
    expect(Bytes.equals([1], new Uint8Array([1]))).toBe(true)
  })

  it("returns false for [0] and Uint8Array([1])", () => {
    expect(Bytes.equals([0], new Uint8Array([1]))).toBe(false)
  })

  it("returns false for Uint8Array([0]) and Uint8Array([1])", () => {
    expect(Bytes.equals(new Uint8Array([0]), new Uint8Array([1]))).toBe(false)
  })
})
