import { describe, expect, it } from "bun:test"
import { Either } from "effect"
import * as Bytes from "../../Codecs/Bytes.js"
import * as Bls12_381 from "../../Crypto/Bls12_381.js"
import * as Builtins from "./Builtins.js"
import type { Value as CekValue } from "./Cek.js"
import * as Type from "./Type.js"
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
  const blsBuiltins = [
    ...Builtins.V3,
    Builtins.bls12_381_G1_multiScalarMulV3,
    Builtins.bls12_381_G2_multiScalarMulV3
  ]

  const scalar =
    29342537169447282925541144552701591957563885683358707334406144036950193508773n
  const scalarUpperBound = 2n ** 4095n - 1n
  const scalarLowerBound = -(2n ** 4095n)

  const g1A =
    "b93105d0cff4c3f6a42ab790900a26bb1843f4b07fc83d527a66e4a2ddf6c49ea86fe37b1106dbd20dc280ec5996dadf"
  const g1B =
    "a077246742bfbffdefc1193aba17434d337f231478bf63173065c1e09c34429e76877983ae5f3add1438e5d237f63724"
  const g1C =
    "abd61864f519748032551e42e0ac417fd828f079454e3e3c9891c5c29ed7f10bdecc046854e3931cb7002779bd76d71f"
  const g1ExpectedSum =
    "9863eb0a7f8b092fca1a4333866ae3579ad2a4edef84bfcdf736333b3adf0100820c7603b002bf911b564cf032392f07"
  const g1ExpectedNeg =
    "993105d0cff4c3f6a42ab790900a26bb1843f4b07fc83d527a66e4a2ddf6c49ea86fe37b1106dbd20dc280ec5996dadf"
  const g1ExpectedScalarMul =
    "a07796202c3fcad405a5da58d99f0194c8ee21999dd03291f0bfe97e68eb4e69077cf8052b9f5d9cbc4a1394baa0e0d8"
  const g1CompressInput =
    "950dfd33da2682260c76038dfb8bad6e84ae9d599a3c151815945ac1e6ef6b1027cd917f3907479d20d636ce437a41f5"

  const g2A =
    "b5ed6482bf5486831a9eb445b8b9a77aa6330005b8b432523c69fee7085d3032856de9f857c55ac9745eabcf14894205149cc67393687289e6c2728be69ad1f8ea1a6c0a5a65bf93eca984f3dac5da1abc6f7156ccbc5a33c655f7b17724eb19"
  const g2B =
    "a6cc0f01663fd65a95d1359758ebe3a412ce05f4242b0c1f5964351b38e188362a8ceb6c2f86d3f7e5f73b60cd04288005d2a50f8ddf1751d7a915515054276fbae7569c3f18c614c9954177d8e745e98404654cf759d4747b0c806bbd336b7d"
  const g2ExpectedSum =
    "b3db03681aaf0d218be32f7cc94bd6a975c6870b4a1d4e461b77b60eee2461ca367154b0c4583b2d5f81124aa21fdf3e09ff6b54ce7c57572283a175fba381a32ac6f46abaf11cdbaeb206dcd7d4269caa4d0ebbb3adc1b8fce42ccfa855ea83"
  const g2ExpectedNeg =
    "95ed6482bf5486831a9eb445b8b9a77aa6330005b8b432523c69fee7085d3032856de9f857c55ac9745eabcf14894205149cc67393687289e6c2728be69ad1f8ea1a6c0a5a65bf93eca984f3dac5da1abc6f7156ccbc5a33c655f7b17724eb19"
  const g2ExpectedScalarMul =
    "89b8e839c317ab3c735c6a65122fff4654f469c30c480701f6e4d9f311f3c5f3411c7cd2876c539bf56f983d14e550b5172765f62bba1235394a33413c21667a57214e9a6f2516f8d7bf57321c20bf8cd8ecd290691ad6bd5ab9e391304240a4"
  const g2CompressInput =
    "b0629fa1158c2d23a10413fe91d381a84d25e31d041cd0377d25828498fd02011b35893938ced97535395e4815201e67108bcd4665e0db25d602d76fa791fab706c54abf5e1a9e44b4ac1e6badf3d2ac0328f5e30be341677c8bac5dda7682f1"

  function bytes(hex: string): Uint8Array {
    return Bytes.toUint8Array(hex)
  }

  function constValue(value: Value.Value): CekValue {
    return { _tag: "Const", value }
  }

  function callBuiltinEither(name: string, args: readonly Value.Value[]) {
    const builtin = blsBuiltins.find((builtin) => builtin.name == name)

    if (builtin == undefined) {
      throw new Error(`missing builtin '${name}'`)
    }

    return builtin.call(args.map(constValue), {} as never)
  }

  function callBuiltin(name: string, args: readonly Value.Value[]): Value.Value {
    const result = Either.getOrThrow(callBuiltinEither(name, args))

    if (result._tag != "Const") {
      throw new Error(`expected '${name}' to return a constant`)
    }

    return result.value
  }

  function callBool(name: string, args: readonly Value.Value[]): boolean {
    const result = callBuiltin(name, args)

    if (typeof result != "boolean") {
      throw new Error(`expected '${name}' to return bool`)
    }

    return result
  }

  function callBytes(name: string, args: readonly Value.Value[]): Uint8Array {
    const result = callBuiltin(name, args)

    if (!(result instanceof Uint8Array)) {
      throw new Error(`expected '${name}' to return bytes`)
    }

    return result
  }

  function intList(items: readonly bigint[]): Value.List {
    return { itemType: Type.Int, items }
  }

  function g1List(items: readonly string[]): Value.List {
    return {
      itemType: Type.Bls12_381_G1Element,
      items: items.map(g1Value)
    }
  }

  function g2List(items: readonly string[]): Value.List {
    return {
      itemType: Type.Bls12_381_G2Element,
      items: items.map(g2Value)
    }
  }

  function g1Value(hex: string): Value.Bls12_381_G1Element {
    return {
      g1Element: Value.g1ToTuple(
        Either.getOrThrow(Bls12_381.decodeG1(bytes(hex)))
      )
    }
  }

  function g2Value(hex: string): Value.Bls12_381_G2Element {
    return {
      g2Element: Value.g2ToTuple(
        Either.getOrThrow(Bls12_381.decodeG2(bytes(hex)))
      )
    }
  }

  function expectMlResult(value: Value.Value): Value.Bls12_381_MlResult {
    if (typeof value == "object" && value != null && "mlResult" in value) {
      return value
    }

    throw new Error("expected bls12_381_mlresult")
  }

  function expectG1Equal(actual: Value.Value, expectedHex: string) {
    expect(
      callBool("bls12_381_G1_equal", [actual, g1Value(expectedHex)])
    ).toBe(true)
  }

  function expectG1Compressed(actual: Value.Value, expectedHex: string) {
    expect(Bytes.toHex(callBytes("bls12_381_G1_compress", [actual]))).toBe(
      expectedHex
    )
  }

  function expectG2Equal(actual: Value.Value, expectedHex: string) {
    expect(
      callBool("bls12_381_G2_equal", [actual, g2Value(expectedHex)])
    ).toBe(true)
  }

  function expectG2Compressed(actual: Value.Value, expectedHex: string) {
    expect(Bytes.toHex(callBytes("bls12_381_G2_compress", [actual]))).toBe(
      expectedHex
    )
  }

  function millerLoop(
    g1: Value.Bls12_381_G1Element,
    g2: Value.Bls12_381_G2Element
  ): Value.Bls12_381_MlResult {
    return expectMlResult(callBuiltin("bls12_381_millerLoop", [g1, g2]))
  }

  function mulMlResult(
    a: Value.Bls12_381_MlResult,
    b: Value.Bls12_381_MlResult
  ): Value.Bls12_381_MlResult {
    return expectMlResult(callBuiltin("bls12_381_mulMlResult", [a, b]))
  }

  function finalVerify(
    a: Value.Bls12_381_MlResult,
    b: Value.Bls12_381_MlResult
  ): boolean {
    return callBool("bls12_381_finalVerify", [a, b])
  }

  it("copies conformance: bls12_381_G1_compress/compress", () => {
    expect(
      Bytes.toHex(callBytes("bls12_381_G1_compress", [g1Value(g1CompressInput)]))
    ).toBe(g1CompressInput)
  })

  it("copies conformance: bls12_381_G2_compress/compress", () => {
    expect(
      Bytes.toHex(callBytes("bls12_381_G2_compress", [g2Value(g2CompressInput)]))
    ).toBe(g2CompressInput)
  })

  it("copies conformance: bls12_381_G1_add/add", () => {
    expectG1Equal(
      callBuiltin("bls12_381_G1_add", [g1Value(g1A), g1Value(g1B)]),
      g1ExpectedSum
    )
  })

  it("copies conformance: bls12_381_G1_add/add-zero", () => {
    expectG1Compressed(
      callBuiltin("bls12_381_G1_add", [
        g1Value(g1C),
        g1Value(
          "c00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
        )
      ]),
      g1C
    )
  })

  it("copies conformance: bls12_381_G1_add/add-commutative", () => {
    expect(
      callBool("bls12_381_G1_equal", [
        callBuiltin("bls12_381_G1_add", [g1Value(g1C), g1Value(g1CompressInput)]),
        callBuiltin("bls12_381_G1_add", [g1Value(g1CompressInput), g1Value(g1C)])
      ])
    ).toBe(true)
  })

  it("copies conformance: bls12_381_G1_neg/neg", () => {
    expectG1Equal(
      callBuiltin("bls12_381_G1_neg", [g1Value(g1A)]),
      g1ExpectedNeg
    )
  })

  it("copies conformance: bls12_381_G1_neg/add-neg", () => {
    expectG1Compressed(
      callBuiltin("bls12_381_G1_add", [
        g1Value(g1C),
        callBuiltin("bls12_381_G1_neg", [g1Value(g1C)])
      ]),
      "c00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
    )
  })

  it("copies conformance: bls12_381_G1_scalarMul/scalarMul", () => {
    expectG1Equal(
      callBuiltin("bls12_381_G1_scalarMul", [scalar, g1Value(g1B)]),
      g1ExpectedScalarMul
    )
  })

  it.each([
    ["mul-zero", 0n],
    ["mul-one", 1n],
    ["mul-neg-one", -1n],
    ["mul-44", 44n],
    ["mulneg-44", -44n],
    ["mulperiodic-01", Bls12_381.R],
    ["mulperiodic-02", Bls12_381.R + 123n]
  ])("copies conformance: bls12_381_G1_scalarMul/%s", (_name, s) => {
    expect(
      callBool("bls12_381_G1_equal", [
        callBuiltin("bls12_381_G1_scalarMul", [s, g1Value(g1CompressInput)]),
        callBuiltin("bls12_381_G1_scalarMul", [s % Bls12_381.R, g1Value(g1CompressInput)])
      ])
    ).toBe(true)
  })

  it("copies conformance: bls12_381_G2_add/add", () => {
    expectG2Equal(
      callBuiltin("bls12_381_G2_add", [g2Value(g2A), g2Value(g2B)]),
      g2ExpectedSum
    )
  })

  it("copies conformance: bls12_381_G2_add/add-commutative", () => {
    expect(
      callBool("bls12_381_G2_equal", [
        callBuiltin("bls12_381_G2_add", [g2Value(g2A), g2Value(g2B)]),
        callBuiltin("bls12_381_G2_add", [g2Value(g2B), g2Value(g2A)])
      ])
    ).toBe(true)
  })

  it("copies conformance: bls12_381_G2_neg/neg", () => {
    expectG2Equal(
      callBuiltin("bls12_381_G2_neg", [g2Value(g2A)]),
      g2ExpectedNeg
    )
  })

  it("copies conformance: bls12_381_G2_neg/add-neg", () => {
    expectG2Compressed(
      callBuiltin("bls12_381_G2_add", [
        g2Value(g2A),
        callBuiltin("bls12_381_G2_neg", [g2Value(g2A)])
      ]),
      "c00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
    )
  })

  it("copies conformance: bls12_381_G2_scalarMul/scalarMul", () => {
    expectG2Equal(
      callBuiltin("bls12_381_G2_scalarMul", [scalar, g2Value(g2B)]),
      g2ExpectedScalarMul
    )
  })

  it.each([
    ["mul-zero", 0n],
    ["mul-one", 1n],
    ["mul-neg-one", -1n],
    ["mul-44", 44n],
    ["mulneg-44", -44n],
    ["mulperiodic-01", Bls12_381.R],
    ["mulperiodic-02", Bls12_381.R + 123n]
  ])("copies conformance: bls12_381_G2_scalarMul/%s", (_name, s) => {
    expect(
      callBool("bls12_381_G2_equal", [
        callBuiltin("bls12_381_G2_scalarMul", [s, g2Value(g2CompressInput)]),
        callBuiltin("bls12_381_G2_scalarMul", [s % Bls12_381.R, g2Value(g2CompressInput)])
      ])
    ).toBe(true)
  })

  it.each([
    ["bls12_381_G1_hashToGroup", "G1"],
    ["bls12_381_G2_hashToGroup", "G2"]
  ])("copies conformance: %s/hash-dst-len-256", (builtinName) => {
    const dstLen256 =
      "123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890ff"

    expect(callBuiltinEither(builtinName, [bytes("3f"), bytes(dstLen256)])._tag).toBe(
      "Left"
    )
  })

  it("copies conformance: bls12_381_G2_hashToGroup/hash", () => {
    expectG2Equal(
      callBuiltin("bls12_381_G2_hashToGroup", [bytes("8e"), bytes("0a")]),
      "abdb064dbaa986d9609796d7a80ef07f719f99fa5d9876e01f9298793d4c7e7ba9b2c55da6896f90693ad76a093d280118a4c24df9a387eaf85b15927365a110fe5256f53ddf8bef4069fe761d8215d4a73ec980f1a801dbaba25146b6ca7e07"
    )
  })

  it.each([
    [
      "bls12_381_G1_hashToGroup/hash",
      "bls12_381_G1_hashToGroup",
      "8e",
      "0a",
      "a45ddef02cdd86039be4b0a863cba70ea903194ea0489ce619c6276175839d62eea72b095d6566067f4a44b85614f199"
    ],
    [
      "bls12_381_G1_hashToGroup/hash-empty-dst",
      "bls12_381_G1_hashToGroup",
      "8e",
      "",
      "9019067bf1fa5b2a7a40fb31a70c66f25a3de7e3ef42f8365c9b7963dc01e15a2e086df6d1a181b1d12811a520440909"
    ],
    [
      "bls12_381_G2_hashToGroup/hash-empty-dst",
      "bls12_381_G2_hashToGroup",
      "8e",
      "",
      "8785334bbccf9f7a1bc656fcbcaf9901521cc09a076ff69d40e467082b605d668219747dfec37c798c97b2c7f28ec90117c4ccfc54ef3cc3c0038951c4969a3c0b3fb842a78103586657428ab38d719c9d3314de566cd95540aaccf7afd48821"
    ]
  ])("copies conformance: %s", (_name, builtinName, msg, dst, expected) => {
    const actual = callBuiltin(builtinName, [bytes(msg), bytes(dst)])

    if (builtinName.includes("_G1_")) {
      expectG1Compressed(actual, expected)
    } else {
      expectG2Compressed(actual, expected)
    }
  })

  const hashDistinctnessConformance = [
    {
      name: "bls12_381_G1_hashToGroup/hash-different-msg-same-dst",
      equalBuiltin: "bls12_381_G1_equal",
      hashBuiltin: "bls12_381_G1_hashToGroup",
      msgA: "8e",
      msgB: "81",
      dstA: "0a"
    },
    {
      name: "bls12_381_G1_hashToGroup/hash-same-msg-different-dst",
      equalBuiltin: "bls12_381_G1_equal",
      hashBuiltin: "bls12_381_G1_hashToGroup",
      msgA: "8e",
      msgB: "8e",
      dstA: "0a",
      dstB: "01"
    },
    {
      name: "bls12_381_G2_hashToGroup/hash-different-msg-same-dst",
      equalBuiltin: "bls12_381_G2_equal",
      hashBuiltin: "bls12_381_G2_hashToGroup",
      msgA: "8e",
      msgB: "81",
      dstA: "0a"
    },
    {
      name: "bls12_381_G2_hashToGroup/hash-same-msg-different-dst",
      equalBuiltin: "bls12_381_G2_equal",
      hashBuiltin: "bls12_381_G2_hashToGroup",
      msgA: "8e",
      msgB: "8e",
      dstA: "0a",
      dstB: "01"
    }
  ] satisfies {
    name: string
    equalBuiltin: string
    hashBuiltin: string
    msgA: string
    msgB: string
    dstA: string
    dstB?: string
  }[]

  for (const {
    name,
    equalBuiltin,
    hashBuiltin,
    msgA,
    msgB,
    dstA,
    dstB = dstA
  } of hashDistinctnessConformance) {
    it(`copies conformance: ${name}`, () => {
      expect(
        callBool(equalBuiltin, [
          callBuiltin(hashBuiltin, [bytes(msgA), bytes(dstA)]),
          callBuiltin(hashBuiltin, [bytes(msgB), bytes(dstB)])
        ])
      ).toBe(false)
    })
  }

  it.each([
    ["bls12_381_G1_scalarMul", scalarUpperBound + 1n, g1Value(g1A)],
    ["bls12_381_G1_scalarMul", scalarLowerBound - 1n, g1Value(g1A)],
    ["bls12_381_G2_scalarMul", scalarUpperBound + 1n, g2Value(g2A)],
    ["bls12_381_G2_scalarMul", scalarLowerBound - 1n, g2Value(g2A)]
  ])("rejects Plutus out-of-bounds scalar: %s", (builtinName, scalar, point) => {
    expect(callBuiltinEither(builtinName, [scalar, point])._tag).toBe("Left")
  })

  it.each([
    [
      "bls12_381_G1_uncompress/off-curve",
      "bls12_381_G1_uncompress",
      "864cc4f64b12ca99ecdd1962572e6add609d9c619aab678b3fc298bc2f0f81feb4f0d3ebad7e850a8bcb52ca467e649d"
    ],
    [
      "bls12_381_G1_uncompress/out-of-group",
      "bls12_381_G1_uncompress",
      "9483141c933166b61990a706aca07f467d22bc34c6552f5bba91cb1fc21db51d03dfff6523a5e1b4285d54c47660eda1"
    ],
    [
      "bls12_381_G2_uncompress/off-curve",
      "bls12_381_G2_uncompress",
      "87861839e602fc5dfa0d0b72232dd81d2b0e4b660a7eba353da27e66ceaf2d6c7734925247281866a12d67752a1edaad01ea59e4e86e2e85a81a573cd68f6dfb526558d81a8f488f261f355ddac23f6caf07d27fda71d8f3968d4ceeda89a09d"
    ],
    [
      "bls12_381_G2_uncompress/out-of-group",
      "bls12_381_G2_uncompress",
      "8bd83699f607412448d202d948bb111badd456d68086ff9a5906ea3b2cda4111d3638391f7a7b153eea77ab47215d6fe13b350f59f884c6e31ac087239d9145b816424cba2c8bcb7b3ed7e19638089d91e5c9136d2aefc8da165284b42229a70"
    ]
  ])("copies conformance: %s", (_name, builtinName, input) => {
    expect(callBuiltinEither(builtinName, [bytes(input)])._tag).toBe("Left")
  })

  it.each([
    [
      "bls12_381_G1_uncompress/zero",
      "bls12_381_G1_uncompress",
      "c00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
    ],
    [
      "bls12_381_G1_uncompress/on-curve-bit3-set",
      "bls12_381_G1_uncompress",
      "a1e9a0c68985059bd25a5ef05b351ca22f7d7c19e37928583ae12a1f4939440ff754cfd85b23df4a54f66c7089db6deb"
    ],
    [
      "bls12_381_G2_uncompress/zero",
      "bls12_381_G2_uncompress",
      "c00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
    ],
    [
      "bls12_381_G2_uncompress/on-curve-bit3-set",
      "bls12_381_G2_uncompress",
      "a8138ebea766d4d1aa64dd3b5826244c32ea3fe9351f9c8d584203716dae151d14bb5d06e245c24877955c79287682ba082d077bbb2afdb1ad1d48d18e2f0c56b001bce207801adfa9fd451fc59d56f0433b02f921ba5a272c58c06536291d07"
    ]
  ])("copies conformance: %s", (_name, builtinName, input) => {
    const actual = callBuiltin(builtinName, [bytes(input)])

    if (builtinName.includes("_G1_")) {
      expectG1Compressed(actual, input)
    } else {
      expectG2Compressed(actual, input)
    }
  })

  it.each([
    ["G1", "bls12_381_G1_multiScalarMul", "bls12_381_G1_scalarMul", g1List],
    ["G2", "bls12_381_G2_multiScalarMul", "bls12_381_G2_scalarMul", g2List]
  ])(
    "copies conformance: bls12_381_%s_multiScalarMul/multiScalarMul-01",
    (_group, msmBuiltin, scalarMulBuiltin, groupList) => {
      const scalars = [-7843724524521392138901923801823923123123454352157n]
      const points = _group == "G1" ? [g1CompressInput] : [g2CompressInput]
      const expected = callBuiltin(scalarMulBuiltin, [
        scalars[0],
        groupList(points).items[0]
      ])

      expect(
        callBool(`bls12_381_${_group}_equal`, [
          callBuiltin(msmBuiltin, [intList(scalars), groupList(points)]),
          expected
        ])
      ).toBe(true)
    }
  )

  it.each([
    ["G1", "bls12_381_G1_multiScalarMul", "bls12_381_G1_add", "bls12_381_G1_scalarMul", g1List],
    ["G2", "bls12_381_G2_multiScalarMul", "bls12_381_G2_add", "bls12_381_G2_scalarMul", g2List]
  ])(
    "copies conformance: bls12_381_%s_multiScalarMul/zip-and-add",
    (_group, msmBuiltin, addBuiltin, scalarMulBuiltin, groupList) => {
      const scalars = [3n, -5n, 7n]
      const points = _group == "G1" ? [g1A, g1B, g1C] : [g2A, g2B, g2CompressInput]
      const expected = scalars
        .map((s, i) => callBuiltin(scalarMulBuiltin, [s, groupList(points).items[i]]))
        .reduce((a, b) => callBuiltin(addBuiltin, [a, b]))

      expect(
        callBool(`bls12_381_${_group}_equal`, [
          callBuiltin(msmBuiltin, [intList(scalars), groupList(points)]),
          expected
        ])
      ).toBe(true)
    }
  )

  it.each([
    ["G1", "bls12_381_G1_multiScalarMul", g1List],
    ["G2", "bls12_381_G2_multiScalarMul", g2List]
  ])(
    "copies conformance: bls12_381_%s_multiScalarMul/empty-and-extra-lists",
    (_group, msmBuiltin, groupList) => {
      const zero =
        _group == "G1"
          ? "c00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
          : "c00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
      const points = _group == "G1" ? [g1A, g1B] : [g2A, g2B]

      const emptyScalars = callBuiltin(msmBuiltin, [
        intList([]),
        groupList(points)
      ])
      const emptyPoints = callBuiltin(msmBuiltin, [
        intList([1n, 2n, 3n]),
        groupList([])
      ])
      const extraScalars = callBuiltin(msmBuiltin, [
        intList([3n, 99n, 100n]),
        groupList([points[0]])
      ])
      const oneScalar = callBuiltin(msmBuiltin, [
        intList([3n]),
        groupList([points[0]])
      ])

      if (_group == "G1") {
        expectG1Compressed(emptyScalars, zero)
        expectG1Compressed(emptyPoints, zero)
      } else {
        expectG2Compressed(emptyScalars, zero)
        expectG2Compressed(emptyPoints, zero)
      }

      expect(
        callBool(`bls12_381_${_group}_equal`, [extraScalars, oneScalar])
      ).toBe(true)
    }
  )

  it.each([
    ["bls12_381_G1_multiScalarMul", scalarUpperBound + 1n, g1List([g1A])],
    ["bls12_381_G1_multiScalarMul", scalarLowerBound - 1n, g1List([g1A])],
    ["bls12_381_G2_multiScalarMul", scalarUpperBound + 1n, g2List([g2A])],
    ["bls12_381_G2_multiScalarMul", scalarLowerBound - 1n, g2List([g2A])]
  ])("rejects Plutus out-of-bounds scalar: %s", (builtinName, scalar, points) => {
    expect(callBuiltinEither(builtinName, [intList([scalar]), points])._tag).toBe(
      "Left"
    )
  })

  it("copies conformance: bls12_381_millerLoop/balanced", () => {
    const n = 251123n
    const g1 = g1Value(g1CompressInput)
    const g2 = g2Value(g2CompressInput)
    const nG1 = callBuiltin("bls12_381_G1_scalarMul", [n, g1])
    const nG2 = callBuiltin("bls12_381_G2_scalarMul", [n, g2])

    expect(
      finalVerify(
        millerLoop(g1Value(Bytes.toHex(callBytes("bls12_381_G1_compress", [nG1]))), g2),
        millerLoop(g1, g2Value(Bytes.toHex(callBytes("bls12_381_G2_compress", [nG2]))))
      )
    ).toBe(true)
  })

  it("copies conformance: bls12_381_mulMlResult/left-additive", () => {
    const g1Sum = callBuiltin("bls12_381_G1_add", [
      g1Value(g1CompressInput),
      g1Value(g1C)
    ])
    const g2 = g2Value(g2CompressInput)

    expect(
      finalVerify(
        millerLoop(
          g1Value(Bytes.toHex(callBytes("bls12_381_G1_compress", [g1Sum]))),
          g2
        ),
        mulMlResult(
          millerLoop(g1Value(g1CompressInput), g2),
          millerLoop(g1Value(g1C), g2)
        )
      )
    ).toBe(true)
  })

  it("copies conformance: bls12_381_finalVerify/false", () => {
    const g1 = g1Value(g1CompressInput)
    const g2 = g2Value(g2CompressInput)
    const nG1 = callBuiltin("bls12_381_G1_scalarMul", [2n, g1])
    const left = millerLoop(
      g1Value(Bytes.toHex(callBytes("bls12_381_G1_compress", [nG1]))),
      g2
    )
    const right = millerLoop(g1, g2)

    expect(finalVerify(left, right)).toBe(false)
  })
})
