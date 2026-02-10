import { describe, expect, it } from "bun:test"
import * as Bytes from "../internal/Bytes.js"
import * as Utf8 from "../internal/Utf8.js"
import * as Hmac from "./Hmac.js"
import * as Pbkdf2 from "./Pbkdf2.js"

describe("Pbkdf2.deriveSync()", () => {
  it('returns #120fb6cffcf8b32c43e7225256c4f837a86548c9 for "password" with prf=hmacSha2_256, salt="salt", nIters=1 and keyLen=20', () => {
    expect(
      Bytes.toHex(
        Pbkdf2.deriveSync(
          Hmac.sha2_256Sync,
          Utf8.encode("password"),
          Utf8.encode("salt"),
          1,
          20
        )
      )
    ).toBe("120fb6cffcf8b32c43e7225256c4f837a86548c9")
  })

  it('returns #e1d9c16aa681708a45f5c7c4e215ceb66e011a2e for "password" with prf=hmacSha2_512, salt="salt", nIters=2 and keyLen=20', () => {
    expect(
      Bytes.toHex(
        Pbkdf2.deriveSync(
          Hmac.sha2_512Sync,
          Utf8.encode("password"),
          Utf8.encode("salt"),
          2,
          20
        )
      )
    ).toBe("e1d9c16aa681708a45f5c7c4e215ceb66e011a2e")
  })
})
