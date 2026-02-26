import { describe, expect, it } from "bun:test"
import { Effect } from "effect"
import * as Wallet from "./Wallet.js"
import { IsMainnet } from "./Network/IsMainnet.js"
import { UTxOsAt } from "./Network/UTxOsAt.js"

describe("Cardano.Wallet.Phrase()", () => {
  it("can restore wallet from phrase", () => {
    const wallet = Effect.runSync(
      Wallet.Phrase(
        "earth success card attitude allow churn uncover assault agent afraid hurry business taxi income velvet egg farm feature edge brain present leg person elite"
      ).pipe(
        Effect.provideService(IsMainnet, false),
        // Don't need to actually provide UTxOsAt because we
        Effect.provideService(UTxOsAt, () => Effect.succeed([]))
      )
    )

    expect(wallet.addressSync as string).toBe(
      "addr_test1vzwe3n48xch4hdely02st3jv9h80ln47neay3xwhjjszj7stcx5w7"
    )
  })
})
