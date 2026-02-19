import { Either, Encoding } from "effect"
import * as Bits from "../Codecs/Bits.js"
import * as Bytes from "../Codecs/Bytes.js"
import * as LittleEndian from "../Codecs/LittleEndian.js"
import { type Curve, type Point2I, type Point4 } from "./Curve.js"
import {
  BadPrivateKeyLength,
  BadPublicKeyLength,
  BadSignatureLength,
  EdDSA
} from "./EdDSA.js"
import { FieldHelper, ScalarField } from "./Field.js"

/**
 * @param bytes
 * @param truncate
 * Force `bytes` to 32 bytes long, applying special padding to first and 32nd byte
 * @returns
 * A DecodeException if `bytes` is empty
 */
export function decodeScalar(
  bytes: Uint8Array,
  truncate: boolean = false
): Either.Either<bigint, Encoding.DecodeException> {
  if (truncate) {
    bytes = bytes.slice(0, 32)

    bytes[0] &= 0b11111000
    bytes[31] &= 0b00111111
    bytes[31] |= 0b01000000
  }

  return LittleEndian.decode(bytes)
}

/**
 * @param bytes
 * @returns
 * A DecodeException if `bytes` is empty
 */
export function decodePrivateKey(
  bytes: Uint8Array
): Either.Either<bigint, Encoding.DecodeException> {
  return decodeScalar(bytes, true)
}

/**
 * @param x
 * @returns
 */
export function encodeScalar(x: bigint): Uint8Array {
  return new Uint8Array(LittleEndian.encode32(x))
}

/**
 * The formula for the twisted Edwards curve is:
 *    -x^2 + y^2 = 1 - d*x^2*y^2
 * Calculating x from this we get (only y is stored in the encoded point):
 *    y^2 - 1 = x^2*(1 - d*y^2)
 *    x = sqrt((y^2 - 1)/(1 - d*y^2))
 * @param bytes
 * @returns
 * A DecodeException if `bytes` isn't exactly 32 long
 */
export const decodePoint = (
  bytes: Uint8Array
): Either.Either<Point2I, Encoding.DecodeException> =>
  Either.gen(function* () {
    if (bytes.length != 32) {
      return yield* Either.left(
        Encoding.DecodeException(
          Bytes.toHex(bytes),
          `expected 32 bytes for encoded point, got ${bytes.length}`
        )
      )
    }

    const tmp = bytes.slice()
    tmp[31] = tmp[31] & 0b01111111

    // here we know that `tmp` isn't empty, so `decodeScalar()` can't throw an error
    const y = Either.getOrThrow(decodeScalar(tmp))
    const finalBit = Bits.getBit(Array.from(bytes), 255)

    const y2 = y * y
    const x2 = (y2 - 1n) * F.invert(1n + D * y2)

    // sqrt
    let x = sqrt(x2)

    if (!x) {
      throw new Error("sqrt not defined on Ed25519 field, unable to recover X")
    }

    // if odd state not equal, make odd state same
    if (Number(x & 1n) != finalBit) {
      x = F.negate(x)
    }

    return { x, y }
  })

/**
 * @param point
 * @returns
 */
export function encodePoint(point: Point2I): Uint8Array {
  const { x, y } = point
  const evenOdd = Number(x & 1n) // 0: even, 1: odd

  const bytes = encodeScalar(y)

  // last bit is determined by x
  bytes[31] = (bytes[31] & 0b011111111) | (evenOdd * 0b10000000)

  return bytes
}

// Decimal representations of large numbers because that's most common in literature

// Curve coordinate prime number.
// 255 bits so last bit can instead be used to encode sign
//   (i.e. 32 byte compressed format for points which is neede by publicKey and first part of signature)
//  operations on point coordinates are modulo P
export const P =
  57896044618658097711785492504343953926634992332820282019728792003956564819949n // ipowi(255n) - 19n, hence 25519

