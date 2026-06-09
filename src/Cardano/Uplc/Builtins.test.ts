import { describe, expect, it } from "bun:test"
import { Either } from "effect"
import * as Bytes from "../../Codecs/Bytes.js"
import * as Bls12_381 from "../../Crypto/Bls12_381.js"
import * as Builtins from "./Builtins.js"
import * as Value from "./Value.js"

describe("Uplc.Builtins.evalDivide()", () => {
  const testVector: { a: bigint; b: bigint; c: bigint }[] = [
    {
      a: 1n,
      b: 1n,
      c: 1n
    },
    {
      a: 0n,
      b: 1n,
      c: 0n
    },
    {
      a: -1n,
      b: 1n,
      c: -1n
    },
    {
      a: -1n,
      b: 2n,
      c: -1n
    },
    {
      a: 1n,
      b: 2n,
      c: 0n
    },
    {
      a: -2n,
      b: 2n,
      c: -1n
    },
    {
      a: -19n,
      b: 10n,
      c: -2n
    }
  ]

  it("throws an error when dividing by 0", () => {
    expect(Builtins.evalDivide(1n, 0n)._tag).toBe("Left")
  })

  testVector.forEach(({ a, b, c }) => {
    it(`${a}/${b} == ${c}`, () => {
      const res = Either.getOrThrow(Builtins.evalDivide(a, b))

      expect(res).toBe(c)
    })
  })
})

describe("Uplc.Builtins.evalMod()", () => {
  const testVector: { a: bigint; b: bigint }[] = [
    { a: 10n, b: -15n },
    { a: -9n, b: 7n },
    { a: 14n, b: 20n },
    { a: -16n, b: -2n },
    { a: 5n, b: -10n },
    { a: -4n, b: 16n },
    { a: -11n, b: -18n },
    { a: 18n, b: -6n },
    { a: 13n, b: 9n },
    { a: -3n, b: 19n },
    { a: 20n, b: -20n },
    { a: 12n, b: 2n },
    { a: -19n, b: -4n },
    { a: 3n, b: 5n },
    { a: -8n, b: 17n },
    { a: 0n, b: -14n },
    { a: 6n, b: 15n },
    { a: -12n, b: 10n },
    { a: -5n, b: 2n },
    { a: 7n, b: -1n },
    { a: 11n, b: -17n },
    { a: -2n, b: 12n },
    { a: -7n, b: 4n },
    { a: 15n, b: -13n },
    { a: 19n, b: 8n },
    { a: -1n, b: -9n },
    { a: 1n, b: -12n },
    { a: -14n, b: 11n },
    { a: 8n, b: -5n },
    { a: 9n, b: 3n },
    { a: -20n, b: 18n },
    { a: 16n, b: -8n },
    { a: 2n, b: 6n },
    { a: -15n, b: 13n },
    { a: 4n, b: 1n },
    { a: 17n, b: -11n },
    { a: -6n, b: 7n },
    { a: 0n, b: -3n },
    { a: -13n, b: 14n },
    { a: 5n, b: -19n },
    { a: 18n, b: -7n },
    { a: -10n, b: 9n },
    { a: -17n, b: 3n },
    { a: 6n, b: 19n },
    { a: 7n, b: -4n },
    { a: -1n, b: 10n },
    { a: 10n, b: 5n },
    { a: -18n, b: -6n },
    { a: 20n, b: -9n }
  ]

  /**
   * @param a
   * @param b
   * @returns
   */
  function modIntegerWithDivide(a: bigint, b: bigint): bigint {
    const aOverB = Either.getOrThrow(Builtins.evalDivide(a, b))
    return a - aOverB * b
  }

  it("throws an error when second arg is 0", () => {
    expect(Builtins.evalMod(1n, 0n)._tag).toBe("Left")
  })

  testVector.forEach(({ a, b }) => {
    const expected = modIntegerWithDivide(a, b)
    it(`${a} mod ${b} == ${expected}`, () => {
      const actual = Either.getOrThrow(Builtins.evalMod(a, b))

      expect(actual).toBe(expected)
    })
  })
})

describe("Uplc.Builtins.evalQuotient()", () => {
  const testVector: { a: bigint; b: bigint; c: bigint }[] = [
    {
      a: 1n,
      b: 1n,
      c: 1n
    },
    {
      a: 0n,
      b: 1n,
      c: 0n
    },
    {
      a: -1n,
      b: 1n,
      c: -1n
    },
    {
      a: -1n,
      b: 2n,
      c: 0n
    },
    {
      a: 1n,
      b: 2n,
      c: 0n
    },
    {
      a: -2n,
      b: 2n,
      c: -1n
    },
    {
      a: -19n,
      b: 10n,
      c: -1n
    }
  ]

  it("throws an error when dividing by 0", () => {
    expect(Builtins.evalQuotient(1n, 0n)._tag).toBe("Left")
  })

  testVector.forEach(({ a, b, c }) => {
    it(`${a}/${b} == ${c}`, () => {
      const res = Either.getOrThrow(Builtins.evalQuotient(a, b))

      expect(res).toBe(c)
    })
  })
})

