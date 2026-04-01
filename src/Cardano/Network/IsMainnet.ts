import { Context } from "effect"

export class IsMainnet extends Context.Tag("Cardano.Network.IsMainnet")<
  IsMainnet,
  boolean
>() {}
