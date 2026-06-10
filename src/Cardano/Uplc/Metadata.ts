import { Either } from "effect"
import * as Bytes from "../../Codecs/Bytes.js"
import * as Cbor from "../../Codecs/Cbor.js"
import type { Term } from "./Term.js"

export type Metadata = {
  sourceNames: string[]
  sourceSpans: number[] // already flattened
  argNames: [number, string][]
  names: [number, string][]
  descriptions: [number, string][]
  captures: [number, string][]
}

export function traverseTerms(
  root: Term,
  callback: (term: Term, index: number) => void
): void {
  let terms: Term[] = [root]
  let term = terms.pop()
  let index = 0

  while (term) {
    callback(term, index)

    switch (term._tag) {
      case "Apply":
        terms = terms.concat([term.arg, term.fn])
        break
      case "Case":
        terms = terms.concat(term.cases.slice().reverse(), [term.arg])
        break
      case "Constr":
        terms = terms.concat(term.args.slice().reverse())
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
    index++
  }
}

export function termByIndex(root: Term): Map<number, Term> {
  const res = new Map<number, Term>()

  traverseTerms(root, (term, index) => {
    res.set(index, term)
  })

  return res
}

export const decode = (
  bytes: Bytes.BytesLike
): Cbor.DecodeResult<Metadata> =>
  Cbor.decodeObjectIKey({
    0: Cbor.decodeList(Cbor.decodeString),
    1: Cbor.decodeList(Cbor.decodeIntAsNumber),
    2: Cbor.decodeMap(Cbor.decodeIntAsNumber, Cbor.decodeString),
    3: Cbor.decodeMap(Cbor.decodeIntAsNumber, Cbor.decodeString),
    4: Cbor.decodeMap(Cbor.decodeIntAsNumber, Cbor.decodeString),
    5: Cbor.decodeMap(Cbor.decodeIntAsNumber, Cbor.decodeString)
  })(bytes).pipe(
    Either.map(
      ({
        0: sourceNames,
        1: sourceSpans,
        2: argNames,
        3: termNames,
        4: termDescriptions,
        5: captures
      }): Metadata => ({
        sourceNames: sourceNames ?? [],
        sourceSpans: sourceSpans ?? [],
        argNames: argNames ?? [],
        names: termNames ?? [],
        descriptions: termDescriptions ?? [],
        captures: captures ?? []
      })
    )
  )

export const encode = (metadata: Metadata): number[] => Cbor.encodeObjectIKey({
    0: Cbor.encodeList(metadata.sourceNames.map((s) => Cbor.encodeString(s))),
    1: Cbor.encodeList(metadata.sourceSpans.map(Cbor.encodeInt)),
    2: encodeStringMap(metadata.argNames),
    3: encodeStringMap(metadata.names),
    4: encodeStringMap(metadata.descriptions),
    5: encodeStringMap(metadata.captures)
  })

function encodeStringMap(entries: [number, string][]): number[] {
  return Cbor.encodeMap(
    entries.map(([key, value]) => [
      Cbor.encodeInt(key),
      Cbor.encodeString(value)
    ])
  )
}

export const fromRootTerm = (root: Term): Metadata => {
  const sourceNames: string[] = []
  const metadata: Metadata = {
    sourceNames,
    sourceSpans: [],
    argNames: [],
    names: [],
    descriptions: [],
    captures: []
  }

  traverseTerms(root, (term, index) => {
    if (term.sourceSpan) {
      let sourceIndex = sourceNames.indexOf(term.sourceSpan.file)
      if (sourceIndex == -1) {
        sourceIndex = sourceNames.length
        sourceNames.push(term.sourceSpan.file)
      }

      metadata.sourceSpans.push(
        index,
        sourceIndex,
        term.sourceSpan.start.line,
        term.sourceSpan.start.column,
        term.sourceSpan.end?.line ?? -1,
        term.sourceSpan.end?.column ?? -1
      )
    }

    if (term._tag == "Lambda" && term.argName !== undefined) {
      metadata.argNames.push([index, term.argName])
    }

    if (
      (term._tag == "Builtin" ||
        term._tag == "Const" ||
        term._tag == "Delay" ||
        term._tag == "Lambda" ||
        term._tag == "Var") &&
      term.name !== undefined
    ) {
      metadata.names.push([index, term.name])
    }

    if (term.description !== undefined) {
      metadata.descriptions.push([index, term.description])
    }

    if (term.capture !== undefined) {
      metadata.captures.push([index, term.capture])
    }
  })

  return metadata
}

export function isEmpty(metadata: Metadata): boolean {
  return (
    metadata.sourceNames.length == 0 &&
    metadata.sourceSpans.length == 0 &&
    metadata.argNames.length == 0 &&
    metadata.names.length == 0 &&
    metadata.descriptions.length == 0 &&
    metadata.captures.length == 0
  )
}

/**
 * Metadata is applied to the UPLC Ast in 5 loops: 
 *  1. source spans
 *  2. lambda arg names
 *  3. term names
 *  4. term descriptions
 *  5. capture ids
 * 
 * The Ast fields are mutated
 * @param root 
 * @param metadata 
 */
export function apply(root: Term, metadata: Metadata): void {
  const terms = termByIndex(root)

  // apply source spans
  for (let i = 0; i < metadata.sourceSpans.length; i += 6) {
    const [termIndex, sourceIndex, startLine, startColumn, endLine, endColumn] =
      metadata.sourceSpans.slice(i, i + 6)

    const term = terms.get(termIndex)
    const file = metadata.sourceNames[sourceIndex]

    if (term && file !== undefined) {
      term.sourceSpan = {
        file,
        start: {
          line: startLine,
          column: startColumn
        },
        end:
          endLine == -1 || endColumn == -1
            ? undefined
            : {
                line: endLine,
                column: endColumn
              }
      }
    }
  }

  for (const [index, argName] of metadata.argNames) {
    const term = terms.get(index)
    if (term?._tag == "Lambda") {
      term.argName = argName
    }
  }

  for (const [index, name] of metadata.names) {
    const term = terms.get(index)
    if (
      term?._tag == "Builtin" ||
      term?._tag == "Const" ||
      term?._tag == "Delay" ||
      term?._tag == "Lambda" ||
      term?._tag == "Var"
    ) {
      term.name = name
    }
  }

  for (const [index, description] of metadata.descriptions) {
    const term = terms.get(index)
    if (term) {
      term.description = description
    }
  }

  for (const [index, capture] of metadata.captures) {
    const term = terms.get(index)
    if (term) {
      term.capture = capture
    }
  }
}
