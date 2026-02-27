import { Data, Either, Encoding } from "effect"
import * as Bytes from "../../Codecs/Bytes.js"
import * as Utf8 from "../../Codecs/Utf8.js"
import * as Crypto from "../../Crypto/index.js"
import type { MachineContext, Value as CekValue } from "./Cek.js"
import * as Cost from "./Cost.js"
import { toString as dataToString, encode as encodeData } from "./Data.js"
import * as Type from "./Type.js"
import * as Value from "./Value.js"

export class WrongArgType extends Data.TaggedError(
  "Uplc.Builtins.WrongArgType"
)<{ message: string }> {
  constructor(argIndex: number, expected: string, actual: string) {
    super({
      message: `expected ${expected} for arg ${argIndex + 1}, got ${actual}`
    })
  }
}

export class DivisionByZero extends Data.TaggedError(
  "Uplc.Builtins.DivisionByZero"
)<{ message: string }> {
  constructor(fnName: string) {
    super({ message: `division by 0 in ${fnName}` })
  }
}

export class OutOfRange extends Data.TaggedError("Uplc.Builtins.OutOfRange")<{
  message: string
}> {
  constructor(containerSize: number, index: number) {
    super({
      message: `index out of range (container has ${containerSize}, but tried to index item ${index})`
    })
  }
}

export class InvalidLength extends Data.TaggedError(
  "Uplc.Builtin.InvalidLength"
)<{ message: string }> {
  constructor(
    fnName: string,
    argName: string,
    expected: number,
    actual: number
  ) {
    super({
      message: `expected arg '${argName}' of '${fnName}' to be ${expected} long, but got ${actual} long`
    })
  }
}

export type Builtin = {
  name: string
  cpuModel: Cost.Function
  memModel: Cost.Function
  forceCount: number
  nArgs: number
  call(
    args: CekValue[],
    ctx: MachineContext
  ): Either.Either<
    CekValue,
    | WrongArgType
    | DivisionByZero
    | OutOfRange
    | InvalidLength
    | Encoding.DecodeException
  >
}

export const addIntegerV1: Builtin = {
  name: "addInteger",
  forceCount: 0,
  nArgs: 2,
  cpuModel: Cost.Linear(0, 1)(Cost.Max),
  memModel: Cost.Linear(2, 3)(Cost.Max),
  call: ([a, b]: CekValue[]) => {
    if (a === undefined) {
      throw new Error("a is undefined in addInteger()")
    }

    if (b === undefined) {
      throw new Error("b is undefined in addInteger")
    }

    if (a._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", a._tag))
    }

    if (typeof a.value != "bigint") {
      return Either.left(
        new WrongArgType(0, "integer", Value.describeType(a.value))
      )
    }

    if (b._tag != "Const") {
      return Either.left(new WrongArgType(1, "Const", b._tag))
    }

    if (typeof b.value != "bigint") {
      return Either.left(
        new WrongArgType(1, "integer", Value.describeType(b.value))
      )
    }

    return Either.right({
      _tag: "Const",
      value: a.value + b.value
    })
  }
}

export const subtractIntegerV1: Builtin = {
  name: "subtractInteger",
  forceCount: 0,
  nArgs: 2,
  cpuModel: Cost.Linear(145, 146)(Cost.Max),
  memModel: Cost.Linear(147, 148)(Cost.Max),
  call: ([a, b]: CekValue[]) => {
    if (a === undefined) {
      throw new Error("a is undefined in subtractInteger()")
    }

    if (b === undefined) {
      throw new Error("b is undefined in subtractInteger()")
    }

    if (a._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", a._tag))
    }

    if (typeof a.value != "bigint") {
      return Either.left(
        new WrongArgType(0, "integer", Value.describeType(a.value))
      )
    }

    if (b._tag != "Const") {
      return Either.left(new WrongArgType(1, "Const", b._tag))
    }

    if (typeof b.value != "bigint") {
      return Either.left(
        new WrongArgType(1, "integer", Value.describeType(b.value))
      )
    }

    return Either.right({
      _tag: "Const",
      value: a.value - b.value
    })
  }
}

export const subtractIntegerV2: Builtin = {
  ...subtractIntegerV1,
  cpuModel: Cost.Linear(149, 150)(Cost.Max),
  memModel: Cost.Linear(151, 152)(Cost.Max)
}

export const subtractIntegerV3: Builtin = {
  ...subtractIntegerV1,
  cpuModel: Cost.Linear(167, 168)(Cost.Max),
  memModel: Cost.Linear(169, 170)(Cost.Max)
}

export const multiplyIntegerV1: Builtin = {
  name: "multiplyInteger",
  forceCount: 0,
  nArgs: 2,
  cpuModel: Cost.Linear(115, 116)(Cost.Sum),
  memModel: Cost.Linear(117, 118)(Cost.Sum),
  call: ([a, b]: CekValue[]) => {
    if (a === undefined) {
      throw new Error("a is undefined in multiplyInteger()")
    }

    if (b === undefined) {
      throw new Error("b is undefined in multiplyInteger()")
    }

    if (a._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", a._tag))
    }

    if (typeof a.value != "bigint") {
      return Either.left(
        new WrongArgType(0, "integer", Value.describeType(a.value))
      )
    }

    if (b._tag != "Const") {
      return Either.left(new WrongArgType(1, "Const", b._tag))
    }

    if (typeof b.value != "bigint") {
      return Either.left(
        new WrongArgType(1, "integer", Value.describeType(b.value))
      )
    }

    return Either.right({
      _tag: "Const",
      value: a.value * b.value
    })
  }
}

export const multiplyIntegerV2: Builtin = {
  ...multiplyIntegerV1,
  cpuModel: Cost.Linear(115, 116)(Cost.Prod),
  memModel: Cost.Linear(117, 118)(Cost.Sum)
}

export const multiplyIntegerV3: Builtin = {
  ...multiplyIntegerV1,
  cpuModel: Cost.Linear(124, 125)(Cost.Sum),
  memModel: Cost.Linear(126, 127)(Cost.Sum)
}

export const divideIntegerV1: Builtin = {
  name: "divideInteger",
  forceCount: 0,
  nArgs: 2,
  cpuModel: Cost.ConstantBelowDiag(49)(Cost.Linear(50, 51)(Cost.Prod)),
  memModel: Cost.AtLeast(53)(Cost.Diff),
  call: ([a, b]: CekValue[]) => {
    if (a === undefined) {
      throw new Error("a is undefined in divideInteger()")
    }

    if (b === undefined) {
      throw new Error("b is undefined in divideInteger()")
    }

    if (a._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", a._tag))
    }

    if (typeof a.value != "bigint") {
      return Either.left(
        new WrongArgType(0, "integer", Value.describeType(a.value))
      )
    }

    if (b._tag != "Const") {
      return Either.left(new WrongArgType(1, "Const", b._tag))
    }

    if (typeof b.value != "bigint") {
      return Either.left(
        new WrongArgType(1, "integer", Value.describeType(b.value))
      )
    }

    return evalDivide(a.value, b.value).pipe(
      Either.map((result) => ({ _tag: "Const", value: result }))
    )
  }
}

export function evalDivide(
  x: bigint,
  y: bigint
): Either.Either<bigint, DivisionByZero> {
  if (y === 0n) {
    return Either.left(new DivisionByZero("divideInteger"))
  }

  // correctly truncate
  return Either.right(x / y - (x % y != 0n && x < 0n != y < 0n ? 1n : 0n))
}

export const divideIntegerV3: Builtin = {
  ...divideIntegerV1,
  cpuModel: Cost.ConstantBelowDiag(49)(
    Cost.AtLeast(56)(
      Cost.QuadXY({ c00: 50, c01: 51, c02: 52, c10: 53, c11: 54, c20: 55 })
    )
  ),
  memModel: Cost.AtLeast(58)(Cost.Diff)
}

export const quotientIntegerV1: Builtin = {
  name: "quotientInteger",
  forceCount: 0,
  nArgs: 2,
  cpuModel: Cost.ConstantBelowDiag(121)(Cost.Linear(122, 123)(Cost.Prod)),
  memModel: Cost.AtLeast(125)(Cost.Diff),
  call: ([a, b]: CekValue[]) => {
    if (a === undefined) {
      throw new Error("a is undefined in quotientInteger()")
    }

    if (b === undefined) {
      throw new Error("b is undefined in quotientInteger()")
    }

    if (a._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", a._tag))
    }

    if (typeof a.value != "bigint") {
      return Either.left(
        new WrongArgType(0, "integer", Value.describeType(a.value))
      )
    }

    if (b._tag != "Const") {
      return Either.left(new WrongArgType(1, "Const", b._tag))
    }

    if (typeof b.value != "bigint") {
      return Either.left(
        new WrongArgType(1, "integer", Value.describeType(b.value))
      )
    }

    return evalQuotient(a.value, b.value).pipe(
      Either.map((result) => ({ _tag: "Const", value: result }))
    )
  }
}