describe("Uplc.Builtins.evalRemainder()", () => {
  const testVector: { a: bigint; b: bigint }[] = [
    { a: 10n, b: -15n },
    { a: -9n, b: 7n },
    { a: 14n, b: 20n },
    { a: -16n, b: -2n },
    { a: 5n, b: -10n },
    { a: -4n, b: 16n },
    { a: -11n, b: -18n },
    { a: 18n, b: -6n },
    { a: 13n, b: 9n },
    { a: -3n, b: 19n },
    { a: 20n, b: -20n },
    { a: 12n, b: 2n },
    { a: -19n, b: -4n },
    { a: 3n, b: 5n },
    { a: -8n, b: 17n },
    { a: 0n, b: -14n },
    { a: 6n, b: 15n },
    { a: -12n, b: 10n },
    { a: -5n, b: 2n },
    { a: 7n, b: -1n },
    { a: 11n, b: -17n },
    { a: -2n, b: 12n },
    { a: -7n, b: 4n },
    { a: 15n, b: -13n },
    { a: 19n, b: 8n },
    { a: -1n, b: -9n },
    { a: 1n, b: -12n },
    { a: -14n, b: 11n },
    { a: 8n, b: -5n },
    { a: 9n, b: 3n },
    { a: -20n, b: 18n },
    { a: 16n, b: -8n },
    { a: 2n, b: 6n },
    { a: -15n, b: 13n },
    { a: 4n, b: 1n },
    { a: 17n, b: -11n },
    { a: -6n, b: 7n },
    { a: 0n, b: -3n },
    { a: -13n, b: 14n },
    { a: 5n, b: -19n },
    { a: 18n, b: -7n },
    { a: -10n, b: 9n },
    { a: -17n, b: 3n },
    { a: 6n, b: 19n },
    { a: 7n, b: -4n },
    { a: -1n, b: 10n },
    { a: 10n, b: 5n },
    { a: -18n, b: -6n },
    { a: 20n, b: -9n }
  ]

  /**
   * @param {bigint} a
   * @param {bigint} b
   * @returns {bigint}
   */
  function remainderIntegerWithQuotient(a: bigint, b: bigint): bigint {
    const aOverB = Either.getOrThrow(Builtins.evalQuotient(a, b))

    return a - aOverB * b
  }

  it("throws an error when second arg is 0", () => {
    expect(Builtins.evalRemainder(1n, 0n)._tag).toBe("Left")
  })

  testVector.forEach(({ a, b }) => {
    const expected = remainderIntegerWithQuotient(a, b)
    it(`${a} quot ${b} == ${expected}`, () => {
      const actual = Either.getOrThrow(Builtins.evalRemainder(a, b))

      expect(actual).toBe(expected)
    })
  })
})

describe("Uplc.Builtins BLS12-381 V3", () => {
  const g1 = Either.getOrThrow(
    Bls12_381.decodeG1(
      Bytes.toUint8Array(
        "950dfd33da2682260c76038dfb8bad6e84ae9d599a3c151815945ac1e6ef6b1027cd917f3907479d20d636ce437a41f5"
      )
    )
  )
  const g2 = Either.getOrThrow(
    Bls12_381.decodeG2(
      Bytes.toUint8Array(
        "b0629fa1158c2d23a10413fe91d381a84d25e31d041cd0377d25828498fd02011b35893938ced97535395e4815201e67108bcd4665e0db25d602d76fa791fab706c54abf5e1a9e44b4ac1e6badf3d2ac0328f5e30be341677c8bac5dda7682f1"
      )
    )
  )

  it("copies conformance: bls12_381_G1_compress/compress", () => {
    const result = Either.getOrThrow(
      Builtins.V3[59].call(
        [{ _tag: "Const", value: { g1Element: Value.g1ToTuple(g1) } }],
        {} as never
      )
    )

    expect(result).toEqual({
      _tag: "Const",
      value: Bytes.toUint8Array(
        "950dfd33da2682260c76038dfb8bad6e84ae9d599a3c151815945ac1e6ef6b1027cd917f3907479d20d636ce437a41f5"
      )
    })
  })

  it("copies conformance: bls12_381_G1_uncompress/off-curve", () => {
    const result = Builtins.V3[60].call(
      [
        {
          _tag: "Const",
          value: Bytes.toUint8Array(
            "a00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003"
          )
        }
      ],
      {} as never
    )

    expect(result._tag).toBe("Left")
  })

  it("copies conformance: bls12_381_millerLoop/equal-pairing", () => {
    const ml = Either.getOrThrow(
      Builtins.V3[68].call(
        [
          { _tag: "Const", value: { g1Element: Value.g1ToTuple(g1) } },
          { _tag: "Const", value: { g2Element: Value.g2ToTuple(g2) } }
        ],
        {} as never
      )
    )

    const verified = Either.getOrThrow(
      Builtins.V3[70].call([ml, ml], {} as never)
    )

    expect(verified).toEqual({ _tag: "Const", value: true })
  })
})
