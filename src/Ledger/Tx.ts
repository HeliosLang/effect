import { Schema } from "effect"
import * as Cbor from "../Cbor.js"
import { Data } from "../Uplc"
import * as NativeScript from "./NativeScript.js"
import * as Redeemer from "./Redeemer.js"
import * as Signature from "./Signature.js"
import * as UTxO from "./UTxO.js"

export const Body = Schema.Struct({
  inputs: Schema.Array(UTxO.UTxO)
})

export type Body = Schema.Schema.Type<typeof Body>

export const Witnesses = Schema.Struct({
  signatures: Schema.Array(Signature.Signature),
  datums: Schema.Array(Data.Data),
  redeemers: Schema.Array(Redeemer.Redeemer),
  nativeScripts: Schema.Array(Schema.Any), // TODO
  v1Scripts: Schema.Array(Schema.Any), // TODO
  v2Scripts: Schema.Array(Schema.Any), // TODO
  v3Scripts: Schema.Array(Schema.Any), // TODO
  v2RefScripts: Schema.Array(Schema.Any), // TODO
  v3RefScripts: Schema.Array(Schema.Any), // TODO
  encoding: Schema.optional(
    Schema.Struct({
      signaturesAsSet: Schema.optional(Schema.Boolean), // defaults to true
      datumsAsSet: Schema.optional(Schema.Boolean), // defaults to true
      nativeScriptsAsSet: Schema.optional(Schema.Boolean), // defaults to true
      v1ScriptsAsSet: Schema.optional(Schema.Boolean), // defaults to true
      v2ScriptsAsSet: Schema.optional(Schema.Boolean), // defaults to true
      v3ScriptsAsSet: Schema.optional(Schema.Boolean) // defaults to true
    })
  )
})

export type Witnesses = Schema.Schema.Type<typeof Witnesses>

export type MetadataAttr =
  | string
  | number
  | readonly MetadataAttr[]
  | Readonly<{ [key: string]: MetadataAttr }>

export const MetadataAttr: Schema.Schema<MetadataAttr> = Schema.Union(
  Schema.String,
  Schema.Number,
  Schema.Array(Schema.suspend((): Schema.Schema<MetadataAttr> => MetadataAttr)),
  Schema.Record({
    // the standard permits maps with arbitrary keys, but limiting this to string keys is probably good enough for now
    key: Schema.String,
    value: Schema.suspend((): Schema.Schema<MetadataAttr> => MetadataAttr)
  })
)

export const Metadata = Schema.Record({
  key: Schema.Number,
  value: MetadataAttr
})

export const Tx = Schema.Struct({
  body: Body,
  witnesses: Witnesses,
  metadata: Schema.optional(Metadata),
  isValid: Schema.Boolean
})

export function encodeWitnesses(witnesses: Witnesses): number[] {
  const m = new Map<number, number[]>()

  if (witnesses.signatures.length > 0) {
    const encodeAsSet = witnesses.encoding?.signaturesAsSet ?? true
    const encodedItems = witnesses.signatures.map(Signature.encode)

    m.set(
      0,
      encodeAsSet
        ? Cbor.encodeSet(encodedItems)
        : Cbor.encodeDefList(encodedItems)
    )
  }

  if (witnesses.nativeScripts.length > 0) {
    const encodeAsSet = witnesses.encoding?.nativeScriptsAsSet ?? true
    const encodedItems = witnesses.nativeScripts.map(NativeScript.encode)

    m.set(
      1,
      encodeAsSet
        ? Cbor.encodeSet(encodedItems)
        : Cbor.encodeDefList(encodedItems)
    )
  }

  if (witnesses.v1Scripts.length > 0) {
    throw new Error("not yet implemented")
  }

  if (witnesses.datums.length > 0) {
    const encodeAsSet = witnesses.encoding?.datumsAsSet ?? true
    const encodedItems = witnesses.datums.map(Data.encode)

    m.set(
      4,
      encodeAsSet
        ? Cbor.encodeSet(encodedItems)
        : Cbor.encodeDefList(encodedItems)
    )
  }

  if (witnesses.redeemers.length > 0) {
    m.set(5, Cbor.encodeDefList(witnesses.redeemers.map(Redeemer.encode)))
  }

  if (witnesses.v2Scripts.length > 0) {
    throw new Error("not yet implemented")
  }

  if (witnesses.v3Scripts.length > 0) {
    throw new Error("not yet implemented")
  }

  return Cbor.encodeObjectIKey(m)
}