export function evalQuotient(
  x: bigint,
  y: bigint
): Either.Either<bigint, DivisionByZero> {
  if (y === 0n) {
    return Either.left(new DivisionByZero("quotientInteger"))
  }

  return Either.right(x / y)
}

export const quotientIntegerV3: Builtin = {
  ...quotientIntegerV1,
  cpuModel: Cost.ConstantBelowDiag(130)(
    Cost.AtLeast(137)(
      Cost.QuadXY({
        c00: 131,
        c01: 132,
        c02: 133,
        c10: 134,
        c11: 135,
        c20: 136
      })
    )
  ),
  memModel: Cost.AtLeast(139)(Cost.Diff)
}

export const remainderIntegerV1: Builtin = {
  name: "remainderInteger",
  forceCount: 0,
  nArgs: 2,
  cpuModel: Cost.ConstantBelowDiag(127)(Cost.Linear(128, 129)(Cost.Prod)),
  memModel: Cost.AtLeast(131)(Cost.Diff),
  call: ([a, b]: CekValue[]) => {
    if (a === undefined) {
      throw new Error("a is undefined in remainderInteger()")
    }

    if (b === undefined) {
      throw new Error("b is undefined in remainderInteger()")
    }

    if (a._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", a._tag))
    }

    if (typeof a.value != "bigint") {
      return Either.left(
        new WrongArgType(0, "integer", Value.describeType(a.value))
      )
    }

    if (b._tag != "Const") {
      return Either.left(new WrongArgType(1, "Const", b._tag))
    }

    if (typeof b.value != "bigint") {
      return Either.left(
        new WrongArgType(1, "integer", Value.describeType(b.value))
      )
    }

    return evalRemainder(a.value, b.value).pipe(
      Either.map((result) => ({ _tag: "Const", value: result }))
    )
  }
}

export function evalRemainder(
  x: bigint,
  y: bigint
): Either.Either<bigint, DivisionByZero> {
  if (y === 0n) {
    return Either.left(new DivisionByZero("remainderInteger"))
  }

  return Either.right(x % y)
}

export const remainderIntegerV3: Builtin = {
  ...remainderIntegerV1,
  cpuModel: Cost.ConstantBelowDiag(141)(
    Cost.AtLeast(148)(
      Cost.QuadXY({
        c00: 142,
        c01: 143,
        c02: 144,
        c10: 145,
        c11: 146,
        c20: 147
      })
    )
  ),
  memModel: Cost.Linear(149, 150)(Cost.Second)
}

export const modIntegerV1: Builtin = {
  name: "modInteger",
  forceCount: 0,
  nArgs: 2,
  cpuModel: Cost.ConstantBelowDiag(109)(Cost.Linear(110, 111)(Cost.Prod)),
  memModel: Cost.AtLeast(113)(Cost.Diff),
  call: ([a, b]: CekValue[]) => {
    if (a === undefined) {
      throw new Error("a is undefined in modInteger()")
    }

    if (b === undefined) {
      throw new Error("b is undefined in modInteger()")
    }

    if (a._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", a._tag))
    }

    if (typeof a.value != "bigint") {
      return Either.left(
        new WrongArgType(0, "integer", Value.describeType(a.value))
      )
    }

    if (b._tag != "Const") {
      return Either.left(new WrongArgType(1, "Const", b._tag))
    }

    if (typeof b.value != "bigint") {
      return Either.left(
        new WrongArgType(1, "integer", Value.describeType(b.value))
      )
    }

    return evalMod(a.value, b.value).pipe(
      Either.map((result) => ({ _tag: "Const", value: result }))
    )
  }
}

export function evalMod(
  x: bigint,
  y: bigint
): Either.Either<bigint, DivisionByZero> {
  if (y === 0n) {
    return Either.left(new DivisionByZero("modInteger"))
  }

  const m = x % y

  if (y > 0 && m < 0) {
    return Either.right(m + y)
  } else if (y < 0 && m > 0) {
    return Either.right(m + y)
  } else {
    return Either.right(m)
  }
}

export const modIntegerV3: Builtin = {
  ...modIntegerV1,
  cpuModel: Cost.ConstantBelowDiag(114)(
    Cost.AtLeast(121)(
      Cost.QuadXY({
        c00: 115,
        c01: 116,
        c02: 117,
        c10: 118,
        c11: 119,
        c20: 120
      })
    )
  ),
  memModel: Cost.Linear(122, 123)(Cost.Second)
}

export const equalsIntegerV1: Builtin = {
  name: "equalsInteger",
  forceCount: 0,
  nArgs: 2,
  cpuModel: Cost.Linear(66, 67)(Cost.Min),
  memModel: Cost.Constant(68),
  call: ([a, b]: CekValue[]) => {
    if (a === undefined) {
      throw new Error("a is undefined in equalsInteger()")
    }

    if (b === undefined) {
      throw new Error("b is undefined in equalsInteger()")
    }

    if (a._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", a._tag))
    }

    if (typeof a.value != "bigint") {
      return Either.left(
        new WrongArgType(0, "integer", Value.describeType(a.value))
      )
    }

    if (b._tag != "Const") {
      return Either.left(new WrongArgType(1, "Const", b._tag))
    }

    if (typeof b.value != "bigint") {
      return Either.left(
        new WrongArgType(1, "integer", Value.describeType(b.value))
      )
    }

    return Either.right({
      _tag: "Const",
      value: a.value === b.value
    })
  }
}

export const equalsIntegerV3: Builtin = {
  ...equalsIntegerV1,
  cpuModel: Cost.Linear(71, 72)(Cost.Min),
  memModel: Cost.Constant(73)
}

export const lessThanIntegerV1: Builtin = {
  name: "lessThanInteger",
  forceCount: 0,
  nArgs: 2,
  cpuModel: Cost.Linear(94, 95)(Cost.Min),
  memModel: Cost.Constant(96),
  call: ([a, b]: CekValue[]) => {
    if (a === undefined) {
      throw new Error("a is undefined in lessThanInteger()")
    }

    if (b === undefined) {
      throw new Error("b is undefined in lessThanInteger()")
    }

    if (a._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", a._tag))
    }

    if (typeof a.value != "bigint") {
      return Either.left(
        new WrongArgType(0, "integer", Value.describeType(a.value))
      )
    }

    if (b._tag != "Const") {
      return Either.left(new WrongArgType(1, "Const", b._tag))
    }

    if (typeof b.value != "bigint") {
      return Either.left(
        new WrongArgType(1, "integer", Value.describeType(b.value))
      )
    }

    return Either.right({
      _tag: "Const",
      value: a.value < b.value
    })
  }
}

export const lessThanIntegerV3: Builtin = {
  ...lessThanIntegerV1,
  cpuModel: Cost.Linear(99, 100)(Cost.Min),
  memModel: Cost.Constant(101)
}

export const lessThanEqualsIntegerV1: Builtin = {
  name: "lessThanEqualsInteger",
  forceCount: 0,
  nArgs: 2,
  cpuModel: Cost.Linear(91, 92)(Cost.Min),
  memModel: Cost.Constant(93),
  call: ([a, b]: CekValue[]) => {
    if (a === undefined) {
      throw new Error("a is undefined in lessThanEqualsInteger()")
    }

    if (b === undefined) {
      throw new Error("b is undefined in lessThanEqualsInteger()")
    }

    if (a._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", a._tag))
    }

    if (typeof a.value != "bigint") {
      return Either.left(
        new WrongArgType(0, "integer", Value.describeType(a.value))
      )
    }

    if (b._tag != "Const") {
      return Either.left(new WrongArgType(1, "Const", b._tag))
    }

    if (typeof b.value != "bigint") {
      return Either.left(
        new WrongArgType(1, "integer", Value.describeType(b.value))
      )
    }

    return Either.right({
      _tag: "Const",
      value: a.value <= b.value
    })
  }
}

export const lessThanEqualsIntegerV3: Builtin = {
  ...lessThanEqualsIntegerV1,
  cpuModel: Cost.Linear(96, 97)(Cost.Min),
  memModel: Cost.Constant(98)
}

