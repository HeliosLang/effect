import { Either, Option, Schema } from "effect"
import * as Bytes from "../../Codecs/Bytes.js"
import * as Cbor from "../../Codecs/Cbor.js"
import type { Builtin } from "./Builtins.js"

export const Cost = Schema.Struct({
  cpu: Schema.BigIntFromSelf,
  mem: Schema.BigIntFromSelf
})

export type Cost = Schema.Schema.Type<typeof Cost>

export const decode = (bytes: Bytes.BytesLike): Cbor.DecodeResult<Cost> =>
  Cbor.decodeTuple([Cbor.decodeInt, Cbor.decodeInt])(bytes).pipe(
    Either.map(([mem, cpu]) => ({ cpu, mem }))
  )

export function encode(cost: Cost): number[] {
  return Cbor.encodeTuple([Cbor.encodeInt(cost.mem), Cbor.encodeInt(cost.cpu)])
}

export type Breakdown = {
  [name: string]: Cost & { count: number }
}

const Param = Schema.Number.pipe(Schema.positive(), Schema.int())

/**
 * V1 has 166 cost-params, V2 has 175 cost-params, V3 has 251 cost-params
 */
const Params = Schema.Array(Param).pipe(Schema.minItems(166))

type Params = Schema.Schema.Type<typeof Params>

export interface Model {
  readonly applyTerm: Cost
  readonly builtinTerm: Cost
  readonly caseTerm: Cost
  readonly constTerm: Cost
  readonly constrTerm: Cost
  readonly delayTerm: Cost
  readonly forceTerm: Cost
  readonly lambdaTerm: Cost
  readonly startupCost: Cost
  readonly varTerm: Cost
  readonly builtins: Record<string, (argSizes: number[]) => Cost>
}

function getParamOrThrow(params: Params, index: number): bigint {
  const x = Option.fromNullable(params[index]).pipe(Option.getOrThrow)

  return BigInt(x)
}

export function makeModel(params: Params, builtins: readonly Builtin[]): Model {
  return {
    applyTerm: {
      cpu: getParamOrThrow(params, 17),
      mem: getParamOrThrow(params, 18)
    },
    builtinTerm: {
      cpu: getParamOrThrow(params, 19),
      mem: getParamOrThrow(params, 20)
    },
    constTerm: {
      cpu: getParamOrThrow(params, 21),
      mem: getParamOrThrow(params, 22)
    },
    delayTerm: {
      cpu: getParamOrThrow(params, 23),
      mem: getParamOrThrow(params, 24)
    },
    forceTerm: {
      cpu: getParamOrThrow(params, 25),
      mem: getParamOrThrow(params, 26)
    },
    lambdaTerm: {
      cpu: getParamOrThrow(params, 27),
      mem: getParamOrThrow(params, 28)
    },
    startupCost: {
      cpu: getParamOrThrow(params, 29),
      mem: getParamOrThrow(params, 30)
    },
    varTerm: {
      cpu: getParamOrThrow(params, 31),
      mem: getParamOrThrow(params, 32)
    },
    constrTerm: {
      cpu: BigInt(params[193] ?? 0), // fall back to zero so we can also use this function for v1 and v2
      mem: BigInt(params[194] ?? 0)
    },
    caseTerm: {
      cpu: BigInt(params[195] ?? 0), // fall back to zero so we can also use this function for v1 and v2
      mem: BigInt(params[196] ?? 0)
    },
    builtins: Object.fromEntries(
      builtins.map((b: Builtin) => {
        const cpuModel = b.cpuModel(params)
        const memModel = b.memModel(params)

        const calc = (argSizes: number[]) => ({
          cpu: cpuModel(argSizes),
          mem: memModel(argSizes)
        })

        return [b.name, calc]
      })
    )
  }
}

type Function$ = (params: Params) => (argSizes: number[]) => bigint

export const Max: Function$ = (_params: Params) => {
  return (argSizes: number[]) => {
    return BigInt(argSizes.reduce((m, s) => (s > m ? s : m), 0))
  }
}

export const Min: Function$ = (_params: Params) => {
  return (argSizes: number[]) => {
    return BigInt(
      argSizes.slice(1).reduce((m, a) => (a < m ? a : m), argSizes[0])
    )
  }
}

export const Sum: Function$ = (_params: Params) => {
  return (argSizes: number[]) => {
    return BigInt(argSizes.reduce((s, a) => s + a, 0))
  }
}

export const Prod: Function$ = (_params: Params) => {
  return (argSizes: number[]) => {
    return BigInt(argSizes.reduce((p, a) => p * a, 1))
  }
}

export const Diff = (_params: Params) => {
  return (argSizes: number[]) => {
    if (argSizes.length != 2) {
      throw new Error(
        `ArgsDiff cost model can only be used for two arguments, got ${argSizes.length} arguments`
      )
    }

    const [x, y] = argSizes
    const d = BigInt(x - y)

    return d
  }
}

export const Constant =
  (constantId: number): Function$ =>
  (params: Params) => {
    const c = getParamOrThrow(params, constantId)

    return (_argSizes: number[]) => c
  }

export const ConstantOffDiag =
  (constantId: number) =>
  (makeOnDiag: Function$): Function$ =>
  (params: Params) => {
    const constant = getParamOrThrow(params, constantId)
    const calcOnDiag = makeOnDiag(params)

    return (argSizes: number[]) => {
      if (argSizes.length != 2) {
        throw new Error(
          `ArgSizesDiag cost model can only be used for two arguments, got ${argSizes.length} arguments`
        )
      }

      const [x, y] = argSizes

      if (x != y) {
        return constant
      } else {
        return calcOnDiag(argSizes)
      }
    }
  }

export const ConstantBelowDiag =
  (constantId: number) =>
  (makeOnAboveDiag: Function$): Function$ =>
  (params: Params) => {
    const constant = getParamOrThrow(params, constantId)
    const calcOnAboveDiag = makeOnAboveDiag(params)

    return (argSizes: number[]) => {
      if (argSizes.length != 2) {
        throw new Error(
          `expected only 2 arguments for ConstantBelowDiag cost model function, got ${argSizes.length}`
        )
      }

      const [x, y] = argSizes

      if (x < y) {
        return constant
      } else {
        return calcOnAboveDiag(argSizes)
      }
    }
  }

export const First: Function$ = (_params: Params) => {
  return (argSizes: number[]) => {
    if (argSizes.length < 1) {
      throw new Error(
        `'First' model expected at least one arg, got ${argSizes.length}`
      )
    }

    return BigInt(argSizes[0])
  }
}

export const Second: Function$ = (_params: Params) => {
  return (argSizes: number[]) => {
    if (argSizes.length < 2) {
      throw new Error(
        `'Second' model expected at least two args, got ${argSizes.length}`
      )
    }

    return BigInt(argSizes[1])
  }
}

export const Third: Function$ = (_params: Params) => {
  return (argSizes: number[]) => {
    if (argSizes.length < 3) {
      throw new Error(
        `'Third' model expected at least three args, got ${argSizes.length}`
      )
    }

    return BigInt(argSizes[2])
  }
}

export const AtLeast =
  (minimumId: number) =>
  (makeX: Function$): Function$ =>
  (params: Params) => {
    const minimum = getParamOrThrow(params, minimumId)
    const calcX = makeX(params)

    return (argSizes: number[]) => {
      const x = calcX(argSizes)

      return x < minimum ? minimum : x
    }
  }

export const Linear =
  (interceptId: number, slopeId: number) =>
  (makeX: Function$): Function$ =>
  (params: Params) => {
    const intercept = getParamOrThrow(params, interceptId)
    const slope = getParamOrThrow(params, slopeId)

    const calcX = makeX(params)

    return (argSizes: number[]) => {
      const x = calcX(argSizes)

      return intercept + slope * x
    }
  }

export const QuadXY =
  (coefIds: {
    c00: number
    c10: number
    c01: number
    c20: number
    c11: number
    c02: number
  }): Function$ =>
  (params: Params) => {
    const c00 = getParamOrThrow(params, coefIds.c00)
    const c10 = getParamOrThrow(params, coefIds.c10)
    const c01 = getParamOrThrow(params, coefIds.c01)
    const c20 = getParamOrThrow(params, coefIds.c20)
    const c11 = getParamOrThrow(params, coefIds.c11)
    const c02 = getParamOrThrow(params, coefIds.c02)

    return (argSizes: number[]): bigint => {
      if (argSizes.length != 2) {
        throw new Error(
          `expected only 2 arguments for QuadXY cost model function, got ${argSizes.length}`
        )
      }

      const x = BigInt(argSizes[0])
      const y = BigInt(argSizes[1])

      return c00 + c10 * x + c01 * y + c20 * x * x + c11 * x * y + c02 * y * y
    }
  }

