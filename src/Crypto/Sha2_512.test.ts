import { describe, expect, it } from "bun:test"
import { Effect } from "effect"
import * as Bytes from "../Codecs/Bytes.js"
import * as Utf8 from "../Codecs/Utf8.js"
import * as Sha2_512 from "./Sha2_512.js"

/**
 * Each entry: first string is msg, second string is hex hash result
 * Taken from: https://www.di-mgt.com.au/sha_testvectors.html
 */
const testVector: [string, string][] = [
  [
    "",
    "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e"
  ],
  [
    "abc",
    "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f"
  ],
  [
    "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq",
    "204a8fc6dda82f0a0ced7beb8e08a41657c16ef468b228a8279be331a703c33596fd15c13b1b07f9aa1d3bea57789ca031ad85c7a71dd70354ec631238ca3445"
  ],
  [
    "abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstuu",
    "23565d109ac0e2aa9fb162385178895058b28489a6bc31cb55491ed83956851ab1d4bbd46440586f5c9c4b69c9c280118cbc55c71495d258cc27cc6bb25ee720"
  ]
]

describe("Crypto.Sha2_512.hashSync", () => {
  testVector.forEach(([msg, hash]) => {
    it(`returns ${hash} for ${msg}`, () => {
      expect(Bytes.toHex(Sha2_512.hashSync(Utf8.encode(msg)))).toBe(hash)
    })
  })
})

describe("Crypto.Sha2_512.hash", () => {
  testVector.forEach(([msg, h]) => {
    it(`returns ${h} for ${msg}`, async () => {
      expect(
        Bytes.toHex(await Effect.runPromise(Sha2_512.hash(Utf8.encode(msg))))
      ).toBe(h)
    })
  })
})

describe("Crypto.Sha2_512.hashWebCrypto", () => {
  testVector.forEach(([msg, h]) => {
    it(`returns ${h} for ${msg}`, async () => {
      expect(
        Bytes.toHex(
          await Effect.runPromise(Sha2_512.hashWebCrypto(Utf8.encode(msg)))
        )
      ).toBe(h)
    })
  })
})

describe("Crypto.Sha2_512.hashNode", () => {
  testVector.forEach(([msg, h]) => {
    it(`returns ${h} for ${msg}`, async () => {
      expect(
        Bytes.toHex(
          await Effect.runPromise(Sha2_512.hashNode(Utf8.encode(msg)))
        )
      ).toBe(h)
    })
  })
})
