import type { Tracker } from "./Cost.js"
import type { Const, SourceSpan, Term } from "./Term.js"

/**
 * The context that terms and frames need to operate.
 */
export interface Context {
  readonly cost: Tracker
  //getBuiltin(id: number): Builtin | undefined
  print(message: string, site?: Site): void
  popLastMessage(): string | undefined
}

/**
 * `BuiltinValue` is equivalent to $\langle \texttt{builtin}~b~\overline{V}~\eta\rangle$ in the *CEK Machine* section of the [plutus core spec](https://plutus.cardano.intersectmbo.org/resources/plutus-core-spec.pdf):
 *
 *    - `id` is equivalent to $b$
 *
 */
export type BuiltinValue = {
  _tag: "Builtin"
  id: number
  forceCount: number
  args: Value[]
  name: string
}

/**
 * `ConstValue` is equivalent to $\langle \texttt{con}~T~c\rangle$ in the *CEK Machine* section of the [Plutus Core spec](https://plutus.cardano.intersectmbo.org/resources/plutus-core-spec.pdf).
 *
 *    - `value` contains information related to both $T$ and $c$
 *
 * The optional `name` field is used for debugging.
 */
export type ConstValue = Const

/**
 * `ConstrValue` is equivalent to $\langle \texttt{constr}~i~\overline{V}\rangle$ in the *CEK Machine* section of the [plutus core spec](https://plutus.cardano.intersectmbo.org/resources/plutus-core-spec.pdf):
 *
 *    - `tag` is equivalent to $i$
 *    - `args` is equivalent to $\overline{V}$
 *
 * The optional `name` is used for debugging.
 */
export type ConstrValue = {
  _tag: "Constr"
  tag: number
  args: Value[]
  name?: string
}

/**
 * `DelayedValue` is equivalent to $\langle \texttt{delay}~M~\rho\rangle$ in the *CEK Machine* section of the [Plutus Core spec](https://plutus.cardano.intersectmbo.org/resources/plutus-core-spec.pdf):
 *
 *    - `term` is equivalent to $M$
 *    - `stack` is equivalent to $\rho$
 *
 * The optional `name` field is used for debugging.
 */
export type DelayedValue = {
  _tag: "Delayed"
  term: Term
  stack: Stack
  name?: string | undefined
}

/**
 * `LambdaValue` is equivalent to $\langle \texttt{lam}~x~M~\rho\rangle$ in the *CEK Machine* section of the [plutus core spec](https://plutus.cardano.intersectmbo.org/resources/plutus-core-spec.pdf):
 *
 *    - `body` is equivalent to $M$
 *    - `env` is equivalent to $\rho$
 *    - `argName` is an optional alternative name for $x$, which is useful during debugging
 *
 * The optional `name` field is used for debugging.
 */
export type LambdaValue = {
  _tag: "Lambda"
  body: Term
  stack: Stack
  name?: string
  argName?: string
}

export type Value =
  | BuiltinValue
  | ConstValue
  | ConstrValue
  | DelayedValue
  | LambdaValue

export type CallSite = {
  sourceSpan?: SourceSpan | undefined
  description?: string
  functionName?: string
  arguments?: Value[]
}

export type Stack = {
  values: Value[]
  callSites: CallSite[] // useful for debugging
}

/**
 * Instantiate a `Machine` with {@link makeCekMachine}.
 */
//export interface Machine extends Context {
//  readonly builtins: Builtin[]
//  readonly logger: Logger | undefined
//  readonly state: State
//  readonly trace: { message: string; site?: Site }[]
//  eval(): Result
//}

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
//export interface Result {
//  result: Either.Either<
//    string | Value,
//    { error: string; callSites: CallSiteInfo[] }
//  >
//}

export interface Site {
  readonly file: string
  readonly line: number
  readonly column: number
  readonly description: string | undefined
}
