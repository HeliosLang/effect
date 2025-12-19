import * as Bits from "./Bits.js"

/**
 * Instantiate a `Flat.Reader` with {@link makeReader}.
 */
export interface Reader {
  isAtEnd(): boolean
  readBits(n: number): number
  readBool(): boolean
  readBuiltinId(): number
  readBytes(): number[]
  readInt(): bigint
  readTag(): number
  readList<T>(readItem: (r: Reader) => T): T[]
}

/**
 * @param bytes
 * @returns
 */
export function makeReader(bytes: string | number[] | Uint8Array): Reader {
  return new ReaderImpl(bytes)
}

class ReaderImpl implements Reader {
  private readonly bitReader: Bits.Reader

  /**
   * @param bytes
   */
  constructor(bytes: string | number[] | Uint8Array) {
    this.bitReader = Bits.makeReader(bytes)
  }

  isAtEnd(): boolean {
    return this.bitReader.isAtEnd()
  }

  /**
   * @param n
   * @returns
   */
  readBits(n: number): number {
    return this.bitReader.readBits(n)
  }

  readBool(): boolean {
    return this.readBits(1) == 1
  }

  readBuiltinId(): number {
    return this.readBits(7)
  }

  readBytes(): number[] {
    return decodeBytes(this.bitReader)
  }

  /**
   * @returns {bigint}
   */
  readInt(): bigint {
    return decodeInt(this.bitReader)
  }

  /**
   * Reads a Plutus-core list with a specified size per element
   * Calls itself recursively until the end of the list is reached
   * @template T
   * @param readItem
   * @returns
   */
  readList<T>(readItem: (r: Reader) => T): T[] {
    // Cons and Nil constructors come from Lisp/Haskell
    //  cons 'a' creates a linked list node,
    //  nil      creates an empty linked list
    const nilOrCons = this.readBits(1)

    if (nilOrCons == 0) {
      return []
    } else {
      return [readItem(this)].concat(this.readList(readItem))
    }
  }

  readTag(): number {
    return this.readBits(4)
  }
}

/**
 * Instantiate a `FlatWriter` with {@link makeWriter}.
 */
export interface Writer {
  writeBool(b: boolean): Writer
  writeBytes(bytes: number[]): Writer
  writeInt(x: bigint | number): Writer
  writeListCons(): Writer
  writeListNil(): Writer
  writeTermTag(tag: number): Writer
  writeTypeBits(typeBits: string): Writer
  writeBuiltinId(id: number): Writer
  finalize(): number[]
}

/**
 * @returns
 */
export function makeWriter(): Writer {
  return new WriterImpl()
}

class WriterImpl implements Writer {
  private readonly bitWriter: Bits.Writer

  constructor() {
    this.bitWriter = Bits.makeWriter()
  }

  /**
   * @param b
   * @returns
   * Self for chaining
   */
  writeBool(b: boolean): Writer {
    if (b) {
      this.bitWriter.writeBits("1")
    } else {
      this.bitWriter.writeBits("0")
    }

    return this
  }

  /**
   * @param bytes
   * @returns
   * Self for chaining
   */
  writeBytes(bytes: number[]): Writer {
    encodeBytes(this.bitWriter, bytes)

    return this
  }

  /**
   * @param x
   * @returns
   * Self for chaining
   * @throws
   * If x is negative
   */
  writeInt(x: bigint): Writer {
    if (x < 0) {
      throw new Error("x in writeInt isn't positive")
    }
    encodeInt(this.bitWriter, x)

    return this
  }

  /**
   * @returns
   * Self for chaining
   */
  writeListCons(): Writer {
    this.bitWriter.writeBits("1")
    return this
  }

  /**
   * @returns
   * Self for chaining
   */
  writeListNil(): Writer {
    this.bitWriter.writeBits("0")
    return this
  }

  /**
   * @param tag
   * @returns
   * Self for chaining
   */
  writeTermTag(tag: number): Writer {
    this.bitWriter.writeBits(Bits.pad(tag.toString(2), 4))
    return this
  }

  /**
   * @param typeBits
   * @returns
   * Self for chaining
   */
  writeTypeBits(typeBits: string): Writer {
    this.bitWriter.writeBits("1" + typeBits + "0")
    return this
  }

