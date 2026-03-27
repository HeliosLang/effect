import { describe, expect, it } from "bun:test"
import { Effect, Either } from "effect"
import * as Bytes from "../../Codecs/Bytes.js"
import * as Address from "../Ledger/Address.js"
import * as Credential from "../Ledger/Credential.js"
import * as PubKey from "../Ledger/PubKey.js"
import * as Bip32 from "../../Crypto/Bip32.js"
import * as Sign1 from "./Sign1.js"

const decodeAddress = (bytes: string): Address.Address =>
  Either.getOrThrow(Address.decode(bytes))

describe("Cardano.Cose.Sign1", () => {
  it("encodes correctly", () => {
    const sign1 = Either.getOrThrow(
      Sign1.make(
        decodeAddress(
          "603a5904074323a4cddfe1103969962a5807c6c37495db9df48d019f9a"
        ),
        "1b00000194d70e512f",
        "32f4643ec6ae20b5c6b9c71d89eadbbdaf42bffadcb8bbda22203fb98640bf491530541bb659fe019b2ef5b0cefd7d683ea8a945a07333185317b16b2aa0440d"
      )
    )

    expect(Bytes.toHex(Sign1.encode(sign1))).toBe(
      "84582aa201276761646472657373581d603a5904074323a4cddfe1103969962a5807c6c37495db9df48d019f9aa166686173686564f4491b00000194d70e512f584032f4643ec6ae20b5c6b9c71d89eadbbdaf42bffadcb8bbda22203fb98640bf491530541bb659fe019b2ef5b0cefd7d683ea8a945a07333185317b16b2aa0440d"
    )
  })

  it("decodes correctly", () => {
    const sign1 = Either.getOrThrow(
      Sign1.decode(
        "84582aa201276761646472657373581d603a5904074323a4cddfe1103969962a5807c6c37495db9df48d019f9aa166686173686564f4491b00000194d70e512f584032f4643ec6ae20b5c6b9c71d89eadbbdaf42bffadcb8bbda22203fb98640bf491530541bb659fe019b2ef5b0cefd7d683ea8a945a07333185317b16b2aa0440d"
      )
    )

    expect(Bytes.toHex(Address.bytes(sign1.address))).toBe(
      "603a5904074323a4cddfe1103969962a5807c6c37495db9df48d019f9a"
    )
    expect(Bytes.toHex(sign1.payload)).toBe("1b00000194d70e512f")
    expect(Bytes.toHex(sign1.bytes)).toBe(
      "32f4643ec6ae20b5c6b9c71d89eadbbdaf42bffadcb8bbda22203fb98640bf491530541bb659fe019b2ef5b0cefd7d683ea8a945a07333185317b16b2aa0440d"
    )
  })

  it("decodes correctly with kid", () => {
    expect(() =>
      Either.getOrThrow(
        Sign1.decode(
          "845882a301270458390180edfa909a3d40a54fca4c3ee852c7ba2a79391738911dc363580dc2fd98e123e92cfe58a90ffaf5d59529c503223aefff76d765e9497732676164647265737358390180edfa909a3d40a54fca4c3ee852c7ba2a79391738911dc363580dc2fd98e123e92cfe58a90ffaf5d59529c503223aefff76d765e9497732a166686173686564f4491b00000199de8ce26d5840d593831aba794d3763f66d5edd84e6c63f44d9243630ccf0e19943a5059a21d937850709f578e6d6694123eee147fd7d1e8618f66e54ad42a1b8478e8397000d"
        )
      )
    ).not.toThrow()
  })

  it("verifies correctly", () => {
    const pubKey = Either.getOrThrow(
      PubKey.make(
        "2e44aa608940b750a7369b15f3830c067b3149450937b3020a9a674329c4d79d"
      )
    )

    const sign1 = Either.getOrThrow(
      Sign1.make(
        decodeAddress(
          "603a5904074323a4cddfe1103969962a5807c6c37495db9df48d019f9a"
        ),
        "1b00000194d70e512f",
        "32f4643ec6ae20b5c6b9c71d89eadbbdaf42bffadcb8bbda22203fb98640bf491530541bb659fe019b2ef5b0cefd7d683ea8a945a07333185317b16b2aa0440d"
      )
    )

    expect(() => Sign1.verify(sign1, pubKey)).not.toThrow()
  })

  it("verifies key with kid correctly", () => {
    const pubKey = Either.getOrThrow(
      PubKey.make(
        "00be5015be5904d9777115ed7f71664b290bde6031e60847b909e1dcf3158542"
      )
    )

    const sign1 = Either.getOrThrow(
      Sign1.decode(
        "84584aa3012704581d61883c5cd1fdbf9d2b2fbd30982e9fb974cf07201bd55e6871e4294f836761646472657373581d61883c5cd1fdbf9d2b2fbd30982e9fb974cf07201bd55e6871e4294f83a166686173686564f4491b00000194dc3e7f9a5840ce0bd7157b541a401f968ed801731f97e9b0dc8dd2a037dab3c7f4dcbf105419f5c904ec42ec603a8f4a3727d8cd59a23a1537bc8fab5b99080a403088af0200"
      )
    )

    expect(() => Sign1.verify(sign1, pubKey)).not.toThrow()
  })

  it("signs and verifies correctly", () => {
    const privateKey = Effect.runSync(
      Bip32.makeSigningKey([
        0x60, 0xd3, 0x99, 0xda, 0x83, 0xef, 0x80, 0xd8, 0xd4, 0xf8, 0xd2, 0x23,
        0x23, 0x9e, 0xfd, 0xc2, 0xb8, 0xfe, 0xf3, 0x87, 0xe1, 0xb5, 0x21, 0x91,
        0x37, 0xff, 0xb4, 0xe8, 0xfb, 0xde, 0xa1, 0x5a, 0xdc, 0x93, 0x66, 0xb7,
        0xd0, 0x03, 0xaf, 0x37, 0xc1, 0x13, 0x96, 0xde, 0x9a, 0x83, 0x73, 0x4e,
        0x30, 0xe0, 0x5e, 0x85, 0x1e, 0xfa, 0x32, 0x74, 0x5c, 0x9c, 0xd7, 0xb4,
        0x27, 0x12, 0xc8, 0x90, 0x60, 0x87, 0x63, 0x77, 0x0e, 0xdd, 0xf7, 0x72,
        0x48, 0xab, 0x65, 0x29, 0x84, 0xb2, 0x1b, 0x84, 0x97, 0x60, 0xd1, 0xda,
        0x74, 0xa6, 0xf5, 0xbd, 0x63, 0x3c, 0xe4, 0x1a, 0xdc, 0xee, 0xf0, 0x7a
      ])
    )
    const pubKey = Bip32.deriveVerificationKey(privateKey)
    const address = Address.make(
      false,
      Credential.makePubKey(PubKey.hash(pubKey))
    )
    const sign1 = Either.getOrThrow(
      Sign1.sign(address, privateKey, "48656c6c6f20576f726c64")
    )

    expect(() => Sign1.verify(sign1, pubKey)).not.toThrow()
    expect(Bytes.toHex(Sign1.encode(sign1))).toBe(
      Bytes.toHex(
        Sign1.encode(Either.getOrThrow(Sign1.decode(Sign1.encode(sign1))))
      )
    )
  })
})
