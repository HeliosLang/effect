export type Uint64 = {
  high: number
  low: number
}

export const Zero: Uint64 = { high: 0, low: 0 }

export function fromBytes(
  bytes: number[],
  littleEndian: boolean = true
): Uint64 {
  let low: number
  let high: number

  if (littleEndian) {
    low =
      (bytes[0] << 0) | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24)
    high =
      (bytes[4] << 0) | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24)
  } else {
    high =
      (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | (bytes[3] << 0)
    low =
      (bytes[4] << 24) | (bytes[5] << 16) | (bytes[6] << 8) | (bytes[7] << 0)
  }

  return { high: high >>> 0, low: low >>> 0 }
}

export function fromHex(hex: string): Uint64 {
  const high = parseInt(hex.slice(0, 8), 16)
  const low = parseInt(hex.slice(8, 16), 16)

  return { high: high >>> 0, low: low >>> 0 }
}

export function toBytes(x: Uint64, littleEndian: boolean = true): number[] {
  const res = [
    0x000000ff & x.low,
    (0x0000ff00 & x.low) >>> 8,
    (0x00ff0000 & x.low) >>> 16,
    (0xff000000 & x.low) >>> 24,
    0x000000ff & x.high,
    (0x0000ff00 & x.high) >>> 8,
    (0x00ff0000 & x.high) >>> 16,
    (0xff000000 & x.high) >>> 24
  ]

  if (!littleEndian) {
    res.reverse()
  }

  return res
}

export function equals(a: Uint64, b: Uint64): boolean {
  return a.high == b.high && a.low == b.low
}

export function not(x: Uint64): Uint64 {
  return { high: ~x.high, low: ~x.low }
}

export function and(a: Uint64, b: Uint64): Uint64 {
  return { high: a.high & b.high, low: a.low & b.low }
}

export function xor(a: Uint64, b: Uint64): Uint64 {
  return {
    high: (a.high ^ b.high) >>> 0,
    low: (a.low ^ b.low) >>> 0
  }
}

export function add(a: Uint64, b: Uint64): Uint64 {
  const low = a.low + b.low
  let high = a.high + b.high

  if (low >= 0x100000000) {
    high += 1
  }

  return { high: high >>> 0, low: low >>> 0 }
}

export function rotr(x: Uint64, n: number): Uint64 {
  let h = x.high
  let l = x.low

  if (n == 32) {
    return { high: l, low: h }
  } else if (n > 32) {
    n -= 32
    ;[h, l] = [l, h]
  }

  return {
    high: ((h >>> n) | (l << (32 - n))) >>> 0,
    low: ((l >>> n) | (h << (32 - n))) >>> 0
  }
}

export function shiftr(x: Uint64, n: number): Uint64 {
  if (n >= 32) {
    return { high: 0, low: x.high >>> (n - 32) }
  } else {
    return {
      high: x.high >>> n,
      low: ((x.low >>> n) | (x.high << (32 - n))) >>> 0
    }
  }
}
