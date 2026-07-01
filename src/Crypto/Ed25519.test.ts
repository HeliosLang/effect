import { describe, expect, it } from "bun:test"
import { Effect } from "effect"
import * as Bytes from "../Codecs/Bytes.js"
import * as Utf8 from "../Codecs/Utf8.js"
import { CurveHelper } from "./Curve.js"
import * as Ed25519 from "./Ed25519.js"
import * as Sha2_512 from "./Sha2_512.js"
import { EdDSA } from "./EdDSA.js"
import { FieldHelper, ScalarField } from "./Field.js"

const affineAlgorithm = new EdDSA(
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

const extendedAlgorithm = {
  derivePublicKey: Ed25519.derivePublicKey,
  sign: Ed25519.sign,
  verify: Ed25519.verify
}

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
    expect(
      Effect.runSync(extendedAlgorithm.derivePublicKey(privateKey))
    ).toEqual(expectedPublicKey)
  })

  it(`generates publicKey ##d7..1a for privateKey #9d..60 (affine)`, () => {
    expect(Effect.runSync(affineAlgorithm.derivePublicKey(privateKey))).toEqual(
      expectedPublicKey
    )
  })

  it(`signs as #7e..04 for privateKey #9d..60`, () => {
    expect(
      Effect.runSync(extendedAlgorithm.sign(messageBytes, privateKey, true))
    ).toEqual(expectedSignature)
  })

  it(`signs as #7e..04 for privateKey #9d..60 (affine)`, () => {
    expect(
      Effect.runSync(affineAlgorithm.sign(messageBytes, privateKey, true))
    ).toEqual(expectedSignature)
  })

  it(`returns true when verifying signature #7e..04`, () => {
    expect(
      Effect.runSync(
        extendedAlgorithm.verify(
          expectedSignature,
          messageBytes,
          expectedPublicKey
        )
      )
    ).toBe(true)
  })

  it(`returns true when verifying signature #7e..04 (affine)`, () => {
    expect(
      Effect.runSync(
        affineAlgorithm.verify(
          expectedSignature,
          messageBytes,
          expectedPublicKey
        )
      )
    ).toBe(true)
  })

  it(`returns false when verifying different message`, () => {
    expect(
      Effect.runSync(
        extendedAlgorithm.verify(
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
      Effect.runSync(extendedAlgorithm.sign(messageBytes, privateKey, true))
    ).toEqual(expectedSignature)
  })

  it(`signs as #62..0a for privateKey #9d..60 (affine)`, () => {
    expect(
      Effect.runSync(affineAlgorithm.sign(messageBytes, privateKey, true))
    ).toEqual(expectedSignature)
  })

  it(`returns true when verifying signature #62..0a`, () => {
    expect(
      Effect.runSync(
        extendedAlgorithm.verify(
          expectedSignature,
          messageBytes,
          expectedPublicKey
        )
      )
    ).toBe(true)
  })

  it(`returns true when verifying signature #62..0a (affine)`, () => {
    expect(
      Effect.runSync(
        affineAlgorithm.verify(
          expectedSignature,
          messageBytes,
          expectedPublicKey
        )
      )
    ).toBe(true)
  })

  it(`returns false when verifying different message`, () => {
    expect(
      Effect.runSync(
        extendedAlgorithm.verify(
          expectedSignature,
          new Uint8Array([0, 0]),
          expectedPublicKey
        )
      )
    ).toBe(false)
  })
})

describe("Ed25519 nonce derivation", () => {
  const scalarBytes = Bytes.toUint8Array(
    "60d399da83ef80d8d4f8d223239efdc2b8fef387e1b5219137ffb4e8fbdea15a"
  )
  const noncePrefix = Bytes.toUint8Array(
    "dc9366b7d003af37c11396de9a83734e30e05e851efa32745c9cd7b42712c890"
  )
  const otherNoncePrefix = Bytes.toUint8Array(
    "dd9366b7d003af37c11396de9a83734e30e05e851efa32745c9cd7b42712c890"
  )
  const privateKey = new Uint8Array([...scalarBytes, ...noncePrefix])
  const otherPrivateKey = new Uint8Array([...scalarBytes, ...otherNoncePrefix])
  const message = Utf8.encode("same public key, different secret nonce prefix")

  const hashToScalar = (...chunks: Uint8Array[]): bigint => {
    const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
    const bytes = new Uint8Array(length)
    let offset = 0

    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.length
    }

    return Effect.runSync(Ed25519.decodeScalar(Sha2_512.hashSync(bytes)))
  }

  it("uses the secret nonce prefix when signing extended private keys", () => {
    const publicKey = Effect.runSync(Ed25519.derivePublicKey(privateKey, false))
    const otherPublicKey = Effect.runSync(
      Ed25519.derivePublicKey(otherPrivateKey, false)
    )

    expect(otherPublicKey).toEqual(publicKey)

    const signature = Effect.runSync(Ed25519.sign(message, privateKey, false))
    const otherSignature = Effect.runSync(
      Ed25519.sign(message, otherPrivateKey, false)
    )

    expect(otherSignature).not.toEqual(signature)
    expect(Effect.runSync(Ed25519.verify(signature, message, publicKey))).toBe(
      true
    )
    expect(
      Effect.runSync(Ed25519.verify(otherSignature, message, publicKey))
    ).toBe(true)
  })

  it("doesn't expose the private scalar through a public-message nonce attack", () => {
    const curveHelper = new CurveHelper(Ed25519.extendedCurve)
    const scalarField = new FieldHelper(new ScalarField(Ed25519.N))
    const publicKey = Effect.runSync(Ed25519.derivePublicKey(privateKey, false))
    const signature = Effect.runSync(Ed25519.sign(message, privateKey, false))

    const privateScalar = Effect.runSync(Ed25519.decodePrivateKey(privateKey))
    const publicMessageNonce = hashToScalar(message)
    const challenge = hashToScalar(signature.slice(0, 32), publicKey, message)
    const s = Effect.runSync(Ed25519.decodeScalar(signature.slice(32, 64)))

    const recoveredWithPublicNonce = scalarField.multiply(
      scalarField.subtract(s, publicMessageNonce),
      scalarField.invert(challenge)
    )

    expect(recoveredWithPublicNonce).not.toBe(privateScalar)

    const recoveredPublicKey = Ed25519.encodePoint(
      Ed25519.extendedCurve.toAffine(
        curveHelper.scale(
          Ed25519.extendedCurve.fromAffine(Ed25519.G),
          recoveredWithPublicNonce
        )
      )
    )

    expect(recoveredPublicKey).not.toEqual(publicKey)
  })
})
