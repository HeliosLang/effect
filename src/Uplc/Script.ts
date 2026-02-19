import { Effect, Either, Encoding, Schema } from "effect"
import * as Bytes from "../internal/Bytes.js"
import * as Flat from "../internal/Flat.js"
import type { ValidatorHash } from "../Ledger/ValidatorHash.js"
import * as Cbor from "../Cbor.js"
import * as Crypto from "../Crypto"
import * as Builtins from "./Builtins.js"
import * as Cek from "./Cek.js"
import * as Term from "./Term.js"
import * as Value from "./Value.js"

export const Version = Schema.Union(
  Schema.Literal(1),
  Schema.Literal(2),
  Schema.Literal(3)
)

export type Version = Schema.Schema.Type<typeof Version>

const ScriptWithoutVersion = Schema.Struct({
  /**
   * `root` is the flat encoded root term (padded)
   */
  root: Schema.Uint8ArrayFromHex,
  verbose: Schema.optional(Schema.Uint8ArrayFromHex)
})

/**
 * A Uplc.Script has:
 *   - a version
 *   - a root term
 *   - an optional verbose root term (unoptimized, containing trace statement for debugging)
 */
export const Script = Schema.extend(
  ScriptWithoutVersion,
  Schema.Struct({
    version: Version
  })
)

export const ScriptV1 = Schema.extend(
  ScriptWithoutVersion,
  Schema.Struct({
    version: Schema.Literal(1)
  })
)

export const ScriptV2 = Schema.extend(
  ScriptWithoutVersion,
  Schema.Struct({
    version: Schema.Literal(2)
  })
)

export const ScriptV3 = Schema.extend(
  ScriptWithoutVersion,
  Schema.Struct({
    version: Schema.Literal(3)
  })
)

export type Script<V extends Version = Version> = {
  version: V
  root: Uint8Array
  verbose?: Uint8Array | undefined
}

export const entryPoint = (script: Script) =>
  Either.gen(function* () {
    const r = Flat.makeReader(script.root)

    void `${r.readInt()}.${r.readInt()}.${r.readInt()}`

    return yield* Term.decode({})(r)
  })

export const decodeRoot = (
  bytes: Bytes.BytesLike
): Cbor.DecodeResult<{ uplcVersion: string; root: Uint8Array }> =>
  Either.gen(function* () {
    const stream = Bytes.makeStream(bytes)

    if (!Cbor.isBytes(stream)) {
      return yield* Either.left(new Cbor.DecodeError(stream, "unexpected"))
    }

    let scriptBytes = yield* Cbor.decodeBytes(stream)

    if (Cbor.isBytes(scriptBytes)) {
      scriptBytes = yield* Cbor.decodeBytes(scriptBytes)
    }

    const r = Flat.makeReader(scriptBytes)
    const uplcVersion = `${r.readInt()}.${r.readInt()}.${r.readInt()}`

    return {
      uplcVersion,
      root: new Uint8Array(scriptBytes)
    }
  })

export const decode =
  <V extends Version>(version: V) =>
  (bytes: Bytes.BytesLike): Cbor.DecodeResult<Script<V>> =>
    Either.gen(function* () {
      const { uplcVersion, root } = yield* decodeRoot(bytes)

      switch (version) {
        case 1:
        case 2:
          if (uplcVersion != "1.0.0") {
            return yield* Either.left(
              new Cbor.DecodeError(
                Bytes.makeStream(bytes),
                `unexpected Uplc version '${uplcVersion}'`
              )
            )
          }
          break
        case 3:
          if (uplcVersion != "1.1.0") {
            return yield* Either.left(
              new Cbor.DecodeError(
                Bytes.makeStream(bytes),
                `unexpected Uplc version '${uplcVersion}'`
              )
            )
          }
          break
      }

      return {
        version,
        root
      } satisfies Script<V>
    })

export function encode(script: Script): number[] {
  return Cbor.encodeBytes(Cbor.encodeBytes(Array.from(script.root)))
}

/**
 * @param script
 * @param args
 * If undefined -> don't do anything
 * If empty -> force term
 * If non-empty -> apply consecutive const terms
 * @param costParams
 */
const eval$ = (
  script: Script,
  args: readonly Value.Value[] | undefined,
  costParams: readonly number[],
  logger: Cek.Logger | undefined = undefined
) =>
  Effect.gen(function* () {
    let root = yield* entryPoint(script)

    if (args !== undefined) {
      if (args.length == 0) {
        root = { _tag: "Force", arg: root }
      } else {
        for (const arg of args) {
          root = { _tag: "Apply", fn: root, arg: { _tag: "Const", value: arg } }
        }
      }
    }

    const ctx: Cek.EvalContext = (() => {
      switch (script.version) {
        case 1:
          return { builtins: Builtins.V1, costParams, logger }
        case 2:
          return { builtins: Builtins.V2, costParams, logger }
        case 3:
          return { builtins: Builtins.V3, costParams, logger }
      }
    })()

    return Cek.eval(root, ctx)
  })

export { eval$ as eval }

export function hash(script: Script): ValidatorHash {
  const bytes = Cbor.encodeBytes(script.root)

  bytes.unshift(script.version)

  return Encoding.encodeHex(Crypto.Blake2b.hashSync(bytes, 28)) as ValidatorHash
}

export const isVersion =
  <V extends Version>(v: V) =>
  (script: Script): script is Script<V> =>
    script.version == v