export { type Function$ as Function }

export class Tracker {
  readonly model: Model
  cpu: bigint
  mem: bigint
  readonly breakdown: Breakdown

  /**
   * @param model
   */
  constructor(model: Model) {
    this.model = model
    this.cpu = 0n
    this.mem = 0n
    this.breakdown = {}
  }

  /**
   * @param key
   * @param d
   */
  private incrCost(key: string, d: Cost) {
    this.cpu += d.cpu
    this.mem += d.mem

    if (key in this.breakdown) {
      const entry = this.breakdown[key]

      this.breakdown[key] = {
        count: entry.count + 1,
        mem: entry.mem + d.mem,
        cpu: entry.cpu + d.cpu
      }
    } else {
      this.breakdown[key] = { mem: d.mem, cpu: d.cpu, count: 1 }
    }
  }

  incrApplyCost(): void {
    this.incrCost("applyTerm", this.model.applyTerm)
  }

  incrBuiltinCost(): void {
    this.incrCost("builtinTerm", this.model.builtinTerm)
  }

  incrCaseCost(): void {
    this.incrCost("caseTerm", this.model.caseTerm)
  }

  incrConstCost(): void {
    this.incrCost("constTerm", this.model.constTerm)
  }

  incrConstrCost(): void {
    this.incrCost("constrTerm", this.model.constrTerm)
  }

  incrDelayCost(): void {
    this.incrCost("delayTerm", this.model.delayTerm)
  }

  incrForceCost(): void {
    this.incrCost("forceTerm", this.model.forceTerm)
  }

  incrLambdaCost(): void {
    this.incrCost("lambdaTerm", this.model.lambdaTerm)
  }

  incrStartupCost(): void {
    this.incrCost("startupTerm", this.model.startupCost)
  }

  incrVarCost(): void {
    this.incrCost("varTerm", this.model.varTerm)
  }

  /**
   * @param name
   * @param argSizes
   */
  incrArgSizesCost(name: string, argSizes: number[]) {
    this.incrCost(name, this.model.builtins[name](argSizes))
  }
}

export const PARAMS_V1_BABBAGE: number[] = [
  205665, // 0: addInteger-cpu-arguments-intercept
  812, // 1: addInteger-cpu-arguments-slope
  1, // 2: addInteger-memory-arguments-intercept
  1, // 3: addInteger-memory-arguments-slope
  1000, // 4: appendByteString-cpu-arguments-intercept
  571, // 5: appendByteString-cpu-arguments-slope
  0, // 6: appendByteString-memory-arguments-intercept
  1, // 7: appendByteString-memory-arguments-slope
  1000, // 8: appendString-cpu-arguments-intercept
  24177, // 9: appendString-cpu-arguments-slope
  4, // 10: appendString-memory-arguments-intercept
  1, // 11: appendString-memory-arguments-slope
  1000, // 12: bData-cpu-arguments
  32, // 13: bData-memory-arguments
  117366, // 14: blake2b_256-cpu-arguments-intercept
  10475, // 15: blake2b_256-cpu-arguments-slope
  4, // 16: blake2b_256-memory-arguments
  23000, // 17: cekApplyCost-exBudgetCPU
  100, // 18: cekApplyCost-exBudgetMemory
  23000, // 19: cekBuiltinCost-exBudgetCPU
  100, // 20: cekBuiltinCost-exBudgetMemory
  23000, // 21: cekConstCost-exBudgetCPU
  100, // 22: cekConstCost-exBudgetMemory
  23000, // 23: cekDelayCost-exBudgetCPU
  100, // 24: cekDelayCost-exBudgetMemory
  23000, // 25: cekForceCost-exBudgetCPU
  100, // 26: cekForceCost-exBudgetMemory
  23000, // 27: cekLamCost-exBudgetCPU
  100, // 28: cekLamCost-exBudgetMemory
  100, // 29: cekStartupCost-exBudgetCPU
  100, // 30: cekStartupCost-exBudgetMemory
  23000, // 31: cekVarCost-exBudgetCPU
  100, // 32: cekVarCost-exBudgetMemory
  19537, // 33: chooseData-cpu-arguments
  32, // 34: chooseData-memory-arguments
  175354, // 35: chooseList-cpu-arguments
  32, // 36: chooseList-memory-arguments
  46417, // 37: chooseUnit-cpu-arguments
  4, // 38: chooseUnit-memory-arguments
  221973, // 39: consByteString-cpu-arguments-intercept
  511, // 40: consByteString-cpu-arguments-slope
  0, // 41: consByteString-memory-arguments-intercept
  1, // 42: consByteString-memory-arguments-slope
  89141, // 43: constrData-cpu-arguments
  32, // 44: constrData-memory-arguments
  497525, // 45: decodeUtf8-cpu-arguments-intercept
  14068, // 46: decodeUtf8-cpu-arguments-slope
  4, // 47: decodeUtf8-memory-arguments-intercept
  2, // 48: decodeUtf8-memory-arguments-slope
  196500, // 49: divideInteger-cpu-arguments-constant
  453240, // 50: divideInteger-cpu-arguments-model-arguments-intercept
  220, // 51: divideInteger-cpu-arguments-model-arguments-slope
  0, // 52: divideInteger-memory-arguments-intercept
  1, // 53: divideInteger-memory-arguments-minimum
  1, // 54: divideInteger-memory-arguments-slope
  1000, // 55: encodeUtf8-cpu-arguments-intercept
  28662, // 56: encodeUtf8-cpu-arguments-slope
  4, // 57: encodeUtf8-memory-arguments-intercept
  2, // 58: encodeUtf8-memory-arguments-slope
  245000, // 59: equalsByteString-cpu-arguments-constant
  216773, // 60: equalsByteString-cpu-arguments-intercept
  62, // 61: equalsByteString-cpu-arguments-slope
  1, // 62: equalsByteString-memory-arguments
  1060367, // 63: equalsData-cpu-arguments-intercept
  12586, // 64: equalsData-cpu-arguments-slope
  1, // 65: equalsData-memory-arguments
  208512, // 66: equalsInteger-cpu-arguments-intercept
  421, // 67: equalsInteger-cpu-arguments-slope
  1, // 68: equalsInteger-memory-arguments
  187000, // 69: equalsString-cpu-arguments-constant
  1000, // 70: equalsString-cpu-arguments-intercept
  52998, // 71: equalsString-cpu-arguments-slope
  1, // 72: equalsString-memory-arguments
  80436, // 73: fstPair-cpu-arguments
  32, // 74: fstPair-memory-arguments
  43249, // 75: headList-cpu-arguments
  32, // 76: headList-memory-arguments
  1000, // 77: iData-cpu-arguments
  32, // 78: iData-memory-arguments
  80556, // 79: ifThenElse-cpu-arguments
  1, // 80: ifThenElse-memory-arguments
  57667, // 81: indexByteString-cpu-arguments
  4, // 82: indexByteString-memory-arguments
  1000, // 83: lengthOfByteString-cpu-arguments
  10, // 84: lengthOfByteString-memory-arguments
  197145, // 85: lessThanByteString-cpu-arguments-intercept
  156, // 86: lessThanByteString-cpu-arguments-slope
  1, // 87: lessThanByteString-memory-arguments
  197145, // 88: lessThanEqualsByteString-cpu-arguments-intercept
  156, // 89: lessThanEqualsByteString-cpu-arguments-slope
  1, // 90: lessThanEqualsByteString-memory-arguments
  204924, // 91: lessThanEqualsInteger-cpu-arguments-intercept
  473, // 92: lessThanEqualsInteger-cpu-arguments-slope
  1, // 93: lessThanEqualsInteger-memory-arguments
  208896, // 94: lessThanInteger-cpu-arguments-intercept
  511, // 95: lessThanInteger-cpu-arguments-slope
  1, // 96: lessThanInteger-memory-arguments
  52467, // 97: listData-cpu-arguments
  32, // 98: listData-memory-arguments
  64832, // 99: mapData-cpu-arguments
  32, // 100: mapData-memory-arguments
  65493, // 101: mkCons-cpu-arguments
  32, // 102: mkCons-memory-arguments
  22558, // 103: mkNilData-cpu-arguments
  32, // 104: mkNilData-memory-arguments
  16563, // 105: mkNilPairData-cpu-arguments
  32, // 106: mkNilPairData-memory-arguments
  76511, // 107: mkPairData-cpu-arguments
  32, // 108: mkPairData-memory-arguments
  196500, // 109: modInteger-cpu-arguments-constant
  453240, // 110: modInteger-cpu-arguments-model-arguments-intercept
  220, // 111: modInteger-cpu-arguments-model-arguments-slope
  0, // 112: modInteger-memory-arguments-intercept
  1, // 113: modInteger-memory-arguments-minimum
  1, // 114: modInteger-memory-arguments-slope
  69522, // 115: multiplyInteger-cpu-arguments-intercept
  11687, // 116: multiplyInteger-cpu-arguments-slope
  0, // 117: multiplyInteger-memory-arguments-intercept
  1, // 118: multiplyInteger-memory-arguments-slope
  60091, // 119: nullList-cpu-arguments
  32, // 120: nullList-memory-arguments
  196500, // 121: quotientInteger-cpu-arguments-constant
  453240, // 122: quotientInteger-cpu-arguments-model-arguments-intercept
  220, // 123: quotientInteger-cpu-arguments-model-arguments-slope
  0, // 124: quotientInteger-memory-arguments-intercept
  1, // 125: quotientInteger-memory-arguments-minimum
  1, // 126: quotientInteger-memory-arguments-slope
  196500, // 127: remainderInteger-cpu-arguments-constant
  453240, // 128: remainderInteger-cpu-arguments-model-arguments-intercept
  220, // 129: remainderInteger-cpu-arguments-model-arguments-slope
  0, // 130: remainderInteger-memory-arguments-intercept
  1, // 131: remainderInteger-memory-arguments-minimum
  1, // 132: remainderInteger-memory-arguments-slope
  806990, // 133: sha2_256-cpu-arguments-intercept
  30482, // 134: sha2_256-cpu-arguments-slope
  4, // 135: sha2_256-memory-arguments
  1927926, // 136: sha3_256-cpu-arguments-intercept
  82523, // 137: sha3_256-cpu-arguments-slope
  4, // 138: sha3_256-memory-arguments
  265318, // 139: sliceByteString-cpu-arguments-intercept
  0, // 140: sliceByteString-cpu-arguments-slope
  4, // 141: sliceByteString-memory-arguments-intercept
  0, // 142: sliceByteString-memory-arguments-slope
  85931, // 143: sndPair-cpu-arguments
  32, // 144: sndPair-memory-arguments
  205665, // 145: subtractInteger-cpu-arguments-intercept
  812, // 146: subtractInteger-cpu-arguments-slope
  1, // 147: subtractInteger-memory-arguments-intercept
  1, // 148: subtractInteger-memory-arguments-slope
  41182, // 149: tailList-cpu-arguments
  32, // 150: tailList-memory-arguments
  212342, // 151: trace-cpu-arguments
  32, // 152: trace-memory-arguments
  31220, // 153: unBData-cpu-arguments
  32, // 154: unBData-memory-arguments
  32696, // 155: unConstrData-cpu-arguments
  32, // 156: unConstrData-memory-arguments
  43357, // 157: unIData-cpu-arguments
  32, // 158: unIData-memory-arguments
  32247, // 159: unListData-cpu-arguments
  32, // 160: unListData-memory-arguments
  38314, // 161: unMapData-cpu-arguments
  32, // 162: unMapData-memory-arguments
  9462713, // 163: verifyEd25519Signature-cpu-arguments-intercept
  1021, // 164: verifyEd25519Signature-cpu-arguments-slope
  10 // 165: verifyEd25519Signature-memory-arguments
]

