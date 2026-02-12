import { Data, Either, Encoding } from "effect"
import * as Bytes from "../internal/Bytes.js"
import * as Utf8 from "../internal/Utf8.js"
import * as Crypto from "../Crypto"
import type { MachineContext, Value as CekValue } from "./Cek.js"
import * as Cost from "./Cost.js"
import { toString as dataToString } from "./Data.js"
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

export const addIntegerV1: Builtin = /* @__PURE__ */ {
  name: "addInteger",
  forceCount: 0,
  nArgs: 2,
  cpuModel: Cost.LargestArg(1, 0),
  memModel: Cost.LargestArg(3, 2),
  call: ([a, b]: CekValue[]) => {
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

export const subtractIntegerV1: Builtin = /* @__PURE__ */ {
  name: "subtractInteger",
  forceCount: 0,
  nArgs: 2,
  cpuModel: Cost.LargestArg(146, 145),
  memModel: Cost.LargestArg(148, 147),
  call: ([a, b]: CekValue[]) => {
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

export const multiplyIntegerV1: Builtin = /* @__PURE__ */ {
  name: "multiplyInteger",
  forceCount: 0,
  nArgs: 2,
  cpuModel: Cost.ArgsSum(116, 115),
  memModel: Cost.ArgsSum(118, 117),
  call: ([a, b]: CekValue[]) => {
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

export const multiplyIntegerV2: Builtin = /* @__PURE__ */ {
  ...multiplyIntegerV1,
  cpuModel: Cost.ArgsProd(116, 115)
}

export const multiplyIntegerV3: Builtin = /* @__PURE__ */ {
  ...multiplyIntegerV1,
  cpuModel: Cost.ArgsSum(125, 124),
  memModel: Cost.ArgsSum(127, 126)
}

export const divideIntegerV1: Builtin = /* @__PURE__ */ {
  name: "divideInteger",
  forceCount: 0,
  nArgs: 2,
  cpuModel: Cost.ArgsProdBelowDiag(51, 50, 49),
  memModel: Cost.ArgsDiff(54, 52, 53),
  call: ([a, b]: CekValue[]) => {
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

export const quotientIntegerV1: Builtin = /* @__PURE__ */ {
  name: "quotientInteger",
  forceCount: 0,
  nArgs: 2,
  cpuModel: Cost.ArgsProdBelowDiag(123, 122, 121),
  memModel: Cost.ArgsDiff(126, 124, 125),
  call: ([a, b]: CekValue[]) => {
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

export const remainderIntegerV1: Builtin = /* @__PURE__ */ {
  name: "remainderInteger",
  forceCount: 0,
  nArgs: 2,
  cpuModel: Cost.ArgsProdBelowDiag(129, 128, 127),
  memModel: Cost.ArgsDiff(132, 130, 131),
  call: ([a, b]: CekValue[]) => {
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

export const modIntegerV1: Builtin = /* @__PURE__ */ {
  name: "modInteger",
  forceCount: 0,
  nArgs: 2,
  cpuModel: Cost.ArgsProdBelowDiag(111, 110, 109),
  memModel: Cost.ArgsDiff(114, 112, 113),
  call: ([a, b]: CekValue[]) => {
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

export const equalsIntegerV1: Builtin = /* @__PURE__ */ {
  name: "equalsInteger",
  forceCount: 0,
  nArgs: 2,
  cpuModel: Cost.SmallestArg(67, 66),
  memModel: Cost.Const(68),
  call: ([a, b]: CekValue[]) => {
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

export const lessThanIntegerV1: Builtin = /* @__PURE__ */ {
  name: "lessThanInteger",
  forceCount: 0,
  nArgs: 2,
  cpuModel: Cost.SmallestArg(95, 94),
  memModel: Cost.Const(96),
  call: ([a, b]: CekValue[]) => {
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

export const lessThanEqualsIntegerV1: Builtin = /* @__PURE__ */ {
  name: "lessThanEqualsInteger",
  forceCount: 0,
  nArgs: 2,
  cpuModel: Cost.SmallestArg(92, 91),
  memModel: Cost.Const(93),
  call: ([a, b]: CekValue[]) => {
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

export const appendByteStringV1: Builtin = /* @__PURE__ */ {
  name: "appendByteString",
  forceCount: 0,
  nArgs: 2,
  cpuModel: Cost.ArgsSum(5, 4),
  memModel: Cost.ArgsSum(7, 6),
  call: ([a, b]: CekValue[]) => {
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

export const consByteStringV1: Builtin = /* @__PURE__ */ {
  name: "consByteString",
  forceCount: 0,
  nArgs: 2,
  cpuModel: Cost.Second(40, 39),
  memModel: Cost.ArgsSum(42, 41),
  call: ([a, b]: CekValue[]) => {
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

export const sliceByteStringV1: Builtin = /* @__PURE__ */ {
  name: "sliceByteString",
  forceCount: 0,
  nArgs: 3,
  cpuModel: Cost.Third(140, 139),
  memModel: Cost.Third(142, 141),
  call: ([a, b, c]: CekValue[]) => {
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

export const lengthOfByteStringV1: Builtin = /* @__PURE__ */ {
  name: "lengthOfByteString",
  forceCount: 0,
  nArgs: 1,
  cpuModel: Cost.Const(83),
  memModel: Cost.Const(84),
  call: ([a]: CekValue[]) => {
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

export const indexByteStringV1: Builtin = /* @__PURE__ */ {
  name: "indexByteString",
  forceCount: 0,
  nArgs: 2,
  cpuModel: Cost.Const(81),
  memModel: Cost.Const(82),
  call: ([a, b]: CekValue[]) => {
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

export const equalsByteStringV1: Builtin = /* @__PURE__ */ {
  name: "equalsByteString",
  forceCount: 0,
  nArgs: 2,
  cpuModel: Cost.Diag(61, 60, 59),
  memModel: Cost.Const(62),
  call: ([a, b]: CekValue[]) => {
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

export const lessThanByteStringV1: Builtin = /* @__PURE__ */ {
  name: "lessThanByteString",
  forceCount: 0,
  nArgs: 2,
  cpuModel: Cost.SmallestArg(86, 85),
  memModel: Cost.Const(87),
  call: ([a, b]: CekValue[]) => {
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

export const lessThanEqualsByteStringV1: Builtin = /* @__PURE__ */ {
  name: "lessThanEqualsByteString",
  forceCount: 0,
  nArgs: 2,
  cpuModel: Cost.SmallestArg(89, 88),
  memModel: Cost.Const(90),
  call: ([a, b]: CekValue[]) => {
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

export const sha2_256V1: Builtin = /* @__PURE__ */ {
  name: "sha2_256",
  forceCount: 0,
  nArgs: 1,
  cpuModel: Cost.First(134, 133),
  memModel: Cost.Const(135),
  call: ([a]: CekValue[]) => {
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

export const sha3_256V1: Builtin = /* @__PURE__ */ {
  name: "sha3_256",
  forceCount: 0,
  nArgs: 1,
  cpuModel: Cost.First(137, 136),
  memModel: Cost.Const(138),
  call: ([a]: CekValue[]) => {
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

export const blake2b_256V1: Builtin = /* @__PURE__ */ {
  name: "blake2b_256",
  forceCount: 0,
  nArgs: 1,
  cpuModel: Cost.First(15, 14),
  memModel: Cost.Const(16),
  call: ([a]: CekValue[]) => {
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

export const verifyEd25519SignatureV1: Builtin = /* @__PURE__ */ {
  name: "verifyEd25519Signature",
  forceCount: 0,
  nArgs: 3,
  cpuModel: Cost.Third(164, 163),
  memModel: Cost.Const(165),
  call: ([pk, message, signature]: CekValue[]) => {
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

export const appendStringV1: Builtin = /* @__PURE__ */ {
  name: "appendString",
  forceCount: 0,
  nArgs: 2,
  cpuModel: Cost.ArgsSum(9, 8),
  memModel: Cost.ArgsSum(11, 10),
  call: ([a, b]: CekValue[]) => {
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

export const equalsStringV1: Builtin = /* @__PURE__ */ {
  name: "equalsString",
  forceCount: 0,
  nArgs: 2,
  cpuModel: Cost.Diag(71, 70, 69),
  memModel: Cost.Const(72),
  call: ([a, b]: CekValue[]) => {
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

export const encodeUtf8V1: Builtin = /* @__PURE__ */ {
  name: "encodeUtf8",
  forceCount: 0,
  nArgs: 1,
  cpuModel: Cost.First(56, 55),
  memModel: Cost.First(58, 57),
  call: ([a]: CekValue[]) => {
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

export const decodeUtf8V1: Builtin = /* @__PURE__ */ {
  name: "decodeUtf8",
  forceCount: 0,
  nArgs: 1,
  cpuModel: Cost.First(46, 45),
  memModel: Cost.First(48, 47),
  call: ([a]: CekValue[]) => {
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

export const ifThenElseV1: Builtin = /* @__PURE__ */ {
  name: "ifThenElse",
  forceCount: 1,
  nArgs: 3,
  cpuModel: Cost.Const(79),
  memModel: Cost.Const(80),
  call: ([cond, a, b]: CekValue[]) => {
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

export const chooseUnitV1: Builtin = /* @__PURE__ */ {
  name: "chooseUnit",
  forceCount: 1,
  nArgs: 2,
  cpuModel: Cost.Const(37),
  memModel: Cost.Const(38),
  call: ([a, b]: CekValue[]) => {
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

export const traceV1: Builtin = /* @__PURE__ */ {
  name: "trace",
  forceCount: 1,
  nArgs: 2,
  cpuModel: Cost.Const(151),
  memModel: Cost.Const(152),
  call: ([message, after]: CekValue[], ctx: MachineContext) => {
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

export const fstPairV1: Builtin = /* @__PURE__ */ {
  name: "fstPair",
  forceCount: 2,
  nArgs: 1,
  cpuModel: Cost.Const(73),
  memModel: Cost.Const(74),
  call: ([a]: CekValue[]) => {
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

export const sndPairV1: Builtin = /* @__PURE__ */ {
  name: "sndPair",
  forceCount: 2,
  nArgs: 1,
  cpuModel: Cost.Const(143),
  memModel: Cost.Const(144),
  call: ([a]: CekValue[]) => {
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

export const chooseListV1: Builtin = /* @__PURE__ */ {
  name: "chooseList",
  forceCount: 2,
  nArgs: 3,
  cpuModel: Cost.Const(35),
  memModel: Cost.Const(36),
  call: ([lst, a, b]: CekValue[]) => {
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

export const mkConsV1: Builtin = /* @__PURE__ */ {
  name: "mkCons",
  forceCount: 1,
  nArgs: 2,
  cpuModel: Cost.Const(101),
  memModel: Cost.Const(102),
  call: ([list, item]: CekValue[]) => {
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

export const headListV1: Builtin = /* @__PURE__ */ {
  name: "headList",
  forceCount: 1,
  nArgs: 1,
  cpuModel: Cost.Const(75),
  memModel: Cost.Const(76),
  call: ([list]: CekValue[]) => {
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

    if (list.value.items.length == 0) {
      return Either.left(new OutOfRange(0, 0))
    }

    return Either.right({
      _tag: "Const",
      value: list.value.items[0]
    })
  }
}

export const tailListV1: Builtin = /* @__PURE__ */ {
  name: "tailList",
  forceCount: 1,
  nArgs: 1,
  cpuModel: Cost.Const(149),
  memModel: Cost.Const(150),
  call: ([list]: CekValue[]) => {
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

    if (list.value.items.length == 0) {
      return Either.left(new OutOfRange(0, 0))
    }

    return Either.right({
      _tag: "Const",
      value: {
        itemType: list.value.itemType,
        items: list.value.items.slice(1)
      }
    })
  }
}

export const nullListV1: Builtin = /* @__PURE__ */ {
  name: "nullList",
  forceCount: 1,
  nArgs: 1,
  cpuModel: Cost.Const(119),
  memModel: Cost.Const(120),
  call: ([list]: CekValue[]) => {
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

    return Either.right({
      _tag: "Const",
      value: list.value.items.length == 0
    })
  }
}

export const chooseDataV1: Builtin = /* @__PURE__ */ {
  name: "chooseData",
  forceCount: 1,
  nArgs: 6,
  cpuModel: Cost.Const(33),
  memModel: Cost.Const(34),
  call: ([
    cond,
    constrCase,
    mapCase,
    listCase,
    intCase,
    bytesCase
  ]: CekValue[]) => {
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
        `unexpected data format in chooseData (got: ${cond.value.data})`
      )
    }
  }
}

export const constrDataV1: Builtin = /* @__PURE__ */ {
  name: "constrData",
  forceCount: 0,
  nArgs: 2,
  cpuModel: Cost.Const(43),
  memModel: Cost.Const(44),
  call: ([tag, fields]: CekValue[]) => {
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

export const mapDataV1: Builtin = /* @__PURE__ */ {
  name: "mapData",
  forceCount: 0,
  nArgs: 1,
  cpuModel: Cost.Const(99),
  memModel: Cost.Const(100),
  call: ([pairs]: CekValue[]) => {
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

export const listDataV1: Builtin = /* @__PURE__ */ {
  name: "listData",
  forceCount: 0,
  nArgs: 1,
  cpuModel: Cost.Const(97),
  memModel: Cost.Const(98),
  call: ([list]: CekValue[]) => {
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

export const iDataV1: Builtin /* @__PURE__ */ = {
  name: "iData",
  forceCount: 0,
  nArgs: 1,
  cpuModel: Cost.Const(77),
  memModel: Cost.Const(78),
  call: ([x]: CekValue[]) => {
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

export const bDataV1: Builtin /* @__PURE__ */ = {
  name: "bData",
  forceCount: 0,
  nArgs: 1,
  cpuModel: Cost.Const(12),
  memModel: Cost.Const(13),
  call: ([b]: CekValue[]) => {
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

export const unConstrDataV1: Builtin /* @__PURE__ */ = {
  name: "unConstrData",
  forceCount: 0,
  nArgs: 1,
  cpuModel: Cost.Const(155),
  memModel: Cost.Const(156),
  call: ([data]: CekValue[]) => {
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
        new WrongArgType(0, "constr data", Value.describeType(data.value))
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

export const unMapDataV1: Builtin /* @__PURE__ */ = {
  name: "unMapData",
  forceCount: 0,
  nArgs: 1,
  cpuModel: Cost.Const(161),
  memModel: Cost.Const(162),
  call: ([data]: CekValue[]) => {
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

export const unListDataV1: Builtin /* @__PURE__ */ = {
  name: "unListData",
  forceCount: 0,
  nArgs: 1,
  cpuModel: Cost.Const(159),
  memModel: Cost.Const(160),
  call: ([data]: CekValue[]) => {
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

export const unIDataV1: Builtin /* @__PURE__ */ = {
  name: "unIData",
  forceCount: 0,
  nArgs: 1,
  cpuModel: Cost.Const(157),
  memModel: Cost.Const(158),
  call: ([data]: CekValue[]) => {
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

export const unBDataV1: Builtin /* @__PURE__ */ = {
  name: "unBData",
  forceCount: 0,
  nArgs: 1,
  cpuModel: Cost.Const(153),
  memModel: Cost.Const(154),
  call: ([data]: CekValue[]) => {
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

export const equalsDataV1: Builtin /* @__PURE__ */ = {
  name: "equalsData",
  forceCount: 0,
  nArgs: 1,
  cpuModel: Cost.SmallestArg(64, 63),
  memModel: Cost.Const(65),
  call: ([a, b]: CekValue[]) => {
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

export const mkPairDataV1: Builtin /* @__PURE__ */ = {
  name: "mkPairData",
  forceCount: 0,
  nArgs: 2,
  cpuModel: Cost.Const(107),
  memModel: Cost.Const(108),
  call: ([a, b]: CekValue[]) => {
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

export const mkNilDataV1: Builtin /* @__PURE__ */ = {
  name: "mkNilData",
  forceCount: 0,
  nArgs: 1,
  cpuModel: Cost.Const(103),
  memModel: Cost.Const(104),
  call: ([unit]: CekValue[]) => {
    if (unit._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", unit._tag))
    }

    if (unit.value === null) {
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

export const mkNilPairDataV1: Builtin /* @__PURE__ */ = {
  name: "mkNilPairData",
  forceCount: 0,
  nArgs: 1,
  cpuModel: Cost.Const(105),
  memModel: Cost.Const(106),
  call: ([unit]: CekValue[]) => {
    if (unit._tag != "Const") {
      return Either.left(new WrongArgType(0, "Const", unit._tag))
    }

    if (unit.value === null) {
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
