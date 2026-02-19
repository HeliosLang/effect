import * as Bytes from "../Codecs/Bytes.js"
import * as Sha2_256 from "./Sha2_256.js"
import * as Sha2_512 from "./Sha2_512.js"

/**
 * Hmac using sha2-256.
 * @example
 * bytesToHex(hmacSha2_256(textToBytes("key"), textToBytes("The quick brown fox jumps over the lazy dog"))) == "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8"
 * @param key
 * @param message
 * @returns
 */
export function sha2_256Sync(
  key: Bytes.BytesLike,
  message: Bytes.BytesLike
): Uint8Array {
  return deriveSyncInternal(Sha2_256.hashSync, 64)(
    Bytes.toUint8Array(key),
    Bytes.toUint8Array(message)
  )
}

/**
 * Hmac using sha2-512.
 * @example
 * bytesToHex(hmacSha2_512(textToBytes("key"), textToBytes("The quick brown fox jumps over the lazy dog"))) == "b42af09057bac1e2d41708e48a902e09b5ff7f12ab428a4fe86653c73dd248fb82f948a549f7b791a5b41915ee4d1ec3935357e4e2317250d0372afa2ebeeb3a"
 * @param key
 * @param message
 * @returns
 */
export function sha2_512Sync(
  key: Bytes.BytesLike,
  message: Bytes.BytesLike
): Uint8Array {
  return deriveSyncInternal(Sha2_512.hashSync, 128)(
    Bytes.toUint8Array(key),
    Bytes.toUint8Array(message)
  )
}

/**
 * Don't use this directly, use hmacSyncSha2_256 or hmacSyncSha2_512 instead
 * @param algorithm
 * sync hashing function
 * @param b
 * blockSize of algorithm
 * @returns
 */
const deriveSyncInternal =
  (algorithm: (x: Uint8Array) => Uint8Array, blockSize: number) =>
  (key: Uint8Array, message: Uint8Array): Uint8Array => {
    if (key.length > blockSize) {
      key = algorithm(key)
    } else {
      key = key.slice()
    }

    while (key.length < blockSize) {
      const tmp = new Uint8Array(key.length + 1)
      tmp.set(key)
      tmp[key.length] = 0x00
      key = tmp
    }

    const iPadded = key.map((k) => k ^ 0x36)
    const oPadded = key.map((k) => k ^ 0x5c)

    return algorithm(
      Bytes.concat(oPadded, algorithm(Bytes.concat(iPadded, message)))
    )
  }
