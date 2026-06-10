import { Either } from "effect"
import type { Builtin } from "./Builtins.js"
import * as Cost from "./Cost.js"
import type {
  Apply,
  Builtin as BuiltinTerm,
  Case,
  Const,
  Constr,
  Delay,
  Error as ErrorTerm,
  Force,
  Lambda,
  SourceSpan,
  Term,
  Var
} from "./Term.js"
import { memSize } from "./Value.js"

export type EvalContext = {
  builtins: readonly Builtin[]
  costParams: readonly number[]
  logger?: Logger | undefined
  capture?: CaptureConfig | undefined
}

export type CaptureConfig = {
  prefix?: string | undefined
}

export type CapturedValue = {
  index: number
  id: string
  value: Value
  callSite?: CallSite | undefined
}

/**
 * The context that terms and frames need to operate.
 */
export interface MachineContext extends EvalContext {
  readonly cost: Cost.Tracker
  //getBuiltin(id: number): Builtin | undefined
  print(message: string, site?: CallSite): void
  popLastMessage(): string | undefined
  captureValue(id: string, value: Value, callSite?: CallSite): void
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
  name?: string | undefined
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
  name?: string | undefined
  argName?: string | undefined
}

export type Value =
  | BuiltinValue
  | ConstValue
  | ConstrValue
  | DelayedValue
  | LambdaValue

export type CallSite = {
  sourceSpan?: SourceSpan | undefined
  description?: string | undefined
  functionName?: string | undefined
  arguments?: Value[] | undefined
}

/**
 * Information which is helpful during debugging
 */
type ApplyInfo = {
  callSite?: CallSite | undefined
  name?: string | undefined
  argName?: string | undefined
}

export type Stack = {
  values: Value[]
  callSites: CallSite[] // useful for debugging
}

export interface Logger {
  lastMessage: string
  logPrint(message: string, callSite?: CallSite): void
  logError?: (message: string, callSite?: CallSite) => void
  logTrace?: (message: string, callSite?: CallSite) => void
  flush?: () => void
  reset?: (reason: "build" | "validate") => void
}

type State = ComputingState | ReducingState | ErrorState | SuccessState

/**
 * `ComputingState` is equivalent to $s; \rho \triangleright M$ in the *CEK Machine* section of the [Plutus Core spec](https://plutus.cardano.intersectmbo.org/resources/plutus-core-spec.pdf):
 *
 *   - `term` is equivalent to $M$
 *   - `stack` is equivalent to $\rho$
 *   - `frames` is equivalent to $s$
 */
type ComputingState<T extends Term = Term> = {
  kind: "computing"
  term: T
  stack: Stack
  frames: Frame[]
}
/**
 * `ReducingState` is equivalent to $s \triangleleft V$ in the *CEK Machine* section of the [Plutus Core spec](https://plutus.cardano.intersectmbo.org/resources/plutus-core-spec.pdf):
 *
 *    - `value` is equivalent to $V$
 *    - `frames` is equivalent to $s$
 */
type ReducingState = {
  kind: "reducing"
  value: Value
  frames: Frame[]
}

/**
 * `ErrorState` is equivalent to $\diamond$ in the *CEK Machine* section of the [plutus core spec](https://plutus.cardano.intersectmbo.org/resources/plutus-core-spec.pdf):
 *
 * The `message` and `stack` fields aren't required by the spec, but are useful for debugging.
 */
type ErrorState = {
  kind: "error"
  message: string
  stack: Stack
}

/**
 * `SuccessState` is equivalent to $\square V$ in the *CEK Machine* section of the [plutus core spec](https://plutus.cardano.intersectmbo.org/resources/plutus-core-spec.pdf):
 *
 *    - `value` is equivalent to $V$
 */
type SuccessState = {
  kind: "success"
  value: Value
}

/**
 * `Frame`s perform CEK Machine transitions during the reduction of {@link Value}s.
 */
type Frame =
  | ForceFrame
  | LeftApplyToTermFrame
  | LeftApplyToValueFrame
  | RightApplyFrame
  | ConstrArgFrame
  | CaseScrutineeFrame

