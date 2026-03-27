import { Data, Effect, Either } from "effect"
import * as Bytes from "../../Codecs/Bytes.js"
import * as Cbor from "../../Codecs/Cbor.js"
import * as Bip32 from "../../Crypto/Bip32.js"
import * as Ed25519 from "../../Crypto/Ed25519.js"
import * as Address from "../Ledger/Address.js"
import * as PubKey from "../Ledger/PubKey.js"

export type Sign1 = {
  address: Address.Address
  payload: Uint8Array
  bytes: Uint8Array
  kid?: Uint8Array
}

export class InvalidAddress extends Data.TaggedError(
  "Cardano.Cose.Sign1.InvalidAddress"
)<{ message: string }> {
  constructor(address: Address.Address) {
    super({
      message: `Invalid COSE Sign1 header address: '${address}' isn't a PubKeyHash address`
    })
  }
}

export class SignerMismatch extends Data.TaggedError(
  "Cardano.Cose.Sign1.SignerMismatch"
)<{ message: string }> {
  constructor(pk: PubKey.PubKey, address: Address.Address) {
    super({
      message: `COSE public key '${pk}' does not match the Sign1 address '${address}'`
    })
  }
}

export function make(
  address: Address.Address,
  payload: Bytes.BytesLike,
  bytes: Bytes.BytesLike,
  kid?: Bytes.BytesLike
): Either.Either<Sign1, InvalidAddress> {
  if (Address.spendingCredential(address)._tag != "PubKey") {
    return Either.left(new InvalidAddress(address))
  }

  const sign1 = {
    address,
    payload: Bytes.toUint8Array(payload),
    bytes: Bytes.toUint8Array(bytes)
  }

  if (kid !== undefined) {
    return Either.right({
      ...sign1,
      kid: Bytes.toUint8Array(kid)
    })
  }

  return Either.right(sign1)
}

export function sign(
  address: Address.Address,
  privateKey: Bip32.SigningKey,
  payload: Bytes.BytesLike,
  kid?: Bytes.BytesLike
): Either.Either<Sign1, InvalidAddress> {
  const payloadBytes = Bytes.toUint8Array(payload)
  const kidBytes = kid === undefined ? undefined : Bytes.toUint8Array(kid)
  const signature = Bip32.sign(privateKey)(
    sigStructure(address, payloadBytes, kidBytes)
  )

  return make(address, payloadBytes, signature.bytes, kidBytes)
}

export const decode = (bytes: Bytes.BytesLike): Cbor.DecodeResult<Sign1> =>
  Either.gen(function* () {
    const [protectedHeaderBytes, , payload, signatureBytes] =
      yield* Cbor.decodeTuple([
        Cbor.decodeBytes,
        Cbor.decodeMap(Cbor.decodeString, Cbor.decodeBool),
        Cbor.decodeBytes,
        Cbor.decodeBytes
      ])(bytes)

    const protectedHeader = yield* Cbor.decodeMap(
      decodeProtectedHeaderKey,
      decodeProtectedHeaderValue
    )(protectedHeaderBytes)

    let alg: bigint | undefined
    let kid: Uint8Array | undefined
    let addressBytes: Uint8Array | undefined

    for (const [key, value] of protectedHeader) {
      switch (key) {
        case 1n:
          if (typeof value == "bigint") {
            alg = value
          }
          break
        case 4n:
          if (value instanceof Uint8Array) {
            kid = value
          }
          break
        case "address":
          if (value instanceof Uint8Array) {
            addressBytes = value
          }
          break
      }
    }

    if (alg === undefined) {
      return yield* Either.left(
        new Cbor.DecodeError(
          Bytes.makeStream(bytes),
          "invalid COSE Sign1 header: alg not set (i.e. field 1 not set)"
        )
      )
    }

    if (alg != -8n) {
      return yield* Either.left(
        new Cbor.DecodeError(
          Bytes.makeStream(bytes),
          `invalid COSE Sign1 header: alg not set to EdDSA (i.e. field 1 not set to -8), got ${alg}`
        )
      )
    }

    if (addressBytes === undefined) {
      return yield* Either.left(
        new Cbor.DecodeError(
          Bytes.makeStream(bytes),
          "invalid COSE Sign1 header: address not set"
        )
      )
    }

    const address = yield* Address.decode(addressBytes).pipe(
      Either.mapLeft(
        (e) =>
          new Cbor.DecodeError(
            Bytes.makeStream(bytes),
            e.message ?? "invalid COSE Sign1 header: invalid address format"
          )
      )
    )

    if (Address.spendingCredential(address)._tag != "PubKey") {
      return yield* Either.left(
        new Cbor.DecodeError(
          Bytes.makeStream(bytes),
          "invalid COSE Sign1 header address: not a PubKeyHash address"
        )
      )
    }

    return Either.getOrThrow(
      make(
        address,
        Uint8Array.from(payload),
        Uint8Array.from(signatureBytes),
        kid
      )
    )
  })

