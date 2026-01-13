import { Data } from "effect"

export class ConnectionError extends Data.TaggedError("CardanoNetworkConnectionError")<{
    message: string
}> {
    constructor(message: string) {
        super({
            message: `Failed to connect to Cardano network (${message})`
        })
    }
}

export class UnexpectedFormat extends Data.TaggedError("CardanoNetworkUnexpectedFormat")<{
    message: string
}> {
    constructor(message: string) {
        super({
            message: `Unexpected format returned from Cardano network (${message})`
        })
    }
}