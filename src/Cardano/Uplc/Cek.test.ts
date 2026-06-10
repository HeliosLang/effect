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

  it("captures only marked lambda arguments when capture is enabled", () => {
    const term: Term.Term = {
      _tag: "Apply",
      fn: {
        _tag: "Lambda",
        argName: "__helios_capture:quotient",
        body: {
          _tag: "Apply",
          fn: {
            _tag: "Lambda",
            argName: "plain",
            body: { _tag: "Var", index: 2 }
          },
          arg: { _tag: "Const", value: 7n }
        }
      },
      arg: { _tag: "Const", value: 42n }
    }

    const normal = Cek.eval(term, {
      builtins: Builtins.V1,
      costParams: Cost.PARAMS_V1_BABBAGE
    })
    const captured = Cek.evalWithCapture(term, {
      builtins: Builtins.V1,
      costParams: Cost.PARAMS_V1_BABBAGE
    })

    expect(normal.captured).toEqual([])
    expect(captured.captured).toEqual([
      {
        index: 0,
        id: "quotient",
        value: {
          _tag: "Const",
          value: 42n,
          name: "__helios_capture:quotient"
        },
        callSite: {
          sourceSpan: undefined,
          functionName: undefined,
          arguments: [
            {
              _tag: "Const",
              value: 42n,
              name: "__helios_capture:quotient"
            }
          ]
        }
      }
    ])
  })
})