/**
 * `ForceFrame` represents the $(\text{force}~\_)$ frame of the *CEK Machine*.
 *
 * Reducing the `CekForceFrame` performs one of the following transitions of the {@link CekMachine}:
 *
 * $$
 * \begin{aligned}
 * (\texttt{force}~\_)\cdot s&\triangleleft\langle\texttt{delay}~M~\rho\rangle~&&\mapsto~s;\rho\triangleright M\\
 * (\texttt{force}~\_)\cdot s&\triangleleft\langle\texttt{builtin}~b~\overline{V}~(\iota\cdot\eta)\rangle~&&\mapsto~s\triangleleft\langle\texttt{builtin}~b~\overline{V}~\eta\rangle\quad\text{if}~\iota\in\mathscr{Q}\\
 * (\texttt{force}~\_)\cdot s&\triangleleft\langle\texttt{builtin}~b~\overline{V}~[\iota]\rangle~&&\mapsto~\textsf{Eval}_\textsf{CEK}(s,b,\overline{V})\quad\text{if}~\iota\in\mathscr{Q}
 * \end{aligned}
 * $$
 *
 * The $\iota\in\mathscr{Q}$ condition is a convoluted way of expressing that the builtin value expects a force term to be applied next, instead of a value.
 */
type ForceFrame = {
  _tag: "ForceFrame"
  stack: Stack
  callSite?: CallSite | undefined
}

/**
 * `LeftApplyToTermFrame` represents the $[\_~(M,\rho)]$ frame of the *CEK Machine*.
 *
 *    - `arg` is equivalent to $M$
 *    - `stack` is equivalent to $\rho$
 *
 * Reducing the `LeftApplyToTermFrame` performs the following transition of the *CEK Machine*:
 *
 * $$
 * [\_~(M,\rho)]\cdot s\triangleleft V~\mapsto~[V~\_]\cdot s;\rho\triangleright M
 * $$
 */
type LeftApplyToTermFrame = {
  _tag: "LeftApplyToTermFrame"
  arg: Term
  stack: Stack
  callSite?: CallSite | undefined
}

/**
 * `LeftApplyToValueFrame` represents the $[\_~V]$ frame of the *CEK Machine*.
 *
 *    - `rhs` is equivalent to $V$ in the $[\_~V]$ frame
 *    - `stack` is equivalent to $\rho$
 *
 * Reducing the `LeftApplyToValueFrame` performs one of the following transitions:
 *
 * $$
 * \begin{aligned}
 * [\_~V]\cdot s &\triangleleft\langle\texttt{lam}~x~M~\rho\rangle~&&\mapsto~s;\rho[x\mapsto V]\triangleright M\\
 * [\_~V]\cdot s &\triangleleft\langle\texttt{builtin}~b~\overline{V}~(\iota\cdot\eta)\rangle\triangleleft V~&&\mapsto~s\triangleleft\langle\texttt{builtin}~b~(\overline{V}\cdot V)~\eta\rangle\quad\text{if}~\iota\in\mathscr{U}\\
 * [\_~V]\cdot s &\triangleleft\langle\texttt{builtin}~b~\overline{V}~[\iota]\rangle~&&\mapsto~\textsf{Eval}_\textsf{CEK}(s,b,\overline{V}\cdot V)\quad\text{if}~\iota\in\mathscr{U}
 * \end{aligned}
 * $$
 *
 * The $\iota\in\mathscr{U}$ condition is a convoluted way of expressing that the builtin expects a value to be applied next, instead of a force term.
 */
type LeftApplyToValueFrame = {
  _tag: "LeftApplyToValueFrame"
  rhs: Value
  stack: Stack
  callSite?: CallSite | undefined
}

