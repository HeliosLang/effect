import { describe, expect, it } from "bun:test"
import { Either } from "effect"
import { runSync } from "effect/Effect"
import { makeStream, toArray, toHex } from "./internal/Bytes.js"
import * as Cbor from "./Cbor.js"

const FALSE_CBOR_BYTE = 0xf4
const TRUE_CBOR_BYTE = 0xf5

describe("Cbor.decodeBool", () => {
  it(`returns false for [${FALSE_CBOR_BYTE}]`, () => {
    expect(runSync(Cbor.decodeBool([FALSE_CBOR_BYTE]))).toBe(false)
  })

  it(`returns true for [${TRUE_CBOR_BYTE}]`, () => {
    expect(runSync(Cbor.decodeBool([TRUE_CBOR_BYTE]))).toBe(true)
  })

  it("fails for [0xf6]", () => {
    expect(() => runSync(Cbor.decodeBool([0xf6]))).toThrow()
  })

  it("fails for [0xf3]", () => {
    expect(() => runSync(Cbor.decodeBool([0xf3]))).toThrow()
  })

  it("fails for empty bytes", () => {
    expect(() => runSync(Cbor.decodeBool([]))).toThrow()
  })
})

describe("Cbor.encodeBool", () => {
  it(`returns [${FALSE_CBOR_BYTE}] for false`, () => {
    expect(Cbor.encodeBool(false)).toEqual([FALSE_CBOR_BYTE])
  })

  it(`returns [${TRUE_CBOR_BYTE}] for true`, () => {
    expect(Cbor.encodeBool(true)).toEqual([TRUE_CBOR_BYTE])
  })
})

describe("Cbor.isBool", () => {
  it("returns false for empty bytes", () => {
    expect(Cbor.isBool([])).toBe(false)
  })

  it(`returns true for [${FALSE_CBOR_BYTE}]`, () => {
    expect(Cbor.isBool([FALSE_CBOR_BYTE])).toBe(true)
  })

  it(`returns true for [${TRUE_CBOR_BYTE}]`, () => {
    expect(Cbor.isBool([TRUE_CBOR_BYTE])).toBe(true)
  })

  it("doesn't change stream pos", () => {
    const stream = makeStream([TRUE_CBOR_BYTE])

    expect(Cbor.isBool(stream)).toBe(true)
    expect(stream.pos).toBe(0)
  })

  it("doesn't change stream pos if not a bool", () => {
    const stream = makeStream(Cbor.encodeInt(0))

    expect(Cbor.isBool(stream)).toBe(false)
    expect(stream.pos).toBe(0)
  })
})

describe("Cbor.decodeBytes()", () => {
  it("returns [] for [0x40]", () => {
    expect(runSync(Cbor.decodeBytes([0x40]))).toEqual([])
  })

  it("returns [1,2,3,4] for #4401020304", () => {
    expect(runSync(Cbor.decodeBytes("4401020304"))).toEqual([1, 2, 3, 4])
  })

  it("returns #4d01000033222220051200120011 for #4e4d01000033222220051200120011", () => {
    expect(runSync(Cbor.decodeBytes("4e4d01000033222220051200120011"))).toEqual(
      toArray("4d01000033222220051200120011")
    )
  })

  it("fails when trying to decode a list", () => {
    expect(() => {
      runSync(Cbor.decodeBytes(Cbor.encodeDefList([Cbor.encodeInt(0)])))
    }).toThrow()
  })
})

describe("Cbor.encodeBytes()", () => {
  it("returns #4e4d01000033222220051200120011 for #4d01000033222220051200120011", () => {
    expect(Cbor.encodeBytes("4d01000033222220051200120011")).toEqual(
      toArray("4e4d01000033222220051200120011")
    )
  })
})

describe("Cbor.encodeBytes()/Cbor.decodeBytes() roundtrip", () => {
  const testVector = []

  for (let i = 0; i < 100; i++) {
    testVector.push(
      new Array(i).fill(0).map(() => Math.floor(256 * Math.random()) % 256)
    )
  }

  testVector.forEach((v, i) => {
    const split = i % 2 == 0

    it(`ok for ${toHex(v)}`, () => {
      expect(runSync(Cbor.decodeBytes(Cbor.encodeBytes(v, split)))).toEqual(v)
    })
  })
})

describe("Cbor.isBytes()", () => {
  it("returns false for empty bytes", () => {
    expect(Cbor.isBytes([])).toBe(false)
  })

  it("returns false for [0]", () => {
    expect(Cbor.isBytes([0])).toBe(false)
  })

  it("returns true for #4e4d01000033222220051200120011", () => {
    expect(Cbor.isBytes("4e4d01000033222220051200120011")).toBe(true)
  })

  it("doesn't change stream pos", () => {
    const stream = makeStream("4e4d01000033222220051200120011")

    expect(Cbor.isBytes(stream)).toBe(true)
    expect(stream.pos).toBe(0)
  })

  it("doesn't change stream pos if not bytes", () => {
    const stream = makeStream(Cbor.encodeInt(0))

    expect(Cbor.isBytes(stream)).toBe(false)
    expect(stream.pos).toBe(0)
  })
})

describe("Cbor.isDefBytes()", () => {
  it("returns false for empty bytes", () => {
    expect(Cbor.isDefBytes([])).toBe(false)
  })

  it("returns false for [0]", () => {
    expect(Cbor.isDefBytes([0])).toBe(false)
  })

  it("returns false for indef bytes", () => {
    expect(Cbor.isDefBytes([2 * 32 + 31])).toBe(false)
  })

  it("returns true for #4e4d01000033222220051200120011", () => {
    expect(Cbor.isDefBytes("4e4d01000033222220051200120011")).toBe(
      true
    )
  })
})

