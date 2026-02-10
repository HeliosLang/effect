import { type Field } from "./Field.js"

/**
 * Data container for affine points
 */
export type Point2<T> = {
  x: T
  y: T
}

export type Point2I = Point2<bigint>
export type Point2C = Point2<[bigint, bigint]>

/**
 * Data container for projected points (much faster to do curve operations on than affine)
 */
export type Point3<T> = {
  x: T
  y: T
  z: T
}

export type Point3I = Point3<bigint>
export type Point3C = Point3<[bigint, bigint]>

/**
 * Data container for extended points (much faster to operate on than affine points)
 */
export type Point4<T> = {
  x: T
  y: T
  z: T
  t: T
}

/**
 * Abstraction of an additive group
 *   * ZERO: additive identity
 *   * add two points to form a new point
 *   * scale: add a point to itself
 *   * equals: compares two points
 *   * isValidPoint: returns true if point lies on curve
 *
 * For scale we'll always be using the double-and-add algorithm
 */
export interface Curve<T, Tc> {
  ZERO: T
  add: (a: T, b: T) => T
  negate: (a: T) => T
  equals: (a: T, b: T) => boolean
  isValidPoint: (p: T) => boolean
  toAffine: (point: T) => Point2<Tc>
  fromAffine: (point: Point2<Tc>) => T
}

export class CurveHelper<T, Tc> implements Curve<T, Tc> {
  protected readonly curve: Curve<T, Tc>

  /**
   * @param curve
   */
  constructor(curve: Curve<T, Tc>) {
    this.curve = curve
  }

  get ZERO(): T {
    return this.curve.ZERO
  }

  /**
   * @param point
   * @returns
   */
  isZero(point: T): boolean {
    return this.curve.equals(this.curve.ZERO, point)
  }

  /**
   * @param point
   * @returns
   */
  isValidPoint(point: T): boolean {
    return this.curve.isValidPoint(point)
  }

  /**
   * @param a
   * @param b
   * @returns
   */
  equals(a: T, b: T): boolean {
    return this.curve.equals(a, b)
  }

  /**
   * @param a
   * @param b
   * @returns
   */
  add(a: T, b: T): T {
    return this.curve.add(a, b)
  }

  /**
   * @param a
   * @param b
   * @returns
   */
  subtract(a: T, b: T): T {
    return this.curve.add(a, this.curve.negate(b))
  }

  /**
   * @param a
   * @returns
   */
  negate(a: T): T {
    return this.curve.negate(a)
  }

  /**
   * Double-and-add algorithm
   * Seems to have acceptable performance.
   * Not constant-time, but for the signing algorithms this scalar is always a random private number
   * @param point
   * @param s
   * @returns
   */
  scale(point: T, s: bigint): T {
    if (s == 0n) {
      console.log("scale returning 0")
      return this.curve.ZERO
    } else if (s == 1n) {
      return point
    } else if (s < 0n) {
      return this.scale(this.curve.negate(point), -s)
    } else {
      let sum = this.scale(point, s / 2n)

      sum = this.curve.add(sum, sum)

      if (s % 2n != 0n) {
        sum = this.curve.add(sum, point)
      }

      return sum
    }
  }

  toAffine(point: T): Point2<Tc> {
    return this.curve.toAffine(point)
  }

  fromAffine(point: Point2<Tc>): T {
    return this.curve.fromAffine(point)
  }
}

export interface ShortAffineCurve<T> extends Curve<Point2<T>, T> {
  F: Field<T>
  b: T
  double(point: Point2<T>): Point2<T>
}

export interface AffineCurve1 {
  b: bigint
  ZERO: Point2I
  add(a: Point2I, b: Point2I): Point2I
  negate(a: Point2I): Point2I
  equals(a: Point2I, b: Point2I): boolean
  isValidPoint(p: Point2I): boolean
  isZero(point: Point2I): boolean
  subtract(a: Point2I, b: Point2I): Point2I
  scale(point: Point2I, s: bigint): Point2I
  toAffine(point: Point2I): Point2I
  fromAffine(point: Point2I): Point2I
}

export interface AffineCurve2 {
  b: [bigint, bigint]
  ZERO: Point2C
  add(a: Point2C, b: Point2C): Point2C
  negate(a: Point2C): Point2C
  equals(a: Point2C, b: Point2C): boolean
  isValidPoint(p: Point2C): boolean
  isZero(point: Point2C): boolean
  subtract(a: Point2C, b: Point2C): Point2C
  scale(point: Point2C, s: bigint): Point2C
  toAffine(point: Point2C): Point2C
  fromAffine(point: Point2C): Point2C
}

export interface ProjectedCurve1 {
  ZERO: Point3I
  add(a: Point3I, b: Point3I): Point3I
  negate(a: Point3I): Point3I
  equals(a: Point3I, b: Point3I): boolean
  isValidPoint(p: Point3I): boolean
  isZero(point: Point3I): boolean
  subtract(a: Point3I, b: Point3I): Point3I
  scale(point: Point3I, s: bigint): Point3I
  toAffine(point: Point3I): Point2I
  fromAffine(point: Point2I): Point3I
  clearCofactor(point: Point3I): Point3I
}

export interface ProjectedCurve2 {
  ZERO: Point3C
  add(a: Point3C, b: Point3C): Point3C
  negate(a: Point3C): Point3C
  equals(a: Point3C, b: Point3C): boolean
  isValidPoint(p: Point3C): boolean
  isZero(point: Point3C): boolean
  subtract(a: Point3C, b: Point3C): Point3C
  scale(point: Point3C, s: bigint): Point3C
  toAffine(point: Point3C): Point2C
  fromAffine(point: Point2C): Point3C
  scalex(point: Point3C): Point3C
  psi(point: Point3C): Point3C
  psi2(point: Point3C): Point3C
  clearCofactor(point: Point3C): Point3C
}