/**
 * `RightApplyFrame` represents the $[V~\_]$ frame of the *CEK Machine*.
 *
 *   - `fn` is equivalent to $V$ in the $[V~\_]$ frame.
 *
 * Reducing the `RightApplyFrame` performs one of the following transitions:
 *
 * $$
 * \begin{aligned}
 * [\langle\texttt{lam}~x~M~\rho\rangle~\_]\cdot s &\triangleleft V~&&\mapsto~s;\rho[x\mapsto V]\triangleright M\\
 * [\langle\texttt{builtin}~b~\overline{V}~(\iota\cdot\eta)\rangle~\_]\cdot s &\triangleleft V~&&\mapsto~s\triangleleft\langle\texttt{builtin}~b~(\overline{V}\cdot V)~\eta\rangle\quad\text{if}~\iota\in\mathscr{U}\\
 * [\langle\texttt{builtin}~b~\overline{V}~[\iota]\rangle~\_]\cdot s &\triangleleft V~&&\mapsto~\textsf{Eval}_\textsf{CEK}(s,b,\overline{V}\cdot V)\quad\text{if}~\iota\in\mathscr{U}
 * \end{aligned}
 * $$
 *
 * The $\iota\in\mathscr{U}$ condition is a convoluted way of expressing that the builtin expects a value to be applied next, instead of a force term.
 */
type RightApplyFrame = {
  _tag: "RightApplyFrame"
  fn: Value
  stack: Stack
  info: ApplyInfo
}

/**
 * `ConstrArgFrame` represents the $(\texttt{constr}~i~\overline{V}~\_~(\overline{M},\rho))$ frame of the *CEK Machine*.
 *
 *   - `tag` is equivalent to $i$.
 *   - `evaluatedArgs` is equivalent to $\overline{V}$.
 *   - `pendingArgs` is equivalent to $\overline{M}$.
 *   - `stack` is equivalent to $\rho$
 *
 * Reducing the `ConstrArgFrame` performs one of the following transitions:
 *
 * $$
 * \begin{aligned}
 * (\texttt{constr}~i~\overline{V}~\_~(M\cdot\overline{M},\rho))\cdot s &\triangleleft V~&&\mapsto~(\texttt{constr}~i~\overline{V}\cdot V~\_~(\overline{M},\rho))\cdot s;\rho\triangleright M\\
 * (\texttt{constr}~i~\overline{V}~\_~([],\rho))\cdot s&\triangleleft V~&&\mapsto~s\triangleleft\langle\texttt{constr}~i~\overline{V}\cdot V\rangle
 * \end{aligned}
 * $$
 */
type ConstrArgFrame = {
  _tag: "ConstrArgFrame"
  tag: number
  evaluatedArgs: Value[]
  pendingArgs: Term[]
  stack: Stack
}

/**
 * `CaseScrutineeFrame` represents the $(\texttt{case}~\_~(\overline{M},\rho))$ frame of the *CEK Machine*.
 *
 *    - `cases` is equivalent to $\overline{M}$.
 *    - `stack` is equivalent to $\rho$.
 *
 * Reducing the `CaseScrutineeFrame` performs the following transition:
 *
 * $$
 * (\texttt{case}~\_~(M_0\ldots M_n,\rho))\cdot s\triangleleft\langle\texttt{constr}~i~V_1 \ldots V_m\rangle~\mapsto~[\_~V_m]\ldots[\_~V_1]\cdot s;\rho \triangleright M_i
 * $$
 */
type CaseScrutineeFrame = {
  _tag: "CaseScrutineeFrame"
  cases: readonly Term[]
  stack: Stack
}

/**
 * Return value is optional and can be omitted if the UplcValue doesn't suffice to contain it (eg. lambda functions).
 */
export type Result = {
  value: Either.Either<Value, { error: string; callSites: CallSite[] }>
  cost: Cost.Cost
  logs: { message: string; callSite?: CallSite | undefined }[]
  breakdown: Cost.Breakdown
  captured: CapturedValue[]
}

/**
 * This is main evaluation function of the CEK Machine
 * Stack-based algorithm
 * @param entryPoint
 * @param evalContext
 * @returns
 */
