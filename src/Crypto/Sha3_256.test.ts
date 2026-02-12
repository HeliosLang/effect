import { describe, expect, it } from "bun:test"
import * as Bytes from "../internal/Bytes.js"
import * as Utf8 from "../internal/Utf8.js"
import * as Sha3_256 from "./Sha3_256.js"

/**
 * Taken from https://www.di-mgt.com.au/sha_testvectors.html
 */
const testVector1: [string, string][] = [
  ["", "a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a"],
  ["abc", "3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532"],
  [
    "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq",
    "41c0dba2a9d6240849100376a8235e2c82e1b9998a999e21db32dd97496d3376"
  ],
  [
    "abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu",
    "916f6061fe879741ca6469b43971dfdb28b1a32dc36cb3254e812be27aad1d18"
  ]
]

const testVector2: [number[], string][] = [
  [
    new Array(136).fill(1),
    "b36dc2167c4d9dda1a58b87046c8d76a6359afe3612c4de8a38857e09117b2db"
  ],
  [
    new Array(135).fill(2),
    "5bdf5d815d29a9d7161c66520efc17c2edd7898f2b99a029e8d2e4ff153407f4"
  ],
  [
    new Array(134).fill(3),
    "8e6575663dfb75a88f94a32c5b363c410278b65020734560d968aadd6896a621"
  ],
  [
    new Array(137).fill(4),
    "f10b39c3e455006aa42120b9751faa0f35c821211c9d086beb28bf3c4134c6c6"
  ],
  [
    new Array(1_000_000).fill(0x61),
    "5c8875ae474a3634ba4fd55ec85bffd661f32aca75c6d699d0cdcb6c115891c1"
  ]
]

describe("Crypto.Sha3_256.hashSync()", () => {
  testVector1.forEach(([msg, hash]) => {
    it(`returns ${hash} for ${msg}`, () => {
      expect(Bytes.toHex(Sha3_256.hashSync(Utf8.encode(msg)))).toBe(hash)
    })
  })

  testVector2.forEach(([msg, hash]) => {
    it(`returns ${hash} for [${msg[0]}, ${msg[1]}, ${msg[2]}, ...] (length=${msg.length})`, () => {
      expect(Bytes.toHex(Sha3_256.hashSync(msg))).toBe(hash)
    })
  })
})