export const PARAMS_V1_CONWAY: number[] = [
  100788, // 0: addInteger-cpu-arguments-intercept
  420, // 1: addInteger-cpu-arguments-slope
  1, // 2: addInteger-memory-arguments-intercept
  1, // 3: addInteger-memory-arguments-slope
  1000, // 4: appendByteString-cpu-arguments-intercept
  173, // 5: appendByteString-cpu-arguments-slope
  0, // 6: appendByteString-memory-arguments-intercept
  1, // 7: appendByteString-memory-arguments-slope
  1000, // 8: appendString-cpu-arguments-intercept
  59957, // 9: appendString-cpu-arguments-slope
  4, // 10: appendString-memory-arguments-intercept
  1, // 11: appendString-memory-arguments-slope
  11183, // 12: bData-cpu-arguments
  32, // 13: bData-memory-arguments
  201305, // 14: blake2b_256-cpu-arguments-intercept
  8356, // 15: blake2b_256-cpu-arguments-slope
  4, // 16: blake2b_256-memory-arguments
  16000, // 17: cekApplyCost-exBudgetCPU
  100, // 18: cekApplyCost-exBudgetMemory
  16000, // 19: cekBuiltinCost-exBudgetCPU
  100, // 20: cekBuiltinCost-exBudgetMemory
  16000, // 21: cekConstCost-exBudgetCPU
  100, // 22: cekConstCost-exBudgetMemory
  16000, // 23: cekDelayCost-exBudgetCPU
  100, // 24: cekDelayCost-exBudgetMemory
  16000, // 25: cekForceCost-exBudgetCPU
  100, // 26: cekForceCost-exBudgetMemory
  16000, // 27: cekLamCost-exBudgetCPU
  100, // 28: cekLamCost-exBudgetMemory
  100, // 29: cekStartupCost-exBudgetCPU
  100, // 30: cekStartupCost-exBudgetMemory
  16000, // 31: cekVarCost-exBudgetCPU
  100, // 32: cekVarCost-exBudgetMemory
  94375, // 33: chooseData-cpu-arguments
  32, // 34: chooseData-memory-arguments
  132994, // 35: chooseList-cpu-arguments
  32, // 36: chooseList-memory-arguments
  61462, // 37: chooseUnit-cpu-arguments
  4, // 38: chooseUnit-memory-arguments
  72010, // 39: consByteString-cpu-arguments-intercept
  178, // 40: consByteString-cpu-arguments-slope
  0, // 41: consByteString-memory-arguments-intercept
  1, // 42: consByteString-memory-arguments-slope
  22151, // 43: constrData-cpu-arguments
  32, // 44: constrData-memory-arguments
  91189, // 45: decodeUtf8-cpu-arguments-intercept
  769, // 46: decodeUtf8-cpu-arguments-slope
  4, // 47: decodeUtf8-memory-arguments-intercept
  2, // 48: decodeUtf8-memory-arguments-slope
  85848, // 49: divideInteger-cpu-arguments-constant
  228465, // 50: divideInteger-cpu-arguments-model-arguments-intercept
  122, // 51: divideInteger-cpu-arguments-model-arguments-slope
  0, // 52: divideInteger-memory-arguments-intercept
  1, // 53: divideInteger-memory-arguments-minimum
  1, // 54: divideInteger-memory-arguments-slope
  1000, // 55: encodeUtf8-cpu-arguments-intercept
  42921, // 56: encodeUtf8-cpu-arguments-slope
  4, // 57: encodeUtf8-memory-arguments-intercept
  2, // 58: encodeUtf8-memory-arguments-slope
  24548, // 59: equalsByteString-cpu-arguments-constant
  29498, // 60: equalsByteString-cpu-arguments-intercept
  38, // 61: equalsByteString-cpu-arguments-slope
  1, // 62: equalsByteString-memory-arguments
  898148, // 63: equalsData-cpu-arguments-intercept
  27279, // 64: equalsData-cpu-arguments-slope
  1, // 65: equalsData-memory-arguments
  51775, // 66: equalsInteger-cpu-arguments-intercept
  558, // 67: equalsInteger-cpu-arguments-slope
  1, // 68: equalsInteger-memory-arguments
  39184, // 69: equalsString-cpu-arguments-constant
  1000, // 70: equalsString-cpu-arguments-intercept
  60594, // 71: equalsString-cpu-arguments-slope
  1, // 72: equalsString-memory-arguments
  141895, // 73: fstPair-cpu-arguments
  32, // 74: fstPair-memory-arguments
  83150, // 75: headList-cpu-arguments
  32, // 76: headList-memory-arguments
  15299, // 77: iData-cpu-arguments
  32, // 78: iData-memory-arguments
  76049, // 79: ifThenElse-cpu-arguments
  1, // 80: ifThenElse-memory-arguments
  13169, // 81: indexByteString-cpu-arguments
  4, // 82: indexByteString-memory-arguments
  22100, // 83: lengthOfByteString-cpu-arguments
  10, // 84: lengthOfByteString-memory-arguments
  28999, // 85: lessThanByteString-cpu-arguments-intercept
  74, // 86: lessThanByteString-cpu-arguments-slope
  1, // 87: lessThanByteString-memory-arguments
  28999, // 88: lessThanEqualsByteString-cpu-arguments-intercept
  74, // 89: lessThanEqualsByteString-cpu-arguments-slope
  1, // 90: lessThanEqualsByteString-memory-arguments
  43285, // 91: lessThanEqualsInteger-cpu-arguments-intercept
  552, // 92: lessThanEqualsInteger-cpu-arguments-slope
  1, // 93: lessThanEqualsInteger-memory-arguments
  44749, // 94: lessThanInteger-cpu-arguments-intercept
  541, // 95: lessThanInteger-cpu-arguments-slope
  1, // 96: lessThanInteger-memory-arguments
  33852, // 97: listData-cpu-arguments
  32, // 98: listData-memory-arguments
  68246, // 99: mapData-cpu-arguments
  32, // 100: mapData-memory-arguments
  72362, // 101: mkCons-cpu-arguments
  32, // 102: mkCons-memory-arguments
  7243, // 103: mkNilData-cpu-arguments
  32, // 104: mkNilData-memory-arguments
  7391, // 105: mkNilPairData-cpu-arguments
  32, // 106: mkNilPairData-memory-arguments
  11546, // 107: mkPairData-cpu-arguments
  32, // 108: mkPairData-memory-arguments
  85848, // 109: modInteger-cpu-arguments-constant
  228465, // 110: modInteger-cpu-arguments-model-arguments-intercept
  122, // 111: modInteger-cpu-arguments-model-arguments-slope
  0, // 112: modInteger-memory-arguments-intercept
  1, // 113: modInteger-memory-arguments-minimum
  1, // 114: modInteger-memory-arguments-slope
  90434, // 115: multiplyInteger-cpu-arguments-intercept
  519, // 116: multiplyInteger-cpu-arguments-slope
  0, // 117: multiplyInteger-memory-arguments-intercept
  1, // 118: multiplyInteger-memory-arguments-slope
  74433, // 119: nullList-cpu-arguments
  32, // 120: nullList-memory-arguments
  85848, // 121: quotientInteger-cpu-arguments-constant
  228465, // 122: quotientInteger-cpu-arguments-model-arguments-intercept
  122, // 123: quotientInteger-cpu-arguments-model-arguments-slope
  0, // 124: quotientInteger-memory-arguments-intercept
  1, // 125: quotientInteger-memory-arguments-minimum
  1, // 126: quotientInteger-memory-arguments-slope
  85848, // 127: remainderInteger-cpu-arguments-constant
  228465, // 128: remainderInteger-cpu-arguments-model-arguments-intercept
  122, // 129: remainderInteger-cpu-arguments-model-arguments-slope
  0, // 130: remainderInteger-memory-arguments-intercept
  1, // 131: remainderInteger-memory-arguments-minimum
  1, // 132: remainderInteger-memory-arguments-slope
  270652, // 133: sha2_256-cpu-arguments-intercept
  22588, // 134: sha2_256-cpu-arguments-slope
  4, // 135: sha2_256-memory-arguments
  1457325, // 136: sha3_256-cpu-arguments-intercept
  64566, // 137: sha3_256-cpu-arguments-slope
  4, // 138: sha3_256-memory-arguments
  20467, // 139: sliceByteString-cpu-arguments-intercept
  1, // 140: sliceByteString-cpu-arguments-slope
  4, // 141: sliceByteString-memory-arguments-intercept
  0, // 142: sliceByteString-memory-arguments-slope
  141992, // 143: sndPair-cpu-arguments
  32, // 144: sndPair-memory-arguments
  100788, // 145: subtractInteger-cpu-arguments-intercept
  420, // 146: subtractInteger-cpu-arguments-slope
  1, // 147: subtractInteger-memory-arguments-intercept
  1, // 148: subtractInteger-memory-arguments-slope
  81663, // 149: tailList-cpu-arguments
  32, // 150: tailList-memory-arguments
  59498, // 151: trace-cpu-arguments
  32, // 152: trace-memory-arguments
  20142, // 153: unBData-cpu-arguments
  32, // 154: unBData-memory-arguments
  24588, // 155: unConstrData-cpu-arguments
  32, // 156: unConstrData-memory-arguments
  20744, // 157: unIData-cpu-arguments
  32, // 158: unIData-memory-arguments
  25933, // 159: unListData-cpu-arguments
  32, // 160: unListData-memory-arguments
  24623, // 161: unMapData-cpu-arguments
  32, // 162: unMapData-memory-arguments
  53384111, // 163: verifyEd25519Signature-cpu-arguments-intercept
  14333, // 164: verifyEd25519Signature-cpu-arguments-slope
  10 // 165: verifyEd25519Signature-memory-arguments
]

