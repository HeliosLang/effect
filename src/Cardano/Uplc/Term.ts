import { Either, Schema } from "effect"
import * as Bytes from "../../Codecs/Bytes.js"
import * as Cbor from "../../Codecs/Cbor.js"
import * as Flat from "../../Codecs/Flat.js"
import * as Metadata from "./Metadata.js"
import * as Type from "./Type.js"
import * as Value from "./Value.js"

export const SourceSpan = Schema.Struct({
  file: Schema.String,
  start: Schema.Struct({
    line: Schema.Number,
    column: Schema.Number
  }),
  end: Schema.optional(
    Schema.Struct({
      line: Schema.Number,
      column: Schema.Number
    })
  )
})

export type SourceSpan = Schema.Schema.Type<typeof SourceSpan>

const SuspendedTerm = Schema.suspend((): Schema.Schema<Term, Term> => Term)

export const Apply = Schema.TaggedStruct("Apply", {
  fn: SuspendedTerm,
  arg: SuspendedTerm,
  capture: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  sourceSpan: Schema.optional(SourceSpan)
})

export type Apply = {
  _tag: "Apply"
  fn: Term
  arg: Term
  capture?: string | undefined
  description?: string | undefined
  sourceSpan?: SourceSpan | undefined
}

const Builtin$ = Schema.TaggedStruct("Builtin", {
  id: Schema.Int, // TODO: also constrain to be positive
  name: Schema.optional(Schema.String), // though is redundant information, it is much easier to keep track of this here for debugging purposes
  capture: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  sourceSpan: Schema.optional(SourceSpan)
})

type Builtin$ = {
  _tag: "Builtin",
  id: number,
  name?: string | undefined,
  capture?: string | undefined,
  description?: string | undefined,
  sourceSpan?: SourceSpan | undefined
}

export { Builtin$ as Builtin }

export const Case = Schema.TaggedStruct("Case", {
  arg: SuspendedTerm,
  cases: Schema.Array(SuspendedTerm),
  capture: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  sourceSpan: Schema.optional(SourceSpan)
})

export type Case = {
  _tag: "Case"
  arg: Term
  cases: readonly Term[]
  capture?: string | undefined
  description?: string | undefined
  sourceSpan?: SourceSpan | undefined
}

export const Const = Schema.TaggedStruct("Const", {
  value: Value.Value,
  name: Schema.optional(Schema.String),
  capture: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  sourceSpan: Schema.optional(SourceSpan)
})

export type Const = {
  _tag: "Const",
  value: Value.Value,
  name?: string | undefined,
  capture?: string | undefined,
  description?: string | undefined,
  sourceSpan?: SourceSpan | undefined
} 


export const Constr = Schema.TaggedStruct("Constr", {
  tag: Schema.Int,
  args: Schema.Array(SuspendedTerm),
  capture: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  sourceSpan: Schema.optional(SourceSpan)
})

export type Constr = {
  _tag: "Constr"
  tag: number
  args: readonly Term[]
  capture?: string | undefined
  description?: string | undefined
  sourceSpan?: SourceSpan | undefined
}

export const Delay = Schema.TaggedStruct("Delay", {
  arg: SuspendedTerm,
  capture: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  name: Schema.optional(Schema.String),
  sourceSpan: Schema.optional(SourceSpan)
})

export type Delay = {
  _tag: "Delay"
  arg: Term
  capture?: string | undefined
  description?: string | undefined
  sourceSpan?: SourceSpan | undefined
  name?: string | undefined
}

const Error$ = Schema.TaggedStruct("Error", {
  capture: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  sourceSpan: Schema.optional(SourceSpan)
})

type Error$ = {
  _tag: "Error",
  capture?: string | undefined,
  description?: string | undefined,
  sourceSpan?: SourceSpan | undefined
}

export { Error$ as Error }

export const Force = Schema.TaggedStruct("Force", {
  arg: SuspendedTerm,
  capture: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  sourceSpan: Schema.optional(SourceSpan)
})

export type Force = {
  _tag: "Force"
  arg: Term
  capture?: string | undefined
  description?: string | undefined
  sourceSpan?: SourceSpan | undefined
}

export const Lambda = Schema.TaggedStruct("Lambda", {
  body: SuspendedTerm,
  argName: Schema.optional(Schema.String),
  capture: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  sourceSpan: Schema.optional(SourceSpan),
  name: Schema.optional(Schema.String)
})

