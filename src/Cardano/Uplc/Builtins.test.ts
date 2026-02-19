import { describe, expect, it } from "bun:test"
import { Either } from "effect"
import * as Builtins from "./Builtins.js"

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
