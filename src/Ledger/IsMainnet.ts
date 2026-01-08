import { Context } from "effect"

export class IsMainnet extends Context.Tag("IS_MAINNET")<
  IsMainnet,
  boolean
>() {}