export const appendByteStringV1: Builtin = {
  name: "appendByteString",
  forceCount: 0,
  nArgs: 2,
  cpuModel: Cost.Linear(4, 5)(Cost.Sum),
  memModel: Cost.Linear(6, 7)(Cost.Sum),
  call: ([a, b]: CekValue[]) => {
    if (a === undefined) {
      throw new Error("a is undefined in appendByteString()")
    }

    if (b === undefined) {
      throw new Error("b is undefined in appendByteString()")
    }

    if (a._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", a._tag))
    }

    if (!(a.value instanceof Uint8Array)) {
      return Either.left(
        new WrongArgType(0, "bytes", Value.describeType(a.value))
      )
    }

    if (b._tag != "Const") {
      return Either.left(new WrongArgType(1, "Const", b._tag))
    }

    if (!(b.value instanceof Uint8Array)) {
      return Either.left(
        new WrongArgType(1, "bytes", Value.describeType(b.value))
      )
    }

    return Either.right({
      _tag: "Const",
      value: Bytes.concat(a.value, b.value)
    })
  }
}

export const consByteStringV1: Builtin = {
  name: "consByteString",
  forceCount: 0,
  nArgs: 2,
  cpuModel: Cost.Linear(39, 40)(Cost.Second),
  memModel: Cost.Linear(41, 42)(Cost.Sum),
  call: ([a, b]: CekValue[]) => {
    if (a === undefined) {
      throw new Error("a is undefined in consByteString()")
    }

    if (b === undefined) {
      throw new Error("b is undefined in consByteString()")
    }

    if (a._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", a._tag))
    }

    if (typeof a.value != "bigint") {
      return Either.left(
        new WrongArgType(0, "integer", Value.describeType(a.value))
      )
    }

    if (b._tag != "Const") {
      return Either.left(new WrongArgType(1, "Const", b._tag))
    }

    if (!(b.value instanceof Uint8Array)) {
      return Either.left(
        new WrongArgType(1, "bytes", Value.describeType(b.value))
      )
    }

    return Either.right({
      _tag: "Const",
      value: Bytes.concat([Number(a.value % 256n)], b.value)
    })
  }
}

export const sliceByteStringV1: Builtin = {
  name: "sliceByteString",
  forceCount: 0,
  nArgs: 3,
  cpuModel: Cost.Linear(139, 140)(Cost.Third),
  memModel: Cost.Linear(141, 142)(Cost.Third),
  call: ([a, b, c]: CekValue[]) => {
    if (a === undefined) {
      throw new Error("a is undefined in sliceByteString()")
    }

    if (b === undefined) {
      throw new Error("b is undefined in sliceByteString()")
    }

    if (c === undefined) {
      throw new Error("c is undefined in sliceByteString()")
    }

    if (a._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", a._tag))
    }

    if (typeof a.value != "bigint") {
      return Either.left(
        new WrongArgType(0, "integer", Value.describeType(a.value))
      )
    }

    if (b._tag != "Const") {
      return Either.left(new WrongArgType(1, "Const", b._tag))
    }

    if (typeof b.value != "bigint") {
      return Either.left(
        new WrongArgType(1, "integer", Value.describeType(b.value))
      )
    }

    if (c._tag != "Const") {
      return Either.left(new WrongArgType(2, "Const", c._tag))
    }

    if (!(c.value instanceof Uint8Array)) {
      return Either.left(
        new WrongArgType(2, "bytes", Value.describeType(c.value))
      )
    }

    const bytes = c.value
    const start = Math.max(Number(a.value), 0)
    const end = Math.min(start + Number(b.value) - 1, bytes.length - 1)

    const res = end < start ? new Uint8Array([]) : bytes.slice(start, end + 1)

    return Either.right({
      _tag: "Const",
      value: res
    })
  }
}

export const sliceByteStringV2: Builtin = {
  ...sliceByteStringV1,
  cpuModel: Cost.Linear(143, 144)(Cost.Third),
  memModel: Cost.Linear(145, 146)(Cost.Third)
}

export const sliceByteStringV3: Builtin = {
  ...sliceByteStringV1,
  cpuModel: Cost.Linear(161, 162)(Cost.Third),
  memModel: Cost.Linear(163, 164)(Cost.Third)
}

export const lengthOfByteStringV1: Builtin = {
  name: "lengthOfByteString",
  forceCount: 0,
  nArgs: 1,
  cpuModel: Cost.Constant(83),
  memModel: Cost.Constant(84),
  call: ([a]: CekValue[]) => {
    if (a === undefined) {
      throw new Error("a is undefined in lengthOfByteString()")
    }

    if (a._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", a._tag))
    }

    if (!(a.value instanceof Uint8Array)) {
      return Either.left(
        new WrongArgType(0, "bytes", Value.describeType(a.value))
      )
    }

    return Either.right({
      _tag: "Const",
      value: BigInt(a.value.length)
    })
  }
}

export const lengthOfByteStringV3: Builtin = {
  ...lengthOfByteStringV1,
  cpuModel: Cost.Constant(88),
  memModel: Cost.Constant(89)
}

export const indexByteStringV1: Builtin = {
  name: "indexByteString",
  forceCount: 0,
  nArgs: 2,
  cpuModel: Cost.Constant(81),
  memModel: Cost.Constant(82),
  call: ([a, b]: CekValue[]) => {
    if (a === undefined) {
      throw new Error("a is undefined in indexByteString()")
    }

    if (b === undefined) {
      throw new Error("b is undefined in indexByteString()")
    }

    if (a._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", a._tag))
    }

    if (!(a.value instanceof Uint8Array)) {
      return Either.left(
        new WrongArgType(0, "bytes", Value.describeType(a.value))
      )
    }

    if (b._tag != "Const") {
      return Either.left(new WrongArgType(1, "Const", b._tag))
    }

    if (typeof b.value != "bigint") {
      return Either.left(
        new WrongArgType(1, "integer", Value.describeType(b.value))
      )
    }

    const bytes = a.value
    const i = Number(b.value)

    if (i < 0 || i >= bytes.length) {
      return Either.left(new OutOfRange(bytes.length, i))
    }

    return Either.right({
      _tag: "Const",
      value: BigInt(bytes[i])
    })
  }
}

export const indexByteStringV3: Builtin = {
  ...indexByteStringV1,
  cpuModel: Cost.Constant(86),
  memModel: Cost.Constant(87)
}

export const equalsByteStringV1: Builtin = {
  name: "equalsByteString",
  forceCount: 0,
  nArgs: 2,
  cpuModel: Cost.ConstantOffDiag(59)(Cost.Linear(60, 61)(Cost.First)),
  memModel: Cost.Constant(62),
  call: ([a, b]: CekValue[]) => {
    if (a === undefined) {
      throw new Error("a is undefined in equalsByteString()")
    }

    if (b === undefined) {
      throw new Error("b is undefined in equalsByteString()")
    }

    if (a._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", a._tag))
    }

    if (!(a.value instanceof Uint8Array)) {
      return Either.left(
        new WrongArgType(0, "bytes", Value.describeType(a.value))
      )
    }

    if (b._tag != "Const") {
      return Either.left(new WrongArgType(1, "Const", b._tag))
    }

    if (!(b.value instanceof Uint8Array)) {
      return Either.left(
        new WrongArgType(1, "bytes", Value.describeType(b.value))
      )
    }

    return Either.right({
      _tag: "Const",
      value: Bytes.equals(a.value, b.value)
    })
  }
}

export const equalsByteStringV3: Builtin = {
  ...equalsByteStringV1,
  cpuModel: Cost.ConstantOffDiag(64)(Cost.Linear(65, 66)(Cost.First)),
  memModel: Cost.Constant(67)
}

export const lessThanByteStringV1: Builtin = {
  name: "lessThanByteString",
  forceCount: 0,
  nArgs: 2,
  cpuModel: Cost.Linear(85, 86)(Cost.Min),
  memModel: Cost.Constant(87),
  call: ([a, b]: CekValue[]) => {
    if (a === undefined) {
      throw new Error("a is undefined in lessThanByteString()")
    }

    if (b === undefined) {
      throw new Error("b is undefined in lessThanByteString()")
    }

    if (a._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", a._tag))
    }

    if (!(a.value instanceof Uint8Array)) {
      return Either.left(
        new WrongArgType(0, "bytes", Value.describeType(a.value))
      )
    }

    if (b._tag != "Const") {
      return Either.left(new WrongArgType(1, "Const", b._tag))
    }

    if (!(b.value instanceof Uint8Array)) {
      return Either.left(
        new WrongArgType(1, "bytes", Value.describeType(b.value))
      )
    }

    return Either.right({
      _tag: "Const",
      value: Bytes.compare(a.value, b.value) == -1
    })
  }
}

export const lessThanByteStringV3: Builtin = {
  ...lessThanByteStringV1,
  cpuModel: Cost.Linear(90, 91)(Cost.Min),
  memModel: Cost.Constant(92)
}