export function encode(sign1: Sign1): number[] {
  return Cbor.encodeTuple([
    Cbor.encodeBytes(encodeProtectedHeader(sign1.address, sign1.kid)),
    Cbor.encodeMap([[Cbor.encodeString("hashed"), Cbor.encodeBool(false)]]),
    Cbor.encodeBytes(sign1.payload),
    Cbor.encodeBytes(sign1.bytes)
  ])
}

export const verify = (sign1: Sign1, pubKey: PubKey.PubKey) =>
  Effect.gen(function* () {
    yield* Ed25519.verify(
      sign1.bytes,
      Uint8Array.from(sigStructure(sign1.address, sign1.payload, sign1.kid)),
      PubKey.bytes(pubKey)
    )

    const userId = PubKey.hash(pubKey)
    const spendingCredential = Address.spendingCredential(sign1.address)
    const stakingCredential = Address.stakingCredential(sign1.address)

    if (
      spendingCredential._tag !== "PubKey" &&
      (!stakingCredential || stakingCredential._tag !== "PubKey")
    ) {
      return yield* Effect.fail(new InvalidAddress(sign1.address))
    }

    if (
      spendingCredential.hash !== userId &&
      stakingCredential?.hash !== userId
    ) {
      return yield* Effect.fail(new SignerMismatch(pubKey, sign1.address))
    }

    return
  })

export function encodeProtectedHeader(
  address: Address.Address,
  kid?: Bytes.BytesLike
): number[] {
  const pairs: [number[], number[]][] = [
    [Cbor.encodeInt(1), Cbor.encodeInt(-8)]
  ]

  if (kid !== undefined) {
    pairs.push([Cbor.encodeInt(4), Cbor.encodeBytes(Bytes.toArray(kid))])
  }

  pairs.push([
    Cbor.encodeString("address"),
    Cbor.encodeBytes(Address.bytes(address))
  ])

  return Cbor.encodeMap(pairs)
}

export function sigStructure(
  address: Address.Address,
  payload: Bytes.BytesLike,
  kid?: Bytes.BytesLike
): number[] {
  return Cbor.encodeTuple([
    Cbor.encodeString("Signature1"),
    Cbor.encodeBytes(encodeProtectedHeader(address, kid)),
    Cbor.encodeBytes([]),
    Cbor.encodeBytes(Bytes.toArray(payload))
  ])
}

const decodeProtectedHeaderKey = (
  bytes: Bytes.BytesLike
): Cbor.DecodeResult<bigint | string> => {
  if (Cbor.isInt(bytes)) {
    return Cbor.decodeInt(bytes)
  }

  if (Cbor.isString(bytes)) {
    return Cbor.decodeString(bytes)
  }

  return Either.left(
    new Cbor.DecodeError(
      Bytes.makeStream(bytes),
      "invalid COSE Sign1 header: unexpected key type"
    )
  )
}

const decodeProtectedHeaderValue = (
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
      "invalid COSE Sign1 header: unexpected value type"
    )
  )
}
