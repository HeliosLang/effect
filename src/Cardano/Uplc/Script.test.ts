import { describe, expect, it } from "bun:test"
import { Effect, Either } from "effect"
import { runSync } from "effect/Effect"
import * as Bytes from "../../Codecs/Bytes.js"
import * as Cek from "./Cek.js"
import * as Cost from "./Cost.js"
import * as Script from "./Script.js"
import * as Type from "./Type.js"

describe("Uplc.Script.decodeRoot", () => {
  it("is able to decode simple v1 script", () => {
    runSync(
      Script.decode(1)("4e4d01000033222220051200120011").pipe(
        Effect.flatMap(Script.entryPoint)
      )
    )
  })

  it("is able to decode slightly larger v1 script", () => {
    runSync(
      Script.decode(1)(
        "581e581c01000033223232222350040071235002353003001498498480048005"
      ).pipe(Effect.flatMap(Script.entryPoint))
    )
  })
})

describe("Uplc.Script.eval() for V1", () => {
  const conformanceTests: {
    description: string
    cborHex: string
    mem: bigint
    cpu: bigint
    result: Cek.Value
    era?: string
  }[] = [
    {
      description: "(program 1.0.0 (con bool False))",
      cborHex: "46450100004a01",
      mem: 200n,
      cpu: 23100n,
      result: { _tag: "Const", value: false }
    },
    {
      description: "(program 1.0.0 (con bool True))",
      cborHex: "46450100004a21",
      mem: 200n,
      cpu: 23100n,
      result: { _tag: "Const", value: true }
    },
    {
      description: "(program 1.0.0 (con bytestring #00ff))",
      cborHex: "4b4a01000048810200ff0001",
      mem: 200n,
      cpu: 23100n,
      result: { _tag: "Const", value: Bytes.toUint8Array("00ff") }
    },
    {
      description:
        "(program 1.0.0 (con bytestring #54686543616B654973414C6965))",
      cborHex: "565501000048810d54686543616b654973414c69650001",
      mem: 200n,
      cpu: 23100n,
      result: {
        _tag: "Const",
        value: Bytes.toUint8Array("54686543616b654973414c6965")
      }
    },
    {
      description: "(program 1.0.0 (con bytestring #))",
      cborHex: "484701000048810001",
      mem: 200n,
      cpu: 23100n,
      result: { _tag: "Const", value: Bytes.toUint8Array("") }
    },
    {
      description: "(program 1.0.0 (con data (B #0123456789ABCDEF)))",
      cborHex: "52510100004c0109480123456789abcdef0001",
      mem: 200n,
      cpu: 23100n,
      result: {
        _tag: "Const",
        value: { data: { bytes: Bytes.toUint8Array("0123456789abcdef") } }
      }
    },
    {
      description: "(program 1.0.0 (con data (Constr 1 [I 1])))",
      cborHex: "4e4d0100004c0105d87a9f01ff0001",
      mem: 200n,
      cpu: 23100n,
      result: {
        _tag: "Const",
        value: { data: { constructor: 1, fields: [{ int: 1n }] } }
      } satisfies Cek.Value
    },
    {
      description: "(program 1.0.0 (con data (I 12354898)))",
      cborHex: "4e4d0100004c01051a00bc85520001",
      mem: 200n,
      cpu: 23100n,
      result: { _tag: "Const", value: { data: { int: 12354898n } } }
    },
    {
      description:
        "(program 1.0.0 (con data (List [Constr 1 [], I 1234, B #ABCDEF])))",
      cborHex: "55540100004c010c9fd87a801904d243abcdefff0001",
      mem: 200n,
      cpu: 23100n,
      result: {
        _tag: "Const",
        value: {
          data: {
            list: [
              { constructor: 1, fields: [] },
              { int: 1234n },
              { bytes: Bytes.toUint8Array("abcdef") }
            ]
          }
        }
      } satisfies Cek.Value
    },
    {
      description:
        "(program 1.0.0 (con data (Map [(B #0123, I 12345), (I 789453, B #456789), (List [I -12364689486], Constr 7 [])])))",
      cborHex:
        "582958270100004c011fa34201231930391a000c0bcd434567899f3b00000002e0fe304dffd90500800001",
      mem: 200n,
      cpu: 23100n,
      result: {
        _tag: "Const",
        value: {
          data: {
            map: [
              {
                k: { bytes: Bytes.toUint8Array("0123") },
                v: { int: 12345n }
              },
              {
                k: { int: 789453n },
                v: { bytes: Bytes.toUint8Array("456789") }
              },
              {
                k: { list: [{ int: -12364689486n }] },
                v: { constructor: 7, fields: [] }
              }
            ]
          }
        }
      } satisfies Cek.Value
    },
    {
      description: "(program 1.0.0 (con integer 0))",
      cborHex: "4746010000480001",
      mem: 200n,
      cpu: 23100n,
      result: { _tag: "Const", value: 0n }
    },
    {
      description: "(program 1.0.0 (con integer 1))",
      cborHex: "4746010000480081",
      mem: 200n,
      cpu: 23100n,
      result: { _tag: "Const", value: 1n }
    },
    {
      description: "(program 1.0.0 (con integer -1))",
      cborHex: "4746010000480041",
      mem: 200n,
      cpu: 23100n,
      result: { _tag: "Const", value: -1n }
    },
    {
      description:
        "(program 1.0.0 (con integer 000000000000000000000000000000000000012345))",
      cborHex: "4948010000483cb00041",
      mem: 200n,
      cpu: 23100n,
      result: { _tag: "Const", value: 12345n }
    },
    {
      description:
        "(program 1.0.0 (con integer -000000000000000000000000000000000000012345))",
      cborHex: "4948010000483c700041",
      mem: 200n,
      cpu: 23100n,
      result: { _tag: "Const", value: -12345n }
    },
    {
      description:
        "(program 1.0.0 (con integer 7934472584735297345829374203940389857324250374130461237461374324689198237413246172439813568362847918324132461234689173469172364972574327894626348923469234728574196241238723984567805163407561370166661807515263473485635726))",
      cborHex:
        "5870586e010000482720a8f0e52af9f72eaa38a16025eebff5ed38a266a7a83af23d62e5f0bff9bafb7cecbc7465346429af3962283369f223f074e0e1b679f17c216beceefb3274fab1783ba535e475e433a6fbb6a8772864ecf635f0bebe34f7bf7fbc3f202e6f792a6a38a9b9b12782c1",
      mem: 200n,
      cpu: 23100n,
      result: {
        _tag: "Const",
        value:
          7934472584735297345829374203940389857324250374130461237461374324689198237413246172439813568362847918324132461234689173469172364972574327894626348923469234728574196241238723984567805163407561370166661807515263473485635726n
      }
    },
    {
      description:
        "(program 1.0.0 (con integer -7934472584735297345829374203940389857324250374130461237461374324689198237413246172439813568362847918324132461234689173469172364972574327894626348923469234728574196241238723984567805163407561370166661807515263473485635726))",
      cborHex:
        "5870586e0100004826e0a8f0e52af9f72eaa38a16025eebff5ed38a266a7a83af23d62e5f0bff9bafb7cecbc7465346429af3962283369f223f074e0e1b679f17c216beceefb3274fab1783ba535e475e433a6fbb6a8772864ecf635f0bebe34f7bf7fbc3f202e6f792a6a38a9b9b12782c1",
      mem: 200n,
      cpu: 23100n,
      result: {
        _tag: "Const",
        value:
          -7934472584735297345829374203940389857324250374130461237461374324689198237413246172439813568362847918324132461234689173469172364972574327894626348923469234728574196241238723984567805163407561370166661807515263473485635726n
      }
    },
    {
      description: "(program 1.0.0 (con (list integer) []))",
      cborHex: "47460100004bd601",
      mem: 200n,
      cpu: 23100n,
      result: {
        _tag: "Const",
        value: { itemType: Type.Int, items: [] }
      } satisfies Cek.Value
    },
    {
      description: "(program 1.0.0 (con (pair integer bool) (12345, True)))",
      cborHex: "4b4a0100004bded0a3cb0007",
      mem: 200n,
      cpu: 23100n,
      result: { _tag: "Const", value: { first: 12345n, second: true } }
    },
    {
      description:
        "(program 1.0.0 (con (pair integer (pair unit bool)) (12345, ((), True))))",
      cborHex: "4e4d0100004bded0bded3a3cb00061",
      mem: 200n,
      cpu: 23100n,
      result: {
        _tag: "Const",
        value: { first: 12345n, second: { first: null, second: true } }
      }
    },
    {
      description: "(program 1.0.0 (con string ''))",
      cborHex: "484701000049010001",
      mem: 200n,
      cpu: 23100n,
      result: { _tag: "Const", value: "" }
    },
    {
      description: "(program 1.0.0 (con string 'xyz'))",
      cborHex: "4c4b01000049010378797a0001",
      mem: 200n,
      cpu: 23100n,
      result: { _tag: "Const", value: "xyz" }
    },
    {
      description: "(program 1.0.0 (con string 'λ-calculus'))",
      cborHex: "545301000049010bcebb2d63616c63756c75730001",
      mem: 200n,
      cpu: 23100n,
      result: { _tag: "Const", value: "λ-calculus" }
    },
    {
      description: "(program 1.0.0 (con unit ()))",
      cborHex: "46450100004981",
      mem: 200n,
      cpu: 23100n,
      result: { _tag: "Const", value: null }
    },
    {
      description: "(program 1.0.0 (builtin ifThenElse))",
      cborHex: "46450100007341",
      mem: 200n,
      cpu: 23100n,
      result: {
        _tag: "Builtin",
        args: [],
        id: 26,
        forceCount: 0,
        name: "ifThenElse"
      }
    },
    {
      description:
        "(program 1.0.0 [[[(force (builtin ifThenElse)) [[(builtin lessThanEqualsInteger) (con integer 11) ] (con integer 22)]] [(builtin multiplyInteger) (con integer 11)]] [(builtin subtractInteger) (con integer 22)]])",
      cborHex: "5756010000333573466e252016480b0dc12402c6e05202c1",
      mem: 1702n,
      cpu: 654053n,
      result: {
        _tag: "Builtin",
        args: [{ _tag: "Const", value: 11n }],
        id: 2,
        forceCount: 0,
        name: "multiplyInteger"
      }
    },
    {
      description:
        "(program 1.0.0 [[[(force (builtin ifThenElse)) [[(builtin lessThanEqualsInteger) (con integer 11)] (con integer 22)]] (builtin multiplyInteger)] (builtin subtractInteger)])",
      cborHex: "5251010000333573466e252016480b1c138101",
      mem: 1302n,
      cpu: 562053n,

      result: {
        _tag: "Builtin",
        id: 2,
        args: [],
        forceCount: 0,
        name: "multiplyInteger"
      } satisfies Cek.Value
    },
    {
      description:
        "(program 1.0.0 [[[[(force (builtin ifThenElse)) [[(builtin lessThanEqualsInteger) (con integer 11)] (con integer 22)]] [(builtin multiplyInteger) (con integer 11)]] [(builtin subtractInteger) (con integer 22)]] (con integer 22)])",
      cborHex: "581b58190100003333573466e252016480b0dc12402c6e05202c480b01",
      mem: 1904n,
      cpu: 792949n,
      result: { _tag: "Const", value: 242n }
    },
    {
      description:
        "(program 1.0.0 [(force (builtin ifThenElse)) [[(builtin lessThanEqualsInteger) (con integer 11)] (con integer 22)]])",
      cborHex: "4e4d0100003573466e252016480b01",
      mem: 901n,
      cpu: 389497n,
      result: {
        _tag: "Builtin",
        id: 26,
        args: [{ _tag: "Const", value: true }],
        forceCount: 1,
        name: "ifThenElse"
      }
    },
    {
      description: "(program 1.0.0 (force (builtin ifThenElse)))",
      cborHex: "46450100005735",
      mem: 300n,
      cpu: 46100n,
      result: {
        _tag: "Builtin",
        id: 26,
        args: [],
        forceCount: 1,
        name: "ifThenElse"
      }
    },
    {
      description:
        "(program 1.0.0 [[[(force (builtin ifThenElse)) [[(builtin lessThanEqualsInteger) (con integer 11)] (con integer 22)]] (con integer 33)] (con string 'abc')])",
      cborHex: "581857010000333573466e252016480b12042491036162630001",
      mem: 1302n,
      cpu: 562053n,
      result: { _tag: "Const", value: 33n }
    },
    {
      description:
        "(program 1.0.0 [[[(force (builtin ifThenElse)) [[(builtin lessThanEqualsInteger) (con integer 11)] (con integer 22)]] (con string '11 <= 22')] (con integer -1111)])",
      cborHex:
        "581f581d010000333573466e252016480b1241083131203c3d20323200482b4441",
      mem: 1302n,
      cpu: 562053n,
      result: { _tag: "Const", value: "11 <= 22" }
    },
    {
      description:
        "(program 1.0.0 [[[(force (builtin ifThenElse)) [[(builtin lessThanEqualsInteger) (con integer 11)] (con integer 22)]] (con string '11 <= 22')] (con string '\\172(11 <= 22)')])",
      cborHex:
        "582e582c010000333573466e252016480b1241083131203c3d2032320049010e5c313732283131203c3d203232290001",
      mem: 1302n,
      cpu: 562053n,
      result: { _tag: "Const", value: "11 <= 22" }
    },
    {
      description:
        "(program 1.0.0 [[(force (builtin ifThenElse)) (con string '11 <= 22')] (con string '\\172(11 <= 22)')])",
      cborHex:
        "582758250100003357349201083131203c3d2032320049010e5c313732283131203c3d203232290001",
      mem: 700n,
      cpu: 138100n,
      result: {
        _tag: "Builtin",
        id: 26,
        args: [
          { _tag: "Const", value: "11 <= 22" },
          { _tag: "Const", value: "\\172(11 <= 22)" }
        ],
        forceCount: 1,
        name: "ifThenElse"
      }
    },
    {
      description:
        "(program 1.0.0 [(builtin addInteger) (con integer 1) (con integer 2)])",
      cborHex: "4b4a01000033700900124009",
      mem: 602n,
      cpu: 321577n,
      result: { _tag: "Const", value: 3n }
    },
    {
      description:
        "(program 1.0.0 [[(builtin addInteger) (con integer 1)] (con integer 1)])",
      cborHex: "4b4a01000033700900124005",
      mem: 602n,
      cpu: 321577n,
      result: { _tag: "Const", value: 2n }
    },
    {
      description:
        "(program 1.0.0 [[(builtin addInteger) (con integer -1789345783478975892347952789342)] (con integer 5734)])",
      cborHex: "581b581901000033700905deeddded3ce42dec8d1d0c15b5285a4198b3",
      mem: 603n,
      cpu: 322389n,
      result: { _tag: "Const", value: -1789345783478975892347952783608n }
    },
    {
      description:
        "(program 1.0.0 [[(builtin addInteger) (con integer -1789345783478975892347952789342)] (con integer 57347348957247358792345278346357234234527384258346526378567285925786235963258)])",
      cborHex:
        "583e583c01000033700905deeddded3ce42dec8d1d0c15b5285a41e93b41af8b53d1b1ebc597654577ff777d37dfd18beb41195b65a75d318b458f0b9997d81f",
      mem: 605n,
      cpu: 324013n,
      result: {
        _tag: "Const",
        value:
          57347348957247358792345278346357234234527384256557180595088310033438283173916n
      }
    },
    {
      description:
        "(program 1.0.0 [[(builtin addInteger) (con integer 0)] (con integer 7527934965792342535732746236582734865623578)])",
      cborHex:
        "5820581e0100003370090002416951ff318da73d312fdf61cb5dd57d0145e7a9cc15",
      mem: 604n,
      cpu: 323201n,
      result: {
        _tag: "Const",
        value: 7527934965792342535732746236582734865623578n
      }
    },
    {
      description:
        "(program 1.0.0 [[(builtin appendByteString) (con bytestring #00AABBCC)] (con bytestring #FF0033)])",
      cborHex: "5655010000337149110400aabbcc00488103ff00330001",
      mem: 602n,
      cpu: 117242n,
      result: { _tag: "Const", value: Bytes.toUint8Array("00aabbccff0033") }
    },
    {
      description:
        "(program 1.0.0 [[(builtin appendByteString) (con bytestring #00AABBCC)] (con bytestring #)])",
      cborHex: "5251010000337149110400aabbcc0048810001",
      mem: 602n,
      cpu: 117242n,
      result: { _tag: "Const", value: Bytes.toUint8Array("00aabbcc") }
    },
    {
      description:
        "(program 1.0.0 [[(builtin appendByteString) (con bytestring #)] (con bytestring #FF0033)])",
      cborHex: "51500100003371491100488103ff00330001",
      mem: 602n,
      cpu: 117242n,
      result: { _tag: "Const", value: Bytes.toUint8Array("ff0033") }
    },
    {
      description:
        "(program 1.0.0 [[(builtin appendString) (con string 'Ola')] (con string ' mundo!')])",
      cborHex: "581a58180100003372c921034f6c6100490107206d756e646f210001",
      mem: 614n,
      cpu: 357870n,
      result: { _tag: "Const", value: "Ola mundo!" }
    },
    {
      description: "(program 1.0.0 [(builtin bData) (con bytestring #0AFD)])",
      cborHex: "4d4c01000037529101020afd0001",
      mem: 432n,
      cpu: 70100n,
      result: {
        _tag: "Const",
        value: { data: { bytes: Bytes.toUint8Array("0afd") } }
      }
    },
    {
      description:
        "(program 1.0.0 [[(builtin equalsByteString) [(builtin blake2b_256) (con bytestring #)]] (con bytestring #0e5751c026e543b2e8ab2eb06099daa1d1e5df47778f7787faab45cdf12fe3a8)])",
      cborHex:
        "5831582f0100003371e6e51221004881200e5751c026e543b2e8ab2eb06099daa1d1e5df47778f7787faab45cdf12fe3a80001",
      mem: 805n,
      cpu: 505962n,
      result: { _tag: "Const", value: true }
    },
    {
      description:
        "(program 1.0.0 [[(builtin equalsByteString) [(builtin blake2b_256) (con bytestring #2e7ea84da4bc4d7cfb463e3f2c8647057afff3fbececa1d200)]] (con bytestring #91c60f99b33303c02b39ed93b713e3915a180c3747f3b31e05727618ee401624)])",
      cborHex:
        "584b58490100003371e6e51221192e7ea84da4bc4d7cfb463e3f2c8647057afff3fbececa1d2000048812091c60f99b33303c02b39ed93b713e3915a180c3747f3b31e05727618ee4016240001",
      mem: 805n,
      cpu: 537387n,
      result: { _tag: "Const", value: true }
    },
    {
      description:
        "(program 1.0.0 [[[[[[(force (builtin chooseData)) (con data (B #001A))] (lam x (con integer 1))] (lam y (con string 'two'))] (lam z3 z3)] (lam u (con data (I 4)))] (lam v (con data (B #05)))])",
      cborHex:
        "58295827010000333333574898010342001a0024800892410374776f00200124c101040024c10241050001",
      mem: 1532n,
      cpu: 341637n,
      result: {
        _tag: "Lambda",
        body: {
          _tag: "Const",
          value: { data: { bytes: Bytes.toUint8Array("05") } }
        },
        stack: { callSites: [], values: [] }
      }
    },
    {
      description:
        "(program 1.0.0 [[[[[[(force (builtin chooseData)) (con data (Constr 1 [I 1]))] (lam x (con integer 1))] (lam y (con string 'two'))] (lam z3 z3)] (lam u (con data (I 4)))] (lam v (con data (B #05)))])",
      cborHex:
        "582b58290100003333335748980105d87a9f01ff0024800892410374776f00200124c101040024c10241050001",
      mem: 1532n,
      cpu: 341637n,
      result: {
        _tag: "Lambda",
        body: { _tag: "Const", value: 1n },
        stack: { callSites: [], values: [] }
      }
    },
    {
      description:
        "(program 1.0.0 [[[[[[(force (builtin chooseData)) (con data (I 5))] (lam x (con integer 1))] (lam y (con string 'two'))] (lam z3 z3)] (lam u (con data (I 4)))] (lam v (con data (B #05)))])",
      cborHex:
        "582758250100003333335748980101050024800892410374776f00200124c101040024c10241050001",
      mem: 1532n,
      cpu: 341637n,
      result: {
        _tag: "Lambda",
        body: { _tag: "Const", value: { data: { int: 4n } } },
        stack: { callSites: [], values: [] }
      }
    },
    {
      description:
        "(program 1.0.0 [[[[[[(force (builtin chooseData)) (con data (List [I 0, I 1 ]))] (lam x (con integer 1))] (lam y (con string 'two'))] (lam z3 z3)] (lam u (con data (I 4)))] (lam v (con data (B #05)))])",
      cborHex:
        "582a582801000033333357489801049f0001ff0024800892410374776f00200124c101040024c10241050001",
      mem: 1532n,
      cpu: 341637n,
      result: {
        _tag: "Lambda",
        body: { _tag: "Var", index: 1 },
        stack: { callSites: [], values: [] }
      }
    },
    {
      description:
        "(program 1.0.0 [[[[[[(force (builtin chooseData)) (con data (Map [(I 0, B #00), (B #0F, I 1)]))] (lam x (con integer 1))] (lam y (con string 'two'))] (lam z3 z3)] (lam u (con data (I 4)))] (lam v (con data (B #05)))])",
      cborHex:
        "582d582b0100003333335748980107a2004100410f010024800892410374776f00200124c101040024c10241050001",
      mem: 1532n,
      cpu: 341637n,
      result: {
        _tag: "Lambda",
        body: { _tag: "Const", value: "two" },
        stack: { callSites: [], values: [] }
      }
    },
    {
      description:
        "(program 1.0.0 [[[(force (force (builtin chooseList))) (con (list integer) [ 0 , 1 , 2 ])] (con integer 1)] (con integer 2)])",
      cborHex: "53520100003335573e97ac100814109001240081",
      mem: 1032n,
      cpu: 382454n,
      result: { _tag: "Const", value: 2n }
    },
    {
      description:
        "(program 1.0.0 [[[(force (force (builtin chooseList))) (con (list integer) [])] (con integer 1)] (con integer 2)])",
      cborHex: "504f0100003335573e97ac048009200401",
      mem: 1032n,
      cpu: 382454n,
      result: { _tag: "Const", value: 1n }
    },
    {
      description:
        "(program 1.0.0 [[[(force (force (builtin chooseList))) (con (list integer) [0, 1, 2])] (lam x x)] (lam y (lam z z))])",
      cborHex: "53520100003335573e97ac100814104002440021",
      mem: 1032n,
      cpu: 382454n,
      result: {
        _tag: "Lambda",
        body: { _tag: "Lambda", body: { _tag: "Var", index: 1 } },
        stack: { callSites: [], values: [] }
      }
    },
    {
      description:
        "(program 1.0.0 [[[(force (force (builtin chooseList))) (con (list integer) [])] (lam x x)] (lam y (lam z z))])",
      cborHex: "504f0100003335573e97ac020012200101",
      mem: 1032n,
      cpu: 382454n,
      result: {
        _tag: "Lambda",
        body: { _tag: "Var", index: 1 },
        stack: { values: [], callSites: [] }
      }
    },
    {
      description:
        "(program 1.0.0 [[(force (builtin chooseUnit)) (con unit ())] (con integer 2)])",
      cborHex: "4b4a01000033573693240081",
      mem: 704n,
      cpu: 184517n,
      result: { _tag: "Const", value: 2n }
    },
    {
      description:
        "(program 1.0.0 [[(force (builtin chooseUnit)) (con unit ())] (lam x x)])",
      cborHex: "4b4a01000033573693100081",
      mem: 704n,
      cpu: 184517n,
      result: {
        _tag: "Lambda",
        body: { _tag: "Var", index: 1 },
        stack: { values: [], callSites: [] }
      }
    },
    {
      description:
        "(program 1.0.0 [(builtin consByteString) (con integer 84) (con bytestring #686543616B654973414C6965)])",
      cborHex: "581b581901000033716905400a450c686543616b654973414c69650001",
      mem: 603n,
      cpu: 338095n,
      result: {
        _tag: "Const",
        value: Bytes.toUint8Array("54686543616b654973414c6965")
      }
    },
    {
      description:
        "(program 1.0.0 [(builtin decodeUtf8) (con bytestring #4f6c61)])",
      cborHex: "4e4d01000037329101034f6c610001",
      mem: 406n,
      cpu: 580693n,
      result: { _tag: "Const", value: "Ola" }
    },
    {
      description:
        "(program 1.0.0 [[(builtin divideInteger) (con integer 1)] (con integer 2)])",
      cborHex: "4b4a01000033706900124009",
      mem: 601n,
      cpu: 568560n,
      result: { _tag: "Const", value: 0n }
    },
    {
      description:
        "(program 1.0.0 [(builtin divideInteger) (con integer -503) (con integer -1777777777)])",
      cborHex: "504f01000033706907683a41c3e36b3e1b",
      mem: 601n,
      cpu: 568560n,
      result: { _tag: "Const", value: 0n }
    },
    {
      description:
        "(program 1.0.0 [(builtin divideInteger) (con integer -503) (con integer 1777777777)])",
      cborHex: "504f01000033706907683a41c5e36b3e1b",
      mem: 601n,
      cpu: 568560n,
      result: { _tag: "Const", value: -1n }
    },
    {
      description:
        "(program 1.0.0 [(builtin divideInteger) (con integer 503) (con integer -1777777777)])",
      cborHex: "504f01000033706907703a41c3e36b3e1b",
      mem: 601n,
      cpu: 568560n,
      result: { _tag: "Const", value: -1n }
    },
    {
      description:
        "(program 1.0.0 [(builtin divideInteger) (con integer 503) (con integer 1777777777)])",
      cborHex: "504f01000033706907703a41c5e36b3e1b",
      mem: 601n,
      cpu: 568560n,
      result: { _tag: "Const", value: 0n }
    },
    {
      description: "(program 1.0.0 [(builtin encodeUtf8) (con string 'Ola')])",
      cborHex: "4e4d01000037309201034f6c610001",
      mem: 410n,
      cpu: 156086n,
      result: { _tag: "Const", value: Bytes.toUint8Array("4f6c61") }
    },
    {
      description:
        "(program 1.0.0 [[(builtin equalsByteString) (con bytestring #00ffaa)] (con bytestring #00ffaa)])",
      cborHex: "55540100003371e9110300ffaa0048810300ffaa0001",
      mem: 601n,
      cpu: 331935n,
      result: { _tag: "Const", value: true }
    },
    {
      description:
        "(program 1.0.0 [(builtin lengthOfByteString) (con bytestring #54686543616B654973414C6965)])",
      cborHex: "581857010000371a91010d54686543616b654973414c69650001",
      mem: 410n,
      cpu: 70100n,
      result: { _tag: "Const", value: 13n }
    },
    {
      description:
        "(program 1.0.0 [(builtin equalsByteString) (con bytestring #54686543616B654973414C6965) (con bytestring #54686543616B65497341506965)])",
      cborHex:
        "582a58280100003371e9110d54686543616b654973414c69650048810d54686543616b654973415069650001",
      mem: 601n,
      cpu: 331997n,
      result: { _tag: "Const", value: false }
    },
    {
      description:
        "(program 1.0.0 [[(builtin equalsInteger) (con integer 1)] (con integer 2)])",
      cborHex: "4b4a0100003370e900124009",
      mem: 601n,
      cpu: 324033n,
      result: { _tag: "Const", value: false }
    },
    {
      description:
        "(program 1.0.0 [[(builtin equalsInteger) (con integer 45723452347050234588234852993485827934)] (con integer 45723452347050234588234852993485827933)])",
      cborHex:
        "5830582e0100003370e905e5ee3e8e855f5c9d0f2fc4161c45042664480a41757b8fa3a157d72743cbf10587114109991203",
      mem: 601n,
      cpu: 324454n,
      result: { _tag: "Const", value: false }
    },
    {
      description:
        "(program 1.0.0 [[(builtin equalsInteger) (con integer 45723452347050234588234852993485827934)] (con integer 45723452347050234588234852993485827934)])",
      cborHex:
        "5830582e0100003370e905e5ee3e8e855f5c9d0f2fc4161c45042664480a41797b8fa3a157d72743cbf10587114109991203",
      mem: 601n,
      cpu: 324454n,
      result: { _tag: "Const", value: true }
    },
    {
      description:
        "(program 1.0.0 [[(builtin equalsString) (con string 'Ola')] (con string ' mundo!')])",
      cborHex: "581a58180100003372e921034f6c6100490107206d756e646f210001",
      mem: 601n,
      cpu: 302100n,
      result: { _tag: "Const", value: false }
    },
    {
      description:
        "(program 1.0.0 [[(builtin equalsString) (con string 'Ola')] (con string 'Ola')])",
      cborHex: "55540100003372e921034f6c61004901034f6c610001",
      mem: 601n,
      cpu: 275094n,
      result: { _tag: "Const", value: true }
    },
    {
      description:
        "(program 1.0.0 [(force (force (builtin fstPair))) (con (pair bool bytestring) (True, #012345))])",
      cborHex: "515001000035573a97bda915030123450001",
      mem: 632n,
      cpu: 195536n,
      result: { _tag: "Const", value: true }
    },
    {
      description:
        "(program 1.0.0 [(force (builtin headList)) (con (list integer) [1, 2])])",
      cborHex: "4c4b0100003574297ac1028201",
      mem: 532n,
      cpu: 135349n,
      result: { _tag: "Const", value: 1n }
    },
    {
      description:
        "(program 1.0.0 [(force (builtin headList)) (con (list integer) [1, 2, 3])])",
      cborHex: "4d4c0100003574297ac102824181",
      mem: 532n,
      cpu: 135349n,
      result: { _tag: "Const", value: 1n }
    },
    {
      description: "(program 1.0.0 [(builtin iData) (con integer 0)])",
      cborHex: "49480100003750900001",
      mem: 432n,
      cpu: 70100n,
      result: { _tag: "Const", value: { data: { int: 0n } } }
    },
    {
      description:
        "(program 1.0.0 [[[(force (builtin ifThenElse)) (con bool True)] (lam x x)] (con integer 2)])",
      cborHex: "4e4d01000033357349448005200401",
      mem: 901n,
      cpu: 264656n,
      result: {
        _tag: "Lambda",
        body: { _tag: "Var", index: 1 },
        stack: { values: [], callSites: [] }
      }
    },
    {
      description:
        "(program 1.0.0 [(force (builtin ifThenElse)) (con bool False) (lam x x) (lam y (lam z z))])",
      cborHex: "4e4d01000033357349408004880041",
      mem: 901n,
      cpu: 264656n,
      result: {
        _tag: "Lambda",
        body: { _tag: "Lambda", body: { _tag: "Var", index: 1 } },
        stack: { values: [], callSites: [] }
      }
    },
    {
      description:
        "(program 1.0.0 [(force (builtin ifThenElse)) (con bool False) (lam x x) (con integer 42)])",
      cborHex: "4e4d01000033357349408005205401",
      mem: 901n,
      cpu: 264656n,
      result: { _tag: "Const", value: 42n }
    },
    {
      description:
        "(program 1.0.0 [[(builtin indexByteString) (con bytestring #00ffaa)] (con integer 1)])",
      cborHex: "504f0100003371c9110300ffaa00480081",
      mem: 604n,
      cpu: 172767n,
      result: { _tag: "Const", value: 255n }
    },
    {
      description:
        "(program 1.0.0 [(builtin lengthOfByteString) (con bytestring #00ffaa)])",
      cborHex: "4e4d010000371a91010300ffaa0001",
      mem: 410n,
      cpu: 70100n,
      result: { _tag: "Const", value: 3n }
    },
    {
      description:
        "(program 1.0.0 [[(builtin lessThanByteString) (con bytestring #00ff)] (con bytestring #00ffaa)])",
      cborHex: "5453010000337209110200ff0048810300ffaa0001",
      mem: 601n,
      cpu: 312401n,
      result: { _tag: "Const", value: true }
    },
    {
      description:
        "(program 1.0.0 [(builtin equalsByteString) (con bytestring #54686543616B654973414C6965) (con bytestring #54686543616B654973414C6965)])",
      cborHex:
        "582a58280100003371e9110d54686543616b654973414c69650048810d54686543616b654973414c69650001",
      mem: 601n,
      cpu: 331997n,
      result: { _tag: "Const", value: true }
    },
    {
      description:
        "(program 1.0.0 [(builtin lessThanByteString) (con bytestring #54686543616B654973414C6965) (con bytestring #54686543616B65497341506965)])",
      cborHex:
        "582a5828010000337209110d54686543616b654973414c69650048810d54686543616b654973415069650001",
      mem: 601n,
      cpu: 312557n,
      result: { _tag: "Const", value: true }
    },
    {
      description:
        "(program 1.0.0 [(builtin lessThanByteString) (con bytestring #54686543616B65497341506965) (con bytestring #54686543616B654973414C6965)])",
      cborHex:
        "582a5828010000337209110d54686543616b654973415069650048810d54686543616b654973414c69650001",
      mem: 601n,
      cpu: 312557n,
      result: { _tag: "Const", value: false }
    },
    {
      description:
        "(program 1.0.0 [(builtin lessThanByteString) (con bytestring #54686543616B65497341506965) (con bytestring #54686543616B654973414C69)])",
      cborHex:
        "58295827010000337209110d54686543616b654973415069650048810c54686543616b654973414c690001",
      mem: 601n,
      cpu: 312557n,
      result: { _tag: "Const", value: false }
    },
    {
      description:
        "(program 1.0.0 [(builtin lessThanByteString) (con bytestring #54686543616B654973414C69) (con bytestring #54686543616B65497341506965)])",
      cborHex:
        "58295827010000337209110c54686543616b654973414c690048810d54686543616b654973415069650001",
      mem: 601n,
      cpu: 312557n,
      result: { _tag: "Const", value: true }
    },
    {
      description:
        "(program 1.0.0 [[(builtin lessThanEqualsByteString) (con bytestring #00ff)] (con bytestring #00)])",
      cborHex: "5251010000337229110200ff00488101000001",
      mem: 601n,
      cpu: 312401n,
      result: { _tag: "Const", value: false }
    },
    {
      description:
        "(program 1.0.0 [(builtin lessThanEqualsByteString) (con bytestring #54686543616B654973414C6964) (con bytestring #54686543616B654973414C6965)])",
      cborHex:
        "582a5828010000337229110d54686543616b654973414c69640048810d54686543616b654973414c69650001",
      mem: 601n,
      cpu: 312557n,
      result: { _tag: "Const", value: true }
    },
    {
      description:
        "(program 1.0.0 [(builtin lessThanEqualsByteString) (con bytestring #54686543616B654973414C6966) (con bytestring #54686543616B654973414C6965)])",
      cborHex:
        "582a5828010000337229110d54686543616b654973414c69660048810d54686543616b654973414c69650001",
      mem: 601n,
      cpu: 312557n,
      result: { _tag: "Const", value: false }
    },
    {
      description:
        "(program 1.0.0 [(builtin lessThanEqualsByteString) (con bytestring #54686543616B654973414C6965) (con bytestring #54686543616B654973414C6965)])",
      cborHex:
        "582a5828010000337229110d54686543616b654973414c69650048810d54686543616b654973414c69650001",
      mem: 601n,
      cpu: 312557n,
      result: { _tag: "Const", value: true }
    },
    {
      description:
        "(program 1.0.0 [[(builtin lessThanEqualsInteger) (con integer 1)] (con integer 2)])",
      cborHex: "4b4a01000033712900124009",
      mem: 601n,
      cpu: 320497n,
      result: { _tag: "Const", value: true }
    },
    {
      description:
        "(program 1.0.0 [(builtin lessThanEqualsInteger) (con integer 8) (con integer 4)])",
      cborHex: "4b4a01000033712900824011",
      mem: 601n,
      cpu: 320497n,
      result: { _tag: "Const", value: false }
    },
    {
      description:
        "(program 1.0.0 [(builtin lessThanEqualsInteger) (con integer 4) (con integer 8)])",
      cborHex: "4b4a01000033712900424021",
      mem: 601n,
      cpu: 320497n,
      result: { _tag: "Const", value: true }
    },
    {
      description:
        "(program 1.0.0 [(builtin lessThanEqualsInteger) (con integer 4) (con integer 4)])",
      cborHex: "4b4a01000033712900424011",
      mem: 601n,
      cpu: 320497n,
      result: { _tag: "Const", value: true }
    },
    {
      description:
        "(program 1.0.0 [(builtin lessThanEqualsInteger) (con integer 3477349701412809834789938452452684373578934257) (con integer 3477349701412809834789938452452684373578934257)])",
      cborHex:
        "583658340100003371290714febd2c9f75e7965ded86249cff158d9e651707e93241c53faf4b27dd79e5977b6189273fc563679945c1fa4d",
      mem: 601n,
      cpu: 321443n,
      result: { _tag: "Const", value: true }
    },
    {
      description:
        "(program 1.0.0 [[(builtin lessThanInteger) (con integer 1)] (con integer 2)])",
      cborHex: "4b4a01000033710900124009",
      mem: 601n,
      cpu: 324507n,
      result: { _tag: "Const", value: true }
    },
    {
      description:
        "(program 1.0.0 [(builtin lessThanInteger) (con integer 8) (con integer 4)])",
      cborHex: "4b4a01000033710900824011",
      mem: 601n,
      cpu: 324507n,
      result: { _tag: "Const", value: false }
    },
    {
      description:
        "(program 1.0.0 [(builtin lessThanInteger) (con integer 4) (con integer 8)])",
      cborHex: "4b4a01000033710900424021",
      mem: 601n,
      cpu: 324507n,
      result: { _tag: "Const", value: true }
    },
    {
      description:
        "(program 1.0.0 [(builtin lessThanInteger) (con integer 4) (con integer 4)])",
      cborHex: "4b4a01000033710900424011",
      mem: 601n,
      cpu: 324507n,
      result: { _tag: "Const", value: false }
    },
    {
      description:
        "(program 1.0.0 [(builtin lessThanInteger) (con integer 3477349701412809834789938452452684373578934257) (con integer 3477349701412809834789938452452684373578934257)])",
      cborHex:
        "583658340100003371090714febd2c9f75e7965ded86249cff158d9e651707e93241c53faf4b27dd79e5977b6189273fc563679945c1fa4d",
      mem: 601n,
      cpu: 325529n,
      result: { _tag: "Const", value: false }
    },
    {
      description:
        "(program 1.0.0 [(builtin listData) (con (list data) [(I 0), (B #1234), (Map [(I 9, List [B #abcd]), (B #4321, I 1234)])])])",
      cborHex:
        "58245822010000374e97ae11010000810342123400810da2099f42abcdff4243211904d20001",
      mem: 432n,
      cpu: 81952n,
      era: "conway",
      result: {
        _tag: "Const",
        value: {
          data: {
            list: [
              { int: 0n },
              { bytes: Bytes.toUint8Array("1234") },
              {
                map: [
                  {
                    k: { int: 9n },
                    v: { list: [{ bytes: Bytes.toUint8Array("abcd") }] }
                  },
                  {
                    k: { bytes: Bytes.toUint8Array("4321") },
                    v: { int: 1234n }
                  }
                ]
              }
            ]
          }
        }
      }
    },
    {
      description:
        "(program 1.0.0 [[(force (builtin mkCons)) (con integer 0)] (con (list integer) [])])",
      cborHex: "4c4b010000335740900025eb01",
      mem: 732n,
      cpu: 203593n,
      result: { _tag: "Const", value: { itemType: Type.Int, items: [0n] } }
    },
    {
      description:
        "(program 1.0.0 [[(force (builtin mkCons)) (con integer 0)] (con (list integer) [1, 2])])",
      cborHex: "4f4e010000335740900025eb040a0801",
      mem: 732n,
      cpu: 203593n,
      result: {
        _tag: "Const",
        value: { itemType: Type.Int, items: [0n, 1n, 2n] }
      }
    },
    {
      description: "(program 1.0.0 [(builtin mkNilData) (con unit ())])",
      cborHex: "484701000037629301",
      mem: 432n,
      cpu: 91658n,
      result: { _tag: "Const", value: { itemType: Type.Data, items: [] } }
    },
    {
      description: "(program 1.0.0 [(builtin mkNilPairData) (con unit ())])",
      cborHex: "484701000037649301",
      mem: 432n,
      cpu: 85663n,
      result: { _tag: "Const", value: { itemType: Type.DataPair, items: [] } }
    },
    {
      description:
        "(program 1.0.0 [[(builtin modInteger) (con integer 2) ] (con integer 3)])",
      cborHex: "4b4a0100003370c90022400d",
      mem: 601n,
      cpu: 568560n,
      result: { _tag: "Const", value: 2n }
    },
    {
      description:
        "(program 1.0.0 [(builtin modInteger) (con integer -503) (con integer -1777777777)])",
      cborHex: "504f0100003370c907683a41c3e36b3e1b",
      mem: 601n,
      cpu: 568560n,
      result: { _tag: "Const", value: -503n }
    },
    {
      description:
        "(program 1.0.0 [(builtin modInteger) (con integer -503) (con integer 1777777777)])",
      cborHex: "504f0100003370c907683a41c5e36b3e1b",
      mem: 601n,
      cpu: 568560n,
      result: { _tag: "Const", value: 1777777274n }
    },
    {
      description:
        "(program 1.0.0 [(builtin modInteger) (con integer 503) (con integer -1777777777)])",
      cborHex: "504f0100003370c907703a41c3e36b3e1b",
      mem: 601n,
      cpu: 568560n,
      result: { _tag: "Const", value: -1777777274n }
    },
    {
      description:
        "(program 1.0.0 [(builtin modInteger) (con integer 503) (con integer 1777777777)])",
      cborHex: "504f0100003370c907703a41c5e36b3e1b",
      mem: 601n,
      cpu: 568560n,
      result: { _tag: "Const", value: 503n }
    },
    {
      description:
        "(program 1.0.0 [[(builtin multiplyInteger) (con integer 1)] (con integer 1)])",
      cborHex: "4b4a01000033704900124005",
      mem: 602n,
      cpu: 207996n,
      result: { _tag: "Const", value: 1n }
    },
    {
      description:
        "(program 1.0.0 [[(builtin multiplyInteger) (con integer 793479793478939166266268485555555)] (con integer 0)])",
      cborHex: "581b58190100003370490636ac85650ecc1c6c359f96cf7e3c793a4001",
      mem: 603n,
      cpu: 219683n,
      result: { _tag: "Const", value: 0n }
    },
    {
      description:
        "(program 1.0.0 [[(builtin multiplyInteger) (con integer 793479793478939)] (con integer 166266268485555555)])",
      cborHex: "581b581901000033704905b5a6849e6f574012418dab61e79325b39c09",
      mem: 602n,
      cpu: 207996n,
      result: { _tag: "Const", value: 131928924380432445633603606956145n }
    },
    {
      description:
        "(program 1.0.0 [[(builtin multiplyInteger) (con integer 793479793478939)] (con integer -166266268485555555)])",
      cborHex: "581b581901000033704905b5a6849e6f574012418bab61e79325b39c09",
      mem: 602n,
      cpu: 207996n,
      result: { _tag: "Const", value: -131928924380432445633603606956145n }
    },
    {
      description:
        "(program 1.0.0 [[(builtin multiplyInteger) (con integer -793479793478939)] (con integer 166266268485555555)])",
      cborHex: "581b581901000033704905ada6849e6f574012418dab61e79325b39c09",
      mem: 602n,
      cpu: 207996n,
      result: { _tag: "Const", value: -131928924380432445633603606956145n }
    },
    {
      description:
        "(program 1.0.0 [[(builtin multiplyInteger) (con integer -793479793478939) ] (con integer -166266268485555555)])",
      cborHex: "581b581901000033704905ada6849e6f574012418bab61e79325b39c09",
      mem: 602n,
      cpu: 207996n,
      result: { _tag: "Const", value: 131928924380432445633603606956145n }
    },
    {
      description:
        "(program 1.0.0 [(force (builtin nullList)) (con (list integer) [1, 2, 3])])",
      cborHex: "4d4c0100003574697ac102824181",
      mem: 532n,
      cpu: 152191n,
      result: { _tag: "Const", value: false }
    },
    {
      description:
        "(program 1.0.0 [(force (builtin nullList)) (con (list integer) [])])",
      cborHex: "4a490100003574697ac001",
      mem: 532n,
      cpu: 152191n,
      result: { _tag: "Const", value: true }
    },
    {
      description:
        "(program 1.0.0 (con (pair (pair bool bytestring) (list integer)) ((True, #012345), [0, 1, 2])))",
      cborHex: "55540100004bded7bda91bd60903012345008040a081",
      mem: 200n,
      cpu: 23100n,
      result: {
        _tag: "Const",
        value: {
          first: { first: true, second: Bytes.toUint8Array("012345") },
          second: { itemType: Type.Int, items: [0n, 1n, 2n] }
        }
      }
    },
    {
      description:
        "(program 1.0.0 [[(builtin quotientInteger) (con integer 1)] (con integer 2)])",
      cborHex: "4b4a01000033708900124009",
      mem: 601n,
      cpu: 568560n,
      result: { _tag: "Const", value: 0n }
    },
    {
      description:
        "(program 1.0.0 [(builtin quotientInteger) (con integer -503783783785265728700234277) (con integer -1777777777)])",
      cborHex: "581c581a010000337089064f44cd5d4f3f271e47b61459a241c3e36b3e1b",
      mem: 601n,
      cpu: 568780n,
      result: { _tag: "Const", value: 283378378503190012n }
    },
    {
      description:
        "(program 1.0.0 [(builtin quotientInteger) (con integer -503783783785265728700234277) (con integer 1777777777)])",
      cborHex: "581c581a010000337089064f44cd5d4f3f271e47b61459a241c5e36b3e1b",
      mem: 601n,
      cpu: 568780n,
      result: { _tag: "Const", value: -283378378503190012n }
    },
    {
      description:
        "(program 1.0.0 [(builtin quotientInteger) (con integer 503783783785265728700234277) (con integer -1777777777)])",
      cborHex: "581c581a010000337089065744cd5d4f3f271e47b61459a241c3e36b3e1b",
      mem: 601n,
      cpu: 568780n,
      result: { _tag: "Const", value: -283378378503190012n }
    },
    {
      description:
        "(program 1.0.0 [(builtin quotientInteger) (con integer 503783783785265728700234277) (con integer 1777777777)])",
      cborHex: "581c581a010000337089065744cd5d4f3f271e47b61459a241c5e36b3e1b",
      mem: 601n,
      cpu: 568780n,
      result: { _tag: "Const", value: 283378378503190012n }
    },
    {
      description:
        "(program 1.0.0 [[(builtin remainderInteger) (con integer 1)] (con integer 2)])",
      cborHex: "4b4a0100003370a900124009",
      mem: 601n,
      cpu: 568560n,
      result: { _tag: "Const", value: 1n }
    },
    {
      description:
        "(program 1.0.0 [(builtin remainderInteger) (con integer -503) (con integer -1777777777)])",
      cborHex: "504f0100003370a907683a41c3e36b3e1b",
      mem: 601n,
      cpu: 568560n,
      result: { _tag: "Const", value: -503n }
    },
    {
      description:
        "(program 1.0.0 [(builtin remainderInteger) (con integer -503) (con integer 1777777777)])",
      cborHex: "504f0100003370a907683a41c5e36b3e1b",
      mem: 601n,
      cpu: 568560n,
      result: { _tag: "Const", value: -503n }
    },
    {
      description:
        "(program 1.0.0 [(builtin remainderInteger) (con integer 503) (con integer -1777777777)])",
      cborHex: "504f0100003370a907703a41c3e36b3e1b",
      mem: 601n,
      cpu: 568560n,
      result: { _tag: "Const", value: 503n }
    },
    {
      description:
        "(program 1.0.0 [(builtin remainderInteger) (con integer 503) (con integer 1777777777)])",
      cborHex: "504f0100003370a907703a41c5e36b3e1b",
      mem: 601n,
      cpu: 568560n,
      result: { _tag: "Const", value: 503n }
    },
    {
      description:
        "(program 1.0.0 [[(builtin equalsByteString) [ (builtin sha2_256) (con bytestring #)]] (con bytestring #e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855)])",
      cborHex:
        "5831582f0100003371e6e4922100488120e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b8550001",
      mem: 805n,
      cpu: 1215593n,
      result: { _tag: "Const", value: true }
    },
    {
      description:
        "(program 1.0.0 [[(builtin equalsByteString) [(builtin sha2_256) (con bytestring #2e7ea84da4bc4d7cfb463e3f2c8647057afff3fbececa1d200)]] (con bytestring #76e3acbc718836f2df8ad2d0d2d76f0cfa5fea0986be918f10bcee730df441b9)])",
      cborHex:
        "584b58490100003371e6e49221192e7ea84da4bc4d7cfb463e3f2c8647057afff3fbececa1d2000048812076e3acbc718836f2df8ad2d0d2d76f0cfa5fea0986be918f10bcee730df441b90001",
      mem: 805n,
      cpu: 1307039n,
      result: { _tag: "Const", value: true }
    },
    {
      description:
        "(program 1.0.0 [[(builtin equalsByteString) [(builtin sha3_256) (con bytestring #)]] (con bytestring #a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a)])",
      cborHex:
        "5831582f0100003371e6e4d22100488120a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a0001",
      mem: 805n,
      cpu: 2388570n,
      result: { _tag: "Const", value: true }
    },
    {
      description:
        "(program 1.0.0 [[(builtin equalsByteString) [(builtin sha3_256) (con bytestring #9b3fdf8d448680840d6284f2997d3af55ffd85f6f4b33d7f8d)]] (con bytestring #25005d10e84ff97c74a589013be42fb37f68db64bdfc7626efc0dd628077493a)])",
      cborHex:
        "584b58490100003371e6e4d221199b3fdf8d448680840d6284f2997d3af55ffd85f6f4b33d7f8d0048812025005d10e84ff97c74a589013be42fb37f68db64bdfc7626efc0dd628077493a0001",
      mem: 805n,
      cpu: 2636139n,
      result: { _tag: "Const", value: true }
    },
    {
      description:
        "(program 1.0.0 [(builtin sliceByteString) (con integer 3) (con integer 5) (con bytestring #54686543616B654973414C6965)])",
      cborHex:
        "581e581c0100003337189003240149110d54686543616b654973414c69650001",
      mem: 804n,
      cpu: 426418n,
      result: { _tag: "Const", value: Bytes.toUint8Array("43616b6549") }
    },
    {
      description:
        "(program 1.0.0 [(builtin sliceByteString) (con integer -3) (con integer 5) (con bytestring #54686543616B654973414C6965)])",
      cborHex:
        "581e581c0100003337189002a40149110d54686543616b654973414c69650001",
      mem: 804n,
      cpu: 426418n,
      result: { _tag: "Const", value: Bytes.toUint8Array("5468654361") }
    },
    {
      description:
        "(program 1.0.0 [(builtin sliceByteString) (con integer -3) (con integer 1234) (con bytestring #54686543616B654973414C6965)])",
      cborHex:
        "581f581d0100003337189002a4148269110d54686543616b654973414c69650001",
      mem: 804n,
      cpu: 426418n,
      result: {
        _tag: "Const",
        value: Bytes.toUint8Array("54686543616b654973414c6965")
      }
    },
    {
      description:
        "(program 1.0.0 [(builtin sliceByteString) (con integer 5) (con integer 3) (con bytestring #54686543616B654973414C6965)])",
      cborHex:
        "581e581c01000033371890052400c9110d54686543616b654973414c69650001",
      mem: 804n,
      cpu: 426418n,
      result: { _tag: "Const", value: Bytes.toUint8Array("6b6549") }
    },
    {
      description:
        "(program 1.0.0 [(builtin sliceByteString) (con integer 123456789123456789) (con integer 123456789123456789) (con bytestring #54686543616B654973414C6965)])",
      cborHex:
        "582e582c01000033371890557e4166fae966db01a4155f9059beba59b6c069110d54686543616b654973414c69650001",
      mem: 804n,
      cpu: 426418n,
      result: { _tag: "Const", value: new Uint8Array() }
    },
    {
      description:
        "(program 1.0.0 [[(builtin subtractInteger) (con integer 1)] (con integer 1)])",
      cborHex: "4b4a01000033702900124005",
      mem: 602n,
      cpu: 321577n,
      result: { _tag: "Const", value: 0n }
    },
    {
      description:
        "(program 1.0.0 [[(builtin subtractInteger) (con integer 123423)] (con integer -794378954789297841)])",
      cborHex: "555401000033702905f4407a41c3f53129d7b9330c2d",
      mem: 602n,
      cpu: 321577n,
      result: { _tag: "Const", value: 794378954789421264n }
    },
    {
      description:
        "(program 1.0.0 [[(builtin subtractInteger) (con integer 134782734132417234781342718231486243)] (con integer 23443231)])",
      cborHex:
        "581f581d0100003370290637e7a4065d16d4c54d3e669e468d37a99a417db95a2d",
      mem: 603n,
      cpu: 322389n,
      result: { _tag: "Const", value: 134782734132417234781342718208043012n }
    },
    {
      description:
        "(program 1.0.0 [[(builtin subtractInteger) (con integer 0)] (con integer -327893248793249782347891)])",
      cborHex: "5655010000337029000241cbc3eb3fb1492ddd83795609",
      mem: 603n,
      cpu: 322389n,
      result: { _tag: "Const", value: 327893248793249782347891n }
    },
    {
      description:
        "(program 1.0.0 [[(builtin subtractInteger) (con integer 1)] (con integer 2)])",
      cborHex: "4b4a01000033702900124009",
      mem: 602n,
      cpu: 321577n,
      result: { _tag: "Const", value: -1n }
    },
    {
      description:
        "(program 1.0.0 [[(force (builtin trace)) (con string 'Ola')] (con integer 2)])",
      cborHex: "51500100003357389201034f6c6100480101",
      mem: 732n,
      cpu: 350442n,
      result: { _tag: "Const", value: 2n }
    },
    {
      description: "(program 1.0.0 [(lam x x) (con unit ())])",
      cborHex: "484701000032001499",
      mem: 500n,
      cpu: 92100n,
      result: { _tag: "Const", value: null }
    },
    {
      description: "(program 1.0.0 [(lam x x) (con integer 0)])",
      cborHex: "49480100003200148001",
      mem: 500n,
      cpu: 92100n,
      result: { _tag: "Const", value: 0n }
    },
    {
      description:
        "(program 1.0.0 [(lam x (con bool False)) (con integer 42)])",
      cborHex: "4948010000324a0902a1",
      mem: 500n,
      cpu: 92100n,
      result: { _tag: "Const", value: false }
    },
    {
      description: "(program 1.0.0 [(lam x x) (con integer 42)])",
      cborHex: "49480100003200148151",
      mem: 500n,
      cpu: 92100n,
      result: { _tag: "Const", value: 42n }
    },
    {
      description: "(program 1.0.0 [[(lam x x) (lam y y)] (con integer 42)])",
      cborHex: "4c4b0100003320012001481501",
      mem: 800n,
      cpu: 161100n,
      result: { _tag: "Const", value: 42n }
    },
    {
      description: "(program 1.0.0 [(lam x x) (lam y y)])",
      cborHex: "49480100003200120011",
      mem: 500n,
      cpu: 92100n,
      result: {
        _tag: "Lambda",
        body: { _tag: "Var", index: 1 },
        stack: { callSites: [], values: [] }
      }
    },
    {
      description: "(program 1.0.0 [(lam x (lam y x)) (con integer 42)])",
      cborHex: "4a49010000322002481501",
      mem: 500n,
      cpu: 92100n,
      result: {
        _tag: "Lambda",
        body: { _tag: "Var", index: 2 },
        stack: {
          callSites: [
            {
              arguments: [{ _tag: "Const", value: 42n }],
              functionName: undefined,
              sourceSpan: undefined
            }
          ],
          values: [{ _tag: "Const", value: 42n }]
        }
      }
    },
    {
      description:
        "(program 1.0.0 [(lam x (lam y x)) (con integer 42) (con bool False)])",
      cborHex: "4c4b0100003322002481512801",
      mem: 800n,
      cpu: 161100n,
      result: { _tag: "Const", value: 42n }
    },
    {
      description:
        "(program 1.0.0 [(lam f (lam x (lam y [f x y]))) (lam a (lam b a)) (con bool False) (con bool True)])",
      cborHex: "525101000033322233003002001220024a0945",
      mem: 1700n,
      cpu: 368100n,
      result: { _tag: "Const", value: false }
    },
    {
      description:
        "(program 1.0.0 [ (lam i_0 (lam j_1 i_0)) (con integer 1) ])",
      cborHex: "4a49010000322002480081",
      mem: 500n,
      cpu: 92100n,
      result: {
        _tag: "Lambda",
        name: undefined,
        argName: undefined,
        body: { _tag: "Var", index: 2 },
        stack: {
          callSites: [
            {
              arguments: [{ _tag: "Const", value: 1n }],
              functionName: undefined,
              sourceSpan: undefined
            }
          ],
          values: [{ _tag: "Const", value: 1n }]
        }
      }
    },
    {
      description: "(program 1.0.0 [(lam x (con integer 4)) (delay (error))])",
      cborHex: "49480100003248020581",
      mem: 500n,
      cpu: 92100n,
      result: { _tag: "Const", value: 4n }
    },
    {
      description: "(program 1.0.0 [(lam x x) (delay (error))])",
      cborHex: "484701000032001161",
      mem: 500n,
      cpu: 92100n,
      result: {
        _tag: "Delayed",
        term: { _tag: "Error" },
        stack: { callSites: [], values: [] }
      }
    },
    {
      description: "(program 1.0.0 (lam x (delay x)))",
      cborHex: "4746010000210011",
      mem: 200n,
      cpu: 23100n,
      result: {
        _tag: "Lambda",
        body: { _tag: "Delay", arg: { _tag: "Var", index: 1 } },
        stack: { callSites: [], values: [] }
      }
    },
    {
      description:
        "(program 1.0.0 [(lam x (force x)) (delay (con integer 4))])",
      cborHex: "4a49010000325001148021",
      mem: 700n,
      cpu: 138100n,
      result: { _tag: "Const", value: 4n }
    },
    {
      description:
        "(program 1.0.0 [(lam x (force [(lam y y) x])) (delay (con integer 4))])",
      cborHex: "4d4c010000325320010011480201",
      mem: 1000n,
      cpu: 207100n,
      result: { _tag: "Const", value: 4n }
    },
    {
      description: "(program 1.0.0 (lam x x))",
      cborHex: "4746010000200101",
      mem: 200n,
      cpu: 23100n,
      result: {
        _tag: "Lambda",
        body: { _tag: "Var", index: 1 },
        stack: { callSites: [], values: [] }
      }
    },
    {
      description: "(program 1.0.0 (lam x (con integer 23)))",
      cborHex: "47460100002480b9",
      mem: 200n,
      cpu: 23100n,
      result: {
        _tag: "Lambda",
        body: { _tag: "Const", value: 23n },
        stack: { callSites: [], values: [] }
      }
    },
    {
      description: "(program 1.0.0 [(builtin addInteger) (con unit ())])",
      cborHex: "484701000037009301",
      mem: 400n,
      cpu: 69100n,
      result: {
        _tag: "Builtin",
        id: 0,
        name: "addInteger",
        forceCount: 0,
        args: [{ _tag: "Const", value: null }]
      }
    },
    {
      description:
        "(program 1.0.0 [[(force (force (delay (delay (lam f (lam x [ f x ])))))) [(builtin addInteger) [(lam x0 [[(builtin multiplyInteger) [[(builtin multiplyInteger) x0] x0]] [[(builtin subtractInteger) [[(builtin subtractInteger) (con integer 0)] (con integer 1)]] [[(builtin subtractInteger) (con integer 3)] (con integer 0)]]]) [(lam x1 [[(builtin subtractInteger) [[(builtin multiplyInteger) (con integer 0)] (con integer 2)]] [[(builtin addInteger) (con integer 0)] (con integer 1)]]) [(lam x2 [[(builtin subtractInteger) (con integer 2) ] (con integer 2)])[(builtin sha3_256) (con bytestring #76)]]]]]] [(lam x0 [[(builtin addInteger) [[(builtin addInteger) [[(builtin multiplyInteger) (con integer 2) ] (con integer 1)]] [[(builtin addInteger) (con integer 2)] (con integer 3)]]] [[(builtin subtractInteger) [[(builtin subtractInteger) (con integer 1)] (con integer 2)]] [[(builtin subtractInteger) (con integer 2)] (con integer 1)]]]) [[(builtin lessThanInteger) (con integer 3)] [[(builtin multiplyInteger) [[(builtin addInteger) (con integer 2)] (con integer 1)]] [[(builtin subtractInteger) (con integer 2)] (con integer 0)]]]]])",
      cborHex:
        "5880587e01000033551122300200137006466e08cdc100080099b813370290002400466e05200648000c8cdc099b82480012004337009000240046466e05200448010dc9a441017600323370066e00cdc124008900119b804801120063370266e05200248010cdc0a4008900119b8848018cdc119b80480112002337029002240001",
      mem: 11045n,
      cpu: 8288591n,
      result: { _tag: "Const", value: 1n }
    },
    {
      description:
        "(program 1.0.0 [[[(force (force (delay (delay (lam f (lam x [ f x ])))))) (builtin addInteger)] [(lam x0 [[(builtin multiplyInteger) [[(builtin subtractInteger) [[(builtin subtractInteger) (con integer 3)] (con integer 2)]] [[(builtin addInteger) (con integer 2)] (con integer 0)]]] [[(builtin subtractInteger) [[(builtin multiplyInteger) (con integer 3)] (con integer 0)]] [[(builtin multiplyInteger) (con integer 1)] (con integer 1)]]]) [[(builtin lessThanEqualsInteger) [[(builtin subtractInteger) [[(builtin multiplyInteger) (con integer 3)] (con integer 3)]] [[(builtin subtractInteger) (con integer 2)] (con integer 3)]]] [[(builtin addInteger) [[(builtin addInteger) (con integer 2)] (con integer 3)]] [[(builtin subtractInteger) (con integer 3)] (con integer 3)]]]]] [(lam x0 [(lam x2 [[(builtin addInteger) [[(builtin subtractInteger) (con integer 0)] (con integer 3)]] [[(builtin subtractInteger) (con integer 2)] (con integer 1)]]) [[(builtin subtractInteger) [[(builtin addInteger) (con integer 1)] (con integer 1)]] [[(builtin subtractInteger) (con integer 2)] (con integer 0)]]]) [(lam x1 [[(builtin lessThanInteger) [[(builtin multiplyInteger) (con integer 0)] (con integer 3)]] [[(builtin addInteger) (con integer 0)] (con integer 1)]]) [[(builtin equalsInteger) [[(builtin multiplyInteger) (con integer 3)] (con integer 2)]] [[(builtin subtractInteger) (con integer 2)] (con integer 0)]]]]])",
      cborHex:
        "5899589701000033355112230020017006466e08cdc099b814801920043370090022400066e04cdc12400c900019b824800920023371266e04cdc12400c900319b814801120063370066e01200448018cdc0a400c9003191919b803370290002400c66e05200448008cdc099b80480092002337029002240006466e20cdc124000900319b804800120023370e66e09200648010cdc0a4008900001",
      mem: 13251n,
      cpu: 7910799n,
      result: { _tag: "Const", value: -1n }
    },
    {
      description:
        "(program 1.0.0 (lam n (delay (lam z (lam f [ f [ [ (force n) z ] f ] ])))))",
      cborHex: "4f4e0100002122300133500300200101",
      mem: 200n,
      cpu: 23100n,
      result: {
        _tag: "Lambda",
        body: {
          _tag: "Delay",
          arg: {
            _tag: "Lambda",
            body: {
              _tag: "Lambda",
              body: {
                _tag: "Apply",
                fn: { _tag: "Var", index: 1 },
                arg: {
                  _tag: "Apply",
                  fn: {
                    _tag: "Apply",
                    fn: { _tag: "Force", arg: { _tag: "Var", index: 3 } },
                    arg: { _tag: "Var", index: 2 }
                  },
                  arg: { _tag: "Var", index: 1 }
                }
              }
            }
          }
        },
        stack: { callSites: [], values: [] }
      } satisfies Cek.Value
    },
    {
      description: "(program 1.0.0 (delay (lam z (lam f z))))",
      cborHex: "484701000012200201",
      mem: 200n,
      cpu: 23100n,
      result: {
        _tag: "Delayed",
        term: {
          _tag: "Lambda",
          body: {
            _tag: "Lambda",
            body: { _tag: "Var", index: 2 }
          }
        },
        stack: { callSites: [], values: [] }
      } satisfies Cek.Value
    },
    {
      description:
        "(program 1.0.0 [[(force [(force (force (force (force (delay (delay (delay (delay (lam f_7 [[(force (delay (lam by_1 [(force (force (delay (delay (lam f_2 [(force (delay (lam s_1 [s_1 s_1]))) (lam s_3 (lam x_4 [[f_2 [(force (delay (lam s_1 [s_1 s_1]))) s_3]] x_4]))]))))) (lam rec_8 (lam h_11 (delay (lam fr_14 [(force [by_1 (delay (lam fq_16 [(force [rec_8 h_11]) [(force h_11) fq_16]]))]) fr_14]))))]))) (lam k_9 (delay (lam h_12 [[h_12 (lam x_15 [(force k_9) (lam f_0_13 (lam f_1_14 [f_0_13 x_15]))])] (lam x_18 [(force k_9) (lam f_0_16 (lam f_1_17 [f_1_17 x_18]))])])))] f_7]))))))))) (delay (lam choose_5 (lam even_0 (lam odd_1 [[choose_5 (lam n_2 [[(force n_2) (con bool True)] odd_1])] (lam n_3 [[(force n_3) (con bool False)] even_0])]))))]) (lam arg_0_0 (lam arg_1_1 arg_0_0))] [(lam n_0 (delay (lam z_2 (lam f_3 [ f_3 n_0 ])))) [(lam n_0 (delay (lam z_2 (lam f_3 [ f_3 n_0 ])))) (delay (lam z_1 (lam f_2 z_1)))]]])",
      cborHex:
        "586a586801000033535555111123351235511235123001001223300335123001001002001221235300412353004003350030010012123300123500322300200323500322300100300112223300323350014a2004466a00294000c88008c8488c00400cc8488c00400c488009",
      mem: 27300n,
      cpu: 6256100n,
      result: { _tag: "Const", value: true }
    },
    {
      description:
        "(program 1.0.0 [[(force [(force (force (force (force (delay (delay (delay (delay (lam f_7 [[(force (delay (lam by_1 [(force (force (delay (delay (lam f_2 [(force (delay (lam s_1 [s_1 s_1]))) (lam s_3 (lam x_4 [[f_2 [(force (delay (lam s_1 [s_1 s_1]))) s_3]] x_4]))]))))) (lam rec_8 (lam h_11 (delay (lam fr_14 [(force [by_1 (delay (lam fq_16 [(force [rec_8 h_11]) [(force h_11) fq_16]]))]) fr_14]))))]))) (lam k_9 (delay (lam h_12 [[h_12 (lam x_15 [(force k_9) (lam f_0_13 (lam f_1_14 [f_0_13 x_15]))])] (lam x_18 [(force k_9) (lam f_0_16 (lam f_1_17 [f_1_17 x_18]))])])))] f_7]))))))))) (delay (lam choose_5 (lam even_0 (lam odd_1 [[choose_5 (lam n_2 [[(force n_2) (con bool True)] odd_1])] (lam n_3 [[(force n_3) (con bool False)] even_0])]))))]) (lam arg_0_0 (lam arg_1_1 arg_0_0))] [(lam n_0 (delay (lam z_2 (lam f_3 [ f_3 n_0 ])))) [(lam n_0 (delay (lam z_2 (lam f_3 [ f_3 n_0 ])))) [(lam n_0 (delay (lam z_2 (lam f_3 [ f_3 n_0 ])))) (delay (lam z_1 (lam f_2 z_1)))]]]])",
      cborHex:
        "5870586e01000033535555111123351235511235123001001223300335123001001002001221235300412353004003350030010012123300123500322300200323500322300100300112223300323350014a2004466a00294000c88008c8488c00400cc8488c00400cc8488c00400c488009",
      mem: 34200n,
      cpu: 7843100n,
      result: { _tag: "Const", value: false }
    },
    {
      description:
        "(program 1.0.0 [[[(force (force (delay (delay (lam f_2 [(force (force (delay (delay (lam f_2 [(force (delay (lam s_1 [s_1 s_1]))) (lam s_3 (lam x_4 [[f_2 [(force (delay (lam s_1 [s_1 s_1]))) s_3]] x_4]))]))))) (lam rec_3 (lam z_4 (lam xs_5 [[(force xs_5) z_4] (lam x_6 (lam xsdash_7 [[rec_3 [[f_2 z_4] x_6]] xsdash_7]))])))]))))) (lam acc_0 (lam n_1 [[(builtin addInteger) acc_0] [[[(force (delay (lam f_1 [(force (force (delay (delay (lam f_2 [(force (delay (lam s_1 [s_1 s_1]))) (lam s_3 (lam x_4 [[f_2 [(force (delay (lam s_1 [s_1 s_1]))) s_3]] x_4]))]))))) (lam rec_2 (lam z_3 (lam n_4 [[(force n_4) z_3] (lam ndash_5 [[rec_2 [f_1 z_3]] ndash_5])])))]))) [(builtin addInteger) (con integer 1)]] (con integer 0)] n_1]]))] (con integer 0)] [[(force [(force (force (force (force (delay (delay (delay (delay (lam f_7 [[(force (delay (lam by_1 [(force (force (delay (delay (lam f_2 [(force (delay (lam s_1 [s_1 s_1]))) (lam s_3 (lam x_4 [[f_2 [(force (delay (lam s_1 [s_1 s_1]))) s_3]] x_4]))]))))) (lam rec_8 (lam h_11 (delay (lam fr_14 [(force [by_1 (delay (lam fq_16 [(force [rec_8 h_11]) [(force h_11) fq_16]]))]) fr_14]))))]))) (lam k_9 (delay (lam h_12 [[h_12 (lam x_15 [(force k_9) (lam f_0_13 (lam f_1_14 [f_0_13 x_15]))])] (lam x_18 [(force k_9) (lam f_0_16 (lam f_1_17 [f_1_17 x_18]))])])))] f_7]))))))))) (delay (lam choose_9 (lam even_0 (lam odd_1 [[choose_9 (lam l_4 [[(force l_4) (force (delay (delay (lam z_2 (lam f_3 z_2)))))] (lam head_2 (lam tail_3 [[(force (delay (lam x_1 (lam xs_2 (delay (lam z_4 (lam f_5 [[f_5 x_1] xs_2]))))))) head_2] [odd_1 tail_3]]))])] (lam l_7 [[(force l_7) (force (delay (delay (lam z_2 (lam f_3 z_2)))))] (lam head_5 (lam tail_6 [even_0 tail_6]))])]))))]) (lam arg_0_0 (lam arg_1_1 arg_0_0))] [[(force (delay (lam x_1 (lam xs_2 (delay (lam z_4 (lam f_5 [[f_5 x_1] xs_2]))))))) [(lam n_0 (delay (lam z_2 (lam f_3 [f_3 n_0])))) (delay (lam z_1 (lam f_2 z_1)))]] [[(force (delay (lam x_1 (lam xs_2 (delay (lam z_4 (lam f_5 [[f_5 x_1] xs_2]))))))) [(lam n_0 (delay (lam z_2 (lam f_3 [f_3 n_0])))) [(lam n_0 (delay (lam z_2 (lam f_3 [f_3 n_0])))) (delay (lam z_1 (lam f_2 z_1)))]]] [[(force (delay (lam x_1 (lam xs_2 (delay (lam z_4 (lam f_5 [[f_5 x_1] xs_2]))))))) [(lam n_0 (delay (lam z_2 (lam f_3 [f_3 n_0])))) [(lam n_0 (delay (lam z_2 (lam f_3 [f_3 n_0])))) [(lam n_0 (delay (lam z_2 (lam f_3 [f_3 n_0])))) (delay (lam z_1 (lam f_2 z_1)))]]]] (force (delay (delay (lam z_2 (lam f_3 z_2)))))]]]]])",
      cborHex:
        "59012059011d01000033355112355112351230010012233003351230010010020012223350010022233005330060040020012233700004666a246aa2246a24600200244660066a24600200200400244466a002004466008600a0060026e01200248000005200033535555111123351235511235123001001223300335123001001002001221235300412353004003350030010012123300123500322300200323500322300100300112223300323350015112200222335122122330010040030023004001233500151122002223005001220023351221223300100400332122300100312200233512212233001004003321223001003321223001003122002335122122330010040033212230010033212230010033212230010031220025112200201",
      mem: 78912n,
      cpu: 19362962n,
      result: { _tag: "Const", value: 4n }
    },
    {
      description:
        "(program 1.0.0 [(lam i [[[(force (force (delay (delay (lam f [(force (force (delay (delay (lam f [(force (delay (lam s [s s]))) (lam s (lam x [[f [(force (delay (lam s [s s]))) s]] x]))]))))) (lam rec (lam z (lam xs [[(force xs) z] (lam x (lam xsdash [[rec [[f z] x]] xsdash]))])))]))))) (builtin multiplyInteger)] (con integer 1)] [[(lam n (lam m [[(force (force (delay (delay (lam f [(force (delay (lam s [s s]))) (lam s (lam x [[f [(force (delay (lam s [s s]))) s]] x]))]))))) (lam rec (lam ndash [[[(force (delay (lam b (lam x (lam y [[[[(force (builtin ifThenElse)) b] x] y] (con unit ())]))))) [[(builtin lessThanEqualsInteger) ndash] m]] (lam u [[(force (delay (lam x (lam xs (delay (lam z (lam f [[f x] xs]))))))) ndash] [rec [(lam i [[(builtin addInteger) i] (con integer 1)]) ndash]]])] (lam u (force (delay (delay (lam z (lam f z))))))]))] n])) (con integer 1)] i]]) (con integer 4)])",
      cborHex:
        "5881587f0100003233355112355112351230010012233003351230010010020012223350010022233005330060040020017049001199119aa8891a89180080091198019a89180080080100091199a89111999ab9a003002001498cdc4800801919a8910911980080200180118019919b80001480080089444880080092002001480201",
      mem: 50026n,
      cpu: 14104357n,
      result: { _tag: "Const", value: 24n }
    },
    {
      description:
        "(program 1.0.0 [(lam i0 [[(force (force (delay (delay (lam f [(force (delay (lam s [s s]))) (lam s (lam x [[f [(force (delay (lam s [s s]))) s]] x]))]))))) (lam rec (lam i [[[(force (delay (lam b (lam x (lam y [[[[(force (builtin ifThenElse)) b] x] y] (con unit ())]))))) [[(builtin lessThanEqualsInteger) i] (con integer 1)]] (lam u i)] (lam u [[(builtin addInteger) [rec [[(builtin subtractInteger) i] (con integer 1)]]] [rec [[(builtin subtractInteger) i] (con integer 2)]]])]))] i0]) (con integer 0)])",
      cborHex:
        "58495847010000323355112351230010012233003351230010010020012233351222333357340060040029319b890014800880088cdc0180199b8100248008c00ccdc08012400800290001",
      mem: 6202n,
      cpu: 1689053n,
      result: { _tag: "Const", value: 0n }
    },
    {
      description: "(program 1.0.0 (lam x (force x)))",
      cborHex: "4746010000250011",
      mem: 200n,
      cpu: 23100n,
      result: {
        _tag: "Lambda",
        body: { _tag: "Force", arg: { _tag: "Var", index: 1 } },
        stack: { callSites: [], values: [] }
      }
    },
    {
      description:
        "(program 1.0.0 [[[(force (delay (lam b (lam x (lam y [[[[(force (builtin ifThenElse)) b] x] y] (con unit ())]))))) [(lam x0 [[(builtin equalsByteString) [(builtin sha2_256) [(builtin sha3_256) (con bytestring #64)]]] x0]) [[(builtin appendByteString) [(lam x1 [(builtin sha3_256) (con bytestring #78)]) [(builtin sha3_256) (con bytestring #726e)]]] (con bytestring #6973)]]] [(force (force (delay (delay (lam x (lam y x)))))) [(lam x0 [(lam x2 x0) [(builtin sha2_256) [(builtin sha3_256) (con bytestring #)]]]) [[(builtin subtractInteger) [[(builtin addInteger) [[(builtin subtractInteger) (con integer 2)] (con integer 2)]] [[(builtin subtractInteger) (con integer 1)] (con integer 3)]]] [(lam x1 [[(builtin subtractInteger) (con integer 3)] (con integer 3)]) [[(builtin equalsByteString) (con bytestring #6c7a)] (con bytestring #6673)]]]]]] [(force (force (delay (delay (lam x (lam y x)))))) (con integer 0)]])",
      cborHex:
        "587958770100003335122233335734006004002931919b8f37246e4d220101640000133714646e4d22010178003726910102726e004881026973003551122002323200237246e4d221003370266e00cdc0a4008900219b81480092006323370290032400c66e3d2201026c7a004881026673003551122002480001",
      mem: 9642n,
      cpu: 13663363n,
      result: { _tag: "Const", value: 0n }
    },
    {
      description:
        "(program 1.0.0 [[[(force (delay (lam f [(force (force (delay (delay (lam f [(force (delay (lam s [s s]))) (lam s (lam x [[f [(force (delay (lam s [s s]))) s]] x]))]))))) (lam rec (lam z (lam n [[(force n) z] (lam ndash [[rec [f z]] ndash])])))]))) [(builtin addInteger) (con integer 1)]] (con integer 0)] [(lam n (delay (lam z (lam f [f n])))) (delay (lam z (lam f z)))]])",
      cborHex:
        "583a58380100003335123551123512300100122330033512300100100200122233500100223300430050030013700900124000642446002006244005",
      mem: 8802n,
      cpu: 2207577n,
      result: { _tag: "Const", value: 1n }
    },
    {
      description:
        "(program 1.0.0 [[[[[(force (builtin ifThenElse)) [[(builtin lessThanInteger) (con integer 1)] (con integer 3)]] (builtin addInteger)] (builtin subtractInteger)] (con integer 1)] (con integer 3)])",
      cborHex: "575601000033333573466e21200248019c03814800920061",
      mem: 1704n,
      cpu: 864540n,
      result: { _tag: "Const", value: 4n }
    },
    {
      description:
        "(program 1.0.0 [[[(force (force (delay (delay (lam f [(force (force (delay (delay (lam f [(force (delay (lam s [s s]))) (lam s (lam x [[f [(force (delay (lam s [s s]))) s]] x]))]))))) (lam rec (lam z (lam xs [[(force xs) z] (lam x (lam xsdash [[rec [[f z] x]] xsdash]))])))]))))) (builtin addInteger)] (con integer 0)] (force (delay (delay (lam z (lam f z)))))])",
      cborHex:
        "5836583401000033355112355112351230010012233003351230010010020012223350010022233005330060040020017009000288910011",
      mem: 5400n,
      cpu: 1219100n,
      result: { _tag: "Const", value: 0n }
    },
    {
      description:
        "(program 1.0.0 (lam i [ [ (builtin addInteger) i ] (con integer 1) ]))",
      cborHex: "4b4a01000023370000290011",
      mem: 200n,
      cpu: 23100n,
      result: {
        _tag: "Lambda",
        body: {
          _tag: "Apply",
          fn: {
            _tag: "Apply",
            fn: { _tag: "Builtin", id: 0 },
            arg: { _tag: "Var", index: 1 }
          },
          arg: {
            _tag: "Const",
            value: 1n
          }
        },
        stack: { callSites: [], values: [] }
      } satisfies Cek.Value
    }
  ]

  conformanceTests.forEach(
    ({ description, mem, cpu, result: expectedResult, cborHex, era }) => {
      it(`ok for ${description}`, () => {
        const script: Script.Script = Either.getOrThrow(
          Script.decode(1)(cborHex)
        )

        const result = runSync(
          Script.eval(
            script,
            undefined,
            era == "conway" ? Cost.PARAMS_V1_CONWAY : Cost.PARAMS_V1_BABBAGE
          )
        )
        const resultValue: Cek.Value = Either.getOrThrow(result.value)

        expect(resultValue).toEqual(expectedResult)
        expect(result.cost.mem).toBe(mem)
        expect(result.cost.cpu).toBe(cpu)
      })
    }
  )
})

