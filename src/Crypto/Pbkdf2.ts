import * as BigEndian from "../internal/BigEndian.js"
import * as Bytes from "../internal/Bytes.js"

/**
 * Password-Based Key Derivation Function 2.
 * @example
 * bytesToHex(pbkdf2(hmacSha2_256, textToBytes("password"), textToBytes("salt"), 1, 20)) == "120fb6cffcf8b32c43e7225256c4f837a86548c9"
 * @example
 * bytesToHex(pbkdf2(hmacSha2_512, textToBytes("password"), textToBytes("salt"), 2, 20)) == "e1d9c16aa681708a45f5c7c4e215ceb66e011a2e"
 * @param prf
 * @param password
 * @param salt
 * @param nIters
 * @param keyLen
 * @returns
 */
export function deriveSync(
  prf: (key: Uint8Array, msg: Uint8Array) => Uint8Array,
  password: Uint8Array,
  salt: Uint8Array,
  nIters: number,
  keyLen: number
): Uint8Array {
  let dk: Uint8Array = new Uint8Array([])

  let i = 1n
  while (dk.length < keyLen) {
    const bi = BigEndian.encode(i)
    while (bi.length < 4) {
      bi.unshift(0)
    }

    let U = prf(password, Bytes.concat(salt, bi))
    let T = U

    for (let j = 1; j < nIters; j++) {
      U = prf(password, U)
      T = xor(T, U)
    }

    dk = Bytes.concat(dk, T)

    i += 1n
  }

  if (dk.length > keyLen) {
    dk = dk.slice(0, keyLen)
  }

  return dk
}

function xor(a: Uint8Array, b: Uint8Array): Uint8Array {
  const c = new Uint8Array(a.length)

  for (let i = 0; i < a.length; i++) {
    c[i] = a[i] ^ b[i]
  }

  return c
}
