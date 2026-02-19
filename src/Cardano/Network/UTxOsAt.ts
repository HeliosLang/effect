import { Context, Effect } from "effect"
import type { Address } from "../Ledger/Address.js"
import type { UTxO } from "../Ledger/UTxO.js"
import { ConnectionError, UnexpectedFormat } from "./errors"

export class UTxOsAt extends Context.Tag("Network.UTxOsAt")<
  UTxOsAt,
  (
    address: Address
  ) => Effect.Effect<UTxO[], ConnectionError | UnexpectedFormat>
>() {}
