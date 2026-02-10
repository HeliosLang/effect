export type Element2 = [bigint, bigint]

export type Element6 = [[bigint, bigint], [bigint, bigint], [bigint, bigint]]

export type Element12 = [
  [[bigint, bigint], [bigint, bigint], [bigint, bigint]],
  [[bigint, bigint], [bigint, bigint], [bigint, bigint]]
]

/**
 * Positive modulo operator
 * @param x
 * @param modulo
 * @returns
 */
export function mod(x: bigint, modulo: bigint): bigint {
  const res = x % modulo

  if (res < 0n) {
    return res + modulo
  } else {
    return res
  }
}

/**
 * A Field is an abstraction of a collection of numbers.
 * Fields used in Elliptic Curve Cryptography must define the following operations:
 *   * add two Field elements (TODO: accept any number of elements to add)
 *   * scale a Field element (i.e. add to itself), this defines how additive negation works
 *   * multiply two Field elements
 *   * pow (i.e. multiply by itself)
 *   * equals, compare to Field elements
 *   * invert (i.e. solve the equation x*x^-1 = 1 for x^-1)
 *   * sqrt (i.e. solve the equation y*y = x for y)
 *
 * The following Field elements must also be defined:
 *   * ZERO (i.e. additive identity)
 *   * ONE (i.e. multiplicative identity)
 *
 * The following operations can then be derived from the base operations:
 *   * subtract
 *   * negate
 *   * divide
 *   * square
 *
 * A Field should be usable without knowing the number used for modulo operations.
 */
export interface Field<T> {
  ZERO: T
  ONE: T
  add: (a: T, ...b: T[]) => T
  scale: (a: T, s: bigint) => T
  multiply: (a: T, b: T) => T
  equals: (a: T, b: T) => boolean
  invert: (a: T) => T
}

export class ScalarField implements Field<bigint> {
  /**
   * Every operation is modulo this number
   */
  readonly modulo: bigint

  constructor(modulo: bigint) {
    this.modulo = modulo
  }

  get ZERO(): bigint {
    return 0n
  }

  get ONE(): bigint {
    return 1n
  }

  /**
   * @param a
   * @param b
   * @returns
   */
  add(a: bigint, ...b: bigint[]): bigint {
    return mod(
      b.reduce((sum, b) => sum + b, a),
      this.modulo
    )
  }

  /**
   * @param a
   * @param n
   * @returns
   */
  scale(a: bigint, n: bigint): bigint {
    return mod(a * n, this.modulo)
  }

  /**
   * Implemented separately from `scale` because it has a different meaning
   * @param a
   * @param b
   * @returns
   */
  multiply(a: bigint, b: bigint): bigint {
    return mod(a * b, this.modulo)
  }

  /**
   * @param a
   * @param b
   * @returns
   */
  equals(a: bigint, b: bigint): boolean {
    return mod(a, this.modulo) === mod(b, this.modulo)
  }

  /**
   * Invert a number on a field (i.e. calculate n^-1 so that n*n^-1 = 1)
   * This is an expensive iterative procedure that is only guaranteed to converge if the modulo is a prime number
   * @param n
   * @returns
   */
  invert(n: bigint): bigint {
    let a = mod(n, this.modulo)
    let b = this.modulo

    let x = 0n
    let y = 1n
    let u = 1n
    let v = 0n

    while (a !== 0n) {
      const q = b / a
      const r = b % a
      const m = x - u * q
      const n = y - v * q
      b = a
      a = r
      x = u
      y = v
      u = m
      v = n
    }

    return mod(x, this.modulo)
  }
}

/**
 * Defines additional operations on a field (which use the basic operations as building blocks)
 *   * isZero(a)
 *   * isOne(a)
 *   * mod(a)
 *   * subtract(a, b)
 *   * negate(a)
 *   * square(a)
 *   * cube(a)
 *   * divide(a, b)
 *   * pow(a, p)
 *   * halve(a)
 */
export class FieldHelper<T> implements Field<T> {
  readonly F: Field<T>

  /**
   * @param F
   */
  constructor(F: Field<T>) {
    this.F = F
  }

  get ZERO(): T {
    return this.F.ZERO
  }

  get ONE(): T {
    return this.F.ONE
  }

  /**
   * @param a
   * @returns
   */
  isZero(a: T): boolean {
    return this.equals(a, this.ZERO)
  }

  /**
   * @param a
   * @returns
   */
  isOne(a: T): boolean {
    return this.equals(a, this.ONE)
  }

  /**
   * @param a
   * @returns
   */
  mod(a: T): T {
    return this.F.scale(a, 1n)
  }

  /**
   * @param a
   * @param bs
   * @returns
   */
  add(a: T, ...bs: T[]): T {
    return this.F.add(a, ...bs)
  }

  /**
   * @param a
   * @param b
   * @returns
   */
  subtract(a: T, b: T) {
    const F = this.F
    return F.add(a, F.scale(b, -1n))
  }

