import { describe, expect, it } from "bun:test"
import * as AssetClass from "./AssetClass.js"

describe("AssetClass.isValid", () => {
  it("empty string is valid", () => {
    expect(AssetClass.isValid("")).toBe(true)
  })
})