export const PARAMS_V2_BABBAGE: number[] = [
  205665, // 0: addInteger-cpu-arguments-intercept
  812, // 1: addInteger-cpu-arguments-slope
  1, // 2: addInteger-memory-arguments-intercept
  1, // 3: addInteger-memory-arguments-slope
  1000, // 4: appendByteString-cpu-arguments-intercept
  571, // 5: appendByteString-cpu-arguments-slope
  0, // 6: appendByteString-memory-arguments-intercept
  1, // 7: appendByteString-memory-arguments-slope
  1000, // 8: appendString-cpu-arguments-intercept
  24177, // 9: appendString-cpu-arguments-slope
  4, // 10: appendString-memory-arguments-intercept
  1, // 11: appendString-memory-arguments-slope
  1000, // 12: bData-cpu-arguments
  32, // 13: bData-memory-arguments
  117366, // 14: blake2b_256-cpu-arguments-intercept
  10475, // 15: blake2b_256-cpu-arguments-slope
  4, // 16: blake2b_256-memory-arguments
  23000, // 17: cekApplyCost-exBudgetCPU
  100, // 18: cekApplyCost-exBudgetMemory
  23000, // 19: cekBuiltinCost-exBudgetCPU
  100, // 20: cekBuiltinCost-exBudgetMemory
  23000, // 21: cekConstCost-exBudgetCPU
  100, // 22: cekConstCost-exBudgetMemory
  23000, // 23: cekDelayCost-exBudgetCPU
  100, // 24: cekDelayCost-exBudgetMemory
  23000, // 25: cekForceCost-exBudgetCPU
  100, // 26: cekForceCost-exBudgetMemory
  23000, // 27: cekLamCost-exBudgetCPU
  100, // 28: cekLamCost-exBudgetMemory
  100, // 29: cekStartupCost-exBudgetCPU
  100, // 30: cekStartupCost-exBudgetMemory
  23000, // 31: cekVarCost-exBudgetCPU
  100, // 32: cekVarCost-exBudgetMemory
  19537, // 33: chooseData-cpu-arguments
  32, // 34: chooseData-memory-arguments
  175354, // 35: chooseList-cpu-arguments
  32, // 36: chooseList-memory-arguments
  46417, // 37: chooseUnit-cpu-arguments
  4, // 38: chooseUnit-memory-arguments
  221973, // 39: consByteString-cpu-arguments-intercept
  511, // 40: consByteString-cpu-arguments-slope
  0, // 41: consByteString-memory-arguments-intercept
  1, // 42: consByteString-memory-arguments-slope
  89141, // 43: constrData-cpu-arguments
  32, // 44: constrData-memory-arguments
  497525, // 45: decodeUtf8-cpu-arguments-intercept
  14068, // 46: decodeUtf8-cpu-arguments-slope
  4, // 47: decodeUtf8-memory-arguments-intercept
  2, // 48: decodeUtf8-memory-arguments-slope
  196500, // 49: divideInteger-cpu-arguments-constant
  453240, // 50: divideInteger-cpu-arguments-model-arguments-intercept
  220, // 51: divideInteger-cpu-arguments-model-arguments-slope
  0, // 52: divideInteger-memory-arguments-intercept
  1, // 53: divideInteger-memory-arguments-minimum
  1, // 54: divideInteger-memory-arguments-slope
  1000, // 55: encodeUtf8-cpu-arguments-intercept
  28662, // 56: encodeUtf8-cpu-arguments-slope
  4, // 57: encodeUtf8-memory-arguments-intercept
  2, // 58: encodeUtf8-memory-arguments-slope
  245000, // 59: equalsByteString-cpu-arguments-constant
  216773, // 60: equalsByteString-cpu-arguments-intercept
  62, // 61: equalsByteString-cpu-arguments-slope
  1, // 62: equalsByteString-memory-arguments
  1060367, // 63: equalsData-cpu-arguments-intercept
  12586, // 64: equalsData-cpu-arguments-slope
  1, // 65: equalsData-memory-arguments
  208512, // 66: equalsInteger-cpu-arguments-intercept
  421, // 67: equalsInteger-cpu-arguments-slope
  1, // 68: equalsInteger-memory-arguments
  187000, // 69: equalsString-cpu-arguments-constant
  1000, // 70: equalsString-cpu-arguments-intercept
  52998, // 71: equalsString-cpu-arguments-slope
  1, // 72: equalsString-memory-arguments
  80436, // 73: fstPair-cpu-arguments
  32, // 74: fstPair-memory-arguments
  43249, // 75: headList-cpu-arguments
  32, // 76: headList-memory-arguments
  1000, // 77: iData-cpu-arguments
  32, // 78: iData-memory-arguments
  80556, // 79: ifThenElse-cpu-arguments
  1, // 80: ifThenElse-memory-arguments
  57667, // 81: indexByteString-cpu-arguments
  4, // 82: indexByteString-memory-arguments
  1000, // 83: lengthOfByteString-cpu-arguments
  10, // 84: lengthOfByteString-memory-arguments
  197145, // 85: lessThanByteString-cpu-arguments-intercept
  156, // 86: lessThanByteString-cpu-arguments-slope
  1, // 87: lessThanByteString-memory-arguments
  197145, // 88: lessThanEqualsByteString-cpu-arguments-intercept
  156, // 89: lessThanEqualsByteString-cpu-arguments-slope
  1, // 90: lessThanEqualsByteString-memory-arguments
  204924, // 91: lessThanEqualsInteger-cpu-arguments-intercept
  473, // 92: lessThanEqualsInteger-cpu-arguments-slope
  1, // 93: lessThanEqualsInteger-memory-arguments
  208896, // 94: lessThanInteger-cpu-arguments-intercept
  511, // 95: lessThanInteger-cpu-arguments-slope
  1, // 96: lessThanInteger-memory-arguments
  52467, // 97: listData-cpu-arguments
  32, // 98: listData-memory-arguments
  64832, // 99: mapData-cpu-arguments
  32, // 100: mapData-memory-arguments
  65493, // 101: mkCons-cpu-arguments
  32, // 102: mkCons-memory-arguments
  22558, // 103: mkNilData-cpu-arguments
  32, // 104: mkNilData-memory-arguments
  16563, // 105: mkNilPairData-cpu-arguments
  32, // 106: mkNilPairData-memory-arguments
  76511, // 107: mkPairData-cpu-arguments
  32, // 108: mkPairData-memory-arguments
  196500, // 109: modInteger-cpu-arguments-constant
  453240, // 110: modInteger-cpu-arguments-model-arguments-intercept
  220, // 111: modInteger-cpu-arguments-model-arguments-slope
  0, // 112: modInteger-memory-arguments-intercept
  1, // 113: modInteger-memory-arguments-minimum
  1, // 114: modInteger-memory-arguments-slope
  69522, // 115: multiplyInteger-cpu-arguments-intercept
  11687, // 116: multiplyInteger-cpu-arguments-slope
  0, // 117: multiplyInteger-memory-arguments-intercept
  1, // 118: multiplyInteger-memory-arguments-slope
  60091, // 119: nullList-cpu-arguments
  32, // 120: nullList-memory-arguments
  196500, // 121: quotientInteger-cpu-arguments-constant
  453240, // 122: quotientInteger-cpu-arguments-model-arguments-intercept
  220, // 123: quotientInteger-cpu-arguments-model-arguments-slope
  0, // 124: quotientInteger-memory-arguments-intercept
  1, // 125: quotientInteger-memory-arguments-minimum
  1, // 126: quotientInteger-memory-arguments-slope
  196500, // 127: remainderInteger-cpu-arguments-constant
  453240, // 128: remainderInteger-cpu-arguments-model-arguments-intercept
  220, // 129: remainderInteger-cpu-arguments-model-arguments-slope
  0, // 130: remainderInteger-memory-arguments-intercept
  1, // 131: remainderInteger-memory-arguments-minimum
  1, // 132: remainderInteger-memory-arguments-slope
  1159724, // 133: serialiseData-cpu-arguments-intercept
  392670, // 134: serialiseData-cpu-arguments-slope
  0, // 135: serialiseData-memory-arguments-intercept
  2, // 136: serialiseData-memory-arguments-slope
  806990, // 137: sha2_256-cpu-arguments-intercept
  30482, // 138: sha2_256-cpu-arguments-slope
  4, // 139: sha2_256-memory-arguments
  1927926, // 140: sha3_256-cpu-arguments-intercept
  82523, // 141: sha3_256-cpu-arguments-slope
  4, // 142: sha3_256-memory-arguments
  265318, // 143: sliceByteString-cpu-arguments-intercept
  0, // 144: sliceByteString-cpu-arguments-slope
  4, // 145: sliceByteString-memory-arguments-intercept
  0, // 146: sliceByteString-memory-arguments-slope
  85931, // 147: sndPair-cpu-arguments
  32, // 148: sndPair-memory-arguments
  205665, // 149: subtractInteger-cpu-arguments-intercept
  812, // 150: subtractInteger-cpu-arguments-slope
  1, // 151: subtractInteger-memory-arguments-intercept
  1, // 152: subtractInteger-memory-arguments-slope
  41182, // 153: tailList-cpu-arguments
  32, // 154: tailList-memory-arguments
  212342, // 155: trace-cpu-arguments
  32, // 156: trace-memory-arguments
  31220, // 157: unBData-cpu-arguments
  32, // 158: unBData-memory-arguments
  32696, // 159: unConstrData-cpu-arguments
  32, // 160: unConstrData-memory-arguments
  43357, // 161: unIData-cpu-arguments
  32, // 162: unIData-memory-arguments
  32247, // 163: unListData-cpu-arguments
  32, // 164: unListData-memory-arguments
  38314, // 165: unMapData-cpu-arguments
  32, // 166: unMapData-memory-arguments
  35892428, // 167: verifyEcdsaSecp256k1Signature-cpu-arguments
  10, // 168: verifyEcdsaSecp256k1Signature-memory-arguments
  57996947, // 169: verifyEd25519Signature-cpu-arguments-intercept
  18975, // 170: verifyEd25519Signature-cpu-arguments-slope
  10, // 171: verifyEd25519Signature-memory-arguments
  38887044, // 172: verifySchnorrSecp256k1Signature-cpu-arguments-intercept
  32947, // 173: verifySchnorrSecp256k1Signature-cpu-arguments-slope
  10 // 174: verifySchnorrSecp256k1Signature-memory-arguments
]

