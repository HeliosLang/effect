import { Context } from "effect"

export class IsMainnet extends Context.Tag("NetworkIsMainnet")<
  IsMainnet,
  boolean
>() {}