function eval$(entryPoint: Term, evalContext: EvalContext): Result {
  const tracker = new Cost.Tracker(
    Cost.makeModel(evalContext.costParams, evalContext.builtins)
  )
  const logs: { message: string; callSite?: CallSite | undefined }[] = []
  const captured: CapturedValue[] = []

  // initialize the machine state
  let state: State = {
    kind: "computing",
    term: entryPoint,
    stack: {
      values: [],
      callSites: []
    },
    frames: []
  } satisfies ComputingState

  /**
   * Create the full context
   */
  const ctx: MachineContext = {
    ...evalContext,
    cost: tracker,
    print: (message: string, callSite?: CallSite) => {
      logs.push({ message, callSite: callSite ?? undefined })
      evalContext.logger?.logPrint(message, callSite)
    },
    popLastMessage: () => {
      return logs.pop()?.message
    },
    captureValue: (id: string, value: Value, callSite?: CallSite) => {
      captured.push({
        index: captured.length,
        id,
        value,
        callSite
      })
    }
  }

  // initialize the execution cost
  tracker.incrStartupCost()

  while (!["error", "success"].includes(state.kind)) {
    if (state.kind == "computing") {
      switch (state.term._tag) {
        case "Apply":
          state = computeApplyTerm(state as ComputingState<Apply>, ctx)
          break
        case "Builtin":
          state = computeBuiltinTerm(state as ComputingState<BuiltinTerm>, ctx)
          break
        case "Case":
          state = computeCaseTerm(state as ComputingState<Case>, ctx)
          break
        case "Const":
          state = computeConstTerm(state as ComputingState<Const>, ctx)
          break
        case "Constr":
          state = computeConstrTerm(state as ComputingState<Constr>, ctx)
          break
        case "Delay":
          state = computeDelayTerm(state as ComputingState<Delay>, ctx)
          break
        case "Error":
          state = computeErrorTerm(state as ComputingState<ErrorTerm>, ctx)
          break
        case "Force":
          state = computeForceTerm(state as ComputingState<Force>, ctx)
          break
        case "Lambda":
          state = computeLambdaTerm(state as ComputingState<Lambda>, ctx)
          break
        case "Var":
          state = computeVarTerm(state as ComputingState<Var>, ctx)
          break
        default:
          throw new Error(
            `Unhandled term kind '${(state.term as unknown as { _tag: string })._tag}'`
          )
      }
    } else if (state.kind == "reducing") {
      const f: Frame | undefined = state.frames.pop()

      if (f) {
        switch (f._tag) {
          case "CaseScrutineeFrame":
            state = reduceCaseScrutineeFrame(f, state)
            break
          case "ConstrArgFrame":
            state = reduceConstrArgFrame(f, state)
            break
          case "ForceFrame":
            state = reduceForceFrame(f, state, ctx)
            break
          case "LeftApplyToTermFrame":
            state = reduceLeftApplyToTermFrame(f, state)
            break
          case "LeftApplyToValueFrame":
            state = reduceLeftApplyToValueFrame(f, state, ctx)
            break
          case "RightApplyFrame":
            state = reduceRightApplyFrame(f, state, ctx)
            break
          default:
            throw new Error(
              `Unhandled frame type ${(f as unknown as { _tag: string })._tag}`
            )
        }
      } else {
        state = {
          kind: "success",
          value: state.value
        }
      }
    }
  }

  if (state.kind == "success") {
    return {
      value: Either.right(state.value),
      cost: {
        mem: tracker.mem,
        cpu: tracker.cpu
      },
      logs: logs,
      breakdown: tracker.breakdown,
      captured
    }
  } else if (state.kind == "error") {
    return {
      value: Either.left({
        error: state.message,
        callSites: state.stack.callSites
      }),
      cost: {
        mem: tracker.mem,
        cpu: tracker.cpu
      },
      logs: logs,
      breakdown: tracker.breakdown,
      captured
    }
  } else {
    throw new Error(`Internal error: unexpected final state ${state.kind}`)
  }
}

export { eval$ as eval }

