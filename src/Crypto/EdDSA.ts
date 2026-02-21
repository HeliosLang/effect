import { Data, Either, Encoding } from "effect"
import { type Curve, CurveHelper, type Point2I } from "./Curve.js"
import * as Sha2_512 from "./Sha2_512.js"
import { type Field } from "./Field.js"

export class BadPrivateKeyLength extends Data.TaggedError(
  "Crypto.EdDSA.BadPrivateKeyLength"
)<{
  message: string
}> {
  constructor(privateKey: Uint8Array) {
    super({
      message: `expected extended privateKey with a length of 64 bytes, this privateKey is ${privateKey.length} bytes long (hint: pass hashPrivateKey = true)`
    })
  }
}

export class BadSignatureLength extends Data.TaggedError(
  "Crypto.EdDSA.BadSignatureLength"
)<{
  message: string
}> {
  constructor(signature: Uint8Array) {
    super({ message: `unexpected signature length ${signature.length}` })
  }
}

export class BadPublicKeyLength extends Data.TaggedError(
  "Crypto.EdDSA.BadPublicKeyLength"
)<{
  message: string
}> {
  constructor(publicKey: Uint8Array) {
    super({ message: `unexpected publicKey length ${publicKey.length}` })
  }
}

/**
 * Implementation of point/scalar codec is left up to Ed25519
 */
export type Codec = {
  decodePoint(
    bytes: Uint8Array
  ): Either.Either<Point2I, Encoding.DecodeException>
  encodePoint(point: Point2I): Uint8Array
  decodePrivateKey(
    bytes: Uint8Array
  ): Either.Either<bigint, Encoding.DecodeException>
  decodeScalar(
    bytes: Uint8Array
  ): Either.Either<bigint, Encoding.DecodeException>
  encodeScalar(x: bigint): Uint8Array
}

/**
 *  Edwards Digital Signing Algorithm
 *
 * Symbols based on the book "Elliptic Curves in Cryptography" by I.F. Blake, G. Seroussi and N.P. Smart
 * See page 4 for an overview of the DSA algorithm.
 * This book along with the first few sections of "Cryptography: An Introduction" by N.P. Smart are
 *   recommended reads in order to understand better the concepts of "scalars" and "CurvePoint" and
 *   their arithmatic over finite fields.
 *
 * Notation:
 *   privateKey: 64 bytes, first 32 bytes form the scalar integer `x`, the latter bytes are used for private nonce generation
 *   publicKey: 32 bytes
 *   x: bigint scalar representation of privateKey
 *   g: generator BASE point
 *   h: CurvePoint representation of publicKey
 *   m: (hashed) message, kept as bytes
 *   k: a practically random number, created by applying a one-way function to the message and part of the private key
 *   a: first part of signature
 *   b: second part of signature
 *   `*`: group multiplication of a CurvePoint by a scalar integer, or multiplication of 2 scalars (depending on context)
 *   `+`: CurvePoint addition or scalar addition depending on context
 *   `.`: byte concatenation
 *   `[n:N]`: slice bytes
 *   `f(a,h,m)`: a one-way function for publicy known information
 *   `mod()`: take modulo of a scalar wrt. the order of the Curve
 *   `hash()`: Sha512 hash function
 *   `encodeScalar`: turn a scalar integer into bytes
 *   `decodeScalar`: turn bytes into a scalar integer
 *   `encodePoint`: turn a CurvePoint into bytes
 *   `decodePoint`: turn bytes into a CurvePoint
 *
 * The algorithm below is approached from an additive perspective.
 *
 * 1. Generate 64 random private key bytes
 *      privateKey = random(64)
 * 2. Generate the associated scalar `x`:
 *      x = decodeScalar(privateKey[0:32])
 * 3. Generate public key CurvePoint:
 *      h = g*x
 * 4. Encode public key:
 *      publicKey = encodePoint(h)
 * 5. Create first part of a signature:
 *      k = decodeScalar(hash(privateKey[32:64] . m))
 *      a = g*k
 *      signature[0:32] = encodePoint(a)
 * 6. Create second part of a signature:
 *      f(a,h,m) = decodeScalar(hash(signature[0:32] . publicKey . m))
 *      b = mod(k + f(a,h,m)*x)
 *      signature[32:64] = encodeScalar(b)
 * 7. Verify a signature:
 *      a = decodePoint(signature[0:32])
 *      b = decodeScalar(signature[32:64])
 *      h = decodePoint(publicKey)
 *      f(a,h,m) = decodeScalar(hash(signature[0:32] . publicKey . m))
 *      g*b === a + h*f(a,h,m)
 *
 * We can show that this works by substituting the private calculations done upon signing (the arithmatic takes care of the mod() operator):
 *      g*(k + f(a,h,m)*x) === g*k + h*f(a,h,m)
 *      g*k + g*x*f(a,h,m) === g*k + h*f(a,h,m)
 *
 * We know that `g*x == h`, QED.
 *
 * The arithmatic details are handled by the CurvePoint class
 */
export class EdDSA<T> {
  readonly curve: Curve<T, bigint>
  readonly G: { x: bigint; y: bigint }
  readonly Z: Field<bigint>
  readonly codec: Codec

  /**
   * @param curve
   */
  constructor(
    curve: Curve<T, bigint>,
    G: { x: bigint; y: bigint },
    Z: Field<bigint>,
    pointCodec: Codec
  ) {
    this.curve = curve
    this.G = G
    this.Z = Z
    this.codec = pointCodec
  }

  /**
   * Combination hash and decodeCurveInt
   * @param bytes
   * @returns
   */
  private oneWay(...chunks: Uint8Array[]): bigint {
    const l = chunks.reduce((prev, chunk) => chunk.length + prev, 0)

    const bytes = new Uint8Array(l)

    let offset = 0
    chunks.forEach((chunk) => {
      bytes.set(chunk, offset)
      offset += chunk.length
    })

    return Either.getOrThrow(this.codec.decodeScalar(Sha2_512.hashSync(bytes)))
  }