export const PARAMS_V2_CONWAY: number[] = [
  100788, // 0: addInteger-cpu-arguments-intercept
  420, // 1: addInteger-cpu-arguments-slope
  1, // 2: addInteger-memory-arguments-intercept
  1, // 3: addInteger-memory-arguments-slope
  1000, // 4: appendByteString-cpu-arguments-intercept
  173, // 5: appendByteString-cpu-arguments-slope
  0, // 6: appendByteString-memory-arguments-intercept
  1, // 7: appendByteString-memory-arguments-slope
  1000, // 8: appendString-cpu-arguments-intercept
  59957, // 9: appendString-cpu-arguments-slope
  4, // 10: appendString-memory-arguments-intercept
  1, // 11: appendString-memory-arguments-slope
  11183, // 12: bData-cpu-arguments
  32, // 13: bData-memory-arguments
  201305, // 14: blake2b_256-cpu-arguments-intercept
  8356, // 15: blake2b_256-cpu-arguments-slope
  4, // 16: blake2b_256-memory-arguments
  16000, // 17: cekApplyCost-exBudgetCPU
  100, // 18: cekApplyCost-exBudgetMemory
  16000, // 19: cekBuiltinCost-exBudgetCPU
  100, // 20: cekBuiltinCost-exBudgetMemory
  16000, // 21: cekConstCost-exBudgetCPU
  100, // 22: cekConstCost-exBudgetMemory
  16000, // 23: cekDelayCost-exBudgetCPU
  100, // 24: cekDelayCost-exBudgetMemory
  16000, // 25: cekForceCost-exBudgetCPU
  100, // 26: cekForceCost-exBudgetMemory
  16000, // 27: cekLamCost-exBudgetCPU
  100, // 28: cekLamCost-exBudgetMemory
  100, // 29: cekStartupCost-exBudgetCPU
  100, // 30: cekStartupCost-exBudgetMemory
  16000, // 31: cekVarCost-exBudgetCPU
  100, // 32: cekVarCost-exBudgetMemory
  94375, // 33: chooseData-cpu-arguments
  32, // 34: chooseData-memory-arguments
  132994, // 35: chooseList-cpu-arguments
  32, // 36: chooseList-memory-arguments
  61462, // 37: chooseUnit-cpu-arguments
  4, // 38: chooseUnit-memory-arguments
  72010, // 39: consByteString-cpu-arguments-intercept
  178, // 40: consByteString-cpu-arguments-slope
  0, // 41: consByteString-memory-arguments-intercept
  1, // 42: consByteString-memory-arguments-slope
  22151, // 43: constrData-cpu-arguments
  32, // 44: constrData-memory-arguments
  91189, // 45: decodeUtf8-cpu-arguments-intercept
  769, // 46: decodeUtf8-cpu-arguments-slope
  4, // 47: decodeUtf8-memory-arguments-intercept
  2, // 48: decodeUtf8-memory-arguments-slope
  85848, // 49: divideInteger-cpu-arguments-constant
  228465, // 50: divideInteger-cpu-arguments-model-arguments-intercept
  122, // 51: divideInteger-cpu-arguments-model-arguments-slope
  0, // 52: divideInteger-memory-arguments-intercept
  1, // 53: divideInteger-memory-arguments-minimum
  1, // 54: divideInteger-memory-arguments-slope
  1000, // 55: encodeUtf8-cpu-arguments-intercept
  42921, // 56: encodeUtf8-cpu-arguments-slope
  4, // 57: encodeUtf8-memory-arguments-intercept
  2, // 58: encodeUtf8-memory-arguments-slope
  24548, // 59: equalsByteString-cpu-arguments-constant
  29498, // 60: equalsByteString-cpu-arguments-intercept
  38, // 61: equalsByteString-cpu-arguments-slope
  1, // 62: equalsByteString-memory-arguments
  898148, // 63: equalsData-cpu-arguments-intercept
  27279, // 64: equalsData-cpu-arguments-slope
  1, // 65: equalsData-memory-arguments
  51775, // 66: equalsInteger-cpu-arguments-intercept
  558, // 67: equalsInteger-cpu-arguments-slope
  1, // 68: equalsInteger-memory-arguments
  39184, // 69: equalsString-cpu-arguments-constant
  1000, // 70: equalsString-cpu-arguments-intercept
  60594, // 71: equalsString-cpu-arguments-slope
  1, // 72: equalsString-memory-arguments
  141895, // 73: fstPair-cpu-arguments
  32, // 74: fstPair-memory-arguments
  83150, // 75: headList-cpu-arguments
  32, // 76: headList-memory-arguments
  15299, // 77: iData-cpu-arguments
  32, // 78: iData-memory-arguments
  76049, // 79: ifThenElse-cpu-arguments
  1, // 80: ifThenElse-memory-arguments
  13169, // 81: indexByteString-cpu-arguments
  4, // 82: indexByteString-memory-arguments
  22100, // 83: lengthOfByteString-cpu-arguments
  10, // 84: lengthOfByteString-memory-arguments
  28999, // 85: lessThanByteString-cpu-arguments-intercept
  74, // 86: lessThanByteString-cpu-arguments-slope
  1, // 87: lessThanByteString-memory-arguments
  28999, // 88: lessThanEqualsByteString-cpu-arguments-intercept
  74, // 89: lessThanEqualsByteString-cpu-arguments-slope
  1, // 90: lessThanEqualsByteString-memory-arguments
  43285, // 91: lessThanEqualsInteger-cpu-arguments-intercept
  552, // 92: lessThanEqualsInteger-cpu-arguments-slope
  1, // 93: lessThanEqualsInteger-memory-arguments
  44749, // 94: lessThanInteger-cpu-arguments-intercept
  541, // 95: lessThanInteger-cpu-arguments-slope
  1, // 96: lessThanInteger-memory-arguments
  33852, // 97: listData-cpu-arguments
  32, // 98: listData-memory-arguments
  68246, // 99: mapData-cpu-arguments
  32, // 100: mapData-memory-arguments
  72362, // 101: mkCons-cpu-arguments
  32, // 102: mkCons-memory-arguments
  7243, // 103: mkNilData-cpu-arguments
  32, // 104: mkNilData-memory-arguments
  7391, // 105: mkNilPairData-cpu-arguments
  32, // 106: mkNilPairData-memory-arguments
  11546, // 107: mkPairData-cpu-arguments
  32, // 108: mkPairData-memory-arguments
  85848, // 109: modInteger-cpu-arguments-constant
  228465, // 110: modInteger-cpu-arguments-model-arguments-intercept
  122, // 111: modInteger-cpu-arguments-model-arguments-slope
  0, // 112: modInteger-memory-arguments-intercept
  1, // 113: modInteger-memory-arguments-minimum
  1, // 114: modInteger-memory-arguments-slope
  90434, // 115: multiplyInteger-cpu-arguments-intercept
  519, // 116: multiplyInteger-cpu-arguments-slope
  0, // 117: multiplyInteger-memory-arguments-intercept
  1, // 118: multiplyInteger-memory-arguments-slope
  74433, // 119: nullList-cpu-arguments
  32, // 120: nullList-memory-arguments
  85848, // 121: quotientInteger-cpu-arguments-constant
  228465, // 122: quotientInteger-cpu-arguments-model-arguments-intercept
  122, // 123: quotientInteger-cpu-arguments-model-arguments-slope
  0, // 124: quotientInteger-memory-arguments-intercept
  1, // 125: quotientInteger-memory-arguments-minimum
  1, // 126: quotientInteger-memory-arguments-slope
  85848, // 127: remainderInteger-cpu-arguments-constant
  228465, // 128: remainderInteger-cpu-arguments-model-arguments-intercept
  122, // 129: remainderInteger-cpu-arguments-model-arguments-slope
  0, // 130: remainderInteger-memory-arguments-intercept
  1, // 131: remainderInteger-memory-arguments-minimum
  1, // 132: remainderInteger-memory-arguments-slope
  955506, // 133: serialiseData-cpu-arguments-intercept
  213312, // 134: serialiseData-cpu-arguments-slope
  0, // 135: serialiseData-memory-arguments-intercept
  2, // 136: serialiseData-memory-arguments-slope
  270652, // 137: sha2_256-cpu-arguments-intercept
  22588, // 138: sha2_256-cpu-arguments-slope
  4, // 139: sha2_256-memory-arguments
  1457325, // 140: sha3_256-cpu-arguments-intercept
  64566, // 141: sha3_256-cpu-arguments-slope
  4, // 142: sha3_256-memory-arguments
  20467, // 143: sliceByteString-cpu-arguments-intercept
  1, // 144: sliceByteString-cpu-arguments-slope
  4, // 145: sliceByteString-memory-arguments-intercept
  0, // 146: sliceByteString-memory-arguments-slope
  141992, // 147: sndPair-cpu-arguments
  32, // 148: sndPair-memory-arguments
  100788, // 149: subtractInteger-cpu-arguments-intercept
  420, // 150: subtractInteger-cpu-arguments-slope
  1, // 151: subtractInteger-memory-arguments-intercept
  1, // 152: subtractInteger-memory-arguments-slope
  81663, // 153: tailList-cpu-arguments
  32, // 154: tailList-memory-arguments
  59498, // 155: trace-cpu-arguments
  32, // 156: trace-memory-arguments
  20142, // 157: unBData-cpu-arguments
  32, // 158: unBData-memory-arguments
  24588, // 159: unConstrData-cpu-arguments
  32, // 160: unConstrData-memory-arguments
  20744, // 161: unIData-cpu-arguments
  32, // 162: unIData-memory-arguments
  25933, // 163: unListData-cpu-arguments
  32, // 164: unListData-memory-arguments
  24623, // 165: unMapData-cpu-arguments
  32, // 166: unMapData-memory-arguments
  43053543, // 167: verifyEcdsaSecp256k1Signature-cpu-arguments
  10, // 168: verifyEcdsaSecp256k1Signature-memory-arguments
  53384111, // 169: verifyEd25519Signature-cpu-arguments-intercept
  14333, // 170: verifyEd25519Signature-cpu-arguments-slope
  10, // 171: verifyEd25519Signature-memory-arguments
  43574283, // 172: verifySchnorrSecp256k1Signature-cpu-arguments-intercept
  26308, // 173: verifySchnorrSecp256k1Signature-cpu-arguments-slope
  10 // 174: verifySchnorrSecp256k1Signature-memory-arguments
]

