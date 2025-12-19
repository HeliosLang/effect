import { Either } from "effect"

/**
 * The context that terms and frames need to operate.
 */
export interface Context {
  readonly cost: CostTracker
  getBuiltin(id: number): Builtin | undefined
  print(message: string, site?: Site | undefined): void
  popLastMessage(): string | undefined
}

export interface Cost {
  readonly cpu: bigint
  readonly mem: bigint
}

export type CostBreakdown = {
  [name: string]: Cost & { count: number }
}

export interface CostModel {
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

export interface CostTracker {
  readonly cost: Cost
  readonly costModel: CostModel
  readonly breakdown: CostBreakdown
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

/**
 * Instantiate a `Machine` with {@link makeCekMachine}.
 */
export interface Machine extends Context {
  readonly builtins: Builtin[]
  readonly logger: Logger | undefined
  readonly state: State
  readonly trace: { message: string; site?: Site }[]
  eval(): Result
}

/**
 * TODO: rename to CEKResult
 * @typedef {{
 *   result: Either<
 *     {
 *       error: string
 *       callSites: CallSiteInfo[]
 *     },
 *     string | UplcValue
 *   >
 *   cost: Cost
 *   logs: {message: string, site?: Site}[]
 *   breakdown: CostBreakdown
 * }} CekResult
 * Return value is optional and can be omitted if the UplcValue doesn't suffice to contain it (eg. lambda functions).
 */
export interface Result {
  result: Either.Either<
    string | Value,
    { error: string; callSites: CallSiteInfo[] }
  >
}

export interface Site {
  readonly file: string
  readonly line: number
  readonly column: number
  readonly description: string | undefined
}