export function evalWithCapture(
  entryPoint: Term,
  evalContext: Omit<EvalContext, "capture"> & { capture?: CaptureConfig | undefined }
): Result {
  return eval$(entryPoint, {
    ...evalContext,
    capture: evalContext.capture ?? {}
  })
}

function computeApplyTerm(
  { term, stack, frames }: ComputingState<Apply>,
  machineContext: MachineContext
): ComputingState {
  machineContext.cost.incrApplyCost()

  return {
    kind: "computing",
    term: term.fn,
    stack,
    frames: frames.concat([
      {
        _tag: "LeftApplyToTermFrame",
        arg: term.arg,
        stack,
        callSite: {
          sourceSpan: term.sourceSpan
        }
      } satisfies LeftApplyToTermFrame
    ])
  }
}

function computeBuiltinTerm(
  { term, frames }: ComputingState<BuiltinTerm>,
  ctx: MachineContext
): ReducingState {
  ctx.cost.incrBuiltinCost()

  return {
    kind: "reducing",
    value: {
      _tag: "Builtin",
      id: term.id,
      name: ctx.builtins[term.id]?.name ?? term.name,
      args: [],
      forceCount: 0 // TODO: count down instead of up
    },
    frames: frames
  }
}

function computeCaseTerm(
  { term, stack, frames }: ComputingState<Case>,
  ctx: MachineContext
): ComputingState {
  ctx.cost.incrCaseCost()

  return {
    kind: "computing",
    term: term.arg,
    stack,
    frames: frames.concat([
      {
        _tag: "CaseScrutineeFrame",
        cases: term.cases,
        stack
      } satisfies CaseScrutineeFrame
    ])
  }
}

function computeConstTerm(
  { term, frames }: ComputingState<Const>,
  ctx: MachineContext
): ReducingState {
  ctx.cost.incrConstCost()

  return {
    kind: "reducing",
    value: term,
    frames: frames
  }
}

function computeConstrTerm(
  { term, stack, frames }: ComputingState<Constr>,
  ctx: MachineContext
): State {
  ctx.cost.incrConstrCost()

  if (term.args.length == 0) {
    return {
      kind: "reducing",
      value: {
        _tag: "Constr",
        tag: term.tag,
        args: []
      },
      frames
    }
  } else {
    return {
      kind: "computing",
      term: term.args[0],
      stack,
      frames: frames.concat([
        {
          _tag: "ConstrArgFrame",
          tag: term.tag,
          evaluatedArgs: [],
          pendingArgs: term.args.slice(1),
          stack
        } satisfies ConstrArgFrame
      ])
    }
  }
}

function computeDelayTerm(
  { term, stack, frames }: ComputingState<Delay>,
  ctx: MachineContext
): ReducingState {
  ctx.cost.incrDelayCost()

  return {
    kind: "reducing",
    value: {
      _tag: "Delayed",
      term: term.arg,
      stack,
      name: term.name
    },
    frames
  }
}

function computeErrorTerm(
  { stack }: ComputingState<ErrorTerm>,
  ctx: MachineContext
): ErrorState {
  return {
    kind: "error",
    message: ctx.popLastMessage() ?? "",
    stack: stack
  }
}

function computeForceTerm(
  { term, stack, frames }: ComputingState<Force>,
  ctx: MachineContext
): ComputingState {
  ctx.cost.incrForceCost()

  return {
    kind: "computing",
    term: term.arg,
    stack,
    frames: frames.concat([
      {
        _tag: "ForceFrame",
        stack,
        callSite: {
          sourceSpan: term.sourceSpan
        }
      } satisfies ForceFrame
    ])
  }
}

function computeLambdaTerm(
  { term, stack, frames }: ComputingState<Lambda>,
  ctx: MachineContext
): ReducingState {
  ctx.cost.incrLambdaCost()

  return {
    kind: "reducing",
    value: {
      _tag: "Lambda",
      body: term.body,
      stack,
      argName: term.argName ?? undefined,
      name: term.name ?? undefined
    },
    frames
  }
}