export type Lambda = {
  _tag: "Lambda"
  body: Term
  argName?: string | undefined
  capture?: string | undefined
  description?: string | undefined
  sourceSpan?: SourceSpan | undefined
  name?: string | undefined
}

export const Var = Schema.TaggedStruct("Var", {
  index: Schema.Int, // TODO: also constrain to be positive?
  name: Schema.optional(Schema.String),
  capture: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  sourceSpan: Schema.optional(SourceSpan)
})

export type Var = {
  _tag: "Var",
  index: number,
  name?: string | undefined,
  capture?: string | undefined,
  description?: string | undefined,
  sourceSpan?: SourceSpan | undefined
}

export const Term = Schema.Union(
  Apply,
  Builtin$,
  Case,
  Const,
  Constr,
  Delay,
  Error$,
  Force,
  Lambda,
  Var
)

export type Term =
  | Apply
  | Builtin$
  | Case
  | Const
  | Constr
  | Delay
  | Error$
  | Force
  | Lambda
  | Var

/**
 * Simple recursive algorithm that calculates the number of bits of the flat encoded term
 * @param term
 * @returns
 */
export function flatSize(term: Term): number {
  switch (term._tag) {
    case "Apply":
      return 4 + flatSize(term.fn) + flatSize(term.arg)
    case "Builtin":
      return 4 + 7
    case "Case":
      return 4 + flatSize(term.arg) + Flat.listSize(term.cases, flatSize)
    case "Const":
      return 4 + Value.flatSize(term.value)
    case "Constr":
      return (
        4 + Flat.intSize(term.tag, false) + Flat.listSize(term.args, flatSize)
      )
    case "Delay":
      return 4 + flatSize(term.arg)
    case "Error":
      return 4
    case "Force":
      return 4 + flatSize(term.arg)
    case "Lambda":
      return 4 + flatSize(term.body)
    case "Var":
      return 4 + Flat.intSize(term.index, false)
  }
}

const ApplyTag = 3
const BuiltinTag = 7
const CaseTag = 9
const ConstTag = 4
const ConstrTag = 8
const DelayTag = 1
const ErrorTag = 6
const ForceTag = 5
const LambdaTag = 2
const VarTag = 0

export function flatTag(term: Term): number {
  switch (term._tag) {
    case "Apply":
      return ApplyTag
    case "Builtin":
      return BuiltinTag
    case "Case":
      return CaseTag
    case "Const":
      return ConstTag
    case "Constr":
      return ConstrTag
    case "Delay":
      return DelayTag
    case "Error":
      return ErrorTag
    case "Force":
      return ForceTag
    case "Lambda":
      return LambdaTag
    case "Var":
      return VarTag
  }
}

const decodeFlatBytes = (bytes: Bytes.BytesLike) => {
  const r = Flat.makeReader(Bytes.toUint8Array(bytes))

  void `${r.readInt()}.${r.readInt()}.${r.readInt()}`

  return decode({})(r)
}

/**
 * Verbose encoding format:
 * 
 * {
 *   0: CBORBytes(root flat bytes (i.e. what would be returned if verbose == false)),
 *   1: {
 *     0: CBORList<String> (source names list),
 *     1: CBORList<Int> (flattened source mapping tuples [termIndex, sourceIndex, startLine, startColumn, endLine, endColumn], endLine==-1 and endColumn==-1 means absence of end of sourceSpan, sourceIndex is the index in the source names list),
 *     2: CBORMap<Int, String> (lambda arg names, key is term index)
 *     3: CBORMap<Int, String> (term names, key is term index)
 *     4: CBORMap<Int, String> (term descriptions, key is termIndex)
 *     5: CBORMap<Int, String> (capture names/ids, key is termIndex)
 *   } 
 * }
 */

export const decodeRoot = (bytes: Bytes.BytesLike): Either.Either<Term, Error> => {
  if (!Cbor.isMap(bytes)) {
    return decodeFlatBytes(bytes)
  } else {
    return Cbor.decodeObjectIKey({
      0: Cbor.decodeBytes,
      1: Metadata.decode
    })(bytes).pipe(Either.flatMap(({0: rootFlatBytes, 1: metadata}) => {
      if (!rootFlatBytes) {
        return Either.left(
          new Cbor.DecodeError(
            Bytes.makeStream(bytes),
            "Entry 0 missing from verbose UPLC encoding"
          )
        )
      }

      return decodeFlatBytes(rootFlatBytes).pipe(Either.map(ast => {
        if (metadata) {
          Metadata.apply(ast, metadata)
        }

        return ast
      }))
    }))
  }
}