describe("Cbor.decodeConstr", () => {
  // test vectors taken from https://github.com/input-output-hk/plutus/blob/master/plutus-core/plutus-core/test/CBOR/DataStability.hs#L83
  describe("returns [0, [#bd99a373075d42fe4ac9109515e46303d0940cb9620bf058b87986a9, [0, []]]]", () => {
    const expected = [
      0,
      [
        toArray("bd99a373075d42fe4ac9109515e46303d0940cb9620bf058b87986a9"),
        [0, []]
      ]
    ] as [number, [number[], [number, []]]]

    const testVectors = [
      "d87982581cbd99a373075d42fe4ac9109515e46303d0940cb9620bf058b87986a9d87980",
      "d8799f581cbd99a373075d42fe4ac9109515e46303d0940cb9620bf058b87986a9d87980ff"
    ]

    testVectors.forEach((v) => {
      it(`ok for ${v}`, () => {
        const actual = runSync(
          Cbor.decodeConstr([Cbor.decodeBytes, Cbor.decodeConstr([])])(v)
        )

        expect(actual).toEqual(expected)
      })

      it(`fails for ${v} too few field decoders`, () => {
        expect(() =>
          runSync(Cbor.decodeConstr([Cbor.decodeBytes])(v))
        ).toThrow()
      })

      it(`fails for ${v} too many field decoders`, () => {
        expect(() =>
          runSync(
            Cbor.decodeConstr([
              Cbor.decodeBytes,
              Cbor.decodeConstr([]),
              Cbor.decodeInt
            ])(v)
          )
        ).toThrow()
      })
    })
  })

  it("fails for []", () => {
    expect(() => runSync(Cbor.decodeConstr([])([]))).toThrow()
  })

  it("fails for [0]", () => {
    expect(() => runSync(Cbor.decodeConstr([])([0]))).toThrow()
  })

  describe(`returns [0, [[0,[[[0, [[], [[0, [[], 2123n]]]]]], [[0, [[], [[0, [[], 2223n]]]]]]]]]]`, () => {
    const expected: [
      number,
      [
        [
          number,
          [
            [number, [number[], [number, [number[], bigint]][]]][],
            [number, [number[], [number, [number[], bigint]][]]][]
          ]
        ]
      ]
    ] = [
      0,
      [[0, [[[0, [[], [[0, [[], 2123n]]]]]], [[0, [[], [[0, [[], 2223n]]]]]]]]]
    ]

    const testVectors = [
      "d87981d8798281d879824081d879824019084b81d879824081d87982401908af",
      "d8799fd8799f9fd8799f409fd8799f4019084bffffffff9fd8799f409fd8799f401908afffffffffffff"
    ]

    testVectors.forEach((v) => {
      it(`ok for ${v}`, () => {
        const actual = runSync(
          Cbor.decodeConstr([
            Cbor.decodeConstr([
              Cbor.decodeList(
                Cbor.decodeConstr([
                  Cbor.decodeBytes,
                  Cbor.decodeList(
                    Cbor.decodeConstr([Cbor.decodeBytes, Cbor.decodeInt])
                  )
                ])
              ),
              Cbor.decodeList(
                Cbor.decodeConstr([
                  Cbor.decodeBytes,
                  Cbor.decodeList(
                    Cbor.decodeConstr([Cbor.decodeBytes, Cbor.decodeInt])
                  )
                ])
              )
            ])
          ])(v)
        )

        expect(actual).toEqual(expected)
      })
    })
  })
})

describe("Cbor.encodeConstr()", () => {
  it("returns #d8799f581cbd99a373075d42fe4ac9109515e46303d0940cb9620bf058b87986a9d87980ff for [0, [#bd99a373075d42fe4ac9109515e46303d0940cb9620bf058b87986a9, [0, []]]]", () => {
    expect(
      Cbor.encodeConstr(0, [
        Cbor.encodeBytes(
          "bd99a373075d42fe4ac9109515e46303d0940cb9620bf058b87986a9"
        ),
        Cbor.encodeConstr(0, [])
      ])
    ).toEqual(
      toArray(
        "d8799f581cbd99a373075d42fe4ac9109515e46303d0940cb9620bf058b87986a9d87980ff"
      )
    )
  })

  it("returns #d8799fd8799f9fd8799f409fd8799f4019084bffffffff9fd8799f409fd8799f401908afffffffffffff for [0, [[0,[[[0, [[], [[0, [[], 2123n]]]]]], [[0, [[], [[0, [[], 2223n]]]]]]]]]]", () => {
    expect(
      Cbor.encodeConstr(0, [
        Cbor.encodeConstr(0, [
          Cbor.encodeList([
            Cbor.encodeConstr(0, [
              Cbor.encodeBytes([]),
              Cbor.encodeList([
                Cbor.encodeConstr(0, [
                  Cbor.encodeBytes([]),
                  Cbor.encodeInt(2123n)
                ])
              ])
            ])
          ]),
          Cbor.encodeList([
            Cbor.encodeConstr(0, [
              Cbor.encodeBytes([]),
              Cbor.encodeList([
                Cbor.encodeConstr(0, [
                  Cbor.encodeBytes([]),
                  Cbor.encodeInt(2223n)
                ])
              ])
            ])
          ])
        ])
      ])
    ).toEqual(
      toArray(
        "d8799fd8799f9fd8799f409fd8799f4019084bffffffff9fd8799f409fd8799f401908afffffffffffff"
      )
    )
  })
})

describe("bad constr tags", () => {
  it("fails for a negative tag", () => {
    expect(() => Cbor.encodeConstr(-1, [])).toThrow()
  })

  it("fails for a non-whole number tag", () => {
    expect(() => Cbor.encodeConstr(3.14, [])).toThrow()
  })

  const badEncodedTags = [101, 103, 120, 128, 1279, 1401, 2000]

  badEncodedTags.forEach((t) => {
    it(`fails decoding tag ${t}`, () => {
      expect(() =>
        runSync(
          Cbor.decodeConstr([])(
            Cbor.encodeDefHead(6, BigInt(t)).concat(Cbor.encodeList([]))
          )
        )
      ).toThrow()
    })
  })

  it("fails for tag 102 with bad second header", () => {
    expect(() =>
      runSync(
        Cbor.decodeConstr([])(
          Cbor.encodeDefHead(6, 102n)
            .concat(Cbor.encodeDefHead(0, 0n))
            .concat(Cbor.encodeInt(0n))
            .concat(Cbor.encodeList([]))
        )
      )
    ).toThrow()
  })
})

describe("Cbor.encodeConstr()/Cbor.decodeConstr() roundtrip homogenous field type", () => {
  it(`ok for [0, 1, 2, 3]`, () => {
    const tag = 0
    const fields = [0n, 1n, 2n, 3n]

    const actual = runSync(
      Cbor.decodeConstr(Cbor.decodeInt)(
        Cbor.encodeConstr(
          tag,
          fields.map((item) => Cbor.encodeInt(item))
        )
      )
    )

    expect(actual).toEqual([tag, fields])
  })
})

const tagsTestVector = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110,
  120, 130, 140, 150, 160, 170, 180, 190, 200, 1000, 2000, 3000, 4000, 5000
]

describe("Cbor.encodeConstr()/Cbor.decodeConstr() tag only roundtrip", () => {
  tagsTestVector.forEach((t) => {
    it(`ok for ${t}`, () => {
      expect(runSync(Cbor.decodeConstr([])(Cbor.encodeConstr(t, [])))).toEqual([
        t,
        []
      ])
    })
  })
})

describe("Cbor.isConstr()", () => {
  it("returns true for #d87982581cbd99a373075d42fe4ac9109515e46303d0940cb9620bf058b87986a9d87980", () => {
    expect(
      
        Cbor.isConstr(
          "d87982581cbd99a373075d42fe4ac9109515e46303d0940cb9620bf058b87986a9d87980"
        )
      
    ).toBe(true)
  })

  tagsTestVector.forEach((t) => {
    it(`returns true for encoded ${t}`, () => {
      expect(Cbor.isConstr(Cbor.encodeConstr(t, []))).toBe(true)
    })
  })

  it("returns false for [0]]", () => {
    expect(Cbor.isConstr([0])).toBe(false)
  })

  it("returns false for []]", () => {
    expect(Cbor.isConstr([])).toBe(false)
  })

  it("doesn't change stream pos", () => {
    const stream = makeStream(
      "d87982581cbd99a373075d42fe4ac9109515e46303d0940cb9620bf058b87986a9d87980"
    )

    expect(Cbor.isConstr(stream)).toBe(true)
    expect(stream.pos).toBe(0)
  })

  it("doesn't change stream pos if not a constr", () => {
    const stream = makeStream(Cbor.encodeInt(0))

    expect(Cbor.isConstr(stream)).toBe(false)
    expect(stream.pos).toBe(0)
  })
})

/**
 * Taken from https://github.com/cbor/test-vectors/blob/master/appendix_a.json
 */
