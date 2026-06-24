import { describe, expect, it } from "bun:test"
import { Effect } from "effect"
import * as Cbor from "../../Codecs/Cbor.js"
import * as Term from "./Term.js"

function decodeRoot(bytes: Uint8Array | number[]): Term.Term {
  return Effect.runSync(Term.decodeRoot(bytes))
}

function collectCaptures(root: Term.Term): string[] {
  const captures: string[] = []
  const terms: Term.Term[] = [root]
  let term = terms.pop()

  while (term) {
    captures.push((term as Term.Term & { capture?: string }).capture ?? "")

    switch (term._tag) {
      case "Apply":
        terms.push(term.arg, term.fn)
        break
      case "Case":
        terms.push(...term.cases.slice().reverse(), term.arg)
        break
      case "Constr":
        terms.push(...term.args.slice().reverse())
        break
      case "Delay":
      case "Force":
        terms.push(term.arg)
        break
      case "Lambda":
        terms.push(term.body)
        break
      case "Builtin":
      case "Const":
      case "Error":
      case "Var":
        break
    }

    term = terms.pop()
  }

  return captures
}

describe("Uplc.Term verbose encoding", () => {
  it("walks terms using front-relative preorder indices matching ../uplc", () => {
    const term: Term.Term = {
      _tag: "Apply",
      capture: "0",
      fn: {
        _tag: "Case",
        capture: "1",
        arg: { _tag: "Var", index: 1, capture: "2" },
        cases: [
          {
            _tag: "Delay",
            capture: "3",
            arg: { _tag: "Const", value: 0n, capture: "4" }
          },
          {
            _tag: "Constr",
            tag: 0,
            capture: "5",
            args: [
              {
                _tag: "Force",
                capture: "6",
                arg: { _tag: "Error", capture: "7" }
              },
              { _tag: "Builtin", id: 0, capture: "8" }
            ]
          }
        ]
      },
      arg: {
        _tag: "Lambda",
        argName: "x",
        capture: "9",
        body: { _tag: "Var", index: 1, capture: "10" }
      }
    }

    const decoded = decodeRoot(Term.encodeRoot("1.1.0", term, true))

    expect(collectCaptures(decoded)).toEqual([
      "0",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10"
    ])
  })

  it("roundtrips source spans, names, descriptions and captures", () => {
    const term: Term.Term = {
      _tag: "Apply",
      capture: "apply",
      description: "apply description",
      sourceSpan: {
        file: "main.hl",
        start: { line: 1, column: 2 },
        end: { line: 3, column: 4 }
      },
      fn: {
        _tag: "Lambda",
        argName: "x",
        name: "identity",
        description: "lambda description",
        sourceSpan: {
          file: "main.hl",
          start: { line: 5, column: 6 }
        },
        body: { _tag: "Var", index: 1, name: "x" }
      },
      arg: { _tag: "Const", value: 42n, name: "answer" }
    }

    const decoded = decodeRoot(Term.encodeRoot("1.0.0", term, true))

    expect(decoded).toEqual(term)
  })

  it("still decodes legacy verbose flat bytes", () => {
    const term: Term.Term = { _tag: "Const", value: true }
    const legacyVerbose = Term.encodeRoot("1.0.0", term)

    expect(decodeRoot(legacyVerbose)).toEqual(term)
  })

  it("fails for unknown verbose map keys", () => {
    const term: Term.Term = { _tag: "Const", value: 1n }
    const rootFlatBytes = Term.encodeRoot("1.0.0", term)
    const verbose = Cbor.encodeObjectIKey({
      0: Cbor.encodeBytes(rootFlatBytes),
      1: Cbor.encodeObjectIKey({
        5: Cbor.encodeMap([[Cbor.encodeInt(0), Cbor.encodeString("root")]]),
        99: Cbor.encodeList([Cbor.encodeString("ignored")])
      }),
      99: Cbor.encodeObjectIKey({
        0: Cbor.encodeString("ignored")
      })
    })

    expect(() => decodeRoot(verbose)).toThrow()
  })

  it("doesn't change non-verbose flat encoding", () => {
    const termWithoutMetadata: Term.Term = {
      _tag: "Apply",
      fn: { _tag: "Lambda", body: { _tag: "Var", index: 1 } },
      arg: { _tag: "Const", value: 1n }
    }
    const termWithMetadata: Term.Term = {
      _tag: "Apply",
      capture: "ignored",
      fn: { _tag: "Lambda", argName: "x", body: { _tag: "Var", index: 1 } },
      arg: { _tag: "Const", value: 1n }
    }

    const nonVerbose = Term.encodeRoot("1.0.0", termWithMetadata, false)
    const plain = Term.encodeRoot("1.0.0", termWithoutMetadata)

    expect(nonVerbose).toEqual(plain)
    expect(decodeRoot(Term.encodeRoot("1.0.0", termWithMetadata))).toEqual(
      termWithoutMetadata
    )
    expect(
      decodeRoot(Term.encodeRoot("1.0.0", termWithMetadata, true))
    ).toMatchObject({
      _tag: "Apply",
      capture: "ignored"
    })
  })
})
