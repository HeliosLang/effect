import { Context, Effect } from "effect"
import { Address } from "../Ledger/Address.js"
import { UTxO } from "../Ledger/UTxO.js"
import { ConnectionError, UnexpectedFormat } from "./errors"

export class UTxOsAt extends Context.Tag("NetworkUTxOsAt")<
    UTxOsAt, 
    (address: Address) => Effect.Effect<UTxO[], ConnectionError | UnexpectedFormat>
>() {}