export const lessThanEqualsByteStringV1: Builtin = {
  name: "lessThanEqualsByteString",
  forceCount: 0,
  nArgs: 2,
  cpuModel: Cost.Linear(88, 89)(Cost.Min),
  memModel: Cost.Constant(90),
  call: ([a, b]: CekValue[]) => {
    if (a === undefined) {
      throw new Error("a is undefined in lessThanEqualsByteString()")
    }

    if (b === undefined) {
      throw new Error("b is undefined in lessThanEqualsByteString()")
    }

    if (a._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", a._tag))
    }

    if (!(a.value instanceof Uint8Array)) {
      return Either.left(
        new WrongArgType(0, "bytes", Value.describeType(a.value))
      )
    }

    if (b._tag != "Const") {
      return Either.left(new WrongArgType(1, "Const", b._tag))
    }

    if (!(b.value instanceof Uint8Array)) {
      return Either.left(
        new WrongArgType(1, "bytes", Value.describeType(b.value))
      )
    }

    return Either.right({
      _tag: "Const",
      value: Bytes.compare(a.value, b.value) <= 0
    })
  }
}

export const lessThanEqualsByteStringV3: Builtin = {
  ...lessThanEqualsByteStringV1,
  cpuModel: Cost.Linear(90, 91)(Cost.Min),
  memModel: Cost.Constant(92)
}

export const sha2_256V1: Builtin = {
  name: "sha2_256",
  forceCount: 0,
  nArgs: 1,
  cpuModel: Cost.Linear(133, 134)(Cost.First),
  memModel: Cost.Constant(135),
  call: ([a]: CekValue[]) => {
    if (a === undefined) {
      throw new Error("a is undefined in sha2_256()")
    }

    if (a._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", a._tag))
    }

    if (!(a.value instanceof Uint8Array)) {
      return Either.left(
        new WrongArgType(0, "bytes", Value.describeType(a.value))
      )
    }

    return Either.right({
      _tag: "Const",
      value: Crypto.Sha2_256.hashSync(a.value)
    })
  }
}

export const sha2_256V2: Builtin = {
  ...sha2_256V1,
  cpuModel: Cost.Linear(137, 138)(Cost.First),
  memModel: Cost.Constant(139)
}

export const sha2_256V3: Builtin = {
  ...sha2_256V1,
  cpuModel: Cost.Linear(155, 156)(Cost.First),
  memModel: Cost.Constant(157)
}

export const sha3_256V1: Builtin = {
  name: "sha3_256",
  forceCount: 0,
  nArgs: 1,
  cpuModel: Cost.Linear(136, 137)(Cost.First),
  memModel: Cost.Constant(138),
  call: ([a]: CekValue[]) => {
    if (a === undefined) {
      throw new Error("a is undefined in sha3_256()")
    }

    if (a._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", a._tag))
    }

    if (!(a.value instanceof Uint8Array)) {
      return Either.left(
        new WrongArgType(0, "bytes", Value.describeType(a.value))
      )
    }

    return Either.right({
      _tag: "Const",
      value: Crypto.Sha3_256.hashSync(a.value)
    })
  }
}

export const sha3_256V2: Builtin = {
  ...sha3_256V1,
  cpuModel: Cost.Linear(140, 141)(Cost.First),
  memModel: Cost.Constant(142)
}

export const sha3_256V3: Builtin = {
  ...sha3_256V1,
  cpuModel: Cost.Linear(158, 159)(Cost.First),
  memModel: Cost.Constant(160)
}

export const blake2b_256V1: Builtin = {
  name: "blake2b_256",
  forceCount: 0,
  nArgs: 1,
  cpuModel: Cost.Linear(14, 15)(Cost.First),
  memModel: Cost.Constant(16),
  call: ([a]: CekValue[]) => {
    if (a === undefined) {
      throw new Error("a is undefined in blake2b_256()")
    }

    if (a._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", a._tag))
    }

    if (!(a.value instanceof Uint8Array)) {
      return Either.left(
        new WrongArgType(0, "bytes", Value.describeType(a.value))
      )
    }

    return Either.right({
      _tag: "Const",
      value: Crypto.Blake2b.hashSync(a.value)
    })
  }
}

export const verifyEd25519SignatureV1: Builtin = {
  name: "verifyEd25519Signature",
  forceCount: 0,
  nArgs: 3,
  cpuModel: Cost.Linear(163, 164)(Cost.Third),
  memModel: Cost.Constant(165),
  call: ([pk, message, signature]: CekValue[]) => {
    if (pk === undefined) {
      throw new Error("pk is undefined in verifyEd25519Signature()")
    }

    if (message === undefined) {
      throw new Error("message is undefined in verifyEd25519Signature()")
    }

    if (signature === undefined) {
      throw new Error("signature is undefined in verifyEd25519Signature()")
    }

    if (pk._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", pk._tag))
    }

    if (!(pk.value instanceof Uint8Array)) {
      return Either.left(
        new WrongArgType(0, "bytes", Value.describeType(pk.value))
      )
    }

    if (pk.value.length != 32) {
      return Either.left(
        new InvalidLength(
          "verifyEd25519Signature",
          "publicKey",
          32,
          pk.value.length
        )
      )
    }

    if (message._tag != "Const") {
      return Either.left(new WrongArgType(1, "Const", message._tag))
    }

    if (!(message.value instanceof Uint8Array)) {
      return Either.left(
        new WrongArgType(1, "bytes", Value.describeType(message.value))
      )
    }

    if (signature._tag != "Const") {
      return Either.left(new WrongArgType(1, "Const", signature._tag))
    }

    if (!(signature.value instanceof Uint8Array)) {
      return Either.left(
        new WrongArgType(1, "bytes", Value.describeType(signature.value))
      )
    }

    if (signature.value.length != 64) {
      return Either.left(
        new InvalidLength(
          "verifyEd25519Signature",
          "signature",
          64,
          pk.value.length
        )
      )
    }

    // length has been validated above
    const b = Either.getOrThrow(
      Crypto.Ed25519.verify(signature.value, message.value, pk.value)
    )
    return Either.right({
      _tag: "Const",
      value: b
    })
  }
}

export const verifyEd25519SignatureV2: Builtin = {
  ...verifyEd25519SignatureV1,
  cpuModel: Cost.Linear(169, 170)(Cost.Second),
  memModel: Cost.Constant(171)
}

export const verifyEd25519SignatureV3: Builtin = {
  ...verifyEd25519SignatureV1,
  cpuModel: Cost.Linear(187, 188)(Cost.Third),
  memModel: Cost.Constant(189)
}

export const appendStringV1: Builtin = {
  name: "appendString",
  forceCount: 0,
  nArgs: 2,
  cpuModel: Cost.Linear(8, 9)(Cost.Sum),
  memModel: Cost.Linear(10, 11)(Cost.Sum),
  call: ([a, b]: CekValue[]) => {
    if (a === undefined) {
      throw new Error("a is undefined in appendString()")
    }

    if (b === undefined) {
      throw new Error("b is undefined in appendString()")
    }

    if (a._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", a._tag))
    }

    if (typeof a.value != "string") {
      return Either.left(
        new WrongArgType(0, "string", Value.describeType(a.value))
      )
    }

    if (b._tag != "Const") {
      return Either.left(new WrongArgType(1, "Const", b._tag))
    }

    if (typeof b.value != "string") {
      return Either.left(
        new WrongArgType(1, "string", Value.describeType(b.value))
      )
    }

    return Either.right({
      _tag: "Const",
      value: a.value + b.value
    })
  }
}

export const equalsStringV1: Builtin = {
  name: "equalsString",
  forceCount: 0,
  nArgs: 2,
  cpuModel: Cost.ConstantOffDiag(69)(Cost.Linear(70, 71)(Cost.First)),
  memModel: Cost.Constant(72),
  call: ([a, b]: CekValue[]) => {
    if (a === undefined) {
      throw new Error("a is undefined in equalsString()")
    }

    if (b === undefined) {
      throw new Error("b is undefined in equalsString()")
    }

    if (a._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", a._tag))
    }

    if (typeof a.value != "string") {
      return Either.left(
        new WrongArgType(0, "string", Value.describeType(a.value))
      )
    }

    if (b._tag != "Const") {
      return Either.left(new WrongArgType(1, "Const", b._tag))
    }

    if (typeof b.value != "string") {
      return Either.left(
        new WrongArgType(1, "string", Value.describeType(b.value))
      )
    }

    return Either.right({
      _tag: "Const",
      value: a.value === b.value
    })
  }
}

export const equalsStringV3: Builtin = {
  ...equalsStringV1,
  cpuModel: Cost.ConstantOffDiag(74)(Cost.Linear(75, 76)(Cost.First)),
  memModel: Cost.Constant(77)
}