  /**
   * @param id
   */
  writeBuiltinId(id: number): Writer {
    this.bitWriter.writeBits(Bits.pad(id.toString(2), 7))

    return this
  }

  /**
   * @returns
   */
  finalize(): number[] {
    return this.bitWriter.finalize()
  }
}

/**
 * @param reader
 * @returns
 */
export function decodeBytes(reader: Bits.Reader): number[] {
  reader.moveToByteBoundary(true)

  const bytes = []

  let nChunk = reader.readByte()

  while (nChunk > 0) {
    for (let i = 0; i < nChunk; i++) {
      bytes.push(reader.readByte())
    }

    nChunk = reader.readByte()
  }

  return bytes
}

/**
 * Write a list of bytes to the bitWriter using flat encoding.
 * Used by UplcString, UplcByteArray and UplcDataValue
 * Equivalent to E_B* function in Plutus-core docs
 * @param writer
 * @param bytes
 * @param pad
 * Optional, defaults to false
 */
export function encodeBytes(
  writer: Bits.Writer,
  bytes: number[],
  pad: boolean = true
): void {
  if (pad) {
    writer.padToByteBoundary(true)
  }

  // the rest of this function is equivalent to E_C* function in Plutus-core docs
  const n = bytes.length
  let pos = 0

  // write chunks of 255
  while (pos < n) {
    // each iteration is equivalent to E_C function in Plutus-core docs

    const nChunk = Math.min(n - pos, 255)

    // equivalent to E_8 function in Plutus-core docs
    writer.writeBits(Bits.pad(nChunk.toString(2), 8))

    for (let i = pos; i < pos + nChunk; i++) {
      const b = bytes[i]

      // equivalent to E_8 function in Plutus-core docs
      writer.writeBits(Bits.pad(b.toString(2), 8))
    }

    pos += nChunk
  }

  if (pad) {
    writer.writeBits("00000000")
  }
}

/**
 * Includes type bits
 * @param n
 * @returns
 */
export function bytesSize(n: number): number {
  return 4 + n * 8 + Math.ceil(n / 256) * 8 + 8
}

/**
 * Returns an unsigned (zigzag encoded) bigint
 * @param reader
 * @returns
 */
export function decodeInt(reader: Bits.Reader): bigint {
  const bytes = []

  let b = reader.readByte()
  bytes.push(b)

  while (!rawByteIsLast(b)) {
    b = reader.readByte()
    bytes.push(b)
  }

  // strip the leading bit
  return decodeIntLE7(bytes.map((b) => parseRawByte(b))) // raw int is unsigned
}

/**
 * Combines a list of Plutus-core bytes into a bigint (leading bit of each byte is ignored).
 * Differs from bytesToBigInt in utils.js because only 7 bits are used from each byte.
 * @param bytes
 * @returns
 */
function decodeIntLE7(bytes: number[]): bigint {
  let value = BigInt(0)

  const n = bytes.length

  for (let i = 0; i < n; i++) {
    const b = bytes[i]

    // 7 (not 8), because leading bit isn't used here
    value = value + BigInt(b) * pow2(BigInt(i) * 7n)
  }

  return value
}

/**
 * 2 to the power 'p' for bigint.
 * @param p
 * @returns
 */
function pow2(p: bigint): bigint {
  return p <= 0n ? 1n : 2n << (p - 1n)
}

/**
 * Parses a single byte in the Plutus-core byte-list representation of an int
 * @param b
 * @returns
 */
function parseRawByte(b: number): number {
  return b & 0b01111111
}

/**
 * Returns true if 'b' is the last byte in the Plutus-core byte-list representation of an int.
 * @param b
 * @returns
 */
function rawByteIsLast(b: number): boolean {
  return (b & 0b10000000) == 0
}

/**
 * @param bitWriter
 * @param x
 * positive number
 */
export function encodeInt(bitWriter: Bits.Writer, x: bigint) {
  const bitString = Bits.pad(x.toString(2), 7)

  // split every 7th
  const parts = []
  for (let i = 0; i < bitString.length; i += 7) {
    parts.push(bitString.slice(i, i + 7))
  }

  // reverse the parts
  parts.reverse()

  for (let i = 0; i < parts.length; i++) {
    if (i == parts.length - 1) {
      // last
      bitWriter.writeBits("0" + parts[i])
    } else {
      bitWriter.writeBits("1" + parts[i])
    }
  }
}
