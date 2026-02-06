import { Either, Schema } from "effect"
import * as Bytes from "../internal/Bytes.js"
import * as Flat from "../internal/Flat.js"
import * as Cbor from "../Cbor.js"
import * as Term from "./Term.js"

export const Version = Schema.Union(
    Schema.Literal("PlutusScriptV1"),
    Schema.Literal("PlutusScriptV2"),
    Schema.Literal("PlutusScriptV3")
)

export type Version = Schema.Schema.Type<typeof Version>

/**
 * A Uplc.Script has:
 *   - a version
 *   - a root term
 *   - an optional verbose root term (unoptimized, containing trace statement for debugging)
 */
export const Script = Schema.Struct({
    version: Version,
    root: Schema.Uint8ArrayFromHex,
    verbose: Schema.optional(Schema.Uint8ArrayFromHex)
})

export type Script = Schema.Schema.Type<typeof Script>

export const decodeRoot = (script:  Script) => Either.gen(function* () {
    const stream = Bytes.makeStream(script.root)

    if (!Cbor.isBytes(stream)) {
        return yield* Either.left(new Error("unexpected"))
    }

    let scriptBytes = yield* Cbor.decodeBytes(stream)

    if (Cbor.isBytes(scriptBytes)) {
        scriptBytes = yield* Cbor.decodeBytes(scriptBytes)
    }

    const r = Flat.makeReader(scriptBytes)

    // TODO: check version when Script is deserialized?
    const _version = `${r.readInt()}.${r.readInt()}.${r.readInt()}`

    return yield* Term.decode({})(r)
})