import { Either, Schema } from "effect"
import * as Bytes from "../internal/Bytes.js"
import * as Cbor from "../Cbor.js"

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

type Function$ = (params: Params) => (argSizes: number[]) => bigint

export const LargestArg =
  (slopeId: number, interceptId: number): Function$ =>
  (params: Params) => {
    const slope = params.get(slopeId)
    const intercept = params.get(interceptId)

    return (argSizes: number[]) => {
      const m = BigInt(argSizes.reduce((m, s) => (s > m ? s : m), 0))
      return m * slope + intercept
    }
  }

export const ArgsSum =
  (slopeId: number, interceptId: number): Function$ =>
  (params: Params) => {
    const slope = params.get(slopeId)
    const intercept = params.get(interceptId)

    return (argSizes: number[]) => {
      const s = BigInt(argSizes.reduce((s, a) => s + a, 0))

      return s * slope + intercept
    }
  }

export const ArgsProd =
  (slopeId: number, interceptId: number): Function$ =>
  (params: Params) => {
    const slope = params.get(slopeId)
    const intercept = params.get(interceptId)

    return (argSizes: number[]) => {
      if (argSizes.length != 2) {
        throw new Error(
          `expected only 2 arguments for ArgProd cost model function, got ${argSizes.length}`
        )
      }

      const [x, y] = argSizes

      return BigInt(x * y) * slope + intercept
    }
  }

export { type Function$ as Function }

export type Params = {
  get(key: number, def?: bigint | undefined): bigint
}

export interface Tracker {
  readonly cost: Cost
  readonly model: Model
  readonly breakdown: Breakdown
  incrApplyCost(): void
  incrBuiltinCost(): void
  incrCaseCost(): void
  incrConstCost(): void
  incrConstrCost(): void
  incrDelayCost(): void
  incrForceCost(): void
  incrLambdaCost(): void
  incrStartupCost(): void
  incrVarCost(): void
  incrArgSizesCost(name: string, argSizes: bigint[]): void
}
