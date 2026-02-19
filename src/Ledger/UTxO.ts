import { Effect, Either, Schema } from "effect"
import * as Bytes from "../internal/Bytes.js"
import * as Cbor from "../Cbor.js"
import * as Network from "../Network"
import * as Data from "../Uplc/Data.js"
import * as Assets from "./Assets.js"
import * as TxOutput from "./TxOutput.js"
import * as UTxORef from "./UTxORef.js"

export const UTxO = Schema.Struct({
  ref: UTxORef.UTxORef,
  output: TxOutput.TxOutput
})

export type UTxO = Schema.Schema.Type<typeof UTxO>

export const FromUplcData = Schema.transform(
  Data.EnumVariant(0, {
    ref: UTxORef.FromUplcData,
    output: TxOutput.FromUplcData
  }),
  Schema.typeSchema(UTxO),
  {
    strict: true,
    decode: ({ ref, output }): UTxO => ({ ref, output }),
    encode: ({ ref, output }: UTxO) => ({ ref, output })
  }
)

export const FromUplcDataV3 = Schema.transform(
  Data.EnumVariant(0, {
    ref: UTxORef.FromUplcDataV3,
    output: TxOutput.FromUplcData
  }),
  Schema.typeSchema(UTxO),
  {
    strict: true,
    decode: ({ ref, output }): UTxO => ({ ref, output }),
    encode: ({ ref, output }: UTxO) => ({ ref, output })
  }
)

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

    if (
      yield* (yield* Cbor.decodeTupleLazy(stream.copy()))((bytes) =>
        Either.right(Cbor.isBytes(bytes))
      )
    ) {
      return yield* UTxORef.decode(stream)
    } else if (
      yield* (yield* Cbor.decodeTupleLazy(stream.copy()))((bytes) =>
        Either.right(Cbor.isTuple(bytes))
      )
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

export const encode = (options: { full?: boolean }) => (utxo: UTxO) => {
  if (options.full === true) {
    return Cbor.encodeTuple([
      UTxORef.encode(utxo.ref),
      TxOutput.encode(utxo.output)
    ])
  } else {
    return UTxORef.encode(utxo.ref)
  }
}

export const resolve =
  (options: { trusted?: boolean }) => (utxo: UTxO | UTxORef.UTxORef) =>
    Effect.gen(function* () {
      if (typeof utxo == "string") {
        const getUTxO = yield* Network.UTxO
        return yield* getUTxO(utxo)
      } else if ("ref" in utxo) {
        if (options.trusted === true) {
          return utxo
        } else {
          const getUTxO = yield* Network.UTxO
          return yield* getUTxO(utxo.ref)
        }
      } else {
        throw new Error(
          `unexpected input to UTxO.resolve(): ${utxo as unknown as any}`
        )
      }
    })

export const resolveAll =
  (options: { trusted?: boolean }) => (utxos: (UTxO | UTxORef.UTxORef)[]) =>
    Effect.all(utxos.map(resolve(options)))

/**
 * For sorting lists of UTxOs
 * @param a
 * @param b
 */
export function compare(a: UTxO, b: UTxO): number {
  return UTxORef.compare(a.ref, b.ref)
}

export const sumAssets = (...utxos: readonly UTxO[]): Assets.Assets =>
  Assets.sum(...utxos.map((utxo) => utxo.output.assets))

export const difference = (set: readonly UTxO[], exclude: readonly UTxO[]) =>
  set.filter((utxo) => !exclude.some((e) => e.ref == utxo.ref))

/**
 * Resorts the list after appending
 * @param list
 * Not mutated
 * @param utxo
 * @returns
 */
export const append = (list: readonly UTxO[], ...utxos: UTxO[]) => {
  const result = list.slice().concat(utxos)

  result.sort(compare)

  return result
}