export const encodeUtf8V1: Builtin = {
  name: "encodeUtf8",
  forceCount: 0,
  nArgs: 1,
  cpuModel: Cost.Linear(55, 56)(Cost.First),
  memModel: Cost.Linear(57, 58)(Cost.First),
  call: ([a]: CekValue[]) => {
    if (a === undefined) {
      throw new Error("a is undefined in encodeUtf8()")
    }

    if (a._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", a._tag))
    }

    if (typeof a.value != "string") {
      return Either.left(
        new WrongArgType(0, "string", Value.describeType(a.value))
      )
    }

    return Either.right({
      _tag: "Const",
      value: Utf8.encode(a.value)
    })
  }
}

export const encodeUtf8V3: Builtin = {
  ...encodeUtf8V1,
  cpuModel: Cost.Linear(60, 61)(Cost.First),
  memModel: Cost.Linear(62, 63)(Cost.First)
}

export const decodeUtf8V1: Builtin = {
  name: "decodeUtf8",
  forceCount: 0,
  nArgs: 1,
  cpuModel: Cost.Linear(45, 46)(Cost.First),
  memModel: Cost.Linear(47, 48)(Cost.First),
  call: ([a]: CekValue[]) => {
    if (a === undefined) {
      throw new Error("a is undefined in decodeUtf8()")
    }

    if (a._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", a._tag))
    }

    if (!(a.value instanceof Uint8Array)) {
      return Either.left(
        new WrongArgType(0, "bytes", Value.describeType(a.value))
      )
    }

    return Utf8.decode(a.value).pipe(
      Either.map((s) => ({ _tag: "Const", value: s }))
    )
  }
}

export const ifThenElseV1: Builtin = {
  name: "ifThenElse",
  forceCount: 1,
  nArgs: 3,
  cpuModel: Cost.Constant(79),
  memModel: Cost.Constant(80),
  call: ([cond, a, b]: CekValue[]) => {
    if (cond === undefined) {
      throw new Error("cond is undefined in ifThenElse()")
    }

    if (a === undefined) {
      throw new Error("a is undefined in ifThenElse()")
    }

    if (b === undefined) {
      throw new Error("b is undefined in ifThenElse()")
    }

    if (cond._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", cond._tag))
    }

    if (typeof cond.value != "boolean") {
      return Either.left(
        new WrongArgType(0, "bool", Value.describeType(cond.value))
      )
    }

    return Either.right(cond.value ? a : b)
  }
}

export const ifThenElseV3: Builtin = {
  ...ifThenElseV1,
  cpuModel: Cost.Constant(84),
  memModel: Cost.Constant(85)
}

export const chooseUnitV1: Builtin = {
  name: "chooseUnit",
  forceCount: 1,
  nArgs: 2,
  cpuModel: Cost.Constant(37),
  memModel: Cost.Constant(38),
  call: ([a, b]: CekValue[]) => {
    if (a === undefined) {
      throw new Error("a is undefined in chooseUnit()")
    }

    if (b === undefined) {
      throw new Error("b is undefined in chooseUnit()")
    }

    if (a._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", a._tag))
    }

    if (a.value !== null) {
      return Either.left(
        new WrongArgType(0, "unit", Value.describeType(a.value))
      )
    }

    return Either.right(b)
  }
}

export const traceV1: Builtin = {
  name: "trace",
  forceCount: 1,
  nArgs: 2,
  cpuModel: Cost.Constant(151),
  memModel: Cost.Constant(152),
  call: ([message, after]: CekValue[], ctx: MachineContext) => {
    if (message === undefined) {
      throw new Error("message is undefined in trace()")
    }

    if (after === undefined) {
      throw new Error("after is undefined in trace()")
    }

    if (message._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", message._tag))
    }

    if (typeof message.value != "string") {
      return Either.left(
        new WrongArgType(0, "string", Value.describeType(message.value))
      )
    }

    ctx.print(message.value)

    return Either.right(after)
  }
}

export const traceV2: Builtin = {
  ...traceV1,
  cpuModel: Cost.Constant(155),
  memModel: Cost.Constant(156)
}

export const traceV3: Builtin = {
  ...traceV1,
  cpuModel: Cost.Constant(173),
  memModel: Cost.Constant(174)
}

export const fstPairV1: Builtin = {
  name: "fstPair",
  forceCount: 2,
  nArgs: 1,
  cpuModel: Cost.Constant(73),
  memModel: Cost.Constant(74),
  call: ([a]: CekValue[]) => {
    if (a === undefined) {
      throw new Error("a is undefined in fstPair()")
    }

    if (a._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", a._tag))
    }

    if (
      !(typeof a.value == "object" && a.value != null && "first" in a.value)
    ) {
      return Either.left(
        new WrongArgType(0, "pair", Value.describeType(a.value))
      )
    }

    return Either.right({
      _tag: "Const",
      value: a.value.first
    })
  }
}

export const fstPairV3: Builtin = {
  ...fstPairV1,
  cpuModel: Cost.Constant(78),
  memModel: Cost.Constant(79)
}

export const sndPairV1: Builtin = {
  name: "sndPair",
  forceCount: 2,
  nArgs: 1,
  cpuModel: Cost.Constant(143),
  memModel: Cost.Constant(144),
  call: ([a]: CekValue[]) => {
    if (a === undefined) {
      throw new Error("a is undefined in sndPair()")
    }

    if (a._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", a._tag))
    }

    if (
      !(typeof a.value == "object" && a.value != null && "first" in a.value)
    ) {
      return Either.left(
        new WrongArgType(0, "pair", Value.describeType(a.value))
      )
    }

    return Either.right({
      _tag: "Const",
      value: a.value.second
    })
  }
}

export const sndPairV2: Builtin = {
  ...sndPairV1,
  cpuModel: Cost.Constant(147),
  memModel: Cost.Constant(148)
}

export const sndPairV3: Builtin = {
  ...sndPairV1,
  cpuModel: Cost.Constant(165),
  memModel: Cost.Constant(166)
}

export const chooseListV1: Builtin = {
  name: "chooseList",
  forceCount: 2,
  nArgs: 3,
  cpuModel: Cost.Constant(35),
  memModel: Cost.Constant(36),
  call: ([lst, a, b]: CekValue[]) => {
    if (lst === undefined) {
      throw new Error("lst is undefined in chooseList()")
    }

    if (a === undefined) {
      throw new Error("a is undefined in chooseList()")
    }

    if (b === undefined) {
      throw new Error("b is undefined in chooseList()")
    }

    if (lst._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", lst._tag))
    }

    if (
      !(
        typeof lst.value == "object" &&
        lst.value != null &&
        "items" in lst.value
      )
    ) {
      return Either.left(
        new WrongArgType(0, "list", Value.describeType(lst.value))
      )
    }

    return Either.right(lst.value.items.length == 0 ? a : b)
  }
}

export const mkConsV1: Builtin = {
  name: "mkCons",
  forceCount: 1,
  nArgs: 2,
  cpuModel: Cost.Constant(101),
  memModel: Cost.Constant(102),
  call: ([item, list]: CekValue[]) => {
    if (item === undefined) {
      throw new Error("item is undefined in mkCons()")
    }

    if (list === undefined) {
      throw new Error("list is undefined in mkCons()")
    }

    if (list._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", list._tag))
    }

    if (
      !(
        typeof list.value == "object" &&
        list.value != null &&
        "items" in list.value
      )
    ) {
      return Either.left(
        new WrongArgType(0, "list", Value.describeType(list.value))
      )
    }

    if (item._tag != "Const") {
      return Either.left(new WrongArgType(1, "Const", item._tag))
    }

    if (Value.toType(item.value) != list.value.itemType) {
      return Either.left(
        new WrongArgType(
          1,
          Value.describeType(list.value.itemType),
          Value.describeType(item.value)
        )
      )
    }

    return Either.right({
      _tag: "Const",
      value: {
        itemType: list.value.itemType,
        items: [item.value].concat(list.value.items)
      }
    })
  }
}

export const mkConsV3: Builtin = {
  ...mkConsV1,
  cpuModel: Cost.Constant(106),
  memModel: Cost.Constant(107)
}

export const headListV1: Builtin = {
  name: "headList",
  forceCount: 1,
  nArgs: 1,
  cpuModel: Cost.Constant(75),
  memModel: Cost.Constant(76),
  call: ([l]: CekValue[]) => {
    if (l === undefined) {
      throw new Error("list is undefined in headList()")
    }

    if (l._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", l._tag))
    }

    if (
      !(typeof l.value == "object" && l.value != null && "items" in l.value)
    ) {
      return Either.left(
        new WrongArgType(0, "list", Value.describeType(l.value))
      )
    }

    if (l.value.items.length == 0) {
      return Either.left(new OutOfRange(0, 0))
    }

    const head = l.value.items[0]

    return Either.right({
      _tag: "Const",
      value: head
    })
  }
}

