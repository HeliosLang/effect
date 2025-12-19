import { Schema } from "effect"
import * as Bech32 from "./Bech32.js"

export function isValid(addr: string): boolean {
  if (addr.startsWith("addr1") || addr.startsWith("addr_test1")) {
    return Bech32.isValid(addr)
  }
  // TODO: validate Byron format

  return false
}

export const Address = Schema.String.pipe(
  Schema.filter((addr: string) => {
    return isValid(addr) || "Invalid Cardano Address"
  }),
  Schema.brand("Address")
)

export type Address = Schema.Schema.Type<typeof Address>
