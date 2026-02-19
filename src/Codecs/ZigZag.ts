export function toSigned(x: bigint | number): bigint {
  if (typeof x == "number") {
    return toSigned(BigInt(x))
  } else if (x < 0n) {
    throw new Error(`invalid zigzag encoding ('${x}' isn't a positive number)`)
  } else if (x % 2n == 0n) {
    return x / 2n
  } else {
    return -(x + 1n) / 2n
  }
}

export function toUnsigned(x: bigint | number): bigint {
  if (typeof x == "number") {
    return toUnsigned(BigInt(x))
  } else if (x < 0n) {
    return -x * 2n - 1n
  } else {
    return x * 2n
  }
}
