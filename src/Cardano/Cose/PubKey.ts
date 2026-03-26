import { Either } from "effect"
import * as Bytes from "../../Codecs/Bytes.js"
import * as Cbor from "../../Codecs/Cbor.js"
import * as PubKey from "../Ledger/PubKey.js"

export const decode = (
  bytes: Bytes.BytesLike
): Cbor.DecodeResult<PubKey.PubKey> =>
  Either.gen(function* () {
    const pairs = yield* Cbor.decodeMap(
      Cbor.decodeInt,
      decodeHeaderValue
    )(bytes)

    let kty: bigint | undefined
    let alg: bigint | undefined
    let crv: bigint | undefined
    let pubKey: PubKey.PubKey | undefined

    for (const [key, value] of pairs) {
      switch (key) {
        case 1n:
          if (typeof value == "bigint") {
            kty = value
          }
          break
        case 3n:
          if (typeof value == "bigint") {
            alg = value
          }
          break
        case -1n:
          if (typeof value == "bigint") {
            crv = value
          }
          break
        case -2n:
          if (value instanceof Uint8Array) {
            pubKey = yield* PubKey.make(value).pipe(
              Either.mapLeft(
                (e) =>
                  new Cbor.DecodeError(
                    Bytes.makeStream(bytes),
                    e.message ?? "Invalid COSE PubKey"
                  )
              )
            )
          }
          break
      }
    }

    if (kty === undefined) {
      return yield* Either.left(
        new Cbor.DecodeError(
          Bytes.makeStream(bytes),
          "invalid COSE PubKey: kty not set (i.e. field 1 not set)"
        )
      )
    }

    if (kty != 1n) {
      return yield* Either.left(
        new Cbor.DecodeError(
          Bytes.makeStream(bytes),
          `invalid COSE PubKey: kty not set to OKP (i.e. field 1 not set to 1), got ${kty}`
        )
      )
    }

    if (alg === undefined) {
      return yield* Either.left(
        new Cbor.DecodeError(
          Bytes.makeStream(bytes),
          "invalid COSE PubKey: alg not set (i.e. field 3 not set)"
        )
      )
    }

    if (alg != -8n) {
      return yield* Either.left(
        new Cbor.DecodeError(
          Bytes.makeStream(bytes),
          `invalid COSE PubKey: alg not set to EdDSA (i.e. field 3 not set to -8), got ${alg}`
        )
      )
    }

    if (crv === undefined) {
      return yield* Either.left(
        new Cbor.DecodeError(
          Bytes.makeStream(bytes),
          "invalid COSE PubKey: crv not set (i.e. field -1 not set)"
        )
      )
    }

    if (crv != 6n) {
      return yield* Either.left(
        new Cbor.DecodeError(
          Bytes.makeStream(bytes),
          `invalid COSE PubKey: crv not set to Ed25519 (i.e. field -1 not set to 6), got ${crv}`
        )
      )
    }

    if (!pubKey) {
      return yield* Either.left(
        new Cbor.DecodeError(
          Bytes.makeStream(bytes),
          "invalid COSE PubKey: pubKey field not set (i.e. field -2 not set)"
        )
      )
    }

    return pubKey
  })

export function encode(pubKey: PubKey.PubKey): number[] {
  return Cbor.encodeMap([
    [Cbor.encodeInt(1), Cbor.encodeInt(1)],
    [Cbor.encodeInt(3), Cbor.encodeInt(-8)],
    [Cbor.encodeInt(-1), Cbor.encodeInt(6)],
    [Cbor.encodeInt(-2), PubKey.encode(pubKey)]
  ])
}

const decodeHeaderValue = (
  bytes: Bytes.BytesLike
): Cbor.DecodeResult<bigint | Uint8Array> => {
  if (Cbor.isInt(bytes)) {
    return Cbor.decodeInt(bytes)
  }

  if (Cbor.isBytes(bytes)) {
    return Cbor.decodeBytes(bytes).pipe(Either.map((bs) => Uint8Array.from(bs)))
  }

  return Either.left(
    new Cbor.DecodeError(
      Bytes.makeStream(bytes),
      "invalid COSE PubKey: unexpected header value type"
    )
  )
}
