import { Either, Schema } from "effect"
import * as Bytes from "../internal/Bytes.js"
import * as Cbor from "../Cbor.js"
import * as TxOutput from "./TxOutput.js"
import * as UTxORef from "./UTxORef.js"

export const UTxO = Schema.Struct({
  ref: UTxORef.UTxORef,
  output: TxOutput.TxOutput
})

export type UTxO = Schema.Schema.Type<typeof UTxO>

export function make(ref: UTxORef.UTxORef, output: TxOutput.TxOutput): UTxO {
  return {
    ref,
    output
  }
}

export const decode = (
  bytes: Bytes.BytesLike
): Cbor.DecodeResult<UTxO | UTxORef.UTxORef> =>
  Either.gen(function* () {
    const stream = Bytes.makeStream(bytes)

    if ((yield* Cbor.decodeTupleLazy(stream.copy()))((bytes) => Either.right(Cbor.isBytes(bytes)))) {
      return yield* UTxORef.decode(stream)
    } else if (
      (yield* Cbor.decodeTupleLazy(stream.copy()))((bytes) => Either.right(Cbor.isTuple(bytes)))
    ) {
      return yield* decodeFull(stream)
    } else {
      return yield* Either.left(
        new Cbor.DecodeError(stream, "unhandled UTxO encoding")
      )
    }
  })

export const decodeFull = (bytes: Bytes.BytesLike): Cbor.DecodeResult<UTxO> =>
  Cbor.decodeTuple([UTxORef.decode, TxOutput.decode])(bytes).pipe(
    Either.map(([id, output]) => make(id, output))
  )

export function encode(txInput: UTxO, full: boolean = false) {
  if (full) {
    return Cbor.encodeTuple([
      UTxORef.encode(txInput.ref),
      TxOutput.encode(txInput.output)
    ])
  } else {
    return UTxORef.encode(txInput.ref)
  }
}
