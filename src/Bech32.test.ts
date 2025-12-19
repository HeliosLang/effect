import { describe, expect, it } from "bun:test"
import { Either } from "effect"
import * as Bech32 from "./Bech32.js"
import * as Utf8 from "./internal/Utf8.js"

describe("Bech32.encode", () => {
  it("fails with empty human readable part", () => {
    expect(() => Bech32.encode("", [])).toThrow()
  })

  it('returns "foo1vehk7cnpwgry9h96" for "foobar" with "foo" human-readable-part', () => {
    expect(Bech32.encode("foo", Utf8.encode("foobar"))).toBe(
      "foo1vehk7cnpwgry9h96"
    )
  })

  it('returns "addr_test1wz54prcptnaullpa3zkyc8ynfddc954m9qw5v3nj7mzf2wggs2uld" for #70a9508f015cfbcffc3d88ac4c1c934b5b82d2bb281d464672f6c49539 with "addr_test" human-readable-part', () => {
    expect(
      Bech32.encode(
        "addr_test",
        "70a9508f015cfbcffc3d88ac4c1c934b5b82d2bb281d464672f6c49539"
      )
    ).toBe("addr_test1wz54prcptnaullpa3zkyc8ynfddc954m9qw5v3nj7mzf2wggs2uld")
  })
})

describe("Bech32.decode", () => {
  it("fails for empty string", () => {
    expect(Bech32.decode("")._tag).toBe("Left")
  })

  it("fails for random string", () => {
    expect(Bech32.decode("balbalbal")._tag).toBe("Left")
  })

  it('returns #70a9508f015cfbcffc3d88ac4c1c934b5b82d2bb281d464672f6c49539 for "addr_test1wz54prcptnaullpa3zkyc8ynfddc954m9qw5v3nj7mzf2wggs2uld"', () => {
    expect(
      Bech32.decode(
        "addr_test1wz54prcptnaullpa3zkyc8ynfddc954m9qw5v3nj7mzf2wggs2uld"
      )
    ).toEqual(
      Either.right({
        prefix: "addr_test",
        bytes: [
          0x70, 0xa9, 0x50, 0x8f, 0x01, 0x5c, 0xfb, 0xcf, 0xfc, 0x3d, 0x88,
          0xac, 0x4c, 0x1c, 0x93, 0x4b, 0x5b, 0x82, 0xd2, 0xbb, 0x28, 0x1d,
          0x46, 0x46, 0x72, 0xf6, 0xc4, 0x95, 0x39
        ]
      })
    )
  })

  it("for script1agrmwv7exgffcdu27cn5xmnuhsh0p0ukuqpkhdgm800xksw7e2w", () => {
    expect(
      Bech32.decode(
        "script1agrmwv7exgffcdu27cn5xmnuhsh0p0ukuqpkhdgm800xksw7e2w"
      )
    ).toEqual(
      Either.right({
        prefix: "script",
        bytes: [
          0xea, 0x07, 0xb7, 0x33, 0xd9, 0x32, 0x12, 0x9c, 0x37, 0x8a, 0xf6,
          0x27, 0x43, 0x6e, 0x7c, 0xbc, 0x2e, 0xf0, 0xbf, 0x96, 0xe0, 0x03,
          0x6b, 0xb5, 0x1b, 0x3b, 0xde, 0x6b
        ]
      })
    )
  })
})

const testVector: [string, boolean][] = [
  ["", false],
  ["blablabla", false],
  ["addr_test1wz54prcptnaullpa3zkyc8ynfddc954m9qw5v3nj7mzf2wggs2uld", true],
  ["foo1vehk7cnpwgry9h96", true],
  ["foo1vehk7cnpwgry9h97", false],
  ["a12uel5l", true],
  ["mm1crxm3i", false],
  ["A1G7SGD8", false],
  ["abcdef1qpzry9x8gf2tvdw0s3jn54khce6mua7lmqqqxw", true],
  ["?1ezyfcl", true],
  ["addr_test1wz54prcptnaullpa3zkyc8ynfddc954m9qw5v3nj7mzf2wggs2uld", true]
]

describe("Bech32.isValid", () => {
  testVector.forEach(([encoded, expected]) => {
    it(`returns ${expected} for "${encoded}"`, () => {
      expect(Bech32.isValid(encoded)).toBe(expected)
    })
  })
})

describe("Bech32.decode()/Bech32.encode() roundtrip", () => {
  const roundtrip = (encoded: string): string => {
    const decodeResult = Bech32.decode(encoded)
    if (decodeResult._tag == "Left") {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw decodeResult.left
    }

    const { prefix, bytes } = decodeResult.right

    return Bech32.encode(prefix, bytes)
  }

  testVector.forEach(([encoded, expected]) => {
    if (expected) {
      it(`ok for "${encoded}"`, () => {
        expect(roundtrip(encoded)).toBe(encoded)
      })
    } else {
      it(`fails for "${encoded}"`, () => {
        expect(() => roundtrip(encoded)).toThrow()
      })
    }
  })
})