function computeVarTerm(
  { term, stack, frames }: ComputingState<Var>,
  ctx: MachineContext
): State {
  ctx.cost.incrVarCost()

  const i: number = stack.values.length - term.index
  const v: Value | undefined = stack.values[i]

  if (v === undefined) {
    return {
      kind: "error",
      message: `var ${term.index} out of stack range (stack has ${stack.values.length} values)${term.name !== undefined ? `, '${term.name}'` : ""}`,
      stack
    }
  } else {
    return {
      kind: "reducing",
      value: v,
      frames
    }
  }
}

function reduceCaseScrutineeFrame(
  frame: CaseScrutineeFrame,
  { frames, value }: ReducingState
): State {
  if (value._tag == "Constr") {
    const tag = value.tag

    const c: Term | undefined = frame.cases[tag]

    if (c === undefined) {
      return {
        kind: "error",
        message: "constr id out of range",
        stack: frame.stack
      }
    }

    const callFrames = value.args.map(
      (a) =>
        ({
          _tag: "LeftApplyToValueFrame",
          rhs: a,
          stack: frame.stack,
          callSite: undefined
        }) satisfies LeftApplyToValueFrame
    )

    callFrames.reverse()

    return {
      kind: "computing",
      term: c,
      stack: frame.stack,
      // TODO: callSite
      frames: frames.concat(callFrames)
    }
  } else {
    return {
      kind: "error",
      message: "expected constr value case",
      stack: frame.stack
    }
  }
}

function reduceConstrArgFrame(
  frame: ConstrArgFrame,
  { frames, value }: ReducingState
): State {
  const evaluatedArgs = frame.evaluatedArgs.concat([value])

  if (frame.pendingArgs.length == 0) {
    return {
      kind: "reducing",
      value: {
        _tag: "Constr",
        tag: frame.tag,
        args: evaluatedArgs
      },
      frames
    }
  } else {
    return {
      kind: "computing",
      term: frame.pendingArgs[0],
      stack: frame.stack,
      frames: frames.concat([
        {
          _tag: "ConstrArgFrame",
          tag: frame.tag,
          evaluatedArgs,
          pendingArgs: frame.pendingArgs.slice(1),
          stack: frame.stack
        } satisfies ConstrArgFrame
      ])
    }
  }
}

/**
 * Only needed for debugging
 * Needed to add stack trace frames for variables like `self`
 * TODO: might introduce unnecessary overhead and thus require a flag to switch off
 * @param stack
 * @returns
 */
function getLastSelfValue(stack: Stack): Value | undefined {
  const last = stack.values[stack.values.length - 1]

  if (last?.name == "self") {
    return last
  } else {
    return undefined
  }
}

/**
 * @param stackWithValues
 * @param stackWithCallSites
 * @returns
 */
function mixStacks(stackWithValues: Stack, stackWithCallSites: Stack): Stack {
  return {
    values: stackWithValues.values,
    callSites: stackWithCallSites.callSites
  }
}

/**
 * @param callSite
 * @returns
 */
export function isEmptyCallSiteInfo(callSite: CallSite | undefined): boolean {
  return (
    callSite === undefined ||
    (callSite.sourceSpan === undefined &&
      callSite.functionName === undefined &&
      callSite.arguments === undefined)
  )
}

/**
 * @param callSite
 * @returns
 */
export function isNonEmptyCallSiteInfo(
  callSite: CallSite | undefined
): callSite is CallSite {
  return !isEmptyCallSiteInfo(callSite)
}

/**
 * @param stack
 * @param callSite
 * @returns
 */
function pushStackCallSite(
  stack: Stack,
  callSite: CallSite | undefined
): Stack {
  if (isNonEmptyCallSiteInfo(callSite)) {
    return {
      values: stack.values,
      callSites: stack.callSites.concat([callSite])
    }
  } else {
    return stack
  }
}

/**
 * @param stack
 * @param callSites
 * @returns
 */