// A prime number that is <= the number of unique points on the curve
//  operations on point multiplication factors are modulo N
export const N =
  7237005577332262213973186563042994240857116359379907606001950938285454250989n // ipow2(252n) + 27742317777372353535851937790883648493n;

// d parameter of affine twisted Edwards curve
//  The formula for the twisted Edwards curve is:
//    -x^2 + y^2 = 1 - d*x^2*y^2
// Note: the negative number is already included in this parameter
export const D = /* @__PURE__ */ (() =>
  -4513249062541557337682894930092624173785641285191125241628941591882900924598840740n)() // -121665n/121666n == -121665n * invert(121666n)

// Generator point
export const G = {
  x: 15112221349535400772501151409588531511454012693041857206046113283949847762202n, // recovered from Gy
  y: 46316835694926478169428394003475163141307993866256225615783033603165251855960n // (4n*invert(5n)) % P
}

const F = /* @__PURE__ */ (() => new FieldHelper(new ScalarField(P)))()

// (P + 3n)/8n
const P38 =
  7237005577332262213973186563042994240829374041602535252466099000494570602494n

// pow(2n, (P + 1n)/4n, P);
const SQRT2P14 =
  19681161376707505956807079304988542015446066515923890162744021073123829784752n

function sqrt(a: bigint): bigint {
  let r = F.pow(a, P38)

  const r2 = F.multiply(r, r)

  if (!F.equals(r2, a)) {
    r = F.multiply(r, SQRT2P14)
  }

  return r
}

class AffineCurve implements Curve<Point2I, bigint> {
  constructor() {}

  get ZERO(): Point2I {
    return {
      x: 0n,
      y: 1n
    }
  }

  /**
   * @param a
   * @param b
   * @returns
   */
  equals(a: Point2I, b: Point2I): boolean {
    return F.equals(a.x, b.x) && F.equals(a.y, b.y)
  }

  /**
   * @param point
   * @returns
   */
  negate(point: Point2I): Point2I {
    return {
      x: F.negate(point.x),
      y: point.y
    }
  }

  /**
   * @param point
   * @returns
   */
  isValidPoint(point: Point2I): boolean {
    const { x, y } = point

    // TODO: can we use F.square() ?
    const xx = x * x
    const yy = y * y

    return F.equals(-xx + yy - 1n, D * xx * yy)
  }

  /**
   * @param a
   * @param b
   * @returns
   */
  add(a: Point2I, b: Point2I): Point2I {
    const { x: x1, y: y1 } = a
    const { x: x2, y: y2 } = b

    const dxxyy = D * x1 * x2 * y1 * y2

    const x3 = F.multiply(x1 * y2 + x2 * y1, F.invert(1n + dxxyy))
    const y3 = F.multiply(y1 * y2 + x1 * x2, F.invert(1n - dxxyy))

    return { x: x3, y: y3 }
  }

  /**
   * @param point
   * @returns
   */
  fromAffine(point: Point2I): Point2I {
    return point
  }

  /**
   * @param point
   * @returns
   */
  toAffine(point: Point2I): Point2I {
    return point
  }
}

export const affineCurve = new AffineCurve()

class ExtendedCurve implements Curve<Point4<bigint>, bigint> {
  constructor() {}

  get ZERO(): Point4<bigint> {
    return { x: 0n, y: 1n, z: 1n, t: 0n }
  }

  /**
   * @param point
   * @returns
   */
  isValidPoint(point: Point4<bigint>): boolean {
    if (this.equals(this.ZERO, point)) {
      return true
    } else {
      const zInverse = F.invert(point.z)

      const x = F.multiply(point.x, zInverse)
      const y = F.multiply(point.y, zInverse)

      const xx = x * x
      const yy = y * y

      return F.equals(-xx + yy - 1n, D * xx * yy)
    }
  }

  /**
   * @param a
   * @param b
   * @returns
   */
  equals(a: Point4<bigint>, b: Point4<bigint>): boolean {
    return (
      F.multiply(a.x, b.z) == F.multiply(b.x, a.z) &&
      F.multiply(a.y, b.z) == F.multiply(b.y, a.z)
    )
  }

