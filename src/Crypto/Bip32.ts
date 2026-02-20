import { Either, ParseResult, Schema } from "effect"
import * as Bech32 from "../Codecs/Bech32.js"
import * as BigEndian from "../Codecs/BigEndian.js"
import * as Bytes from "../Codecs/Bytes.js"
import * as LE from "../Codecs/LittleEndian.js"
import * as Ed25519 from "./Ed25519.js"
import * as Hmac from "./Hmac.js"
import * as Pbkdf2 from "./Pbkdf2.js"

/**
 * Used during `PrivateKey` derivation, to create a new `PrivateKey` instance with a non-publicly deriveable `PubKey`.
 */
export const HARDEN = 0x80000000

export function isValidSigningKey(sk: string): boolean {
  if (sk.startsWith("addr_sk")) {
    const decodeResult = Bech32.decode(sk)

    if (decodeResult._tag == "Left") {
      return false
    }

    const { prefix, bytes } = decodeResult.right

    if (bytes.length != 96) {
      return false
    }

    if (prefix != "addr_sk") {
      return false
    }

    return true
  }

  return false
}

export const SigningKey = Schema.String.pipe(
  Schema.filter((pk: string) => {
    return isValidSigningKey(pk) || "Invalid Bip32 Private Signing Key"
  }),
  Schema.brand("Crypto.Bip32.SigningKey")
)

export type SigningKey = Schema.Schema.Type<typeof SigningKey>

function makeSigningKeyUnsafe(bytes: Bytes.BytesLike): string {
  return Bech32.encode("addr_sk", Bytes.toUint8Array(bytes))
}

export function isValidVerificationKey(pk: string): boolean {
  if (pk.startsWith("addr_vk")) {
    const decodeResult = Bech32.decode(pk)

    if (decodeResult._tag == "Left") {
      return false
    }

    const { prefix, bytes } = decodeResult.right

    if (bytes.length != 32) {
      return false
    }

    if (prefix != "addr_vk") {
      return false
    }

    return true
  }

  return false
}

export const VerificationKey = Schema.String.pipe(
  Schema.filter((pk: string) => {
    return isValidSigningKey(pk) || "Invalid Bip32 Public Verification Key"
  }),
  Schema.brand("Crypto.Bip32.VerificationKey")
)

export type VerificationKey = Schema.Schema.Type<typeof VerificationKey>

export const makeVerificationKeyUnsafe = (bytes: Bytes.BytesLike): string =>
  Bech32.encode("addr_vk", Bytes.toUint8Array(bytes))
export const makeVerificationKey = (
  bytes: Bytes.BytesLike
): Either.Either<VerificationKey, ParseResult.Unexpected> => {
  const vk = makeVerificationKeyUnsafe(bytes)

  if (!isValidVerificationKey(vk)) {
    return Either.left(
      new ParseResult.Unexpected(vk, "Invalid Verification Key")
    )
  }

  return Either.right(vk as VerificationKey)
}

/**
 * @param {number[]} entropy
 * @param {boolean} force
 * @returns {Bip32PrivateKey}
 */
export function skFromEntropy(
  entropy: Bytes.BytesLike,
  force: boolean = true
): SigningKey {
  const bytes = Pbkdf2.deriveSync(
    Hmac.sha2_512Sync,
    new Uint8Array([]),
    Bytes.toUint8Array(entropy),
    4096,
    96
  )

  const kl = bytes.slice(0, 32)
  const kr = bytes.slice(32, 64)

  if (!force) {
    if ((kl[31] & 0b00100000) != 0) {
      throw new Error("invalid root secret")
    }
  }

  kl[0] &= 0b11111000
  kl[31] &= 0b00011111
  kl[31] |= 0b01000000

  const c = bytes.slice(64, 96)

  return makeSigningKeyUnsafe(Bytes.concat(kl, kr, c)) as SigningKey
}

export const skBytes = (sk: SigningKey): Uint8Array =>
  Bytes.toUint8Array(Either.getOrThrow(Bech32.decode(sk)).bytes)
export const vkBytes = (vk: VerificationKey): Uint8Array =>
  Bytes.toUint8Array(Either.getOrThrow(Bech32.decode(vk)).bytes)

export const deriveVerificationKey = (sk: SigningKey): VerificationKey =>
  Bech32.encode(
    "addr_vk",
    Either.getOrThrow(Ed25519.derivePublicKey(skBytes(sk), false))
  ) as VerificationKey

const k = (sk: SigningKey): Uint8Array => skBytes(sk).slice(0, 64)
const kl = (sk: SigningKey): Uint8Array => skBytes(sk).slice(0, 32)
const kr = (sk: SigningKey): Uint8Array => skBytes(sk).slice(32, 64)
const c = (sk: SigningKey): Uint8Array => skBytes(sk).slice(64, 96)

const calcChildZorC = (sk: SigningKey, i: number, d: 0 | 1): Uint8Array => {
  const ib = BigEndian.encode(BigInt(i)).reverse()
  while (ib.length < 4) {
    ib.push(0)
  }

  if (ib.length != 4) {
    throw new Error("child index too big")
  }

  if (i < HARDEN) {
    const A = vkBytes(deriveVerificationKey(sk))

    return Hmac.sha2_512Sync(c(sk), Bytes.concat([0x02 + d], A, ib))
  } else {
    return Hmac.sha2_512Sync(c(sk), Bytes.concat([0x00 + d], k(sk), ib))
  }
}

const calcChildZ = (sk: SigningKey, i: number): Uint8Array =>
  calcChildZorC(sk, i, 0)
const calcChildC = (sk: SigningKey, i: number): Uint8Array =>
  calcChildZorC(sk, i, 1)

const deriveSingleChildSigningKey = (sk: SigningKey, i: number): SigningKey => {
  const Z = calcChildZ(sk, i)

  const kl$ = LE.encode32(
    8n * LE.decodeOrThrow(Z.slice(0, 28)) + LE.decodeOrThrow(kl(sk))
  ).slice(0, 32)

  const kr$ = LE.encode32(
    LE.decodeOrThrow(Z.slice(32, 64)) +
      (LE.decodeOrThrow(kr(sk)) %
        115792089237316195423570985008687907853269984665640564039457584007913129639936n)
  ).slice(0, 32)

  const c = calcChildC(sk, i).slice(32, 64)

  // TODO: discard child key whose public key is the identity point
  return Bech32.encode("addr_sk", Bytes.concat(kl$, kr$, c)) as SigningKey
}

export const derivePath = (sk: SigningKey, path: number[]): SigningKey => {
  path.forEach((i) => {
    sk = deriveSingleChildSigningKey(sk, i)
  })

  return sk
}

export const sign = (sk: SigningKey) => (message: Bytes.BytesLike) => {
  return {
    pubKey: deriveVerificationKey(sk),
    signature: Either.getOrThrow(
      Ed25519.sign(Bytes.toUint8Array(message), k(sk), false)
    )
  }
}
