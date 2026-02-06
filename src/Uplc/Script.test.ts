import { describe, it } from "bun:test"
import { runSync } from "effect/Effect"
import * as Bytes from "../internal/Bytes.js"
import * as Script from "./Script.js" 
import * as Term from "./Term.js"

describe("Uplc.Script.decodeRoot", () => {
    it("is able to decode simple v1 script", () => {
        const rootTerm = runSync(Script.decodeRoot({
            version: "PlutusScriptV1",
            root: Bytes.toUint8Array("4e4d01000033222220051200120011")
        }))

        console.log(Term.toString(rootTerm))
    })

    it("is able to decode slightly larger v1 script", () => {
        const rootTerm = runSync(Script.decodeRoot({
            version: "PlutusScriptV1",
            root: Bytes.toUint8Array("581e581c01000033223232222350040071235002353003001498498480048005")
        }))

        console.log(Term.toString(rootTerm))
    })
})