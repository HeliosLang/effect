import { describe, expect, it } from "bun:test"
import { Effect, Either } from "effect"
import * as Bytes from "../Codecs/Bytes.js"
import * as Cbor from "../Codecs/Cbor.js"
import * as Cose from "./Cose/index.js"
import * as Address from "./Ledger/Address.js"
import * as Signature from "./Ledger/Signature.js"
import * as Tx from "./Ledger/Tx.js"
import * as UTxORef from "./Ledger/UTxORef.js"
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

    expect(signature._tag).toBe("Right")
    if (!Either.isRight(signature)) {
      throw new Error("Unexpected")
    }
    expect(signature.right.address).toBe(wallet.addressSync)
    expect(Buffer.from(signature.right.payload).toString("hex")).toBe(
      "48656c6c6f20576f726c64"
    )
    expect(() => Cose.Sign1.verify(signature.right, key)).not.toThrow()
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

describe("Cardano.Wallet.Browser()", () => {
  it("decodes the change address returned by a CIP-30 wallet", async () => {
    const address = makePhraseWallet().addressSync
    const wallet = Wallet.Browser(
      makeCip30FullHandle({
        getChangeAddress: () => Promise.resolve(Bytes.toHex(Address.bytes(address)))
      })
    )

    const actual = await Effect.runPromise(wallet.changeAddress)
    expect(actual).toBe(address)
  })

  it("normalizes null UTxOs to an empty list", async () => {
    const wallet = Wallet.Browser(
      makeCip30FullHandle({
        getUtxos: () => Promise.resolve(null)
      })
    )

    const utxos = await Effect.runPromise(wallet.utxos)
    expect(utxos).toEqual([])
  })

  it("decodes full CIP-30 UTxOs", async () => {
    const wallet = Wallet.Browser(
      makeCip30FullHandle({
        getUtxos: () => Promise.resolve([cip30UtxoFixture])
      })
    )

    const utxos = await Effect.runPromise(wallet.utxos)
    expect(utxos).toHaveLength(1)
    expect(String(utxos[0]?.ref)).toBe(
      "4cb4e9f79554fb3b572b19f68c8cce0dba929fcee2f6ab6cc390419a8d703bd824"
    )
  })

  it("rejects unresolved UTxO refs", async () => {
    const unresolvedRef = Bytes.toHex(
      UTxORef.encode(
        "01010101010101010101010101010101010101010101010101010101010101010" as UTxORef.UTxORef
      )
    )
    const wallet = Wallet.Browser(
      makeCip30FullHandle({
        getUtxos: () => Promise.resolve([unresolvedRef])
      })
    )

    await expectThrows(Effect.runPromise(wallet.utxos), "expected full CIP-30 UTxO")
  })

  it("decodes vkey signatures returned by signTx", async () => {
    const witnessSet = Bytes.toHex(
      Cbor.encodeObjectIKey(
        new Map([[0, Cbor.encodeSet([Signature.encode(Signature.dummy)])]])
      )
    )
    const wallet = Wallet.Browser(
      makeCip30FullHandle({
        signTx: () => Promise.resolve(witnessSet)
      })
    )

    const signatures = await Effect.runPromise(wallet.signTx(Tx.empty))
    expect(signatures).toEqual([Signature.dummy])
  })
})

const cip30UtxoFixture =
  "828258204cb4e9f79554fb3b572b19f68c8cce0dba929fcee2f6ab6cc390419a8d703bd8181882581d604988cad9aa1ebd733b165695cfef965fda2ee42dab2d8584c43b039c1a49da0141"

function makeCip30FullHandle(
  overrides: Partial<Wallet.Cip30FullHandle> = {}
): Wallet.Cip30FullHandle {
  return {
    getNetworkId: () => Promise.resolve(0),
    getUsedAddresses: () => Promise.resolve([]),
    getUnusedAddresses: () => Promise.resolve([]),
    getChangeAddress: () =>
      Promise.resolve(Bytes.toHex(Address.bytes(makePhraseWallet().addressSync))),
    getUtxos: () => Promise.resolve([]),
    getCollateral: () => Promise.resolve([]),
    getRewardAddresses: () => Promise.resolve([]),
    signData: () => Promise.resolve({ signature: "", key: "" }),
    signTx: () => Promise.resolve(Bytes.toHex(Cbor.encodeObjectIKey(new Map()))),
    submitTx: () => Promise.resolve(""),
    experimental: {},
    ...overrides
  }
}

async function expectThrows(promise: Promise<unknown>, message: string) {
  try {
    await promise
    throw new Error("Expected promise to reject")
  } catch (error) {
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toContain(message)
  }
}