  /**
   * @param point
   * @returns
   */
  negate(point: Point4<bigint>): Point4<bigint> {
    return {
      x: F.negate(point.x),
      y: point.y,
      z: point.z,
      t: F.negate(point.t)
    }
  }

  /**
   * @param point1
   * @param point2
   * @returns
   */
  add(point1: Point4<bigint>, point2: Point4<bigint>): Point4<bigint> {
    const { x: x1, y: y1, z: z1, t: t1 } = point1
    const { x: x2, y: y2, z: z2, t: t2 } = point2

    const a = F.multiply(x1, x2)
    const b = F.multiply(y1, y2)
    const c = F.multiply(D * t1, t2)
    const d = F.multiply(z1, z2)
    const e = F.add((x1 + y1) * (x2 + y2), -a - b)
    const f = F.add(d, -c)
    const g = F.add(d, c)
    const h = F.add(a, b)
    const x3 = F.multiply(e, f)
    const y3 = F.multiply(g, h)
    const z3 = F.multiply(f, g)
    const t3 = F.multiply(e, h)

    return { x: x3, y: y3, z: z3, t: t3 }
  }

  /**
   * @param point
   * @returns
   */
  toAffine(point: Point4<bigint>): Point2I {
    if (this.equals(this.ZERO, point)) {
      return { x: 0n, y: 1n }
    } else {
      const zInverse = F.invert(point.z)

      return {
        x: F.multiply(point.x, zInverse),
        y: F.multiply(point.y, zInverse)
      }
    }
  }

  /**
   * @param point
   * @returns
   */
  fromAffine(point: Point2I): Point4<bigint> {
    const { x, y } = point

    return {
      x,
      y,
      z: 1n,
      t: F.multiply(x, y)
    }
  }
}

export const extendedCurve = /* @__PURE__ */ (() => new ExtendedCurve())()

const algorithm = /* @__PURE__ */ (() =>
  new EdDSA(extendedCurve, G, new ScalarField(N), {
    decodePoint,
    encodePoint,
    decodePrivateKey,
    decodeScalar,
    encodeScalar
  }))()

/**
 * @param privateKey
 * Must be 64 bytes long
 * @param hashPrivateKey
 * Defaults to true, set to false when used in Bip32 algorithm
 * @returns
 * 32 byte public key, or BadPrivateKeyLength if private key isn't 64 bytes long
 */
export function derivePublicKey(
  privateKey: Uint8Array,
  hashPrivateKey: boolean = true
): Either.Either<Uint8Array, BadPrivateKeyLength> {
  return algorithm.derivePublicKey(privateKey, hashPrivateKey)
}

/**
 * Sign the message.
 * Even though this implementation isn't constant time, it isn't vulnerable to a timing attack (see detailed notes in EdDSA implementation)
 * @param message
 * @param privateKeyBytes
 * @param hashPrivateKey
 * Defaults to true, Bip32 passes this as false
 * @returns
 * 64 byte signature, or BadPrivateKeyLength if private key isn't 64 bytes long
 */
export function sign(
  message: Uint8Array,
  privateKey: Uint8Array,
  hashPrivateKey: boolean = true
): Either.Either<Uint8Array, BadPrivateKeyLength> {
  return algorithm.sign(message, privateKey, hashPrivateKey)
}

/**
 * @param signature
 * @param message
 * @param publicKey
 * @returns
 *   - `true` if the signature is correct.
 *   - `false`:
 *     - if the signature is incorrect
 *     - if the signature doesn't lie on the curve,
 *     - if the publicKey doesn't lie on the curve
 *   - BadPublicKeyLength if publicKey isn't 32 bytes long
 *   - BadSignatureLength if signature isn't 64 bytes long
 */
export function verify(
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array
): Either.Either<boolean, BadSignatureLength | BadPublicKeyLength> {
  return algorithm.verify(signature, message, publicKey)
}
