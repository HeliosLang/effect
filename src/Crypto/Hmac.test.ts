import { describe, expect, it } from "bun:test"
import * as Bytes from "../internal/Bytes.js"
import * as Utf8 from "../internal/Utf8.js"
import * as Hmac from "./Hmac.js"

describe("Crypto.Hmac.sha2_256Sync()", () => {
  it('returns #f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8 for "The quick brown fox jumps over the lazy dog" with key="key"', () => {
    expect(
      Bytes.toHex(
        Hmac.sha2_256Sync(
          Utf8.encode("key"),
          Utf8.encode("The quick brown fox jumps over the lazy dog")
        )
      )
    ).toBe("f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8")
  })
})

describe("Crypto.Hmac.sha2_512Sync()", () => {
  it('returns #b42af09057bac1e2d41708e48a902e09b5ff7f12ab428a4fe86653c73dd248fb82f948a549f7b791a5b41915ee4d1ec3935357e4e2317250d0372afa2ebeeb3a for "The quick brown fox jumps over the lazy dog" with key="key"', () => {
    expect(
      Bytes.toHex(
        Hmac.sha2_512Sync(
          Utf8.encode("key"),
          Utf8.encode("The quick brown fox jumps over the lazy dog")
        )
      )
    ).toBe(
      "b42af09057bac1e2d41708e48a902e09b5ff7f12ab428a4fe86653c73dd248fb82f948a549f7b791a5b41915ee4d1ec3935357e4e2317250d0372afa2ebeeb3a"
    )
  })
})