  /**
   * @param privateKeyBytes
   * @param hashPrivateKey
   * Defaults to true, set to false
   * when used in Bip32 algorithm
   * @returns 32 byte public key.
   */
  derivePublicKey(
    privateKeyBytes: Uint8Array,
    hashPrivateKey: boolean = true
  ): Either.Either<Uint8Array, BadPrivateKeyLength> {
    if (hashPrivateKey) {
      privateKeyBytes = Sha2_512.hashSync(privateKeyBytes)
    } else {
      if (privateKeyBytes.length != 64) {
        return Either.left(new BadPrivateKeyLength(privateKeyBytes))
      }
    }

    // we know that `privateKeyBytes` isn't empty, so `decodePrivateKey()` should never throw an error
    const privateKey = Either.getOrThrow(
      this.codec.decodePrivateKey(privateKeyBytes)
    )

    const curveHelper = new CurveHelper(this.curve)

    const publicKey = curveHelper.scale(
      this.curve.fromAffine(this.G),
      privateKey
    )
    const publicKeyBytes = this.codec.encodePoint(
      this.curve.toAffine(publicKey)
    )

    return Either.right(publicKeyBytes)
  }

  /**
   * Sign the message.
   * Even though this implementation isn't constant time, it isn't vulnerable to a timing attack (see detailed notes in implementation below)
   * @param message
   * @param privateKeyBytes
   * @param hashPrivateKey
   * Defaults to true, Bip32 passes this as false
   * @returns
   * 64 byte signature.
   */
  sign(
    message: Uint8Array,
    privateKeyBytes: Uint8Array,
    hashPrivateKey: boolean = true
  ): Either.Either<Uint8Array, BadPrivateKeyLength> {
    if (hashPrivateKey) {
      privateKeyBytes = Sha2_512.hashSync(privateKeyBytes)
    } else {
      if (privateKeyBytes.length != 64) {
        return Either.left(new BadPrivateKeyLength(privateKeyBytes))
      }
    }

    // Extract privateKey as integer
    //   (Not vulnerable to timing attack because there is no mixing with the message,
    //      so always takes the same amount of time for the same privateKey)
    const privateKey = Either.getOrThrow(
      this.codec.decodePrivateKey(privateKeyBytes)
    )

    const curveHelper = new CurveHelper(this.curve)

    // For convenience calculate publicKey here
    //   (Not vulnerable to timing attack because there is no mixing with the message,
    //      so always takes the same amount of time for the same privateKey)
    const publicKey = curveHelper.scale(
      this.curve.fromAffine(this.G),
      privateKey
    )
    const publicKeyBytes = this.codec.encodePoint(
      this.curve.toAffine(publicKey)
    )

    // Generate a practically random number
    //   (Not vulnerable to timing attack because sha2_512 runtime only depends on message length,
    //     so timing doesn't expose any bytes of the privateKey)
    const k = this.oneWay(privateKeyBytes.slice(32, 64), message)

    // First part of the signature
    //   (Not vulnerable to timing attack because variations in the message create huge random variations in k)
    const a = curveHelper.scale(this.curve.fromAffine(this.G), k)
    const aEncoded = this.codec.encodePoint(this.curve.toAffine(a))

    // Second part of the signature
    //   (Not vulnerable to timing attack.
    //      Even though f is known publicly and changes with each message,
    //      and the f * x operation isn't constant time (bigint ops in JS aren't constant time),
    //      k also changes with each message, and the [k]BASE operation above
    //      is much more expensive than multiplying two big ints)
    const f = this.oneWay(aEncoded, publicKeyBytes, message)
    const b = this.Z.add(k, f * privateKey)
    const bEncoded = this.codec.encodeScalar(b)

    return Either.right(
      new Uint8Array(Array.from(aEncoded).concat(Array.from(bEncoded)))
    )
  }

  /**
   * Returns `true` if the signature is correct.
   * Returns `false`:
   *   * if the signature is incorrect
   *   * if the signature doesn't lie on the curve,
   *   * if the publicKey doesn't lie on the curve
   * Throw an error:
   *   * signature isn't 64 bytes long
   *   * publickey isn't 32 bytes long (asserted inside `decodePoint()`)
   * @param signature
   * @param message
   * @param publicKey
   * @returns
   */
  verify(
    signature: Uint8Array,
    message: Uint8Array,
    publicKey: Uint8Array
  ): Either.Either<boolean, BadSignatureLength | BadPublicKeyLength> {
    if (signature.length != 64) {
      return Either.left(new BadSignatureLength(signature))
    }

    const a = this.curve.fromAffine(
      Either.getOrThrow(this.codec.decodePoint(signature.slice(0, 32)))
    )

    if (!this.curve.isValidPoint(a)) {
      return Either.right(false)
    }

    const b = Either.getOrThrow(
      this.codec.decodeScalar(signature.slice(32, 64))
    )

    if (publicKey.length != 32) {
      return Either.left(new BadPublicKeyLength(publicKey))
    }

    const h = this.curve.fromAffine(
      Either.getOrThrow(this.codec.decodePoint(publicKey))
    )

    if (!this.curve.isValidPoint(h)) {
      return Either.right(false)
    }

    const f = this.oneWay(signature.slice(0, 32), publicKey, message)

    const curveHelper = new CurveHelper(this.curve)

    const left = curveHelper.scale(this.curve.fromAffine(this.G), b)
    const right = this.curve.add(a, curveHelper.scale(h, f))

    return Either.right(this.curve.equals(left, right))
  }
}