/**
 * @param uplcVersion 
 * @param term 
 * @param verbose 
 * Optional, defaults to false.
 * Note that if verbose==true but metadata is empty, the plain flat encoded program without metadata is still returned
 * 
 * @returns
 * The encoded program 
 */
export const encodeRoot = (
  uplcVersion: "1.0.0" | "1.1.0",
  term: Term,
  verbose: boolean = false
): Uint8Array => {
  const w = Flat.makeWriter()

  uplcVersion.split(".").forEach((v) => {
    w.writeInt(Number(v))
  })

  encode(w)(term)

  const rootFlatBytes = Bytes.toUint8Array(w.finalize())
  
  if (verbose) {
    const metadata = Metadata.fromRootTerm(term)
    
    if (!Metadata.isEmpty(metadata)) {
      return Bytes.toUint8Array(
        Cbor.encodeObjectIKey({
          0: Cbor.encodeBytes(rootFlatBytes),
          1: Metadata.encode(metadata)
        })
      )
    }
  }

  return rootFlatBytes
}

/**
 * Reads a single Term using stack-based algorithm for its children
 * @param param0
 * @returns
 */
export const decode =
  ({ builtinName }: { builtinName?: (id: number) => string | undefined }) =>
  (r: Flat.Reader): Either.Either<Term, Error> => {
    /**
     * Undefined -> decoding
     * Defined -> collecting
     */
    let term: Term | undefined = undefined

    const collect: (
      | {
          kind: "delay"
        }
      | {
          kind: "lambda"
        }
      | {
          kind: "applyfn"
        }
      | {
          kind: "force"
        }
      | {
          kind: "casearg"
        }
      | {
          kind: "apply"
          fn: Term
        }
      | {
          kind: "constr"
          tag: number
          args: Term[]
        }
      | {
          kind: "case"
          arg: Term
          cases: Term[]
        }
    )[] = []

    while (!term || collect.length > 0) {
      if (!term) {
        const tag = r.readTag()

        switch (tag) {
          case VarTag:
            term = { _tag: "Var", index: Number(r.readInt()) }
            break
          case DelayTag:
            collect.push({ kind: "delay" })
            break
          case LambdaTag:
            collect.push({ kind: "lambda" })
            break
          case ApplyTag:
            collect.push({ kind: "applyfn" })
            break
          case ConstTag:
            {
              const value = Value.decode(r)

              if (Either.isLeft(value)) {
                return Either.left(value.left)
              }
              term = { _tag: "Const", value: value.right }
            }
            break
          case ForceTag:
            collect.push({ kind: "force" })
            break
          case ErrorTag:
            term = { _tag: "Error" }
            break
          case BuiltinTag:
            {
              const id = r.readBuiltinId()
              term = { _tag: "Builtin", id, name: builtinName?.(id) }
            }
            break
          case ConstrTag:
            {
              const constrTag = Number(r.readInt())
              const nilOrCons = r.readBits(1)
              if (nilOrCons == 0) {
                term = { _tag: "Constr", tag: constrTag, args: [] }
              } else {
                collect.push({
                  kind: "constr",
                  tag: constrTag,
                  args: []
                })
              }
            }
            break
          case CaseTag:
            collect.push({ kind: "casearg" })
            break
          default:
            return Either.left(
              new Error("term tag " + tag.toString() + " unhandled")
            )
        }
      } else {
        const c = collect.pop()

        if (!c) {
          return Either.left(
            new Error("Term decoding failed, collect is empty")
          )
        }

        switch (c.kind) {
          case "apply":
            term = { _tag: "Apply", fn: c.fn, arg: term }
            break
          case "applyfn":
            collect.push({ kind: "apply", fn: term })
            term = undefined
            break
          case "case":
            {
              const cases: Term[] = c.cases.concat([term])
              const nilOrCons = r.readBits(1)
              if (nilOrCons == 0) {
                term = { _tag: "Case", arg: c.arg, cases }
              } else {
                collect.push({ ...c, cases })
                term = undefined
              }
            }
            break
          case "casearg":
            {
              const nilOrCons = r.readBits(1)
              if (nilOrCons == 0) {
                term = { _tag: "Case", arg: term, cases: [] }
              } else {
                collect.push({ kind: "case", arg: term, cases: [] })
                term = undefined
              }
            }
            break
          case "constr":
            {
              const args: Term[] = c.args.concat([term])
              const nilOrCons = r.readBits(1)
              if (nilOrCons == 0) {
                term = { _tag: "Constr", tag: c.tag, args }
              } else {
                collect.push({ ...c, args })
                term = undefined
              }
            }
            break
          case "delay":
            term = { _tag: "Delay", arg: term }
            break
          case "force":
            term = { _tag: "Force", arg: term }
            break
          case "lambda":
            term = { _tag: "Lambda", body: term }
            break
        }
      }
    }

    if (term === undefined) {
      return Either.left(new Error("term decoding failed"))
    }

    return Either.right(term)
  }