export const headListV3: Builtin = {
  ...headListV1,
  cpuModel: Cost.Constant(80),
  memModel: Cost.Constant(81)
}

export const tailListV1: Builtin = {
  name: "tailList",
  forceCount: 1,
  nArgs: 1,
  cpuModel: Cost.Constant(149),
  memModel: Cost.Constant(150),
  call: ([l]: CekValue[]) => {
    if (l === undefined) {
      throw new Error("list is undefined in tailList()")
    }

    if (l._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", l._tag))
    }

    if (
      !(typeof l.value == "object" && l.value != null && "items" in l.value)
    ) {
      return Either.left(
        new WrongArgType(0, "list", Value.describeType(l.value))
      )
    }

    if (l.value.items.length == 0) {
      return Either.left(new OutOfRange(0, 0))
    }

    return Either.right({
      _tag: "Const",
      value: {
        itemType: l.value.itemType,
        items: l.value.items.slice(1)
      }
    })
  }
}

export const tailListV2: Builtin = {
  ...tailListV1,
  cpuModel: Cost.Constant(153),
  memModel: Cost.Constant(154)
}

export const tailListV3: Builtin = {
  ...tailListV1,
  cpuModel: Cost.Constant(171),
  memModel: Cost.Constant(172)
}

export const nullListV1: Builtin = {
  name: "nullList",
  forceCount: 1,
  nArgs: 1,
  cpuModel: Cost.Constant(119),
  memModel: Cost.Constant(120),
  call: ([l]: CekValue[]) => {
    if (l === undefined) {
      throw new Error("list is undefined in nullList()")
    }

    if (l._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", l._tag))
    }

    if (
      !(typeof l.value == "object" && l.value != null && "items" in l.value)
    ) {
      return Either.left(
        new WrongArgType(0, "list", Value.describeType(l.value))
      )
    }

    return Either.right({
      _tag: "Const",
      value: l.value.items.length == 0
    })
  }
}

export const nullListV3: Builtin = {
  ...nullListV1,
  cpuModel: Cost.Constant(128),
  memModel: Cost.Constant(129)
}

export const chooseDataV1: Builtin = {
  name: "chooseData",
  forceCount: 1,
  nArgs: 6,
  cpuModel: Cost.Constant(33),
  memModel: Cost.Constant(34),
  call: ([
    cond,
    constrCase,
    mapCase,
    listCase,
    intCase,
    bytesCase
  ]: CekValue[]) => {
    if (cond === undefined) {
      throw new Error("cond is undefined in chooseData()")
    }

    if (constrCase === undefined) {
      throw new Error("constrCase is undefined in chooseData()")
    }

    if (mapCase === undefined) {
      throw new Error("mapCase is undefined in chooseData()")
    }

    if (listCase === undefined) {
      throw new Error("listCase is undefined in chooseData()")
    }

    if (intCase === undefined) {
      throw new Error("intCase is undefined in chooseData()")
    }

    if (bytesCase === undefined) {
      throw new Error("bytesCase is undefined in chooseData()")
    }

    if (cond._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", cond._tag))
    }

    if (
      !(
        typeof cond.value == "object" &&
        cond.value != null &&
        "data" in cond.value
      )
    ) {
      return Either.left(
        new WrongArgType(0, "data", Value.describeType(cond.value))
      )
    }

    if ("fields" in cond.value.data) {
      return Either.right(constrCase)
    } else if ("map" in cond.value.data) {
      return Either.right(mapCase)
    } else if ("list" in cond.value.data) {
      return Either.right(listCase)
    } else if ("int" in cond.value.data) {
      return Either.right(intCase)
    } else if ("bytes" in cond.value.data) {
      return Either.right(bytesCase)
    } else {
      // this is a defect
      throw new Error(
        `unexpected data format in chooseData (got: ${cond.value.data as unknown as any})`
      )
    }
  }
}

export const constrDataV1: Builtin = {
  name: "constrData",
  forceCount: 0,
  nArgs: 2,
  cpuModel: Cost.Constant(43),
  memModel: Cost.Constant(44),
  call: ([tag, fields]: CekValue[]) => {
    if (tag === undefined) {
      throw new Error("tag is undefined in constrData()")
    }

    if (fields === undefined) {
      throw new Error("fields is undefined in constrData()")
    }

    if (tag._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", tag._tag))
    }

    if (typeof tag.value != "bigint") {
      return Either.left(
        new WrongArgType(0, "integer", Value.describeType(tag.value))
      )
    }

    if (fields._tag != "Const") {
      return Either.left(new WrongArgType(1, "Const", fields._tag))
    }

    if (!(Value.isList(fields.value) && fields.value.itemType == Type.Data)) {
      return Either.left(
        new WrongArgType(1, "data list", Value.describeType(fields.value))
      )
    }

    return Either.right({
      _tag: "Const",
      value: {
        data: {
          constructor: Number(tag.value),
          fields: fields.value.items.map((item) => {
            if (!Value.isData(item)) {
              throw new Error("expected only data value fields")
            }

            return item.data
          })
        }
      }
    } satisfies CekValue)
  }
}

export const mapDataV1: Builtin = {
  name: "mapData",
  forceCount: 0,
  nArgs: 1,
  cpuModel: Cost.Constant(99),
  memModel: Cost.Constant(100),
  call: ([pairs]: CekValue[]) => {
    if (pairs === undefined) {
      throw new Error("pairs is undefined in mapData()")
    }

    if (pairs._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", pairs._tag))
    }

    if (!(Value.isList(pairs.value) && pairs.value.itemType == Type.DataPair)) {
      return Either.left(
        new WrongArgType(0, "data pair list", Value.describeType(pairs.value))
      )
    }

    return Either.right({
      _tag: "Const",
      value: {
        data: {
          map: pairs.value.items.map((pair) => {
            if (!Value.isPair(pair)) {
              // this is a defect
              throw new Error("expected data pair")
            }

            const a = pair.first
            const b = pair.second

            if (!Value.isData(a)) {
              throw new Error("unexpected non-data first entry in pair")
            }

            if (!Value.isData(b)) {
              throw new Error("unexpected non-data second entry in pair")
            }

            return { k: a.data, v: b.data }
          })
        }
      }
    })
  }
}

export const mapDataV3: Builtin = {
  ...mapDataV1,
  cpuModel: Cost.Constant(104),
  memModel: Cost.Constant(105)
}

export const listDataV1: Builtin = {
  name: "listData",
  forceCount: 0,
  nArgs: 1,
  cpuModel: Cost.Constant(97),
  memModel: Cost.Constant(98),
  call: ([list]: CekValue[]) => {
    if (list === undefined) {
      throw new Error("list is undefined in listData()")
    }

    if (list._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", list._tag))
    }

    if (!(Value.isList(list.value) && list.value.itemType == Type.Data)) {
      return Either.left(
        new WrongArgType(0, "data list", Value.describeType(list.value))
      )
    }

    return Either.right({
      _tag: "Const",
      value: {
        data: {
          list: list.value.items.map((item) => {
            if (!Value.isData(item)) {
              throw new Error("expected data item")
            }

            return item.data
          })
        }
      }
    })
  }
}

export const listDataV3: Builtin = {
  ...listDataV1,
  cpuModel: Cost.Constant(102),
  memModel: Cost.Constant(103)
}

export const iDataV1: Builtin = {
  name: "iData",
  forceCount: 0,
  nArgs: 1,
  cpuModel: Cost.Constant(77),
  memModel: Cost.Constant(78),
  call: ([x]: CekValue[]) => {
    if (x === undefined) {
      throw new Error("x is undefined in iData()")
    }

    if (x._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", x._tag))
    }

    if (typeof x.value != "bigint") {
      return Either.left(
        new WrongArgType(0, "integer", Value.describeType(x.value))
      )
    }

    return Either.right({
      _tag: "Const",
      value: {
        data: {
          int: x.value
        }
      }
    })
  }
}

export const iDataV3: Builtin = {
  ...iDataV1,
  cpuModel: Cost.Constant(82),
  memModel: Cost.Constant(83)
}

export const bDataV1: Builtin = {
  name: "bData",
  forceCount: 0,
  nArgs: 1,
  cpuModel: Cost.Constant(12),
  memModel: Cost.Constant(13),
  call: ([b]: CekValue[]) => {
    if (b === undefined) {
      throw new Error("b is undefined in bData()")
    }

    if (b._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", b._tag))
    }

    if (!(b.value instanceof Uint8Array)) {
      return Either.left(
        new WrongArgType(0, "bytes", Value.describeType(b.value))
      )
    }

    return Either.right({
      _tag: "Const",
      value: {
        data: {
          bytes: b.value
        }
      }
    })
  }
}

