import { Context, Effect, Schema } from "effect"
import type { AssetClass } from "../Ledger/AssetClass.js"

export const AssetMetadata = Schema.Struct({
  name: Schema.String,
  decimals: Schema.Int,
  ticker: Schema.String,
  description: Schema.String,
  logo: Schema.optional(Schema.String)
})

export type AssetMetadata = Schema.Schema.Type<typeof AssetMetadata>

export class Fetch extends Context.Tag("Cardano.Network.AssetMetadata.Fetch")<
  Fetch,
  (ac: AssetClass) => Effect.Effect<AssetMetadata, Error>
>() {}