export const PARAMS_V3_CONWAY: number[] = [
    100788, // 0: addInteger-cpu-arguments-intercept
    420, // 1: addInteger-cpu-arguments-slope
    1, // 2: addInteger-memory-arguments-intercept
    1, // 3: addInteger-memory-arguments-slope
    1000, // 4: appendByteString-cpu-arguments-intercept
    173, // 5: appendByteString-cpu-arguments-slope
    0, // 6: appendByteString-memory-arguments-intercept
    1, // 7: appendByteString-memory-arguments-slope
    1000, // 8: appendString-cpu-arguments-intercept
    59957, // 9: appendString-cpu-arguments-slope
    4, // 10: appendString-memory-arguments-intercept
    1, // 11: appendString-memory-arguments-slope
    11183, // 12: bData-cpu-arguments
    32, // 13: bData-memory-arguments
    201305, // 14: blake2b_256-cpu-arguments-intercept
    8356, // 15: blake2b_256-cpu-arguments-slope
    4, // 16: blake2b_256-memory-arguments
    16000, // 17: cekApplyCost-exBudgetCPU
    100, // 18: cekApplyCost-exBudgetMemory
    16000, // 19: cekBuiltinCost-exBudgetCPU
    100, // 20: cekBuiltinCost-exBudgetMemory
    16000, // 21: cekConstCost-exBudgetCPU
    100, // 22: cekConstCost-exBudgetMemory
    16000, // 23: cekDelayCost-exBudgetCPU
    100, // 24: cekDelayCost-exBudgetMemory
    16000, // 25: cekForceCost-exBudgetCPU
    100, // 26: cekForceCost-exBudgetMemory
    16000, // 27: cekLamCost-exBudgetCPU
    100, // 28: cekLamCost-exBudgetMemory
    100, // 29: cekStartupCost-exBudgetCPU
    100, // 30: cekStartupCost-exBudgetMemory
    16000, // 31: cekVarCost-exBudgetCPU
    100, // 32: cekVarCost-exBudgetMemory
    94375, // 33: chooseData-cpu-arguments
    32, // 34: chooseData-memory-arguments
    132994, // 35: chooseList-cpu-arguments
    32, // 36: chooseList-memory-arguments
    61462, // 37: chooseUnit-cpu-arguments
    4, // 38: chooseUnit-memory-arguments
    72010, // 39: consByteString-cpu-arguments-intercept
    178, // 40: consByteString-cpu-arguments-slope
    0, // 41: consByteString-memory-arguments-intercept
    1, // 42: consByteString-memory-arguments-slope
    22151, // 43: constrData-cpu-arguments
    32, // 44: constrData-memory-arguments
    91189, // 45: decodeUtf8-cpu-arguments-intercept
    769, // 46: decodeUtf8-cpu-arguments-slope
    4, // 47: decodeUtf8-memory-arguments-intercept
    2, // 48: decodeUtf8-memory-arguments-slope
    85848, // 49: divideInteger-cpu-arguments-constant
    123203, // 50: divideInteger-cpu-arguments-model-arguments-c00
    7305, // 51: divideInteger-cpu-arguments-model-arguments-c01
    -900, // 52: divideInteger-cpu-arguments-model-arguments-c02
    1716, // 53: divideInteger-cpu-arguments-model-arguments-c10
    549, // 54: divideInteger-cpu-arguments-model-arguments-c11
    57, // 55: divideInteger-cpu-arguments-model-arguments-c20
    85848, // 56: divideInteger-cpu-arguments-model-arguments-minimum
    0, // 57: divideInteger-memory-arguments-intercept
    1, // 58: divideInteger-memory-arguments-minimum
    1, // 59: divideInteger-memory-arguments-slope
    1000, // 60: encodeUtf8-cpu-arguments-intercept
    42921, // 61: encodeUtf8-cpu-arguments-slope
    4, // 62: encodeUtf8-memory-arguments-intercept
    2, // 63: encodeUtf8-memory-arguments-slope
    24548, // 64: equalsByteString-cpu-arguments-constant
    29498, // 65: equalsByteString-cpu-arguments-intercept
    38, // 66: equalsByteString-cpu-arguments-slope
    1, // 67: equalsByteString-memory-arguments
    898148, // 68: equalsData-cpu-arguments-intercept
    27279, // 69: equalsData-cpu-arguments-slope
    1, // 70: equalsData-memory-arguments
    51775, // 71: equalsInteger-cpu-arguments-intercept
    558, // 72: equalsInteger-cpu-arguments-slope
    1, // 73: equalsInteger-memory-arguments
    39184, // 74: equalsString-cpu-arguments-constant
    1000, // 75: equalsString-cpu-arguments-intercept
    60594, // 76: equalsString-cpu-arguments-slope
    1, // 77: equalsString-memory-arguments
    141895, // 78: fstPair-cpu-arguments
    32, // 79: fstPair-memory-arguments
    83150, // 80: headList-cpu-arguments
    32, // 81: headList-memory-arguments
    15299, // 82: iData-cpu-arguments
    32, // 83: iData-memory-arguments
    76049, // 84: ifThenElse-cpu-arguments
    1, // 85: ifThenElse-memory-arguments
    13169, // 86: indexByteString-cpu-arguments
    4, // 87: indexByteString-memory-arguments
    22100, // 88: lengthOfByteString-cpu-arguments
    10, // 89: lengthOfByteString-memory-arguments
    28999, // 90: lessThanByteString-cpu-arguments-intercept
    74, // 91: lessThanByteString-cpu-arguments-slope
    1, // 92: lessThanByteString-memory-arguments
    28999, // 93: lessThanEqualsByteString-cpu-arguments-intercept
    74, // 94: lessThanEqualsByteString-cpu-arguments-slope
    1, // 95: lessThanEqualsByteString-memory-arguments
    43285, // 96: lessThanEqualsInteger-cpu-arguments-intercept
    552, // 97: lessThanEqualsInteger-cpu-arguments-slope
    1, // 98: lessThanEqualsInteger-memory-arguments
    44749, // 99: lessThanInteger-cpu-arguments-intercept
    541, // 100: lessThanInteger-cpu-arguments-slope
    1, // 101: lessThanInteger-memory-arguments
    33852, // 102: listData-cpu-arguments
    32, // 103: listData-memory-arguments
    68246, // 104: mapData-cpu-arguments
    32, // 105: mapData-memory-arguments
    72362, // 106: mkCons-cpu-arguments
    32, // 107: mkCons-memory-arguments
    7243, // 108: mkNilData-cpu-arguments
    32, // 109: mkNilData-memory-arguments
    7391, // 110: mkNilPairData-cpu-arguments
    32, // 111: mkNilPairData-memory-arguments
    11546, // 112: mkPairData-cpu-arguments
    32, // 113: mkPairData-memory-arguments
    85848, // 114: modInteger-cpu-arguments-constant
    123203, // 115: modInteger-cpu-arguments-model-arguments-c00
    7305, // 116: modInteger-cpu-arguments-model-arguments-c01
    -900, // 117: modInteger-cpu-arguments-model-arguments-c02
    1716, // 118: modInteger-cpu-arguments-model-arguments-c10
    549, // 119: modInteger-cpu-arguments-model-arguments-c11
    57, // 120: modInteger-cpu-arguments-model-arguments-c20
    85848, // 121: modInteger-cpu-arguments-model-arguments-minimum
    0, // 122: modInteger-memory-arguments-intercept
    1, // 123: modInteger-memory-arguments-slope
    90434, // 124: multiplyInteger-cpu-arguments-intercept
    519, // 125: multiplyInteger-cpu-arguments-slope
    0, // 126: multiplyInteger-memory-arguments-intercept
    1, // 127: multiplyInteger-memory-arguments-slope
    74433, // 128: nullList-cpu-arguments
    32, // 129: nullList-memory-arguments
    85848, // 130: quotientInteger-cpu-arguments-constant
    123203, // 131: quotientInteger-cpu-arguments-model-arguments-c00
    7305, // 132: quotientInteger-cpu-arguments-model-arguments-c01
    -900, // 133: quotientInteger-cpu-arguments-model-arguments-c02
    1716, // 134: quotientInteger-cpu-arguments-model-arguments-c10
    549, // 135: quotientInteger-cpu-arguments-model-arguments-c11
    57, // 136: quotientInteger-cpu-arguments-model-arguments-c20
    85848, // 137: quotientInteger-cpu-arguments-model-arguments-minimum
    0, // 138: quotientInteger-memory-arguments-intercept
    1, // 139: quotientInteger-memory-arguments-minimum
    1, // 140: quotientInteger-memory-arguments-slope
    85848, // 141: remainderInteger-cpu-arguments-constant
    123203, // 142: remainderInteger-cpu-arguments-model-arguments-c00
    7305, // 143: remainderInteger-cpu-arguments-model-arguments-c01
    -900, // 144: remainderInteger-cpu-arguments-model-arguments-c02
    1716, // 145: remainderInteger-cpu-arguments-model-arguments-c10
    549, // 146: remainderInteger-cpu-arguments-model-arguments-c11
    57, // 147: remainderInteger-cpu-arguments-model-arguments-c20
    85848, // 148: remainderInteger-cpu-arguments-model-arguments-minimum
    0, // 149: remainderInteger-memory-arguments-intercept
    1, // 150: remainderInteger-memory-arguments-slope
    955506, // 151: serialiseData-cpu-arguments-intercept
    213312, // 152: serialiseData-cpu-arguments-slope
    0, // 153: serialiseData-memory-arguments-intercept
    2, // 154: serialiseData-memory-arguments-slope
    270652, // 155: sha2_256-cpu-arguments-intercept
    22588, // 156: sha2_256-cpu-arguments-slope
    4, // 157: sha2_256-memory-arguments
    1457325, // 158: sha3_256-cpu-arguments-intercept
    64566, // 159: sha3_256-cpu-arguments-slope
    4, // 160: sha3_256-memory-arguments
    20467, // 161: sliceByteString-cpu-arguments-intercept
    1, // 162: sliceByteString-cpu-arguments-slope
    4, // 163: sliceByteString-memory-arguments-intercept
    0, // 164: sliceByteString-memory-arguments-slope
    141992, // 165: sndPair-cpu-arguments
    32, // 166: sndPair-memory-arguments
    100788, // 167: subtractInteger-cpu-arguments-intercept
    420, // 168: subtractInteger-cpu-arguments-slope
    1, // 169: subtractInteger-memory-arguments-intercept
    1, // 170: subtractInteger-memory-arguments-slope
    81663, // 171: tailList-cpu-arguments
    32, // 172: tailList-memory-arguments
    59498, // 173: trace-cpu-arguments
    32, // 174: trace-memory-arguments
    20142, // 175: unBData-cpu-arguments
    32, // 176: unBData-memory-arguments
    24588, // 177: unConstrData-cpu-arguments
    32, // 178: unConstrData-memory-arguments
    20744, // 179: unIData-cpu-arguments
    32, // 180: unIData-memory-arguments
    25933, // 181: unListData-cpu-arguments
    32, // 182: unListData-memory-arguments
    24623, // 183: unMapData-cpu-arguments
    32, // 184: unMapData-memory-arguments
    43053543, // 185: verifyEcdsaSecp256k1Signature-cpu-arguments
    10, // 186: verifyEcdsaSecp256k1Signature-memory-arguments
    53384111, // 187: verifyEd25519Signature-cpu-arguments-intercept
    14333, // 188: verifyEd25519Signature-cpu-arguments-slope
    10, // 189: verifyEd25519Signature-memory-arguments
    43574283, // 190: verifySchnorrSecp256k1Signature-cpu-arguments-intercept
    26308, // 191: verifySchnorrSecp256k1Signature-cpu-arguments-slope
    10, // 192: verifySchnorrSecp256k1Signature-memory-arguments
    16000, // 193: cekConstrCost-exBudgetCPU
    100, // 194: cekConstrCost-exBudgetMemory
    16000, // 195: cekCaseCost-exBudgetCPU
    100, // 196: cekCaseCost-exBudgetMemory
    962335, // 197: bls12_381_G1_add-cpu-arguments
    18, // 198: bls12_381_G1_add-memory-arguments
    2780678, // 199: bls12_381_G1_compress-cpu-arguments
    6, // 200: bls12_381_G1_compress-memory-arguments
    442008, // 201: bls12_381_G1_equal-cpu-arguments
    1, // 202: bls12_381_G1_equal-memory-arguments
    52538055, // 203: bls12_381_G1_hashToGroup-cpu-arguments-intercept
    3756, // 204: bls12_381_G1_hashToGroup-cpu-arguments-slope
    18, // 205: bls12_381_G1_hashToGroup-memory-arguments
    267929, // 206: bls12_381_G1_neg-cpu-arguments
    18, // 207: bls12_381_G1_neg-memory-arguments
    76433006, // 208: bls12_381_G1_scalarMul-cpu-arguments-intercept
    8868, // 209: bls12_381_G1_scalarMul-cpu-arguments-slope
    18, // 210: bls12_381_G1_scalarMul-memory-arguments
    52948122, // 211: bls12_381_G1_uncompress-cpu-arguments
    18, // 212: bls12_381_G1_uncompress-memory-arguments
    1995836, // 213: bls12_381_G2_add-cpu-arguments
    36, // 214: bls12_381_G2_add-memory-arguments
    3227919, // 215: bls12_381_G2_compress-cpu-arguments
    12, // 216: bls12_381_G2_compress-memory-arguments
    901022, // 217: bls12_381_G2_equal-cpu-arguments
    1, // 218: bls12_381_G2_equal-memory-arguments
    166917843, // 219: bls12_381_G2_hashToGroup-cpu-arguments-intercept
    4307, // 220: bls12_381_G2_hashToGroup-cpu-arguments-slope
    36, // 221: bls12_381_G2_hashToGroup-memory-arguments
    284546, // 222: bls12_381_G2_neg-cpu-arguments
    36, // 223: bls12_381_G2_neg-memory-arguments
    158221314, // 224: bls12_381_G2_scalarMul-cpu-arguments-intercept
    26549, // 225: bls12_381_G2_scalarMul-cpu-arguments-slope
    36, // 226: bls12_381_G2_scalarMul-memory-arguments
    74698472, // 227: bls12_381_G2_uncompress-cpu-arguments
    36, // 228: bls12_381_G2_uncompress-memory-arguments
    333849714, // 229: bls12_381_finalVerify-cpu-arguments
    1, // 230: bls12_381_finalVerify-memory-arguments
    254006273, // 231: bls12_381_millerLoop-cpu-arguments
    72, // 232: bls12_381_millerLoop-memory-arguments
    2174038, // 233: bls12_381_mulMlResult-cpu-arguments
    72, // 234: bls12_381_mulMlResult-memory-arguments
    2261318, // 235: keccak_256-cpu-arguments-intercept
    64571, // 236: keccak_256-cpu-arguments-slope
    4, // 237: keccak_256-memory-arguments
    207616, // 238: blake2b_224-cpu-arguments-intercept
    8310, // 239: blake2b_224-cpu-arguments-slope
    4, // 240: blake2b_224-memory-arguments
    1293828, // 241: integerToByteString-cpu-arguments-c0
    28716, // 242: integerToByteString-cpu-arguments-c1
    63, // 243: integerToByteString-cpu-arguments-c2
    0, // 244: integerToByteString-memory-arguments-intercept
    1, // 245: integerToByteString-memory-arguments-slope
    1006041, // 246: byteStringToInteger-cpu-arguments-c0
    43623, // 247: byteStringToInteger-cpu-arguments-c1
    251, // 248: byteStringToInteger-cpu-arguments-c2
    0, // 249: byteStringToInteger-memory-arguments-intercept
    1 // 250: byteStringToInteger-memory-arguments-slope
]
