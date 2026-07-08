import { Context, Effect } from "effect"
import { ConnectionError } from "./errors.js"


export class FetchLiveBlockHeight extends Context.Tag("Cardano.Network.FetchLiveBlockHeight")<
  FetchLiveBlockHeight,
  () => Effect.Effect<number, ConnectionError, never>
>() {}