import { Effect, Schema } from "effect"
import * as Bytes from "../internal/Bytes.js"
import * as Cbor from "../Cbor.js"
import * as TxOutput from "./TxOutput.js"
import * as UTxORef from "./UTxORef.js"

export const UTxO = Schema.TaggedStruct("UTxO", {
  ref: UTxORef.UTxORef,
  output: TxOutput.TxOutput
})

export type UTxO = Schema.Schema.Type<typeof UTxO>

export function make(
  ref: UTxORef.UTxORef,
  output: TxOutput.TxOutput
): UTxO {
  return {
    _tag: "UTxO",
    ref,
    output
  }
}

export const decode = (bytes: Bytes.BytesLike): Cbor.DecodeEffect<UTxO | UTxORef.UTxORef> =>
  Effect.gen(function* () {
    const stream = Bytes.makeStream(bytes)

    if (yield* (yield* Cbor.decodeTupleLazy(stream.copy()))(Cbor.isBytes)) {
      return yield* UTxORef.decode(stream)
    } else if (
      yield* (yield* Cbor.decodeTupleLazy(stream.copy()))(Cbor.isTuple)
    ) {
      return yield* decodeFull(stream)
    } else {
      return yield* Effect.fail(
        new Cbor.DecodeError(stream, "unhandled UTxO encoding")
      )
    }
  })

export const decodeFull = (bytes: Bytes.BytesLike): Cbor.DecodeEffect<UTxO> => Cbor.decodeTuple([
      UTxORef.decode,
      TxOutput.decode
    ])(bytes).pipe(Effect.map(([id, output]) => make(id, output)))

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