  /**
   * @param a
   * @param s
   * @returns
   */
  scale(a: T, s: bigint): T {
    return this.F.scale(a, s)
  }

  /**
   * @param a
   * @returns
   */
  negate(a: T): T {
    return this.F.scale(a, -1n)
  }

  /**
   * @param a
   * @param b
   * @returns
   */
  multiply(a: T, b: T): T {
    return this.F.multiply(a, b)
  }

  /**
   * @param a
   * @returns
   */
  square(a: T): T {
    return this.F.multiply(a, a)
  }

  /**
   * @param a
   * @returns
   */
  cube(a: T): T {
    return this.F.multiply(a, this.F.multiply(a, a))
  }

  /**
   * @param a
   * @param b
   * @returns
   */
  divide(a: T, b: T): T {
    return this.F.multiply(a, this.F.invert(b))
  }

  /**
   * @param a
   * @returns
   */
  invert(a: T): T {
    return this.F.invert(a)
  }

  /**
   * Modular exponent
   * TODO: would a non-recursive version of this algorithm be faster?
   * @param a
   * @param p
   * @returns
   */
  pow(a: T, p: bigint): T {
    if (p == 0n) {
      return this.F.ONE
    } else if (p == 1n) {
      return a
    } else {
      let t = this.pow(a, p / 2n)
      t = this.F.multiply(t, t)

      if (p % 2n != 0n) {
        t = this.F.multiply(t, a)
      }

      return t
    }
  }

  /**
   * @param a
   * @param b
   * @returns
   */
  equals(a: T, b: T): boolean {
    return this.F.equals(a, b)
  }

  /**
   * @param a
   * @returns
   */
  halve(a: T): T {
    return this.divide(a, this.F.scale(this.F.ONE, 2n))
  }
}

export class QuadraticField<T> implements Field<[T, T]> {
  /**
   * Field used for each component
   */
  readonly F: Field<T>

  /**
   * We can always replace u^2 by this number (e.g. for complex numbers this is -1)
   */
  readonly U2: T

  /**
   * @param F
   * Applied to each part separately
   * @param U2
   */
  constructor(F: Field<T>, U2: T) {
    this.F = F
    this.U2 = U2
  }

  get ZERO(): [T, T] {
    return [this.F.ZERO, this.F.ZERO]
  }

  get ONE(): [T, T] {
    return [this.F.ONE, this.F.ZERO]
  }

  /**
   * @param a
   * @param b
   * @returns
   */
  add([ax, ay]: [T, T], ...b: [T, T][]): [T, T] {
    const F = this.F
    return [F.add(ax, ...b.map((b) => b[0])), F.add(ay, ...b.map((b) => b[1]))]
  }

  /**
   * @param a
   * @param s
   * @returns
   */
  scale([ax, ay]: [T, T], s: bigint): [T, T] {
    const F = this.F
    return [F.scale(ax, s), F.scale(ay, s)]
  }

  /**
   * @param a
   * @param b
   * @returns
   */
  multiply([ax, ay]: [T, T], [bx, by]: [T, T]): [T, T] {
    const F = this.F

    return [
      F.add(F.multiply(ax, bx), F.multiply(F.multiply(ay, by), this.U2)),
      F.add(F.multiply(ay, bx), F.multiply(by, ax))
    ]
  }

  /**
   * @param a
   * @param b
   * @returns
   */
  equals([ax, ay]: [T, T], [bx, by]: [T, T]): boolean {
    const F = this.F

    return F.equals(ax, bx) && F.equals(ay, by)
  }

  /**
   * Using the following formula we can derive the inverse of complex field element
   *   (ax + u*ay)*(ax - u*ay) = ax^2 - u^2*ay^2
   *   (ax + u*ay)^-1 = (ax - u*ay)/(ax^2 - u^2*ay^2)
   * @param a
   * @returns
   */
  invert([ax, ay]: [T, T]): [T, T] {
    const F = new FieldHelper(this.F)
    const f = F.invert(
      F.subtract(F.square(ax), F.multiply(F.square(ay), this.U2))
    )

    return [F.multiply(ax, f), F.multiply(ay, F.negate(f))]
  }
}

export interface Field12WithExtendedOps {
  ZERO: Element12
  ONE: Element12
  add(a: Element12, ...b: Element12[]): Element12
  scale(a: Element12, s: bigint): Element12
  multiply(a: Element12, b: Element12): Element12
  equals(a: Element12, b: Element12): boolean
  invert(a: Element12): Element12
  isZero(a: Element12): boolean
  isOne(a: Element12): boolean
  mod(a: Element12): Element12
  subtract(a: Element12, b: Element12): Element12
  negate(a: Element12): Element12
  square(a: Element12): Element12
  cube(a: Element12): Element12
  divide(a: Element12, b: Element12): Element12
  pow(a: Element12, p: bigint): Element12
  halve(a: Element12): Element12
  conjugate(a: Element12): Element12
  powp(a: Element12, n: number): Element12
  multiplyF2(a: Element12, b: [bigint, bigint]): Element12
}