export const unConstrDataV1: Builtin = {
  name: "unConstrData",
  forceCount: 0,
  nArgs: 1,
  cpuModel: Cost.Constant(155),
  memModel: Cost.Constant(156),
  call: ([data]: CekValue[]) => {
    if (data === undefined) {
      throw new Error("data is undefined in unConstrData()")
    }

    if (data._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", data._tag))
    }

    if (!Value.isData(data.value)) {
      return Either.left(
        new WrongArgType(0, "data", Value.describeType(data.value))
      )
    }

    if (!("fields" in data.value.data)) {
      return Either.left(
        new WrongArgType(
          0,
          "constr data",
          Object.keys(data.value.data).join("")
        )
      )
    }

    return Either.right({
      _tag: "Const",
      value: {
        first: BigInt(data.value.data.constructor),
        second: {
          itemType: Type.Data,
          items: data.value.data.fields.map((d) => ({ data: d }))
        } satisfies Value.Value
      } satisfies Value.Value
    })
  }
}

export const unConstrDataV2: Builtin = {
  ...unConstrDataV1,
  cpuModel: Cost.Constant(159),
  memModel: Cost.Constant(160)
}

export const unConstrDataV3: Builtin = {
  ...unConstrDataV1,
  cpuModel: Cost.Constant(177),
  memModel: Cost.Constant(178)
}

export const unMapDataV1: Builtin = {
  name: "unMapData",
  forceCount: 0,
  nArgs: 1,
  cpuModel: Cost.Constant(161),
  memModel: Cost.Constant(162),
  call: ([data]: CekValue[]) => {
    if (data === undefined) {
      throw new Error("data is undefined in unMapData()")
    }

    if (data._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", data._tag))
    }

    if (!Value.isData(data.value)) {
      return Either.left(
        new WrongArgType(0, "data", Value.describeType(data.value))
      )
    }

    if (!("map" in data.value.data)) {
      return Either.left(
        new WrongArgType(0, "map data", Value.describeType(data.value))
      )
    }

    return Either.right({
      _tag: "Const",
      value: {
        itemType: Type.Data,
        items: data.value.data.map.map((d) => ({
          first: { data: d.k },
          second: { data: d.v }
        }))
      } satisfies Value.Value
    })
  }
}

export const unMapDataV2: Builtin = {
  ...unMapDataV1,
  cpuModel: Cost.Constant(165),
  memModel: Cost.Constant(166)
}

export const unMapDataV3: Builtin = {
  ...unMapDataV1,
  cpuModel: Cost.Constant(183),
  memModel: Cost.Constant(184)
}

export const unListDataV1: Builtin = {
  name: "unListData",
  forceCount: 0,
  nArgs: 1,
  cpuModel: Cost.Constant(159),
  memModel: Cost.Constant(160),
  call: ([data]: CekValue[]) => {
    if (data === undefined) {
      throw new Error("data is undefined in unListData()")
    }

    if (data._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", data._tag))
    }

    if (!Value.isData(data.value)) {
      return Either.left(
        new WrongArgType(0, "data", Value.describeType(data.value))
      )
    }

    if (!("list" in data.value.data)) {
      return Either.left(
        new WrongArgType(0, "list data", Value.describeType(data.value))
      )
    }

    return Either.right({
      _tag: "Const",
      value: {
        itemType: Type.Data,
        items: data.value.data.list.map((d) => ({ data: d }))
      } satisfies Value.Value
    })
  }
}

export const unListDataV2: Builtin = {
  ...unListDataV1,
  cpuModel: Cost.Constant(163),
  memModel: Cost.Constant(164)
}

export const unListDataV3: Builtin = {
  ...unListDataV1,
  cpuModel: Cost.Constant(181),
  memModel: Cost.Constant(182)
}

export const unIDataV1: Builtin = {
  name: "unIData",
  forceCount: 0,
  nArgs: 1,
  cpuModel: Cost.Constant(157),
  memModel: Cost.Constant(158),
  call: ([data]: CekValue[]) => {
    if (data === undefined) {
      throw new Error("data is undefined in unIData()")
    }

    if (data._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", data._tag))
    }

    if (!Value.isData(data.value)) {
      return Either.left(
        new WrongArgType(0, "data", Value.describeType(data.value))
      )
    }

    if (!("int" in data.value.data)) {
      return Either.left(
        new WrongArgType(0, "int data", Value.describeType(data.value))
      )
    }

    return Either.right({
      _tag: "Const",
      value: data.value.data.int
    })
  }
}

export const unIDataV2: Builtin = {
  ...unIDataV1,
  cpuModel: Cost.Constant(161),
  memModel: Cost.Constant(162)
}

export const unIDataV3: Builtin = {
  ...unIDataV1,
  cpuModel: Cost.Constant(179),
  memModel: Cost.Constant(180)
}

export const unBDataV1: Builtin = {
  name: "unBData",
  forceCount: 0,
  nArgs: 1,
  cpuModel: Cost.Constant(153),
  memModel: Cost.Constant(154),
  call: ([data]: CekValue[]) => {
    if (data === undefined) {
      throw new Error("data is undefined in unBData()")
    }

    if (data._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", data._tag))
    }

    if (!Value.isData(data.value)) {
      return Either.left(
        new WrongArgType(0, "data", Value.describeType(data.value))
      )
    }

    if (!("bytes" in data.value.data)) {
      return Either.left(
        new WrongArgType(0, "byte data", Value.describeType(data.value))
      )
    }

    return Either.right({
      _tag: "Const",
      value: data.value.data.bytes
    })
  }
}

export const unBDataV2: Builtin = {
  ...unBDataV1,
  cpuModel: Cost.Constant(157),
  memModel: Cost.Constant(158)
}

export const unBDataV3: Builtin = {
  ...unBDataV1,
  cpuModel: Cost.Constant(175),
  memModel: Cost.Constant(176)
}

export const equalsDataV1: Builtin = {
  name: "equalsData",
  forceCount: 0,
  nArgs: 2,
  cpuModel: Cost.Linear(63, 64)(Cost.Min),
  memModel: Cost.Constant(65),
  call: ([a, b]: CekValue[]) => {
    if (a === undefined) {
      throw new Error("a is undefined in equalsData()")
    }

    if (b === undefined) {
      throw new Error("b is undefined in equalsData()")
    }

    if (a._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", a._tag))
    }

    if (!Value.isData(a.value)) {
      return Either.left(
        new WrongArgType(0, "data", Value.describeType(a.value))
      )
    }

    if (b._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", b._tag))
    }

    if (!Value.isData(b.value)) {
      return Either.left(
        new WrongArgType(0, "data", Value.describeType(b.value))
      )
    }

    return Either.right({
      _tag: "Const",
      value: dataToString(a.value.data) == dataToString(b.value.data)
    })
  }
}

export const equalsDataV3: Builtin = {
  ...equalsDataV1,
  cpuModel: Cost.Linear(68, 69)(Cost.Min),
  memModel: Cost.Constant(70)
}

export const mkPairDataV1: Builtin = {
  name: "mkPairData",
  forceCount: 0,
  nArgs: 2,
  cpuModel: Cost.Constant(107),
  memModel: Cost.Constant(108),
  call: ([a, b]: CekValue[]) => {
    if (a === undefined) {
      throw new Error("a is undefined in mkPairData()")
    }

    if (b === undefined) {
      throw new Error("b is undefined in mkPairData()")
    }

    if (a._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", a._tag))
    }

    if (!Value.isData(a.value)) {
      return Either.left(
        new WrongArgType(0, "data", Value.describeType(a.value))
      )
    }

    if (b._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", b._tag))
    }

    if (!Value.isData(b.value)) {
      return Either.left(
        new WrongArgType(0, "data", Value.describeType(b.value))
      )
    }

    return Either.right({
      _tag: "Const",
      value: {
        first: a.value,
        second: b.value
      } satisfies Value.Value
    })
  }
}

export const mkPairDataV3: Builtin = {
  ...mkPairDataV1,
  cpuModel: Cost.Constant(112),
  memModel: Cost.Constant(113)
}

export const mkNilDataV1: Builtin = {
  name: "mkNilData",
  forceCount: 0,
  nArgs: 1,
  cpuModel: Cost.Constant(103),
  memModel: Cost.Constant(104),
  call: ([unit]: CekValue[]) => {
    if (unit === undefined) {
      throw new Error("unit is undefined in mkNilData()")
    }

    if (unit._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", unit._tag))
    }

    if (unit.value !== null) {
      return Either.left(
        new WrongArgType(0, "null", Value.describeType(unit.value))
      )
    }

    return Either.right({
      _tag: "Const",
      value: {
        itemType: Type.Data,
        items: []
      } satisfies Value.Value
    })
  }
}

