import { Effect, Either } from "effect"
import { describe, it, expect } from "bun:test"
import * as Base32 from "./Base32.js"
import * as Utf8 from "./Utf8.js"

/**
 * Some test vectors taken from https://chromium.googlesource.com/chromium/src/+/lkgr/components/base32/base32_unittest.cc
 */

describe(`Base32.make()`, () => {
  it("fails for non-32 char alphabet", () => {
    expect(() => Base32.make({ alphabet: "abcdefg" })).toThrow()
  })

  it("fails for non-unique 32 char alphabet", () => {
    expect(() =>
      Base32.make({ alphabet: "aacdefghijklmnopqrstuvwxyz234567" })
    ).toThrow()
  })

  it("fails for non-single char padding (0 chars)", () => {
    expect(() =>
      Base32.make({
        alphabet: Base32.DEFAULT_ALPHABET,
        padChar: ""
      })
    ).toThrow()
  })

  it("fails for non-single char padding (more than 1 chars)", () => {
    expect(() =>
      Base32.make({
        alphabet: Base32.DEFAULT_ALPHABET,
        padChar: "=="
      })
    ).toThrow()
  })

  it("fails if padding char is part of alphabet", () => {
    expect(() =>
      Base32.make({
        alphabet: "abcdefghijklmnopqrstuvwxyz23456=",
        padChar: "="
      })
    ).toThrow()
  })
})

describe("Base32.DEFAULT.isValid()", () => {
  it("returns true for an empty string", () => {
    expect(Base32.DEFAULT.isValid("")).toBe(true)
  })

  it('returns true for "my"', () => {
    expect(Base32.DEFAULT.isValid("my")).toBe(true)
  })

  it('returns false for "f0" (invalid char)', () => {
    expect(Base32.DEFAULT.isValid("f0")).toBe(false)
  })

  it('returns false for "fo=" (bad alignment with padding)', () => {
    expect(Base32.DEFAULT.isValid("fo=")).toBe(false)
  })

  it('returns false for "fo=o====" (interrupted padding)', () => {
    expect(Base32.DEFAULT.isValid("fo=o====")).toBe(false)
  })

  it('returns false for "foo=====" (invalid padding length)', () => {
    expect(Base32.DEFAULT.isValid("foo=====")).toBe(false)
  })

  it('returns false for "fooo====" (bad terminating char)', () => {
    expect(Base32.DEFAULT.isValid("fooo====")).toBe(false)
  })

  it('returns true for "fooa===="', () => {
    expect(Base32.DEFAULT.isValid("fooa====")).toBe(true)
  })
})

describe("Base32.encode() without padding", () => {
  const codec = Base32.make({})

  it("returns an empty string for []", () => {
    expect(codec.encode([])).toBe("")
  })

  it('returns "my" for the utf-8 bytes of "f"', () => {
    expect(codec.encode(Utf8.encode("f"))).toBe("my")
  })

  it('returns "mzxq" for the utf-8 bytes of "fo"', () => {
    expect(codec.encode(Utf8.encode("fo"))).toBe("mzxq")
  })

  it('returns "mzxw6" for the utf-8 bytes of "foo"', () => {
    expect(codec.encode(Utf8.encode("foo"))).toBe("mzxw6")
  })

  it('returns "mzxw6yq" for the utf-8 bytes of "foob"', () => {
    expect(codec.encode(Utf8.encode("foob"))).toBe("mzxw6yq")
  })

  it('returns "mzxw6ytb" for the utf-8 bytes of "fooba"', () => {
    expect(codec.encode(Utf8.encode("fooba"))).toBe("mzxw6ytb")
  })

  it('returns "mzxw6ytboi" for the utf-8 bytes of "foobar"', () => {
    expect(codec.encode(Utf8.encode("foobar"))).toBe("mzxw6ytboi")
  })
})

describe("Base32.decode()", () => {
  const paddingLessCodec = Base32.make({ alphabet: Base32.DEFAULT_ALPHABET })
  const paddingCodec = Base32.make({
    ...Base32.DEFAULT_PROPS,
    strict: true
  })

  it("returns [] for an empty string", () => {
    expect(Base32.DEFAULT.decode("")).toEqual(Either.right(new Uint8Array([])))
  })

  it('returns the utf-8 bytes of "f" for "my"', () => {
    expect(paddingLessCodec.decode("my")).toEqual(
      Either.right(Utf8.encode("f"))
    )
  })

  it('returns the utf-8 bytes of "fo" for "mzxq"', () => {
    expect(Base32.DEFAULT.decode("mzxq")).toEqual(
      Either.right(Utf8.encode("fo"))
    )
  })

  it('fails for "mzxq" if strict', () => {
    expect(paddingCodec.decode("mzxq")._tag).toBe("Left")
  })

  it('returns the utf-8 btyes of "foo" for "mzxw6"', () => {
    expect(Base32.DEFAULT.decode("mzxw6")).toEqual(
      Either.right(Utf8.encode("foo"))
    )
  })

  it('returns the utf-8 bytes of "foob" for "mzxw6yq"', () => {
    expect(Base32.DEFAULT.decode("mzxw6yq")).toEqual(
      Either.right(Utf8.encode("foob"))
    )
  })

  it('returns the utf-8 bytes of "fooba" for "mzxw6ytb"', () => {
    expect(Base32.DEFAULT.decode("mzxw6ytb")).toEqual(
      Either.right(Utf8.encode("fooba"))
    )
  })

  it('returns the utf-8 bytes of "foobar" for "mzxw6ytboi"', () => {
    expect(Base32.DEFAULT.decode("mzxw6ytboi")).toEqual(
      Either.right(Utf8.encode("foobar"))
    )
  })

  it('fails for "0" (invalid char)', () => {
    expect(Base32.DEFAULT.decode("0")._tag).toBe("Left")
  })

  it('fails for "1" (invalid char)', () => {
    expect(Base32.DEFAULT.decode("1")._tag).toBe("Left")
  })

  it('fails for "8" (invalid char)', () => {
    expect(Base32.DEFAULT.decode("8")._tag).toBe("Left")
  })

  it('fails for "9" (invalid char)', () => {
    expect(Base32.DEFAULT.decode("9")._tag).toBe("Left")
  })

  it('fails for "$" (invalid char)', () => {
    expect(Base32.DEFAULT.decode("$")._tag).toBe("Left")
  })

  it('returns the same for "mzxw6ytboi" as for "MZXW6YTBOI" (case insensitive)', () => {
    const s = "mzxw6ytboi"

    expect(Base32.DEFAULT.decode(s)).toEqual(
      Base32.DEFAULT.decode(s.toUpperCase())
    )
  })
})

describe("Base32.decode()/Base32.encode() roundtrip", () => {
  function roundtrip(encoded: string): string {
    return Base32.DEFAULT.encode(Effect.runSync(Base32.DEFAULT.decode(encoded)))
  }

  it("fails for foo=====", () => {
    expect(() => roundtrip("foo=====")).toThrow()
  })

  it("fails for foo====", () => {
    expect(() => roundtrip("foo====")).toThrow()
  })

  it("fails for foo=b", () => {
    expect(() => roundtrip("foo=b")).toThrow()
  })

  it("ok for fooa====", () => {
    expect(roundtrip("fooa====")).toBe("fooa====")
  })

  it("fails for for fooo====", () => {
    expect(() => roundtrip("fooo====")).toThrow()
  })
})