export function pushStackCallSites(
  stack: Stack,
  ...callSites: CallSite[]
): Stack {
  return {
    values: stack.values,
    callSites: stack.callSites.concat(callSites.filter(isNonEmptyCallSiteInfo))
  }
}

/**
 * @param stack
 * @param value
 * @returns
 */
export function pushStackValue(stack: Stack, value: Value): Stack {
  return {
    values: stack.values.concat([value]),
    callSites: stack.callSites
  }
}

/**
 * @param stack
 * @param value
 * @param callSite
 * @returns
 */
export function pushStackValueAndCallSite(
  stack: Stack,
  value: Value,
  callSite: CallSite | undefined
): Stack {
  return {
    values: stack.values.concat([value]),
    callSites: stack.callSites.concat(
      isNonEmptyCallSiteInfo(callSite) ? [callSite] : []
    )
  }
}

/**
 * @param stack
 * @param value
 * @param callSites
 * @returns
 */
export function pushStackValueAndCallSites(
  stack: Stack,
  value: Value,
  ...callSites: CallSite[]
): Stack {
  return {
    values: stack.values.concat([value]),
    callSites: stack.callSites.concat(callSites)
  }
}

function reduceForceFrame(
  frame: ForceFrame,
  { frames, value }: ReducingState,
  ctx: MachineContext
): State {
  if (value._tag == "Delayed") {
    /**
     * TODO: cleaner way of getting `self` and other variables that are in the stacks of callbacks
     */
    const lastSelfValue: Value | undefined = getLastSelfValue(value.stack)

    return {
      kind: "computing",
      term: value.term,
      stack: mixStacks(
        value.stack,
        pushStackCallSite(
          frame.stack,
          frame.callSite?.sourceSpan
            ? {
                sourceSpan: frame.callSite?.sourceSpan,
                functionName: value.name,
                arguments: lastSelfValue ? [lastSelfValue] : undefined
              }
            : undefined
        )
      ),
      frames
    }
  } else if (value._tag == "Builtin") {
    const b: Builtin | undefined = ctx.builtins[value.id]

    if (b === undefined) {
      return {
        kind: "error",
        message: `builtin ${value.id} not found`,
        stack: frame.stack
      }
    } else if (value.forceCount >= b.forceCount) {
      return {
        kind: "error",
        message: `too many forces for builtin ${b.name}, ${
          value.forceCount + 1
        } > ${b.forceCount}`,
        stack: frame.stack
      }
    } else {
      return {
        kind: "reducing",
        value: {
          ...value,
          forceCount: value.forceCount + 1
        },
        frames
      }
    }
  } else {
    return {
      kind: "error",
      message: "expected delayed or builtin value for force",
      stack: frame.stack
    }
  }
}

/**
 * @param {CekFrame[]} frames
 * @param {CekValue} value - fn value
 * @param {CekContext} _ctx
 * @returns {CekState}
 */
function reduceLeftApplyToTermFrame(
  frame: LeftApplyToTermFrame,
  { frames, value }: ReducingState
): ComputingState {
  if (value._tag == "Lambda") {
    const mixedEnv = mixStacks(value.stack, frame.stack)
    return {
      kind: "computing",
      term: frame.arg,
      stack: frame.stack,
      frames: frames.concat([
        {
          _tag: "RightApplyFrame",
          fn: {
            ...value,
            stack: mixedEnv
          },
          stack: mixedEnv,
          info: {
            callSite: frame.callSite,
            name: value.name,
            argName: value.argName
          }
        } satisfies RightApplyFrame
      ])
    }
  } else {
    return {
      kind: "computing",
      term: frame.arg,
      stack: frame.stack,
      frames: frames.concat([
        {
          _tag: "RightApplyFrame",
          fn: value,
          stack: frame.stack,
          info: {
            callSite: frame.callSite
          }
        } satisfies RightApplyFrame
      ])
    }
  }
}

