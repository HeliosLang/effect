import { describe, expect, it } from "bun:test"
import * as AssetClass from "./AssetClass.js"

describe("AssetClass.isValid", () => {
  it("empty string is valid", () => {
    expect(AssetClass.isValid("")).toBe(true)
  })

  it("120 characeter hexadecimal string is valid", () => {
    expect(
      AssetClass.isValid(
        "f5c68f1631b427e7e8b5c84c6116aeee9bf8aa889af7474b25fd4f5108ad12e2cf206708f29c98d9cf8c3363c29b22f3817a0277f00da9a99c1f3b2f"
      )
    ).toBe(true)
  })

  it("uneven length hexadecimal string is invalud", () => {
    expect(
      AssetClass.isValid(
        "f5c68f1631b427e7e8b5c84c6116aeee9bf8aa889af7474b25fd4f5108ad12e2cf206708f29c98d9cf8c3363c29b22f3817a0277f00da9a99c1f3b2"
      )
    ).toBe(false)
  })

  it("122 character hexadecimal string is invalid", () => {
    expect(
      AssetClass.isValid(
        "f5c68f1631b427e7e8b5c84c6116aeee9bf8aa889af7474b25fd4f5108ad12e2cf206708f29c98d9cf8c3363c29b22f3817a0277f00da9a99c1f3b2fff"
      )
    ).toBe(false)
  })
})
