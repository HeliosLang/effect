import { Either, Schema } from "effect"
import * as Bytes from "../../Codecs/Bytes.js"
import * as Cbor from "../../Codecs/Cbor.js"
import { Cost, Data } from "../Uplc/index.js"

export const Minting = Schema.TaggedStruct("Minting", {
  policyIndex: Schema.Number,
  data: Data.Data,
  cost: Cost.Cost
})

export type Minting = Schema.Schema.Type<typeof Minting>

export const Spending = Schema.TaggedStruct("Spending", {
  inputIndex: Schema.Number,
  data: Data.Data,
  cost: Cost.Cost
})

export type Spending = Schema.Schema.Type<typeof Spending>

export const Rewarding = Schema.TaggedStruct("Rewarding", {
  withdrawalIndex: Schema.Number,
  data: Data.Data,
  cost: Cost.Cost
})

export type Rewarding = Schema.Schema.Type<typeof Rewarding>

export const Certifying = Schema.TaggedStruct("Certifying", {
  dcertIndex: Schema.Number,
  data: Data.Data,
  cost: Cost.Cost
})

export type Certifying = Schema.Schema.Type<typeof Certifying>

export const Redeemer = Schema.Union(Minting, Spending, Rewarding, Certifying)

export type Redeemer = Schema.Schema.Type<typeof Redeemer>

/**
 * @param a
 * @param b
 * @returns
 */
export function compare(a: Redeemer, b: Redeemer): number {
  switch (a._tag) {
    case "Spending":
      switch (b._tag) {
        case "Spending":
          return a.inputIndex - b.inputIndex
        case "Minting":
          return 0 - 1
        case "Certifying":
          return 0 - 2
        case "Rewarding":
          return 0 - 3
      }

      // needed to avoid linting errors
      break
    case "Minting":
      switch (b._tag) {
        case "Spending":
          return 1 - 0
        case "Minting":
          return a.policyIndex - b.policyIndex
        case "Certifying":
          return 1 - 2
        case "Rewarding":
          return 1 - 3
      }

      // needed to avoid linting errors
      break
    case "Certifying":
      switch (b._tag) {
        case "Spending":
          return 2 - 0
        case "Minting":
          return 2 - 1
        case "Certifying":
          return a.dcertIndex - b.dcertIndex
        case "Rewarding":
          return 2 - 3
      }

      // needed to avoid linting errors
      break
    case "Rewarding":
      switch (b._tag) {
        case "Spending":
          return 3 - 0
        case "Minting":
          return 3 - 1
        case "Certifying":
          return 3 - 2
        case "Rewarding":
          return a.withdrawalIndex - b.withdrawalIndex
      }

      // needed to avoid linting errors
      break
  }
}

export const decode = (bytes: Bytes.BytesLike): Cbor.DecodeResult<Redeemer> =>
  Either.gen(function* () {
    const [tag, decodeItem] = yield* Cbor.decodeTagged(bytes)

    switch (tag) {
      case 0: {
        return {
          _tag: "Spending",
          inputIndex: Number(yield* decodeItem(Cbor.decodeInt)),
          data: yield* decodeItem(Data.decode),
          cost: yield* decodeItem(Cost.decode)
        }
      }
      case 1:
        return {
          _tag: "Minting",
          policyIndex: Number(yield* decodeItem(Cbor.decodeInt)),
          data: yield* decodeItem(Data.decode),
          cost: yield* decodeItem(Cost.decode)
        }
      case 2:
        return {
          _tag: "Certifying",
          dcertIndex: Number(yield* decodeItem(Cbor.decodeInt)),
          data: yield* decodeItem(Data.decode),
          cost: yield* decodeItem(Cost.decode)
        }
      case 3:
        return {
          _tag: "Rewarding",
          withdrawalIndex: Number(yield* decodeItem(Cbor.decodeInt)),
          data: yield* decodeItem(Data.decode),
          cost: yield* decodeItem(Cost.decode)
        }
      default:
        return yield* Either.left(
          new Cbor.DecodeError(
            Bytes.makeStream(bytes),
            `unhandled Redeemer tag ${tag}`
          )
        )
    }
  })

export function encode(redeemer: Redeemer): number[] {
  switch (redeemer._tag) {
    case "Spending":
      return Cbor.encodeTuple([
        Cbor.encodeInt(0),
        Cbor.encodeInt(redeemer.inputIndex),
        Data.encode(redeemer.data),
        Cost.encode(redeemer.cost)
      ])
    case "Minting":
      return Cbor.encodeTuple([
        Cbor.encodeInt(1),
        Cbor.encodeInt(redeemer.policyIndex),
        Data.encode(redeemer.data),
        Cost.encode(redeemer.cost)
      ])
    case "Certifying":
      return Cbor.encodeTuple([
        Cbor.encodeInt(2),
        Cbor.encodeInt(redeemer.dcertIndex),
        Data.encode(redeemer.data),
        Cost.encode(redeemer.cost)
      ])
    case "Rewarding":
      return Cbor.encodeTuple([
        Cbor.encodeInt(3),
        Cbor.encodeInt(redeemer.withdrawalIndex),
        Data.encode(redeemer.data),
        Cost.encode(redeemer.cost)
      ])
  }
}
