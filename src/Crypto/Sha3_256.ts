import * as Bytes from "../Codecs/Bytes.js"
import * as Keccak from "./Keccak.js"

/**
 * @param bytes
 * @returns
 * A 32 byte hash
 */
export function hashSync(bytes: Bytes.BytesLike): Uint8Array {
  return Keccak.hashSync(bytes, 0x06)
}
