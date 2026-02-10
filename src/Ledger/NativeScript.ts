import { Either, Schema } from "effect"
import * as Bytes from "../internal/Bytes.js"
import * as Cbor from "../Cbor.js"
import * as PubKeyHash from "./PubKeyHash.js"

export const After = Schema.Struct({
  type: Schema.Literal("after"),
  slot: Schema.Number
})

export type After = Schema.Schema.Type<typeof After>

export const Before = Schema.Struct({
  type: Schema.Literal("before"),
  slot: Schema.Number
})

export type Before = Schema.Schema.Type<typeof Before>

export const All = Schema.Struct({
  type: Schema.Literal("all"),
  scripts: Schema.Array(
    Schema.suspend(
      (): Schema.Schema<NativeScript, NativeScriptJSON> => NativeScript
    )
  )
})

export type All = Schema.Schema.Type<typeof All>

export const Any = Schema.Struct({
  type: Schema.Literal("any"),
  scripts: Schema.Array(
    Schema.suspend(
      (): Schema.Schema<NativeScript, NativeScriptJSON> => NativeScript
    )
  )
})

export type Any = Schema.Schema.Type<typeof Any>

export const AtLeast = Schema.Struct({
  type: Schema.Literal("atLeast"),
  required: Schema.Number,
  scripts: Schema.Array(
    Schema.suspend(
      (): Schema.Schema<NativeScript, NativeScriptJSON> => NativeScript
    )
  )
})

export type AtLeast = Schema.Schema.Type<typeof AtLeast>

export const Sig = Schema.Struct({
  type: Schema.Literal("sig"),
  keyHash: PubKeyHash.PubKeyHash
})

export type Sig = Schema.Schema.Type<typeof Sig>

export type NativeScript =
  | {
      type: "after"
      slot: number
    }
  | {
      type: "before"
      slot: number
    }
  | {
      type: "all"
      scripts: readonly NativeScript[]
    }
  | {
      type: "any"
      scripts: readonly NativeScript[]
    }
  | {
      type: "atLeast"
      required: number
      scripts: readonly NativeScript[]
    }
  | {
      type: "sig"
      keyHash: PubKeyHash.PubKeyHash
    }

export type NativeScriptJSON =
  | {
      type: "after"
      slot: number
    }
  | {
      type: "before"
      slot: number
    }
  | {
      type: "all"
      scripts: readonly NativeScriptJSON[]
    }
  | {
      type: "any"
      scripts: readonly NativeScriptJSON[]
    }
  | {
      type: "atLeast"
      required: number
      scripts: readonly NativeScriptJSON[]
    }
  | {
      type: "sig"
      keyHash: string
    }

export const NativeScript = Schema.Union(After, Before, All, Any, AtLeast, Sig)

export const decode = (
  bytes: Bytes.BytesLike
): Cbor.DecodeResult<NativeScript> =>
  Either.gen(function* () {
    const stream = Bytes.makeStream(bytes)

    if ((yield* stream.peekOne()) == 0) {
      yield* stream.shiftOne()
    }

    const [tag, decodeItem] = yield* Cbor.decodeTagged(stream)

    switch (tag) {
      case 0:
        return {
          type: "sig",
          keyHash: yield* decodeItem(PubKeyHash.decode)
        }
      case 1:
        return {
          type: "all",
          scripts: yield* decodeItem(Cbor.decodeList(decode))
        }
      case 2:
        return {
          type: "any",
          scripts: yield* decodeItem(Cbor.decodeList(decode))
        }
      case 3:
        return {
          type: "atLeast",
          required: Number(yield* decodeItem(Cbor.decodeInt)),
          scripts: yield* decodeItem(Cbor.decodeList(decode))
        }
      case 4:
        return {
          type: "after",
          slot: Number(yield* decodeItem(Cbor.decodeInt))
        }
      case 5:
        return {
          type: "before",
          slot: Number(yield* decodeItem(Cbor.decodeInt))
        }
      default:
        return yield* Either.left(
          new Cbor.DecodeError(stream, `unexpected NativeScript tag ${tag}`)
        )
    }
  })

export function encode(script: NativeScript): number[] {
  switch (script.type) {
    case "sig":
      return Cbor.encodeTuple([
        Cbor.encodeInt(0),
        PubKeyHash.encode(script.keyHash)
      ])
    case "all":
      return Cbor.encodeTuple([
        Cbor.encodeInt(1),
        Cbor.encodeDefList(script.scripts.map(encode))
      ])
    case "any":
      return Cbor.encodeTuple([
        Cbor.encodeInt(2),
        Cbor.encodeDefList(script.scripts.map(encode))
      ])
    case "atLeast":
      return Cbor.encodeTuple([
        Cbor.encodeInt(3),
        Cbor.encodeInt(script.required),
        Cbor.encodeDefList(script.scripts.map(encode))
      ])
    case "after":
      return Cbor.encodeTuple([Cbor.encodeInt(4), Cbor.encodeInt(script.slot)])
    case "before":
      return Cbor.encodeTuple([Cbor.encodeInt(5), Cbor.encodeInt(script.slot)])
  }
}

// simple recursive algorithm
export function validate(ctx: {
  firstValidSlot?: number
  lastValidSlot?: number
  signers: PubKeyHash.PubKeyHash[]
}) {
  return (script: NativeScript): boolean => {
    switch (script.type) {
      case "sig":
        return ctx.signers.includes(script.keyHash)
      case "all":
        return script.scripts.every(validate(ctx))
      case "any":
        return script.scripts.some(validate(ctx))
      case "atLeast":
        return (
          script.scripts
            .map(validate(ctx))
            .reduce((prev: number, b: boolean) => prev + Number(b), 0) >=
          script.required
        )
      case "after":
        if (ctx.firstValidSlot !== undefined) {
          return script.slot < ctx.firstValidSlot
        } else {
          return false
        }
      case "before":
        if (ctx.lastValidSlot !== undefined) {
          return ctx.lastValidSlot < script.slot
        } else {
          return false
        }
    }
  }
}