//describe("Uplc.Script.eval() for V3s", () => {
//  it("can evaluate a UPLCv3 script", () => {
//    const script: Script.Script<3> = {
//      root: Bytes.toUint8Array("0101003229800aba2aba1aba0aab9faab9eaab9dab9a4888888966003300130033754011370e90004dd2a400123007300830080019b874800a4600e60100029111114c004c03401a601800d2225980080145300103d87a80008acc004c0200062600e6601c601e00497ae08cc00400e6020005337000029000a0064028806a444600a6466446600400400244b3001001801c4c8cc896600266e4401c00a2b30013371e00e00510018032020899802802980b0022020375c601e0026eb4c040004c048005010191919800800803112cc00400600713233225980099b910090028acc004cdc78048014400600c808a26600a00a602e0088088dd718080009bab301100130130014044297adef6c6014800244b30013007300a3754005132323322598009809801c0162c8080c966002601c00315980099b8948010c0340062d13007300d001403116403c6ea8c040004dd69808001180800098059baa0028b2012488888cc88ca60024446466446600400400244b30010018a508acc004cdd7801980b180d000c528c4cc008008c06c005015203037566030603260326032603260326032602a6ea8010c966002602260286ea8006264b300198009bab300e30163754003004a4410040291325980099b8748010c058dd5000c4c8c8cc004004008896600200313259800980b980d1baa00189919912cc004c06800626464b300130240028024590211bae3022001301e3754007159800980b800c4c8c96600260480050048b2042375c6044002603c6ea800e2c80e101c0800980d9baa001301e301b3754003164064646600200200844b30010018a6103d87a80008992cc004cdd7a6107466f7261636c6500301d0018980c1980f980e000a5eb82266006006604200480d8c07c00501d44c8cc88cc014014c084010dd7180d000980d800980e800a03637566034602e6ea80062c80a8c040c058dd5000c590141806980a9baa30183015375400316404cb3001300d30133754601860286ea80062660086eb0c05cc050dd50019bad3017301437540031330043758601860286ea800cdd6980b980a1baa0014049301400898081baa00348896600260200031323322598009809800c4c8c966002603a0050048b2034375a6036002602e6ea80162b300130100018992cc004c0700062660166036002007164064602e6ea80162c80a90150acc004c044c050dd5001c56600264660020026eb0c064c058dd5006112cc00400629422b30013375e6034602e6ea8c068004c068c05cdd500ec528c4cc008008c06c00501520308acc004cdd7980c180c980c980c980c980a9baa00b374cb30014a114bd6f7b63044c8c8cc0040052f5bded8c044b300100189980d19bb037520086e9800d2f5bded8c113298009bae30180019bab3019001980e8012444b30013372001000713301e337606ea4020dd3003802c56600266e3c02000e26603c66ec0dd48041ba600700189980f19bb037520066e98008cc01801800501a2034180d800a03232330010014bd6f7b630112cc00400626603266ec13010140004c010101004bd6f7b63044ca60026eb8c05c0066eb4c06000660380049112cc004cdc824410000389980e99bb04c010140004c010101000058acc004cdc7a4410000389980e99bb04c010140004c0101010000189980e99bb037520066ea0008cc0180180050192032180d000a030404d132598009809180a9baa0018992cc004cdd7980d180b9baa301a3017375400266e95200233019375200697ae08cc004dd59807980b9baa001801d220100402d1640546032602c6ea80062c80a0cc014dd61807980a9baa00b375a6030602a6ea800e2c809a2c809a3300100b800cc060c054dd5001a008404c60286ea800cdd7180b980a1baa0068acc004c03400626466446601400a264b3001301430173754003132598009809180c1baa0018cc00403e6eb8c070c064dd5000c01d008459017180d980c1baa301b30183754602060306ea8c06cc060dd5000c5901619198008009bac301b3018375401c44b30010018a6103d87a80008992cc004cdd7980e980d1baa0010058980a9980e000a5eb82266006006603c00480c0c07000501a180c000980c180c800980a1baa0068b20244048225980099b88001480022980103d87a8000899801801000a020301130120053003003229344d95900113001299fd8799f58208c20a9ab7153e53d17a0b820b2d606b27257a1281d9365acc6d0d3cb8725ccc300ffff0001"),
//      version: 3
//    }
//
//    const c
//
//    const origScriptContextData = runSync(Data.decode("d8799fd8799f8080a080a1d8799f581c51d90ef6da996ea05a678151c41cf1224a6328351f98ec8af1296c86ffd8799f00ffa0a080d87a80d87a809fd8799fd8799f0058208c20a9ab7153e53d17a0b820b2d606b27257a1281d9365acc6d0d3cb8725ccc3ffd8799fd87980d87a80d8799fd87a80d8799f581c5936d8857d50575c33e772f4a60d8f8909489cf6f5d6433198209240ffffa140a1401b000000025409611fffffff9fd8799fd87b9fa1466f7261636c65d87a9f581cb8b8b420e136b84b06639fe9140c6d3e1e866c7166da086c06d28c47ffffd87a80d8799fd87a80d87a9f581c51d90ef6da996ea05a678151c41cf1224a6328351f98ec8af1296c86ffffa1581c51d90ef6da996ea05a678151c41cf1224a6328351f98ec8af1296c86a14001ffd8799fd87980d87a80d8799fd87a80d8799f581c5936d8857d50575c33e772f4a60d8f8909489cf6f5d6433198209240ffffa140a1401b0000000254058d5effffa140a1401a0003d3c1a1581c51d90ef6da996ea05a678151c41cf1224a6328351f98ec8af1296c86a14001d8799fd8799fd87980d87a80ffd8799fd87b80d87a80ffff5820d30ca67b19e0d9361172f33070d0ed4c24c85b47013c78d19c573468142a7c3dffd8799f00ffd8799f581c51d90ef6da996ea05a678151c41cf1224a6328351f98ec8af1296c86ffff"))
//    const correctedTxInfoData = runSync(Data.decode("d8799f9fd8799fd8799f58208c20a9ab7153e53d17a0b820b2d606b27257a1281d9365acc6d0d3cb8725ccc300ffd8799fd8799fd8799f581c5936d8857d50575c33e772f4a60d8f8909489cf6f5d6433198209240ffd87a80ffa140a1401b000000025409611fd87980d87a80ffffff809fd8799fd8799fd87a9f581c51d90ef6da996ea05a678151c41cf1224a6328351f98ec8af1296c86ffd87a80ffa1581c51d90ef6da996ea05a678151c41cf1224a6328351f98ec8af1296c86a14001d87b9fa1466f7261636c65d87a9f581cb8b8b420e136b84b06639fe9140c6d3e1e866c7166da086c06d28c47ffffd87a80ffd8799fd8799fd8799f581c5936d8857d50575c33e772f4a60d8f8909489cf6f5d6433198209240ffd87a80ffa140a1401b000000025405adaed87980d87a80ffffa140a1401a0003bb2da1581c51d90ef6da996ea05a678151c41cf1224a6328351f98ec8af1296c86a1400180a0d8799fd8799fd87980d87a80ffd8799fd87b80d87a80ffff80a0a05820c7e464158419d8bac8559cab52ae7dba6e62a0f0a067d42e339e3400ede2a4b6a080d87a80d87a80ff"))
//
//    const ScriptContextV3 = Data.EnumVariant(0, {
//      txInfo: Data.EnumVariant(0, {
//        inputs: Data.Data,
//        refInputs: Data.Data,
//        outputs: Data.Data,
//        fee: Data.Data,
//        minted: Data.Data,
//        dcerts: Data.Data,
//        withdrawals: Data.Data,
//        validityTimeRange: Data.Data,
//        signers: Data.Data,
//        redeemers: Data.Data,
//        datums: Data.Data,
//        txHash: Data.Data
//      }),
//      redeemer: Data.Data,
//      purpose: Data.Data
//    })
//
//    const origScriptContext = Schema.decodeUnknownSync(ScriptContextV3)(origScriptContextData)
//
//    const correctScriptContext = Data.makeConstrData(0, [
//      correctedTxInfoData,
//      origScriptContext.redeemer,
//      origScriptContext.purpose
//    ])
//
//    //console.log(correctedTxInfoData)
//    //console.log(origScriptContext.redeemer)
//
//    const ctx = Schema.decodeUnknownSync(ScriptContextV3)(correctScriptContext)
//
//    const result = runSync(Script.eval(script, [{data: correctScriptContext}], Cost.PARAMS_V3_CONWAY))
//
//    expect(result.value._tag).toBe("Right")
//  })
//})