/**
 * If the `leftValue` is a lambda function, perform the following transition:
 *
 * $$
 * [\langle\text{lam}~x~M~\rho\rangle~V]
 * $$
 * @param frames
 * @param leftValue
 * @param rightValue
 * @param frameStack
 * @param ctx
 * @param machineContext
 * @param info
 * @returns
 */
function reduceApplyToFrame(
  frames: Frame[],
  leftValue: Value,
  rightValue: Value,
  frameStack: Stack,
  ctx: MachineContext,
  info: ApplyInfo = {}
): State {
  if (info.argName !== undefined) {
    rightValue = {
      ...rightValue,
      name: info.argName
    }

    if (ctx.capture !== undefined) {
      const capturePrefix = ctx.capture.prefix ?? "__helios_capture:"
      if (info.argName.startsWith(capturePrefix)) {
        ctx.captureValue(
          info.argName.slice(capturePrefix.length),
          rightValue,
          info.callSite
        )
      }
    }
  }

  if (leftValue._tag == "Lambda") {
    /**
     * TODO: cleaner way of getting `self` and other variables that are in the stacks of callbacks
     */
    const lastSelfValue: Value | undefined = getLastSelfValue(frameStack)

    const callSite: CallSite = {
      sourceSpan: info.callSite?.sourceSpan,
      functionName: info.name,
      arguments: lastSelfValue ? [lastSelfValue, rightValue] : [rightValue]
    }

    return {
      kind: "computing",
      term: leftValue.body,
      stack: pushStackValueAndCallSite(leftValue.stack, rightValue, callSite),
      frames
    }
  } else if (leftValue._tag == "Builtin") {
    const b: Builtin | undefined = ctx.builtins[leftValue.id]

    if (b === undefined) {
      return {
        kind: "error",
        message: `builtin ${leftValue.id} not found`,
        stack: frameStack
      }
    } else if (b.forceCount > leftValue.forceCount) {
      return {
        kind: "error",
        message: `insufficient forces applied to ${b.name}, ${leftValue.forceCount} < ${b.forceCount}`,
        stack: frameStack
      }
    } else {
      const args = leftValue.args.concat([rightValue])

      if (args.length == b.nArgs) {
        ctx.cost.incrArgSizesCost(
          b.name,
          args.map((a) => {
            if ("value" in a) {
              return memSize(a.value)
            } else {
              return 1
            }
          })
        )

        const callSites: CallSite[] = args.map((a, i) => {
          if (i == args.length - 1) {
            return {
              site: info.callSite,
              functionName: b.name,
              argument: a
            }
          } else {
            return {
              argument: a
            }
          }
        })

        const callResult = b.call(args, {
          ...ctx,
          print: (message: string) => {
            ctx.print(message, info.callSite)
          }
        })

        if (callResult._tag == "Left") {
          return {
            kind: "error",
            message:
              (callResult.left.message ?? callResult.left._tag) +
              ` (in ${b.name})`,
            stack: pushStackCallSites(frameStack, ...callSites)
          }
        } else {
          return {
            kind: "reducing",
            value: callResult.right,
            frames
          }
        }
      } else {
        return {
          kind: "reducing",
          value: {
            _tag: "Builtin",
            id: leftValue.id,
            name: leftValue.name,
            forceCount: b.forceCount,
            args: args
          },
          frames
        }
      }
    }
  } else {
    return {
      kind: "error",
      message: `can only call lambda or builtin terms`,
      stack: frameStack
    }
  }
}

function reduceLeftApplyToValueFrame(
  frame: LeftApplyToValueFrame,
  { frames, value }: ReducingState,
  ctx: MachineContext
): State {
  return reduceApplyToFrame(frames, value, frame.rhs, frame.stack, ctx, {
    callSite: frame.callSite
  })
}

/**
 * @param frames
 * @param value
 * @param ctx
 * @returns
 */
function reduceRightApplyFrame(
  frame: RightApplyFrame,
  { frames, value }: ReducingState,
  ctx: MachineContext
): State {
  return reduceApplyToFrame(
    frames,
    frame.fn,
    value,
    frame.stack,
    ctx,
    frame.info
  )
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
