import { describe, expect, it } from "bun:test"
import * as AssetClass from "./AssetClass"

describe("AssetClass.isValid", () => {
    it("empty string is valid", () => {
        expect(AssetClass.isValid("")).toBe(true)
    })
})