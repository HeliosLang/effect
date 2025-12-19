import { Brand, Schema } from "effect"

export type Bool = boolean & Brand.Brand<"Bool">

export const makeBool = Brand.nominal<Bool>()

export type ByteArray = number[] & Brand.Brand<"ByteArray">

export const makeByteArray = Brand.nominal<ByteArray>()

export const Int = Schema.BigInt.pipe(Schema.brand("Int"))

export type Int = bigint & Brand.Brand<"Int">

export const makeInt = Brand.nominal<Int>()

export type List = {
  readonly _tag: "List"
  readonly itemType: string // needed for empty lists
  readonly items: Primitive[]
}

export function makeList(itemType: string, items: Primitive[]): List {
  return {
    _tag: "List",
    itemType,
    items
  }
}

export type Pair = {
  readonly _tag: "Pair"
  readonly first: Primitive
  readonly second: Primitive
}

export function makePair(first: Primitive, second: Primitive): Pair {
  return {
    _tag: "Pair",
    first,
    second
  }
}

export type String = string & Brand.Brand<"String">

export const makeString = Brand.nominal<String>()

export type Unit = Brand.Brand<"Unit">

const makeUnitInternal = Brand.nominal<Unit>()

export const makeUnit = () => makeUnitInternal({})

// TODO: add Bls12_381 primitives
export type Primitive = Bool | ByteArray | Int | List | Pair | String | Unit
