import type { Context, Value } from "./Cek.js"
import * as Cost from "./Cost.js"

export type Builtin = {
  name: string
  cpuModel: Cost.Function
  memModel: Cost.Function
  forceCount: number
  nArgs: number
  call(args: Value[], ctx: Context): Value // not Effectful to avoid overhead
}

export const addIntegerV1: Builtin = /* @__PURE__ */ {
  name: "addInteger",
  forceCount: 0,
  nArgs: 2,
  cpuModel: Cost.LargestArg(1, 0),
  memModel: Cost.LargestArg(3, 2),
  call: ([a, b]: Value[], _ctx: Context) => {
    if (a._tag != "Const") {
      throw new Error(`expected Const for 1st argument, got ${a._tag}`)
    }

    if (typeof a.value != "bigint") {
      throw new Error(`expected integer for 1st argument, got ${a.value}`)
    }

    if (b._tag != "Const") {
      throw new Error(`expected Const for 2nd argument, got ${b._tag}`)
    }

    if (typeof b.value != "bigint") {
      throw new Error(`expected integer for 2nd argument, got ${b.value}`)
    }

    return {
      _tag: "Const",
      value: a.value + b.value
    }
  }
}

export const subtractIntegerV1: Builtin = /* @__PURE__ */ {
  name: "subtractInteger",
  forceCount: 0,
  nArgs: 2,
  cpuModel: Cost.LargestArg(146, 145),
  memModel: Cost.LargestArg(148, 147),
  call: ([a, b]: Value[], _ctx: Context) => {
    if (a._tag != "Const") {
      throw new Error(`expected Const for 1st argument, got ${a._tag}`)
    }

    if (typeof a.value != "bigint") {
      throw new Error(`expected integer for 1st argument, got ${a.value}`)
    }

    if (b._tag != "Const") {
      throw new Error(`expected Const for 2nd argument, got ${b._tag}`)
    }

    if (typeof b.value != "bigint") {
      throw new Error(`expected integer for 2nd argument, got ${b.value}`)
    }

    return {
      _tag: "Const",
      value: a.value - b.value
    }
  }
}

export const multiplyIntegerV1: Builtin = /* @__PURE__ */ {
  name: "multiplyInteger",
  forceCount: 0,
  nArgs: 2,
  cpuModel: Cost.ArgsSum(116, 115),
  memModel: Cost.ArgsSum(118, 117),
  call: ([a, b]: Value[], _ctx: Context) => {
    if (a._tag != "Const") {
      throw new Error(`expected Const for 1st argument, got ${a._tag}`)
    }

    if (typeof a.value != "bigint") {
      throw new Error(`expected integer for 1st argument, got ${a.value}`)
    }

    if (b._tag != "Const") {
      throw new Error(`expected Const for 2nd argument, got ${b._tag}`)
    }

    if (typeof b.value != "bigint") {
      throw new Error(`expected integer for 2nd argument, got ${b.value}`)
    }

    return {
      _tag: "Const",
      value: a.value * b.value
    }
  }
}

export const multiplyIntegerV2: Builtin = /* @__PURE__ */ {
  ...multiplyIntegerV1,
  cpuModel: Cost.ArgsProd(116, 115)
}

export const multiplyIntegerV3: Builtin = /* @__PURE__ */ {
  ...multiplyIntegerV1,
  cpuModel: Cost.ArgsSum(125, 124),
  memModel: Cost.ArgsSum(127, 126)
}

export const V1: Builtin[] = [
  addIntegerV1, // 0
  subtractIntegerV1, // 1
  multiplyIntegerV1 // 2
]

export const V2: Builtin[] = [
  addIntegerV1, // 0
  subtractIntegerV1, // 1
  multiplyIntegerV2 // 2
]

export const V3: Builtin[] = [
  addIntegerV1, // 0
  subtractIntegerV1, // 1
  multiplyIntegerV3 // 2
]
