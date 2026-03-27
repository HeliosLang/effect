import { describe, expect, it } from "bun:test"
import { Effect } from "effect"
import * as Cose from "./Cose/index.js"
import * as Address from "./Ledger/Address.js"
import * as Wallet from "./Wallet.js"
import { IsMainnet } from "./Network/IsMainnet.js"
import { UTxOsAt } from "./Network/UTxOsAt.js"

const phrase =
  "earth success card attitude allow churn uncover assault agent afraid hurry business taxi income velvet egg farm feature edge brain present leg person elite"

const makePhraseWallet = (
  seedPhrase: string = phrase,
  account: number = 0,
  subAccount: number = 0
) =>
  Effect.runSync(
    Wallet.Phrase(seedPhrase, account, subAccount).pipe(
      Effect.provideService(IsMainnet, false),
      Effect.provideService(UTxOsAt, () => Effect.succeed([]))
    )
  )

describe("Cardano.Wallet.Phrase()", () => {
  it("can restore wallet from phrase", () => {
    const wallet = makePhraseWallet()

    expect(wallet.addressSync as string).toBe(
      "addr_test1vzwe3n48xch4hdely02st3jv9h80ln47neay3xwhjjszj7stcx5w7"
    )
  })

  it("can sign data for its address", () => {
    const wallet = makePhraseWallet()
    const { signature, key } = Effect.runSync(
      wallet.signData(wallet.addressSync, "48656c6c6f20576f726c64")
    )

    expect(signature.address).toBe(wallet.addressSync)
    expect(Buffer.from(signature.payload).toString("hex")).toBe(
      "48656c6c6f20576f726c64"
    )
    expect(() => Cose.Sign1.verify(signature, key)).not.toThrow()
  })

  it("rejects signing for a different spending credential", () => {
    const wallet = makePhraseWallet()
    const otherWallet = makePhraseWallet(phrase, 0, 1)

    expect(() =>
      Effect.runSync(wallet.signData(otherWallet.addressSync, "48656c6c6f"))
    ).toThrow(
      "given address.spendingCredential doesn't correspond to Phrase wallet's spending credential"
    )
  })

  it("rejects signing for addresses with staking credentials", () => {
    const wallet = makePhraseWallet()
    const otherWallet = makePhraseWallet(phrase, 0, 1)
    const baseAddress = Address.make(
      false,
      Address.spendingCredential(wallet.addressSync),
      Address.spendingCredential(otherWallet.addressSync)
    )

    expect(() =>
      Effect.runSync(wallet.signData(baseAddress, "48656c6c6f"))
    ).toThrow(
      "given address contains a staking credential but Phrase wallet only supports enterprise addresses"
    )
  })
})