/**
 * Mutates the Flat.Writer
 * @param w
 */
export const encode =
  (w: Flat.Writer) =>
  (term: Term): void => {
    const pending: (
      | {
          kind: "notInList"
          term: Term
        }
      | {
          kind: "listItem"
          term: Term
        }
      | {
          kind: "listEnd"
        }
    )[] = [
      {
        kind: "notInList",
        term
      }
    ]

    let action = pending.pop()

    while (action) {
      if (action.kind == "listItem" || action.kind == "notInList") {
        if (action.kind == "listItem") {
          w.writeListCons()
        }

        const t = action.term
        switch (t._tag) {
          case "Builtin":
            w.writeTermTag(BuiltinTag)
            w.writeBuiltinId(t.id)
            break
          case "Apply":
            w.writeTermTag(ApplyTag)
            pending.push({ kind: "notInList", term: t.arg })
            pending.push({ kind: "notInList", term: t.fn })
            break
          case "Case":
            w.writeTermTag(CaseTag)
            pending.push({ kind: "listEnd" })
            for (let i = t.cases.length - 1; i >= 0; i--) {
              pending.push({ kind: "listItem", term: t.cases[i] })
            }
            pending.push({ kind: "notInList", term: t.arg })
            break
          case "Const":
            if (
              t.value !== null &&
              typeof t.value == "object" &&
              ("g1Element" in t.value ||
                "g2Element" in t.value ||
                "mlResult" in t.value)
            ) {
              throw new Error("not yet implemented")
            } else {
              w.writeTermTag(ConstTag)
              w.writeTypeBits(Value.toType(t.value))
              Value.toFlat(w)(t.value)
            }
            break
          case "Constr":
            w.writeTermTag(ConstrTag)
            w.writeInt(t.tag)
            pending.push({ kind: "listEnd" })
            for (let i = t.args.length - 1; i >= 0; i--) {
              pending.push({ kind: "listItem", term: t.args[i] })
            }
            break
          case "Delay":
            w.writeTermTag(DelayTag)
            pending.push({ kind: "notInList", term: t.arg })
            break
          case "Error":
            w.writeTermTag(ErrorTag)
            break
          case "Force":
            w.writeTermTag(ForceTag)
            pending.push({ kind: "notInList", term: t.arg })
            break
          case "Lambda":
            w.writeTermTag(LambdaTag)
            pending.push({ kind: "notInList", term: t.body })
            break
          case "Var":
            w.writeTermTag(VarTag)
            w.writeInt(BigInt(t.index))
            break
        }
      } else {
        w.writeListNil()
      }

      action = pending.pop()
    }
  }

/**
 * Simple recursive algorithm the generates the textual UPLC representation
 * @param term
 * @returns
 */
export function toString(term: Term): string {
  switch (term._tag) {
    case "Apply":
      return `[${toString(term.fn)} ${toString(term.arg)}${
        term.capture !== undefined ? ` #capture=${term.capture}` : ""
      }]`
    case "Builtin":
      return `(builtin ${term.id.toString()})`
    case "Case":
      return `(case (${toString(term.arg)}) ${term.cases.map((c) => `(${toString(c)})`).join(" ")})`
    case "Const":
      return `(con ${Type.toString(Value.toType(term.value))} ${Value.toString(term.value)})`
    case "Constr":
      return `(constr ${term.tag} ${term.args.map(toString).join(" ")})`
    case "Delay":
      return `(delay ${toString(term.arg)})`
    case "Error":
      return "(error)"
    case "Force":
      return `(force ${toString(term.arg)})`
    case "Lambda":
      return `(lam ${
        term.argName !== undefined ? `${term.argName} ` : ""
      }${toString(term.body)})`
    case "Var":
      return term.name ?? `x${term.index}`
  }
}
