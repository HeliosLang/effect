import { describe, expect, it } from "bun:test"
import * as Bytes from "../Codecs/Bytes.js"
import * as Bls12_381 from "./Bls12_381.js"

describe("Crypto.Bls12_381 G1 codec", () => {
  const g1Point = Bytes.toUint8Array(
    "950dfd33da2682260c76038dfb8bad6e84ae9d599a3c151815945ac1e6ef6b1027cd917f3907479d20d636ce437a41f5"
  )

  it("round-trips a compressed G1 point", () => {
    const decoded = Bls12_381.decodeG1(g1Point)

    expect(decoded._tag).toBe("Right")
    if (decoded._tag == "Right") {
      expect(Bytes.toHex(Bls12_381.encodeG1(decoded.right))).toBe(
        Bytes.toHex(g1Point)
      )
    }
  })

  it("rejects an off-curve compressed G1 point", () => {
    const decoded = Bls12_381.decodeG1(
      Bytes.toUint8Array(
        "a00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003"
      )
    )

    expect(decoded._tag).toBe("Left")
  })

  it("compresses the G1 generator", () => {
    expect(Bytes.toHex(Bls12_381.encodeG1(Bls12_381.G1_GENERATOR))).toBe(
      "97f1d3a73197d7942695638c4fa9ac0fc3688c4f9774b905a14e3a3f171bac586c55e83ff97a1aeffb3af00adb22c6bb"
    )
  })
})

describe("Crypto.Bls12_381 group operations", () => {
  it("multiplies the G1 generator by the scalar field order to zero", () => {
    expect(
      Bytes.toHex(
        Bls12_381.encodeG1(
          Bls12_381.g1ScalarMul(Bls12_381.R, Bls12_381.G1_GENERATOR)
        )
      )
    ).toBe(
      "c00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
    )
  })

  it("hashes a G1 conformance vector", () => {
    const point = Bls12_381.g1HashToGroup(
      Bytes.toUint8Array("8e"),
      Bytes.toUint8Array("0a")
    )

    expect(Bytes.toHex(Bls12_381.encodeG1(point))).toBe(
      "a45ddef02cdd86039be4b0a863cba70ea903194ea0489ce619c6276175839d62eea72b095d6566067f4a44b85614f199"
    )
  })
})
