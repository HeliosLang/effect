import { describe, expect, it } from "bun:test"
import { Either } from "effect"
import * as Builtins from "./Builtins.js"
import * as Cek from "./Cek.js"
import * as Cost from "./Cost.js"
import * as Term from "./Term.js"

describe("Cek.eval()", () => {
  it("correct cost for add1 program", () => {
    const term: Term.Term = {
      _tag: "Apply",
      fn: {
        _tag: "Lambda",
        body: {
          _tag: "Apply",
          fn: {
            _tag: "Apply",
            fn: { _tag: "Builtin", id: 0, name: "addInteger" },
            arg: {
              _tag: "Apply",
              fn: {
                _tag: "Apply",
                fn: { _tag: "Var", index: 1 },
                arg: { _tag: "Const", value: 12n }
              },
              arg: { _tag: "Const", value: 32n }
            }
          },
          arg: {
            _tag: "Apply",
            fn: {
              _tag: "Apply",
              fn: { _tag: "Var", index: 1 },
              arg: { _tag: "Const", value: 5n }
            },
            arg: { _tag: "Const", value: 4n }
          }
        }
      },
      arg: {
        _tag: "Lambda",
        body: {
          _tag: "Lambda",
          body: {
            _tag: "Apply",
            fn: {
              _tag: "Apply",
              fn: { _tag: "Builtin", id: 0, name: "addInteger" },
              arg: {
                _tag: "Apply",
                fn: {
                  _tag: "Apply",
                  fn: {
                    _tag: "Builtin",
                    id: 0,
                    name: "addInteger"
                  },
                  arg: { _tag: "Var", index: 2 }
                },
                arg: { _tag: "Var", index: 1 }
              }
            },
            arg: { _tag: "Const", value: 1n }
          }
        }
      }
    }

    const { value, cost } = Cek.eval(term, {
      builtins: Builtins.V1,
      costParams: Cost.PARAMS_V1_BABBAGE
    })

    expect(Either.getOrThrow(value)).toEqual({ _tag: "Const", value: 55n })
    expect(cost).toEqual({ cpu: 1860485n, mem: 3710n })
  })

  it("captures const terms with capture metadata", () => {
    const term: Term.Term = {
      _tag: "Const",
      value: 42n,
      capture: "answer"
    }

    const result = Cek.eval(term, {
      builtins: Builtins.V1,
      costParams: Cost.PARAMS_V1_BABBAGE
    })

    expect(result.capturedValues).toEqual([
      {
        index: 0,
        id: "answer",
        value: {
          _tag: "Const",
          value: 42n
        }
      }
    ])
  })

  it("captures apply results with capture metadata", () => {
    const term: Term.Term = {
      _tag: "Apply",
      capture: "identity-result",
      fn: {
        _tag: "Lambda",
        body: { _tag: "Var", index: 1 }
      },
      arg: { _tag: "Const", value: 42n }
    }

    const result = Cek.eval(term, {
      builtins: Builtins.V1,
      costParams: Cost.PARAMS_V1_BABBAGE
    })

    expect(Either.getOrThrow(result.value)).toEqual({
      _tag: "Const",
      value: 42n
    })
    expect(result.capturedValues).toEqual([
      {
        index: 0,
        id: "identity-result",
        value: {
          _tag: "Const",
          value: 42n
        }
      }
    ])
  })

  it("captures nested terms in evaluation order", () => {
    const term: Term.Term = {
      _tag: "Apply",
      capture: "outer",
      fn: {
        _tag: "Lambda",
        body: { _tag: "Var", index: 1, capture: "body" }
      },
      arg: { _tag: "Const", value: 42n, capture: "arg" }
    }

    const result = Cek.eval(term, {
      builtins: Builtins.V1,
      costParams: Cost.PARAMS_V1_BABBAGE
    })

    expect(result.capturedValues).toEqual([
      {
        index: 0,
        id: "arg",
        value: {
          _tag: "Const",
          value: 42n
        }
      },
      {
        index: 1,
        id: "body",
        value: {
          _tag: "Const",
          value: 42n
        }
      },
      {
        index: 2,
        id: "outer",
        value: {
          _tag: "Const",
          value: 42n
        }
      }
    ])
  })

  it("returns empty captured values when no capture metadata is present", () => {
    const result = Cek.eval(
      { _tag: "Const", value: 42n },
      {
        builtins: Builtins.V1,
        costParams: Cost.PARAMS_V1_BABBAGE
      }
    )

    expect(result.capturedValues).toEqual([])
  })

  it("returns captures produced before an error", () => {
    const term: Term.Term = {
      _tag: "Apply",
      fn: { _tag: "Const", value: 0n, capture: "before-error" },
      arg: { _tag: "Const", value: 1n }
    }

    const result = Cek.eval(term, {
      builtins: Builtins.V1,
      costParams: Cost.PARAMS_V1_BABBAGE
    })

    expect(result.value._tag).toBe("Left")
    expect(result.capturedValues).toEqual([
      {
        index: 0,
        id: "before-error",
        value: {
          _tag: "Const",
          value: 0n
        }
      }
    ])
  })
})