const floatTestVector: [number[], number][] = [
  [[0xf9, 0x00, 0x00], 0.0],
  [[0xf9, 0x80, 0x00], -0.0],
  [[0xf9, 0x3c, 0x00], 1.0],
  [[0xfb, 0x3f, 0xf1, 0x99, 0x99, 0x99, 0x99, 0x99, 0x9a], 1.1],
  [[0xf9, 0x3e, 0x00], 1.5],
  [[0xf9, 0x7b, 0xff], 65504.0],
  [[0xfa, 0x47, 0xc3, 0x50, 0x00], 100000.0],
  [[0xfa, 0x7f, 0x7f, 0xff, 0xff], 3.4028234663852886e38],
  [[0xfb, 0x7e, 0x37, 0xe4, 0x3c, 0x88, 0x00, 0x75, 0x9c], 1.0e300],
  [[0xf9, 0x00, 0x01], 5.960464477539063e-8],
  [[0xf9, 0x04, 0x00], 6.103515625e-5],
  [[0xf9, 0xc4, 0x00], -4.0],
  [[0xfb, 0xc0, 0x10, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66], -4.1],
  [[0xf9, 0x7c, 0x00], Number.POSITIVE_INFINITY],
  [[0xf9, 0x7e, 0x00], Number.NaN],
  [[0xf9, 0xfc, 0x00], Number.NEGATIVE_INFINITY],
  [[0xfa, 0x7f, 0x80, 0x00, 0x00], Number.POSITIVE_INFINITY],
  [[0xfa, 0x7f, 0xc0, 0x00, 0x00], Number.NaN],
  [[0xfa, 0xff, 0x80, 0x00, 0x00], Number.NEGATIVE_INFINITY],
  [
    [0xfb, 0x7f, 0xf0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    Number.POSITIVE_INFINITY
  ],
  [[0xfb, 0x7f, 0xf8, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], Number.NaN],
  [
    [0xfb, 0xff, 0xf0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    Number.NEGATIVE_INFINITY
  ]
]

describe("Cbor.decodeFloat()", () => {
  floatTestVector.forEach(([bytes, f]) => {
    it(`decodes #${toHex(bytes)} as ${f}`, () => {
      expect(runSync(Cbor.decodeFloat(bytes))).toBe(f)
    })
  })

  it("fails for non-float cbor", () => {
    expect(() => {
      runSync(Cbor.decodeFloat([0]))
    }).toThrow()
  })
})

describe("Cbor.decodeFloat16()", () => {
  floatTestVector
    .filter(([bytes, f]) => bytes.length == 3 && !Number.isNaN(f))
    .forEach(([bytes, f]) => {
      expect(runSync(Cbor.decodeFloat16(bytes))).toBe(f)
      expect(() => {
        runSync(Cbor.decodeFloat32(bytes))
      }).toThrow()
      expect(() => {
        runSync(Cbor.decodeFloat64(bytes))
      }).toThrow()
    })
})

describe("Cbor.decodeFloat32()", () => {
  // NaN has a variety of representations, so we won't test that here
  floatTestVector
    .filter(([bytes, f]) => bytes.length == 5 && !Number.isNaN(f))
    .forEach(([bytes, f]) => {
      expect(() => {
        runSync(Cbor.decodeFloat16(bytes))
      }).toThrow()
      expect(runSync(Cbor.decodeFloat32(bytes))).toBe(f)
      expect(() => {
        runSync(Cbor.decodeFloat64(bytes))
      }).toThrow()
    })
})

describe("Cbor.decodeFloat64()", () => {
  // NaN has a variety of representations, so we won't test that here
  floatTestVector
    .filter(([bytes, f]) => bytes.length == 9 && !Number.isNaN(f))
    .forEach(([bytes, f]) => {
      expect(() => {
        runSync(Cbor.decodeFloat16(bytes))
      }).toThrow()
      expect(() => {
        runSync(Cbor.decodeFloat32(bytes))
      }).toThrow()
      expect(runSync(Cbor.decodeFloat64(bytes))).toBe(f)
    })
})

describe("Cbor.encodeFloat16() & Cbor.isFloat<n>()", () => {
  // NaN has a variety of representations, so will won't test that here
  floatTestVector
    .filter(([bytes, f]) => bytes.length == 3 && !Number.isNaN(f))
    .forEach(([bytes, f]) => {
      it(`encodes ${f} as #${toHex(bytes)}`, () => {
        expect(Cbor.encodeFloat16(f)).toEqual(bytes)
        expect(Cbor.isFloat(bytes)).toBe(true)
        expect(Cbor.isFloat16(bytes)).toBe(true)
        expect(Cbor.isFloat32(bytes)).toBe(false)
        expect(Cbor.isFloat64(bytes)).toBe(false)
      })
    })
})

describe("Cbor.encodeFloat32() & Cbor.isFloat<n>()", () => {
  // NaN has a variety of representations, so we won't test that here
  floatTestVector
    .filter(([bytes, f]) => bytes.length == 5 && !Number.isNaN(f))
    .forEach(([bytes, f]) => {
      it(`encodes ${f} as #${toHex(bytes)}`, () => {
        expect(Cbor.encodeFloat32(f)).toEqual(bytes)
        expect(Cbor.isFloat(bytes)).toBe(true)
        expect(Cbor.isFloat16(bytes)).toBe(false)
        expect(Cbor.isFloat32(bytes)).toBe(true)
        expect(Cbor.isFloat64(bytes)).toBe(false)
      })
    })
})

describe("Cbor.encodeFloat64() & Cbor.isFloat<n>()", () => {
  // NaN has a variety of representations, so we don't test that here
  floatTestVector
    .filter(([bytes, f]) => bytes.length == 9 && !Number.isNaN(f))
    .forEach(([bytes, f]) => {
      it(`encodes ${f} as #${toHex(bytes)}`, () => {
        expect(Cbor.encodeFloat64(f)).toEqual(bytes)
        expect(Cbor.isFloat(bytes)).toBe(true)
        expect(Cbor.isFloat16(bytes)).toBe(false)
        expect(Cbor.isFloat32(bytes)).toBe(false)
        expect(Cbor.isFloat64(bytes)).toBe(true)
      })
    })
})

const intTestVectors: [number | bigint, number[]][] = [
  [0, [0]],
  [1, [1]],
  [10, [10]],
  [23, [23]],
  [24n, [24, 24]],
  [25n, [24, 25]],
  [100, [24, 100]],
  [1000, [25, 3, 232]],
  [1000000n, [0x1a, 0, 0x0f, 0x42, 0x40]],
  [1000000000000n, [0x1b, 0, 0, 0, 0xe8, 0xd4, 0xa5, 0x10, 0]],
  [
    18446744073709551615n,
    [0x1b, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]
  ],
  [18446744073709551616n, [0xc2, 0x49, 1, 0, 0, 0, 0, 0, 0, 0, 0]],
  [
    -18446744073709551616n,
    [0x3b, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]
  ],
  [-18446744073709551617n, [0xc3, 0x49, 1, 0, 0, 0, 0, 0, 0, 0, 0]],
  [-1, [0x20]],
  [-10, [0x29]],
  [-100, [0x38, 0x63]],
  [-1000, [0x39, 0x03, 0xe7]]
]

describe("Cbor.decodeInt()", () => {
  intTestVectors.forEach(([x, bs]) => {
    it(`returns ${x} for #${toHex(bs)}`, () => {
      expect(runSync(Cbor.decodeInt(bs))).toBe(BigInt(x))
    })
  })

  it("fails for [24]", () => {
    expect(() => runSync(Cbor.decodeInt([24]))).toThrow()
  })

  it("fails for empty bytes", () => {
    expect(() => runSync(Cbor.decodeInt([]))).toThrow()
  })
})

describe("Cbor.encodeInt()", () => {
  intTestVectors.forEach(([x, bs]) => {
    it(`returns #${toHex(bs)} for ${x}`, () => {
      expect(Cbor.encodeInt(x)).toEqual(bs)
    })
  })
})

describe("Cbor.isInt()", () => {
  intTestVectors.forEach(([, bs]) => {
    it(`returns true for #${toHex(bs)}`, () => {
      expect(Cbor.isInt(bs)).toBe(true)
    })
  })

  it("returns false for #6161", () => {
    expect(Cbor.isInt([0x61, 0x61])).toBe(false)
  })

  it("returns false for []", () => {
    expect(Cbor.isInt([])).toBe(false)
  })

  it("doesn't change stream pos", () => {
    const stream = makeStream(Cbor.encodeInt(0))

    expect(Cbor.isInt(stream)).toBe(true)
    expect(stream.pos).toBe(0)
  })

  it("doesn't change stream pos if not an int", () => {
    const stream = makeStream([0x61, 0x61])

    expect(Cbor.isInt(stream)).toBe(false)
    expect(stream.pos).toBe(0)
  })
})

describe("Cbor.decodeList()", () => {
  const unusedItemDecoder = () => Either.right(0)

  it("fails for []", () => {
    expect(() => runSync(Cbor.decodeList(unusedItemDecoder)([]))).toThrow()
  })

  it("fails for [0]", () => {
    expect(() => runSync(Cbor.decodeList(unusedItemDecoder)([0]))).toThrow()
  })

  it("returns [] for [0x80]", () => {
    expect(runSync(Cbor.decodeList(unusedItemDecoder)([0x80]))).toEqual([])
  })

  it("returns [] for [0x9f, 0xff]", () => {
    expect(runSync(Cbor.decodeList(unusedItemDecoder)([0x9f, 0xff]))).toEqual(
      []
    )
  })

  it("returns [1n,2n,3n] for #83010203", () => {
    expect(runSync(Cbor.decodeList(Cbor.decodeInt)("83010203"))).toEqual([
      1n,
      2n,
      3n
    ])
  })

  describe("returns [1n,2n,3n,4n, ..., 25n]", () => {
    const variants = [
      "98190102030405060708090a0b0c0d0e0f101112131415161718181819",
      "9f0102030405060708090a0b0c0d0e0f101112131415161718181819ff"
    ]

    const expected = new Array(25).fill(0).map((_, i) => BigInt(i + 1))

    for (const v of variants) {
      it(`decodes #${v}`, () => {
        expect(runSync(Cbor.decodeList(Cbor.decodeInt)(v))).toEqual(expected)
      })
    }
  })
})

describe("Cbor.decodeListLazy()", () => {
  it("fails for []", () => {
    expect(() => runSync(Cbor.decodeListLazy([]))).toThrow()
  })

  it("fails for [0]", () => {
    expect(() => runSync(Cbor.decodeListLazy([0]))).toThrow()
  })

  it("succeeds when not calling the callback for [0x80] (i.e. empty list)", () => {
    runSync(Cbor.decodeListLazy([0x80]))
  })

  it("fails when calling the callback for [0x80] (i.e. empty list)", () => {
    const callback = runSync(Cbor.decodeListLazy([0x80]))

    expect(() => {
      runSync(callback(Cbor.decodeInt))
    }).toThrow(/end-of-list/)
  })

  it("succeeds when not calling callback for [0x9f, 0xff] (i.e. empty list)", () => {
    runSync(Cbor.decodeListLazy([0x9f, 0xff]))
  })

  it("fails when calling the callback for [0x9f, 0xff] (i.e. empty list)", () => {
    const callback = runSync(Cbor.decodeListLazy([0x9f, 0xff]))

    expect(() => {
      runSync(callback(Cbor.decodeInt))
    }).toThrow(/end-of-list/)
  })

  it("returns [1n,2n,3n] for #83010203", () => {
    const callback = runSync(Cbor.decodeListLazy("83010203"))

    expect(runSync(callback(Cbor.decodeInt))).toBe(1n)
    expect(runSync(callback(Cbor.decodeInt))).toBe(2n)
    expect(runSync(callback(Cbor.decodeInt))).toBe(3n)

    expect(() => {
      runSync(callback(Cbor.decodeInt))
    }).toThrow(/end-of-list/)
  })

  describe("returns [1n,2n,3n,4n, ..., 25n]", () => {
    const variants = [
      "98190102030405060708090a0b0c0d0e0f101112131415161718181819",
      "9f0102030405060708090a0b0c0d0e0f101112131415161718181819ff"
    ]

    for (const v of variants) {
      it(`decodes #${v}`, () => {
        const callback = runSync(Cbor.decodeListLazy(v))

        for (let i = 1; i <= 25; i++) {
          expect(runSync(callback(Cbor.decodeInt))).toBe(BigInt(i))
        }

        expect(() => {
          runSync(callback(Cbor.decodeInt))
        }).toThrow(/end-of-list/)
      })
    }
  })
})

describe("Cbor.decodeListLazyOption()", () => {
  it("fails for []", () => {
    expect(() => runSync(Cbor.decodeListLazyOption([]))).toThrow()
  })

  it("fails for [0]", () => {
    expect(() => runSync(Cbor.decodeListLazyOption([0]))).toThrow()
  })

  it("succeeds when not calling the callback for [0x80] (i.e. empty list)", () => {
    runSync(Cbor.decodeListLazy([0x80]))
  })

  it("returns undefined when calling the callback for [0x80] (i.e. empty list)", () => {
    const callback = runSync(Cbor.decodeListLazyOption([0x80]))

    expect(runSync(callback(Cbor.decodeInt))).toBe(undefined)
  })

  it("succeeds when not calling callback for [0x9f, 0xff] (i.e. empty list)", () => {
    runSync(Cbor.decodeListLazyOption([0x9f, 0xff]))
  })

  it("returns undefined when calling the callback for [0x9f, 0xff] (i.e. empty list)", () => {
    const callback = runSync(Cbor.decodeListLazyOption([0x9f, 0xff]))

    expect(runSync(callback(Cbor.decodeInt))).toBe(undefined)
  })

  it("returns [1n,2n,3n] for #83010203", () => {
    const callback = runSync(Cbor.decodeListLazyOption("83010203"))

    expect(runSync(callback(Cbor.decodeInt))).toBe(1n)
    expect(runSync(callback(Cbor.decodeInt))).toBe(2n)
    expect(runSync(callback(Cbor.decodeInt))).toBe(3n)
    expect(runSync(callback(Cbor.decodeInt))).toBe(undefined)
  })

  describe("returns [1n,2n,3n,4n, ..., 25n]", () => {
    const variants = [
      "98190102030405060708090a0b0c0d0e0f101112131415161718181819",
      "9f0102030405060708090a0b0c0d0e0f101112131415161718181819ff"
    ]

    for (const v of variants) {
      it(`decodes #${v}`, () => {
        const callback = runSync(Cbor.decodeListLazyOption(v))

        for (let i = 1; i <= 25; i++) {
          expect(runSync(callback(Cbor.decodeInt))).toBe(BigInt(i))
        }

        expect(runSync(callback(Cbor.decodeInt))).toBe(undefined)
      })
    }
  })
})

describe("Cbor.encodeList()", () => {
  // see https://github.com/well-typed/cborg/blob/4bdc818a1f0b35f38bc118a87944630043b58384/serialise/src/Codec/Serialise/Class.hs#L181
  it("returns [0x80] for []", () => {
    expect(Cbor.encodeList([])).toEqual([0x80])
  })
})

describe("Cbor.isList()", () => {
  it("returns true for [0x80]", () => {
    expect(Cbor.isList([0x80])).toBe(true)
  })

  it("returns false for [0x61, 0x61]", () => {
    expect(Cbor.isList([0x61, 0x61])).toBe(false)
  })

  it("returns false for [0]", () => {
    expect(Cbor.isList([0])).toBe(false)
  })

  it("returns false for []", () => {
    expect(Cbor.isList([])).toBe(false)
  })

  it("doesn't change stream pos", () => {
    const stream = makeStream([0x80])

    expect(Cbor.isList(stream)).toBe(true)
    expect(stream.pos).toBe(0)
  })

  it("doesn't change stream pos if not a list", () => {
    const stream = makeStream([0x61, 0x61])

    expect(Cbor.isList(stream)).toBe(false)
    expect(stream.pos).toBe(0)
  })
})

describe("Cbor.decodeMap()", () => {
  const unusedDecoder = () => Either.right(0)

  it("fails for []", () => {
    expect(() =>
      runSync(Cbor.decodeMap(unusedDecoder, unusedDecoder)([]))
    ).toThrow()
  })

  it("fails for [0]", () => {
    expect(() =>
      runSync(Cbor.decodeMap(unusedDecoder, unusedDecoder)([0]))
    ).toThrow()
  })

  it("returns [] for [0xa0]", () => {
    expect(
      runSync(Cbor.decodeMap(unusedDecoder, unusedDecoder)([0xa0]))
    ).toEqual([])
  })

  it("returns [[1n, 2n], [3n, 4n]] for #a201020304", () => {
    expect(
      runSync(Cbor.decodeMap(Cbor.decodeInt, Cbor.decodeInt)("a201020304"))
    ).toEqual([
      [1n, 2n],
      [3n, 4n]
    ])
  })

  it("doesn't fail for int -> string map with 31 entries", () => {
    const cborHex =
      "b81f18736a6765745f6d696e746564187c683c7377697463683e1887683c7377697463683e188a683c7377697463683e1894683c7377697463683e1897683c7377697463683e18a1683c7377697463683e18a4683c7377697463683e18ae683c7377697463683e18b2683c7377697463683e18bc683c7377697463683e18c0683c7377697463683e18ca683c7377697463683e18ce683c7377697463683e18d8683c7377697463683e18dc683c7377697463683e18e6683c7377697463683e18e9683c61737369676e3e18f2683c7377697463683e18fc683c7377697463683e190100683c7377697463683e19010a683c7377697463683e19010e683c7377697463683e190118683c7377697463683e19011c683c7377697463683e190126683c7377697463683e190129683c7377697463683e190133683c7377697463683e190136683c7377697463683e19013b6f696e6469726563745f706f6c69637919013d683c61737369676e3e"

    runSync(Cbor.decodeMap(Cbor.decodeInt, Cbor.decodeString)(cborHex))
  })
})

describe("Cbor.encodeDefMap()", () => {
  it("encoding a def map with 31 entries should be decodeable", () => {
    const cbor = Cbor.encodeDefMap(
      (new Array(31).fill(0) as number[]).map((i) => [
        Cbor.encodeInt(i),
        Cbor.encodeString(i.toString())
      ])
    )

    runSync(Cbor.decodeMap(Cbor.decodeInt, Cbor.decodeString)(cbor))
  })
})

describe("Cbor.encodeMap()/Cbor.decodeMap() roundtrip", () => {
  const testVectors: [string, string][][] = [
    [],
    [["a", "A"]],
    [
      ["a", "A"],
      ["b", "B"]
    ],
    [
      ["a", "A"],
      ["b", "B"],
      ["c", "C"]
    ],
    [
      ["a", "A"],
      ["b", "B"],
      ["c", "C"],
      ["d", "D"]
    ],
    [
      ["a", "A"],
      ["b", "B"],
      ["c", "C"],
      ["d", "D"],
      ["e", "E"]
    ],
    [
      ["a", "A"],
      ["b", "B"],
      ["c", "C"],
      ["d", "D"],
      ["e", "E"],
      ["f", "F"]
    ]
  ]

  testVectors.forEach((v) => {
    it(`ok for ${JSON.stringify(v)}`, () => {
      expect(
        runSync(
          Cbor.decodeMap(
            Cbor.decodeString,
            Cbor.decodeString
          )(
            Cbor.encodeMap(
              v.map(([k, v]) => [Cbor.encodeString(k), Cbor.encodeString(v)])
            )
          )
        )
      ).toEqual(v)
    })

    it(`ok for ${JSON.stringify(v)} (indef encoding)`, () => {
      expect(
        runSync(
          Cbor.decodeMap(
            Cbor.decodeString,
            Cbor.decodeString
          )(
            Cbor.encodeIndefMap(
              v.map(([k, v]) => [Cbor.encodeString(k), Cbor.encodeString(v)])
            )
          )
        )
      ).toEqual(v)
    })
  })
})

describe("Cbor.isMap()", () => {
  it("returns true for [0xa0]", () => {
    expect(Cbor.isMap([0xa0])).toBe(true)
  })

  it("returns false for [0]", () => {
    expect(Cbor.isMap([0])).toBe(false)
  })

  it("returns false for []", () => {
    expect(Cbor.isMap([])).toBe(false)
  })

  it("doesn't change stream pos", () => {
    const stream = makeStream([0xa0])

    expect(Cbor.isMap(stream)).toBe(true)
    expect(stream.pos).toBe(0)
  })

  it("doesn't change stream pos if not a map", () => {
    const stream = makeStream(Cbor.encodeInt(0))

    expect(Cbor.isMap(stream)).toBe(false)
    expect(stream.pos).toBe(0)
  })
})

const NULL_CBOR_BYTE = 0xf6

describe("Cbor.decodeNull()", () => {
  it("fails for empty bytes", () => {
    expect(() => runSync(Cbor.decodeNull([]))).toThrow()
  })

  it("fails for [0]", () => {
    expect(() => runSync(Cbor.decodeNull([0]))).toThrow()
  })

  it(`returns null for [${NULL_CBOR_BYTE}]`, () => {
    expect(runSync(Cbor.decodeNull([NULL_CBOR_BYTE]))).toBe(null)
  })
})

describe("Cbor.encodeNull()", () => {
  it(`returns [${NULL_CBOR_BYTE}]`, () => {
    expect(Cbor.encodeNull()).toEqual([NULL_CBOR_BYTE])
  })

  it(`returns [${NULL_CBOR_BYTE}] when called with null arg`, () => {
    expect(Cbor.encodeNull(null)).toEqual([NULL_CBOR_BYTE])
  })
})

describe("Cbor.isNull()", () => {
  it(`returns true for [${NULL_CBOR_BYTE}]`, () => {
    expect(Cbor.isNull([NULL_CBOR_BYTE])).toBe(true)
  })

  it(`returns false for empty bytes`, () => {
    expect(Cbor.isNull([])).toBe(false)
  })

  it("doesn't change stream pos", () => {
    const stream = makeStream([NULL_CBOR_BYTE])

    expect(Cbor.isNull(stream)).toBe(true)
    expect(stream.pos).toBe(0)
  })

  it("doesn't change stream pos if not null", () => {
    const stream = makeStream(Cbor.encodeInt(0))

    expect(Cbor.isNull(stream)).toBe(false)
    expect(stream.pos).toBe(0)
  })
})

describe("Cbor.decodeObjectIKey()", () => {
  it("returns {1: 2n, 3: 4n} for #a201020304", () => {
    const actual = runSync(
      Cbor.decodeObjectIKey({
        1: Cbor.decodeInt,
        3: Cbor.decodeInt
      })("a201020304")
    )

    expect(actual).toEqual({ 1: 2n, 3: 4n })
  })
})

describe("Cbor.encodeObjectIKey()", () => {
  it("returns #a201020304 for {1: 2n, 3: 4n}", () => {
    expect(
      Cbor.encodeObjectIKey({
        1: Cbor.encodeInt(2n),
        3: Cbor.encodeInt(4n)
      })
    ).toEqual(toArray("a201020304"))
  })

  it("returns #a201020304 for Map({1: 2n, 3: 4n})", () => {
    expect(
      Cbor.encodeObjectIKey(
        new Map([
          [1, Cbor.encodeInt(2n)],
          [3, Cbor.encodeInt(4n)]
        ])
      )
    ).toEqual(toArray("a201020304"))
  })
})

describe("Cbor.decodeObjectSKey()", () => {
  it("returns {a: 1n, b: [2n, 3n]} for #a26161016162820203", () => {
    const actual = runSync(
      Cbor.decodeObjectSKey({
        a: Cbor.decodeInt,
        b: Cbor.decodeList(Cbor.decodeInt)
      })("a26161016162820203")
    )

    expect(actual).toEqual({ a: 1n, b: [2n, 3n] })
  })

  it('returns {a: "A", b: "B", c: "C", d: "D", e: "E"} for #a56161614161626142616361436164614461656145', () => {
    const actual = runSync(
      Cbor.decodeObjectSKey({
        a: Cbor.decodeString,
        b: Cbor.decodeString,
        c: Cbor.decodeString,
        d: Cbor.decodeString,
        e: Cbor.decodeString
      })("a56161614161626142616361436164614461656145")
    )

    expect(actual).toEqual({
      a: "A",
      b: "B",
      c: "C",
      d: "D",
      e: "E"
    })
  })

  it("returns {Fun: true, Amt: -2} for #bf6346756ef563416d7421ff", () => {
    const actual = runSync(
      Cbor.decodeObjectSKey({
        Fun: Cbor.decodeBool,
        Amt: Cbor.decodeInt
      })("bf6346756ef563416d7421ff")
    )

    expect(actual).toEqual({ Fun: true, Amt: -2n })
  })

  it("fails for #bf6346756ef563416d7421ff if Amt decoder isn't specified", () => {
    expect(() =>
      runSync(
        Cbor.decodeObjectSKey({
          Fun: Cbor.decodeBool
        })("bf6346756ef563416d7421ff")
      )
    ).toThrow()
  })
})

describe("Cbor.encodeObjectSKey()", () => {
  it('returns #a56161614161626142616361436164614461656145 for {a: "A", b: "B", c: "C", d: "D", e: "E"}', () => {
    expect(
      Cbor.encodeObjectSKey({
        a: Cbor.encodeString("A"),
        b: Cbor.encodeString("B"),
        c: Cbor.encodeString("C"),
        d: Cbor.encodeString("D"),
        e: Cbor.encodeString("E")
      })
    ).toEqual(toArray("a56161614161626142616361436164614461656145"))
  })

  it('returns #a56161614161626142616361436164614461656145 for Map({a: "A", b: "B", c: "C", d: "D", e: "E"})', () => {
    expect(
      Cbor.encodeObjectSKey(
        new Map([
          ["a", Cbor.encodeString("A")],
          ["b", Cbor.encodeString("B")],
          ["c", Cbor.encodeString("C")],
          ["d", Cbor.encodeString("D")],
          ["e", Cbor.encodeString("E")]
        ])
      )
    ).toEqual(toArray("a56161614161626142616361436164614461656145"))
  })
})

describe("Cbor.isObject()", () => {
  it("returns false for []", () => {
    expect(Cbor.isObject([])).toBe(false)
  })

  it("returns false for [0]", () => {
    expect(Cbor.isObject([0])).toBe(false)
  })

  it("returns true for #a201020304", () => {
    expect(Cbor.isObject("a201020304")).toBe(true)
  })

  it("doesn't change stream pos", () => {
    const stream = makeStream("a201020304")

    expect(Cbor.isObject(stream)).toBe(true)
    expect(stream.pos).toBe(0)
  })

  it("doesn't change stream pos if not an object", () => {
    const stream = makeStream(Cbor.encodeInt(0))

    expect(Cbor.isObject(stream)).toBe(false)
    expect(stream.pos).toBe(0)
  })
})

describe("Cbor.decodeString()", () => {
  it('returns "" for [0x60]', () => {
    expect(runSync(Cbor.decodeString([0x60]))).toBe("")
  })

  it('returns "a" for [0x61, 0x61]', () => {
    expect(runSync(Cbor.decodeString([0x61, 0x61]))).toBe("a")
  })

  it('returns "IETF" for #6449455446', () => {
    expect(runSync(Cbor.decodeString("6449455446"))).toBe("IETF")
  })

  it('returns ""\\" for #62225c', () => {
    expect(runSync(Cbor.decodeString("62225c"))).toBe('"\\')
  })

  it('returns "ü" for #62c3bc', () => {
    expect(runSync(Cbor.decodeString("62c3bc"))).toBe("ü")
  })

  it('returns "水" for #63e6b0b4', () => {
    expect(runSync(Cbor.decodeString("63e6b0b4"))).toBe("水")
  })

  it('returns "𐅑" for #64f0908591', () => {
    expect(runSync(Cbor.decodeString("64f0908591"))).toBe("𐅑")
  })

  it("fails for []", () => {
    expect(() => runSync(Cbor.decodeString([]))).toThrow()
  })

  it("fails for [0]", () => {
    expect(() => runSync(Cbor.decodeString([0]))).toThrow()
  })
})

describe("Cbor.encodeString()", () => {
  it('returns [0x60] for ""', () => {
    expect(Cbor.encodeString("")).toEqual([0x60])
  })

  it('returns [0x61, 0x61] for "a"', () => {
    expect(Cbor.encodeString("a")).toEqual([0x61, 0x61])
  })

  it('returns #6449455446 for "IETF"', () => {
    expect(Cbor.encodeString("IETF")).toEqual(toArray("6449455446"))
  })
})

describe("Cbor.encodeString()/Cbor.decodeString() roundtrip", () => {
  const testVector = [
    "天",
    "地玄",
    "黃宇宙",
    "洪荒。蓋",
    "此身髮四大",
    "五常。都邑華",
    "夏東西二京。治",
    "本於農務茲稼穡。",
    "耽讀玩市寓目囊箱。",
    "布射僚丸嵇琴阮嘯。日",
    "月盈昃辰宿列張。恭惟鞠",
    "養豈敢毀傷。背邙面洛浮渭",
    "據涇。俶載南畝我藝黍稷。易",
    "輶攸畏屬耳垣牆。恬筆倫紙鈞巧",
    "任釣。寒來暑往，秋收冬藏。女慕",
    "貞絜男效才良。宮殿盤郁樓觀飛驚。稅",
    "熟貢新勸賞黜陟。具膳餐飯適口充腸。釋",
    "紛利俗竝皆佳妙。閏餘成歲律呂調陽。知過",
    "必改得能莫忘。圖寫禽獸畫彩仙靈。孟軻敦素",
    "史魚秉直。飽飫烹宰飢厭糟糠。毛施淑姿工顰妍",
    "笑。雲騰致雨露結為霜。罔談彼短靡恃己長。丙舍",
    "傍啟甲帳對楹。庶幾中庸勞謙謹敕。親戚故舊老少異",
    "糧。年矢每催曦暉朗曜。金生麗水玉出崑岡。信使可覆",
    "器欲難量。肆筵設席鼓瑟吹笙。聆音察理鑒貌辨色。妾御",
    "績紡侍巾帷房。璿璣懸斡晦魄環照。劍號巨闕珠稱夜光。墨",
    "悲絲染詩讚羔羊。升階納陛弁轉疑星。貽厥嘉猷勉其祗植。紈",
    "扇圓潔銀燭煒煌。指薪修祜永綏吉劭。果珍李柰菜重芥薑。景行",
    "維賢克念作聖。右通廣內左達承明。省躬譏誡寵增抗極。晝眠夕寐",
    "藍筍象床。矩步引領俯仰廊廟。海鹹河淡，鱗潛羽翔。德建名立形端",
    "表正。既集墳典亦聚群英。殆辱近恥林皋幸即。弦歌酒宴接杯舉觴。束",
    "帶矜庄徘徊瞻眺。空谷傳聲虛堂習聽。杜稿鍾隸漆書壁經。兩疏見機解組",
    "誰逼。矯手頓足，悅豫且康。孤陋寡聞，愚蒙等誚。龍師火帝，鳥官人皇。",
    " 禍因惡積，福緣善慶。 	府羅將相，路俠槐卿。 	索居閒處，沉默寂寥。",
    "嫡後嗣續，祭祀烝嘗。 	謂語助者，焉哉乎也。       始製文字，乃服衣裳",
    "尺璧非寶，寸陰是競。 	戶封八縣，家給千兵。 	求古尋論，散慮逍遙。稽顙",
    "再拜，悚懼恐惶。 	       推位讓國，有虞陶唐。 	資父事君，曰嚴與敬。",
    " 	高冠陪輦，驅轂振纓。 	欣奏累遣，慼謝歡招。 	箋牒簡要，顧答審詳。  ",
    "弔民伐罪，周發殷湯。 	孝當竭力，忠則盡命。 	世祿侈富，車駕肥輕。 	渠荷",
    "的歷，園莽抽條。 	骸垢想浴，執熱願涼。 	        坐朝問道，垂拱平章。 	",
    "臨深履薄，夙興溫凊。 	策功茂實，勒碑刻銘。 	枇杷晚翠，梧桐蚤凋。 	驢騾犢特",
    "，駭躍超驤。 	愛育黎首，臣伏戎羌。 	似蘭斯馨，如松之盛。 	磻溪伊尹，佐時阿衡",
    "。 	陳根委翳，落葉飄搖。 	誅斬賊盜，捕獲叛亡。 	      遐邇一體，率賓歸王。",
    " 	川流不息，淵澄取映。 	奄宅曲阜，微旦孰營。 	遊鵾獨運，凌摩絳霄。 		   ",
    "    鳴鳳在竹，白駒食場。 	容止若思，言辭安定。 	桓公匡合，濟弱扶傾。    化被草木，",
    "賴及萬方。 	篤初誠美，慎終宜令。 	綺回漢惠，說感武丁。榮業所基，藉甚無竟。 	俊乂",
    "密勿，多士寔寧。 			        學優登仕，攝職從政。 	晉楚更霸，趙魏困橫。     存",
    "以甘棠，去而益詠。 	假途滅虢，踐土會盟。 			         樂殊貴賤，禮別尊卑。 	",
    "何遵約法，韓弊煩刑。 			          上和下睦，夫唱婦隨。 	起翦頗牧，用軍最精。 	  ",
    "           外受傅訓，入奉母儀。 	宣威沙漠，馳譽丹青。 			          諸姑伯叔，猶",
    "子比兒。 	九州禹跡，百郡秦并。 			          孔懷兄弟，同氣連枝。 	岳宗泰岱，禪主云亭",
    "。 			         交友投分，切磨箴規。 	雁門紫塞，雞田赤城。          仁慈隱惻，造次弗",
    "離。 	昆池碣石，鉅野洞庭。 			       節義廉退，顛沛匪虧。 	曠遠綿邈，岩岫杳冥。    ",
    "性靜情逸，心動神疲。            守真志滿，逐物意移。                       堅持雅操，好爵自縻。"
  ]

  testVector.forEach((v, i) => {
    const split = i % 2 == 0

    it(`ok for "${v}" with split=${split}`, () => {
      expect(runSync(Cbor.decodeString(Cbor.encodeString(v, split)))).toBe(v)
    })
  })
})

describe("Cbor.isString()", () => {
  it("returns true for [0x60]", () => {
    expect(Cbor.isString([0x60])).toBe(true)
  })

  it("returns false for [0]", () => {
    expect(Cbor.isString([0])).toBe(false)
  })

  it("returns false for []", () => {
    expect(Cbor.isString([])).toBe(false)
  })

  it("doesn't change stream pos", () => {
    const stream = makeStream([0x60])

    expect(Cbor.isString(stream)).toBe(true)
    expect(stream.pos).toBe(0)
  })

  it("doesn't change stream pos if not a string", () => {
    const stream = makeStream(Cbor.encodeInt(0))

    expect(Cbor.isString(stream)).toBe(false)
    expect(stream.pos).toBe(0)
  })
})

describe("Cbor.decodeTag()", () => {
  it("returns 1 for #c11a514b67b0", () => {
    expect(runSync(Cbor.decodeTag("c11a514b67b0"))).toBe(1n)
  })

  it(`returns 1363896240 after decoding tag of #c11a514b67b0`, () => {
    const stream = makeStream("c11a514b67b0")
    runSync(Cbor.decodeTag(stream))
    expect(runSync(Cbor.decodeInt(stream))).toBe(1363896240n)
  })

  it("fails for []", () => {
    expect(() => runSync(Cbor.decodeTag([]))).toThrow()
  })

  it("fails for [0]", () => {
    expect(() => runSync(Cbor.decodeTag([0]))).toThrow()
  })

  it("decodes tag in d90102 as 258", () => {
    expect(runSync(Cbor.decodeTag("d90102"))).toBe(258n)
  })
})

describe("Cbor.encodeTag()", () => {
  it("returns #c11a514b67b0 for 1(1363896240n)", () => {
    expect(Cbor.encodeTag(1).concat(Cbor.encodeInt(1363896240n))).toEqual(
      toArray("c11a514b67b0")
    )
  })

  it("fails for a negative tag", () => {
    expect(() => Cbor.encodeTag(-1)).toThrow()
  })
})

describe("Cbor.isTag()", () => {
  it("detects tag in d90102", () => {
    expect(Cbor.isTag("d90102")).toBe(true)
  })

  it("detects tag in set of signatures", () => {
    expect(
      
        Cbor.isTag(
          "d901028182582044f3523cc794ecd0e4cc6aa5d459d4c0b30064d7f7f68dac0eb0653819861b985840ad8a1887d409ca2c5205a9002b104ff77ddee415d730fd85925399e622c6840c2a0c68b72d4bd57979f1d9fec70c6ee7b15a01607da98119dddf05420e274e0a"
        )
      
    ).toBe(true)
  })
})

describe("Cbor.decodeTagged()", () => {
  it("returns 1 when decoding first item of tuple [0, 1]", () => {
    const tupleBytes = Cbor.encodeTuple([Cbor.encodeInt(0), Cbor.encodeInt(1)])

    const [tag, decodeItem] = runSync(Cbor.decodeTagged(tupleBytes))

    expect([tag, runSync(decodeItem(Cbor.decodeInt))]).toEqual([0, 1n])
  })

  it("fails when decoding too many items", () => {
    const tupleBytes = Cbor.encodeTuple([Cbor.encodeInt(0), Cbor.encodeInt(1)])

    const decodeItem = runSync(Cbor.decodeTagged(tupleBytes))[1]

    runSync(decodeItem(Cbor.decodeInt))

    expect(() => runSync(decodeItem(Cbor.decodeInt))).toThrow()
  })

  it("returns tag 0 for d87982581cbd99a373075d42fe4ac9109515e46303d0940cb9620bf058b87986a9d87980 (plain const)", () => {
    const [tag] = runSync(
      Cbor.decodeTagged(
        "d87982581cbd99a373075d42fe4ac9109515e46303d0940cb9620bf058b87986a9d87980"
      )
    )

    expect(tag).toBe(0)
  })
})

describe("Cbor.decodeTuple()", () => {
  describe("returns [1n, [2n, 3n], [4n, 5n]]", () => {
    const expected: [bigint, bigint[], bigint[]] = [1n, [2n, 3n], [4n, 5n]]

    const variants = [
      "8301820203820405",
      "9f018202039f0405ffff",
      "9f01820203820405ff",
      "83018202039f0405ff",
      "83019f0203ff820405"
    ]

    for (const v of variants) {
      it(`decodes #${v}`, () => {
        const actual = runSync(
          Cbor.decodeTuple([
            Cbor.decodeInt,
            Cbor.decodeList(Cbor.decodeInt),
            Cbor.decodeList(Cbor.decodeInt)
          ])(v)
        )

        expect(actual).toEqual(expected)
      })
    }
  })

  it('returns ["a", {b: "c"}] for #826161a161626163', () => {
    const actual = runSync(
      Cbor.decodeTuple([
        Cbor.decodeString,
        Cbor.decodeObjectSKey({ b: Cbor.decodeString })
      ])("826161a161626163")
    )

    expect(actual).toEqual(["a", { b: "c" }])
  })

  it('returns ["a", {b: "c"}] for #826161bf61626163ff', () => {
    const actual = runSync(
      Cbor.decodeTuple([
        Cbor.decodeString,
        Cbor.decodeObjectSKey({ b: Cbor.decodeString })
      ])("826161bf61626163ff")
    )

    expect(actual).toEqual(["a", { b: "c" }])
  })

  it('returns ["a", {b: "c"}] for #826161bf61626163ff, with the second decoder being optional', () => {
    const actual = runSync(
      Cbor.decodeTuple(
        [Cbor.decodeString],
        [Cbor.decodeObjectSKey({ b: Cbor.decodeString })]
      )("826161bf61626163ff")
    )

    expect(actual).toEqual(["a", { b: "c" }])
  })

  it("fails if an optional decoder is missing for third entry", () => {
    expect(() => {
      runSync(
        Cbor.decodeTuple(
          [Cbor.decodeString],
          [Cbor.decodeObjectSKey({ b: Cbor.decodeString })]
        )(
          Cbor.encodeTuple([
            Cbor.encodeString("a"),
            Cbor.encodeObjectSKey({ b: Cbor.encodeString("c") }),
            Cbor.encodeInt(0)
          ])
        )
      )
    }).toThrow()
  })

  it("fails for #826161bf61626163ff when decoding 3 items", () => {
    expect(() =>
      runSync(
        Cbor.decodeTuple([
          Cbor.decodeString,
          Cbor.decodeObjectSKey({ b: Cbor.decodeString }),
          Cbor.decodeString
        ])("826161bf61626163ff")
      )
    ).toThrow()
  })

  it("fails for #826161bf61626163ff when decoding only 1 item", () => {
    expect(() =>
      runSync(Cbor.decodeTuple([Cbor.decodeString])("826161bf61626163ff"))
    ).toThrow()
  })

  it("fails for #826161bf61626163ff when decoding 0 items", () => {
    expect(() => {
      runSync(Cbor.decodeTuple([])("826161bf61626163ff"))
    })
  })
})

describe("Cbor.decodeTupleLazy()", () => {
  it("fails for []", () => {
    expect(() => runSync(Cbor.decodeTupleLazy([]))).toThrow()
  })

  it("fails for [0]", () => {
    expect(() => runSync(Cbor.decodeTupleLazy([0]))).toThrow()
  })

  it("succeeds when not calling the callback for [0x80] (i.e. empty list)", () => {
    runSync(Cbor.decodeTupleLazy([0x80]))
  })

  it("fails when calling the callback for [0x80] (i.e. empty list)", () => {
    const callback = runSync(Cbor.decodeTupleLazy([0x80]))

    expect(() => {
      runSync(callback(Cbor.decodeInt))
    }).toThrow(/end-of-list/)
  })

  it('returns [1n,"hello world"]', () => {
    const callback = runSync(
      Cbor.decodeTupleLazy(
        Cbor.encodeTuple([Cbor.encodeInt(1), Cbor.encodeString("hello world")])
      )
    )

    expect(runSync(callback(Cbor.decodeInt))).toBe(1n)
    expect(runSync(callback(Cbor.decodeString))).toBe("hello world")

    expect(() => {
      runSync(callback(Cbor.decodeInt))
    }).toThrow(/end-of-list/)
  })
})

describe("Cbor.encodeTuple()", () => {
  it('returns #826161a161626163 for ["a", {b: "c"}]', () => {
    expect(
      Cbor.encodeTuple([
        Cbor.encodeString("a"),
        Cbor.encodeObjectSKey({ b: Cbor.encodeString("c") })
      ])
    ).toEqual(toArray("826161a161626163"))
  })
})

describe("Cbor.isTuple()", () => {
  it("returns false for []", () => {
    expect(Cbor.isTuple([])).toBe(false)
  })

  it("returns false for [0]", () => {
    expect(Cbor.isTuple([0])).toBe(false)
  })

  it("returns true for #8301820203820405", () => {
    expect(Cbor.isTuple("8301820203820405")).toBe(true)
  })

  it("doesn't change stream pos", () => {
    const stream = makeStream("8301820203820405")

    expect(Cbor.isTuple(stream)).toBe(true)
    expect(stream.pos).toBe(0)
  })

  it("doesn't change stream pos if not a tuple", () => {
    const stream = makeStream(Cbor.encodeInt(0))

    expect(Cbor.isTuple(stream)).toBe(false)
    expect(stream.pos).toBe(0)
  })
})
