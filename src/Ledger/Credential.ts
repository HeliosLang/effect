import { Schema } from "effect"
import { PubKeyHash } from "./PubKeyHash.js"
import { ValidatorHash } from "./ValidatorHash.js"
import { Data } from "../Uplc/index.js"

export const Credential = Schema.Union(
  Schema.TaggedStruct("PubKey", { hash: PubKeyHash }),
  Schema.TaggedStruct("Validator", { hash: ValidatorHash })
)

export type Credential = Schema.Schema.Type<typeof Credential>

export function makePubKey(pkh: PubKeyHash): Credential {
  return { _tag: "PubKey", hash: pkh }
}

export function makeValidator(vh: ValidatorHash): Credential {
  return { _tag: "Validator", hash: vh }
}

export const FromUplcData = Schema.transform(
  Data.Enum({ PubKey: { hash: Data.Hex }, Validator: { hash: Data.Hex } }),
  Credential,
  {
    strict: true,
    decode: (cred) => cred,
    encode: (cred) => cred
  }
)
