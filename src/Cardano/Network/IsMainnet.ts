import { Context } from "effect"

export class IsMainnet extends Context.Tag("Cardanp.Network.IsMainnet")<
  IsMainnet,
  boolean
>() {}
