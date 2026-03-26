import { describe, expect, it } from "bun:test"
import { Either } from "effect"
import * as Bytes from "../../Codecs/Bytes.js"
import * as PubKey from "../Ledger/PubKey.js"
import * as CosePubKey from "./PubKey.js"

describe("Cardano.Cose.PubKey.decode", () => {
  it("decodes a40101032720062158202e44aa608940b750a7369b15f3830c067b3149450937b3020a9a674329c4d79d", () => {
    const data =
      "a40101032720062158202e44aa608940b750a7369b15f3830c067b3149450937b3020a9a674329c4d79d"

    expect(
      Bytes.toHex(PubKey.bytes(Either.getOrThrow(CosePubKey.decode(data))))
    ).toBe("2e44aa608940b750a7369b15f3830c067b3149450937b3020a9a674329c4d79d")
  })

  it("decodes a501010258390180edfa909a3d40a54fca4c3ee852c7ba2a79391738911dc363580dc2fd98e123e92cfe58a90ffaf5d59529c503223aefff76d765e9497732032720062158208d9578fed65af1d1ce74b1c27e8be3dfe98490157382be39b0b6cb33c268d778", () => {
    const data =
      "a501010258390180edfa909a3d40a54fca4c3ee852c7ba2a79391738911dc363580dc2fd98e123e92cfe58a90ffaf5d59529c503223aefff76d765e9497732032720062158208d9578fed65af1d1ce74b1c27e8be3dfe98490157382be39b0b6cb33c268d778"

    expect(
      Bytes.toHex(PubKey.bytes(Either.getOrThrow(CosePubKey.decode(data))))
    ).toBe("8d9578fed65af1d1ce74b1c27e8be3dfe98490157382be39b0b6cb33c268d778")
  })
})

describe("Cardano.Cose.PubKey.encode", () => {
  it("encodes #2e44aa608940b750a7369b15f3830c067b3149450937b3020a9a674329c4d79d", () => {
    const pubKey = Either.getOrThrow(
      PubKey.make(
        "2e44aa608940b750a7369b15f3830c067b3149450937b3020a9a674329c4d79d"
      )
    )

    expect(Bytes.toHex(CosePubKey.encode(pubKey))).toBe(
      "a40101032720062158202e44aa608940b750a7369b15f3830c067b3149450937b3020a9a674329c4d79d"
    )
  })
})
