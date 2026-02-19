import { describe, expect, it } from "bun:test"
import { Effect } from "effect"
import * as Bytes from "../internal/Bytes.js"
import * as Utf8 from "../internal/Utf8.js"
import * as Sha2_256 from "./Sha2_256.js"

/**
 * Each entry: text input hex bytes output
 * Taken from: https://www.di-mgt.com.au/sha_testvectors.html
 */
const testVector: [string, string][] = [
  ["", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
  ["abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
  [
    "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq",
    "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1"
  ],
  [
    "abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu",
    "cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1"
  ]
]

describe("Crypto.Sha2_256.hashSync", () => {
  it('returns [223, 253, 96, ...] for "Hello, World!"', () => {
    expect(Sha2_256.hashSync(Utf8.encode("Hello, World!"))).toEqual(
      new Uint8Array([
        223, 253, 96, 33, 187, 43, 213, 176, 175, 103, 98, 144, 128, 158, 195,
        165, 49, 145, 221, 129, 199, 247, 10, 75, 40, 104, 138, 54, 33, 130,
        152, 111
      ])
    )
  })

  testVector.forEach(([msg, hash]) => {
    it(`returns #${hash} for "${msg}"`, () => {
      expect(Bytes.toHex(Sha2_256.hashSync(Utf8.encode(msg)))).toBe(hash)
    })
  })
})

describe("Crypto.Sha2_256.hash", () => {
  it('returns [223, 253, 96, ...] for "Hello, World!"', async () => {
    expect(
      await Effect.runPromise(Sha2_256.hash(Utf8.encode("Hello, World!")))
    ).toEqual(
      new Uint8Array([
        223, 253, 96, 33, 187, 43, 213, 176, 175, 103, 98, 144, 128, 158, 195,
        165, 49, 145, 221, 129, 199, 247, 10, 75, 40, 104, 138, 54, 33, 130,
        152, 111
      ])
    )
  })

  testVector.forEach(([msg, hash]) =>
    it(`returns #${hash} for "${msg}"`, async () => {
      expect(
        Bytes.toHex(await Effect.runPromise(Sha2_256.hash(Utf8.encode(msg))))
      ).toBe(hash)
    })
  )
})

describe("Crypto.Sha2_256.hashWebCrypto", () => {
  it('returns [223, 253, 96, ...] for "Hello, World!"', async () => {
    expect(
      await Effect.runPromise(
        Sha2_256.hashWebCrypto(Utf8.encode("Hello, World!"))
      )
    ).toEqual(
      new Uint8Array([
        223, 253, 96, 33, 187, 43, 213, 176, 175, 103, 98, 144, 128, 158, 195,
        165, 49, 145, 221, 129, 199, 247, 10, 75, 40, 104, 138, 54, 33, 130,
        152, 111
      ])
    )
  })

  testVector.forEach(([msg, hash]) =>
    it(`returns #${hash} for "${msg}"`, async () => {
      expect(
        Bytes.toHex(
          await Effect.runPromise(Sha2_256.hashWebCrypto(Utf8.encode(msg)))
        )
      ).toBe(hash)
    })
  )
})

describe("Crypto.Sha2_256.hashNode", () => {
  it('returns [223, 253, 96, ...] for "Hello, World!"', async () => {
    expect(
      await Effect.runPromise(Sha2_256.hashNode(Utf8.encode("Hello, World!")))
    ).toEqual(
      new Uint8Array([
        223, 253, 96, 33, 187, 43, 213, 176, 175, 103, 98, 144, 128, 158, 195,
        165, 49, 145, 221, 129, 199, 247, 10, 75, 40, 104, 138, 54, 33, 130,
        152, 111
      ])
    )
  })

  testVector.forEach(([msg, h]) =>
    it(`returns #${h} for "${msg}"`, async () => {
      expect(
        Bytes.toHex(
          await Effect.runPromise(Sha2_256.hashNode(Utf8.encode(msg)))
        )
      ).toBe(h)
    })
  )
})
