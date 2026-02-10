import { describe, expect, it } from "bun:test"
import { Effect } from "effect"
import * as Bytes from "../internal/Bytes.js"
import * as Utf8 from "../internal/Utf8.js"
import * as Ed25519 from "./Ed25519.js"
import { EdDSA } from "./EdDSA.js"
import { ScalarField } from "./Field.js"

const affine = new EdDSA(
  Ed25519.affineCurve,
  Ed25519.G,
  new ScalarField(Ed25519.N),
  {
    decodePoint: Ed25519.decodePoint,
    encodePoint: Ed25519.encodePoint,
    decodePrivateKey: Ed25519.decodePrivateKey,
    decodeScalar: Ed25519.decodeScalar,
    encodeScalar: Ed25519.encodeScalar
  }
)

const extended = Ed25519.Ed25519

describe('Ed25519 for ""', () => {
  // not the extended privateKey!
  const privateKey = Bytes.toUint8Array(
    "9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60"
  )
  const expectedPublicKey = Bytes.toUint8Array(
    "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a"
  )
  const message = ""
  const messageBytes = Utf8.encode(message)
  const expectedSignature = Bytes.toUint8Array(
    "e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b"
  )

  it(`generates publicKey ##d7..1a for privateKey #9d..60`, () => {
    expect(Effect.runSync(extended.derivePublicKey(privateKey))).toEqual(
      expectedPublicKey
    )
  })

  it(`generates publicKey ##d7..1a for privateKey #9d..60 (affine)`, () => {
    expect(Effect.runSync(affine.derivePublicKey(privateKey))).toEqual(
      expectedPublicKey
    )
  })

  it(`signs as #7e..04 for privateKey #9d..60`, () => {
    expect(
      Effect.runSync(extended.sign(messageBytes, privateKey, true))
    ).toEqual(expectedSignature)
  })

  it(`signs as #7e..04 for privateKey #9d..60 (affine)`, () => {
    expect(Effect.runSync(affine.sign(messageBytes, privateKey, true))).toEqual(
      expectedSignature
    )
  })

  it(`returns true when verifying signature #7e..04`, () => {
    expect(
      Effect.runSync(
        extended.verify(expectedSignature, messageBytes, expectedPublicKey)
      )
    ).toBe(true)
  })

  it(`returns true when verifying signature #7e..04 (affine)`, () => {
    expect(
      Effect.runSync(
        affine.verify(expectedSignature, messageBytes, expectedPublicKey)
      )
    ).toBe(true)
  })

  it(`returns false when verifying different message`, () => {
    expect(
      Effect.runSync(
        extended.verify(
          expectedSignature,
          new Uint8Array([0, 0]),
          expectedPublicKey
        )
      )
    ).toBe(false)
  })
})

describe('Ed25519 for "Hello"', () => {
  // not the extended privateKey!
  const privateKey = Bytes.toUint8Array(
    "9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60"
  )
  const expectedPublicKey = Bytes.toUint8Array(
    "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a"
  )
  const message = "Hello"
  const messageBytes = Utf8.encode(message)
  const expectedSignature = Bytes.toUint8Array(
    "52dc29f7ec08cf13d82af0738b2d12ff7da1b967866e9cf9bcd22d7972f1be2cfad44b3018e30969edd07a0fb902a95685707003011c50de3b1cec146a0d4207"
  )

  it(`signs as #62..0a for privateKey #9d..60`, () => {
    expect(
      Effect.runSync(extended.sign(messageBytes, privateKey, true))
    ).toEqual(expectedSignature)
  })

  it(`signs as #62..0a for privateKey #9d..60 (affine)`, () => {
    expect(Effect.runSync(affine.sign(messageBytes, privateKey, true))).toEqual(
      expectedSignature
    )
  })

  it(`returns true when verifying signature #62..0a`, () => {
    expect(
      Effect.runSync(
        extended.verify(expectedSignature, messageBytes, expectedPublicKey)
      )
    ).toBe(true)
  })

  it(`returns true when verifying signature #62..0a (affine)`, () => {
    expect(
      Effect.runSync(
        affine.verify(expectedSignature, messageBytes, expectedPublicKey)
      )
    ).toBe(true)
  })

  it(`returns false when verifying different message`, () => {
    expect(
      Effect.runSync(
        extended.verify(
          expectedSignature,
          new Uint8Array([0, 0]),
          expectedPublicKey
        )
      )
    ).toBe(false)
  })
})
