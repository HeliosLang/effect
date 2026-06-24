import { describe, expect, it } from "bun:test"
import * as AssetClass from "./AssetClass.js"
import * as Assets from "./Assets.js"
import type * as MintingPolicy from "./MintingPolicy.js"

describe("Assets.sort", () => {
  it("uses canonical shortest-first token ordering by default", () => {
    const policy = "01".repeat(28) as MintingPolicy.MintingPolicy
    const longerLexicographicallyEarlier = AssetClass.make(policy, [0x01, 0x01])
    const shorterLexicographicallyLater = AssetClass.make(policy, [0x02])

    const assets: Assets.Assets = {
      [longerLexicographicallyEarlier]: 1n,
      [shorterLexicographicallyLater]: 1n
    }

    const sorted = Assets.sort()(assets)

    expect(Object.keys(sorted)).toEqual([
      shorterLexicographicallyLater,
      longerLexicographicallyEarlier
    ])
    expect(Assets.isSorted(sorted)).toBeTrue()
    expect(Assets.isSorted(sorted, { shortestFirst: false })).toBeFalse()
  })
})
