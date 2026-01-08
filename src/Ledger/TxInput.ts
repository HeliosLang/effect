import { Effect, Schema } from "effect"
import * as Bytes from "../internal/Bytes.js"
import * as Cbor from "../Cbor.js"
import * as TxOutput from "./TxOutput.js"
import * as TxOutputId from "./TxOutputId.js"

export const TxInput = Schema.TaggedStruct("TxInput", {
  id: TxOutputId.TxOutputId,
  output: Schema.optional(TxOutput.TxOutput)
})

export type TxInput = Schema.Schema.Type<typeof TxInput>

export function make(
  id: TxOutputId.TxOutputId,
  output: TxOutput.TxOutput | undefined = undefined
): TxInput {
  return {
    _tag: "TxInput",
    id,
    output
  }
}

export const decode = (bytes: Bytes.BytesLike): Cbor.DecodeEffect<TxInput> =>
  Effect.gen(function* () {
    const stream = Bytes.makeStream(bytes)

    if (yield* (yield* Cbor.decodeTupleLazy(stream.copy()))(Cbor.isBytes)) {
      const id = yield* TxOutputId.decode(stream)

      return make(id)
    } else if (
      yield* (yield* Cbor.decodeTupleLazy(stream.copy()))(Cbor.isTuple)
    ) {
      const [id, output] = yield* Cbor.decodeTuple([
        TxOutputId.decode,
        TxOutput.decode
      ])(stream)

      return make(id, output)
    } else {
      return yield* Effect.fail(
        new Cbor.DecodeError(stream, "unhandled TxInput encoding")
      )
    }
  })

export function encode(txInput: TxInput, full: boolean = false) {
  if (full) {
    return Cbor.encodeTuple([
      TxOutputId.encode(txInput.id),
      TxOutput.encode(output(txInput))
    ])
  } else {
    return TxOutputId.encode(txInput.id)
  }
}

export function output(txInput: TxInput): TxOutput.TxOutput {
  if (!txInput.output) {
    throw new Error("txInput.output not available")
  }

  return txInput.output
}