export const mkNilDataV3: Builtin = {
  ...mkNilDataV1,
  cpuModel: Cost.Constant(108),
  memModel: Cost.Constant(109)
}

export const mkNilPairDataV1: Builtin = {
  name: "mkNilPairData",
  forceCount: 0,
  nArgs: 1,
  cpuModel: Cost.Constant(105),
  memModel: Cost.Constant(106),
  call: ([unit]: CekValue[]) => {
    if (unit === undefined) {
      throw new Error("unit is undefined in mkNilPairData()")
    }

    if (unit._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", unit._tag))
    }

    if (unit.value !== null) {
      return Either.left(
        new WrongArgType(0, "null", Value.describeType(unit.value))
      )
    }

    return Either.right({
      _tag: "Const",
      value: {
        itemType: Type.DataPair,
        items: []
      }
    })
  }
}

export const mkNilPairDataV3: Builtin = {
  ...mkNilPairDataV1,
  cpuModel: Cost.Constant(110),
  memModel: Cost.Constant(111)
}

export const serialiseDataV2: Builtin = {
  name: "serialiseData",
  forceCount: 0,
  nArgs: 1,
  cpuModel: Cost.Linear(133, 134)(Cost.First),
  memModel: Cost.Linear(135, 136)(Cost.First),
  call: ([data]: CekValue[]) => {
    if (data === undefined) {
      throw new Error("data is undefined in serialiseData()")
    }

    if (data._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", data._tag))
    }

    if (!Value.isData(data.value)) {
      return Either.left(
        new WrongArgType(0, "data", Value.describeType(data.value))
      )
    }

    return Either.right({
      _tag: "Const",
      value: Bytes.toUint8Array(encodeData(data.value.data))
    })
  }
}

export const serialiseDataV3: Builtin = {
  ...serialiseDataV2,
  cpuModel: Cost.Linear(151, 152)(Cost.First),
  memModel: Cost.Linear(153, 154)(Cost.First)
}

export const verifyEcdsaSecp256k1SignatureV2: Builtin = {
  name: "verifyEcdsaSecp256k1Signature",
  forceCount: 0,
  nArgs: 3,
  cpuModel: Cost.Constant(167),
  memModel: Cost.Constant(168),
  call: () => {
    throw new Error("not yet implemented")
  }
}

export const verifyEcdsaSecp256k1SignatureV3: Builtin = {
  ...verifyEcdsaSecp256k1SignatureV2,
  cpuModel: Cost.Constant(185),
  memModel: Cost.Constant(186)
}

export const verifySchnorrSecp256k1SignatureV2: Builtin = {
  name: "verifySchnorrSecp256k1Signature",
  forceCount: 0,
  nArgs: 3,
  cpuModel: Cost.Linear(172, 173)(Cost.Second),
  memModel: Cost.Constant(174),
  call: () => {
    throw new Error("not yet implemented")
  }
}

export const verifySchnorrSecp256k1SignatureV3: Builtin = {
  ...verifyEcdsaSecp256k1SignatureV2,
  cpuModel: Cost.Linear(190, 191)(Cost.Third),
  memModel: Cost.Constant(192)
}

export const V1: Builtin[] = [
  addIntegerV1, // 0
  subtractIntegerV1, // 1
  multiplyIntegerV1, // 2
  divideIntegerV1, // 3
  quotientIntegerV1, // 4
  remainderIntegerV1, // 5
  modIntegerV1, // 6
  equalsIntegerV1, // 7
  lessThanIntegerV1, // 8
  lessThanEqualsIntegerV1, // 9
  appendByteStringV1, // 10
  consByteStringV1, // 11
  sliceByteStringV1, // 12
  lengthOfByteStringV1, // 13
  indexByteStringV1, // 14
  equalsByteStringV1, // 15
  lessThanByteStringV1, // 16
  lessThanEqualsByteStringV1, // 17
  sha2_256V1, // 18
  sha3_256V1, // 19
  blake2b_256V1, // 20
  verifyEd25519SignatureV1, // 21
  appendStringV1, // 22
  equalsStringV1, // 23
  encodeUtf8V1, // 24
  decodeUtf8V1, // 25
  ifThenElseV1, // 26
  chooseUnitV1, // 27
  traceV1, // 28
  fstPairV1, // 29
  sndPairV1, // 30
  chooseListV1, // 31
  mkConsV1, // 32
  headListV1, // 33
  tailListV1, // 34
  nullListV1, // 35
  chooseDataV1, // 36
  constrDataV1, // 37
  mapDataV1, // 38
  listDataV1, // 39
  iDataV1, // 40
  bDataV1, // 41
  unConstrDataV1, // 42
  unMapDataV1, // 43
  unListDataV1, // 44
  unIDataV1, // 45
  unBDataV1, // 46
  equalsDataV1, // 47
  mkPairDataV1, // 48
  mkNilDataV1, // 49
  mkNilPairDataV1 // 50
]

export const V2: Builtin[] = [
  addIntegerV1, // 0
  subtractIntegerV2, // 1
  multiplyIntegerV2, // 2
  divideIntegerV1, // 3
  quotientIntegerV1, // 4
  remainderIntegerV1, // 5
  modIntegerV1, // 6
  equalsIntegerV1, // 7
  lessThanIntegerV1, // 8
  lessThanEqualsIntegerV1, // 9
  appendByteStringV1, // 10
  consByteStringV1, // 11
  sliceByteStringV2, // 12
  lengthOfByteStringV1, // 13
  indexByteStringV1, // 14
  equalsByteStringV1, // 15
  lessThanByteStringV1, // 16
  lessThanEqualsByteStringV1, // 17
  sha2_256V2, // 18
  sha3_256V2, // 19
  blake2b_256V1, // 20
  verifyEd25519SignatureV2, // 21
  appendStringV1, // 22
  equalsStringV1, // 23
  encodeUtf8V1, // 24
  decodeUtf8V1, // 25
  ifThenElseV1, // 26
  chooseUnitV1, // 27
  traceV2, // 28
  fstPairV1, // 29
  sndPairV2, // 30
  chooseListV1, // 31
  mkConsV1, // 32
  headListV1, // 33
  tailListV2, // 34
  nullListV1, // 35
  chooseDataV1, // 36
  constrDataV1, // 37
  mapDataV1, // 38
  listDataV1, // 39
  iDataV1, // 40
  bDataV1, // 41
  unConstrDataV2, // 42
  unMapDataV2, // 43
  unListDataV2, // 44
  unIDataV2, // 45
  unBDataV2, // 46
  equalsDataV1, // 47
  mkPairDataV1, // 48
  mkNilDataV1, // 49
  mkNilPairDataV1, // 50
  serialiseDataV2, // 51
  verifyEcdsaSecp256k1SignatureV2, // 52
  verifySchnorrSecp256k1SignatureV2 // 53
]

export const V3: Builtin[] = [
  addIntegerV1, // 0
  subtractIntegerV3, // 1
  multiplyIntegerV3, // 2
  divideIntegerV3, // 3
  quotientIntegerV3, // 4
  remainderIntegerV3, // 5
  modIntegerV3, // 6
  equalsIntegerV3, // 7
  lessThanIntegerV3, // 8
  lessThanEqualsIntegerV3, // 9
  appendByteStringV1, // 10
  consByteStringV1, // 11,
  sliceByteStringV3, // 12
  lengthOfByteStringV3, // 13
  indexByteStringV3, // 14
  equalsByteStringV3, // 15
  lessThanByteStringV3, // 16
  lessThanEqualsByteStringV3, // 17
  sha2_256V3, // 18
  sha3_256V3, // 19
  blake2b_256V1, // 20
  verifyEd25519SignatureV3, // 21
  appendStringV1, // 22
  equalsStringV3, // 23
  encodeUtf8V3, // 24
  decodeUtf8V1, // 25
  ifThenElseV3, // 26
  chooseUnitV1, // 27
  traceV3, // 28
  fstPairV3, // 29
  sndPairV3, // 30
  chooseListV1, // 31
  mkConsV3, // 32
  headListV3, // 33
  tailListV3, // 34
  nullListV3, // 35,
  chooseDataV1, // 36
  constrDataV1, // 37
  mapDataV3, // 38
  listDataV3, // 39
  iDataV3, // 40
  bDataV1, // 41
  unConstrDataV3, // 42
  unMapDataV3, // 43
  unListDataV3, // 44
  unIDataV3, // 45
  unBDataV3, // 46
  equalsDataV3, // 47
  mkPairDataV3, // 48
  mkNilDataV3, // 49
  mkNilPairDataV3, // 50
  serialiseDataV3, // 51
  verifyEcdsaSecp256k1SignatureV3, // 52
  verifySchnorrSecp256k1SignatureV3 // 53
  // TODO: remaining builtins
]
