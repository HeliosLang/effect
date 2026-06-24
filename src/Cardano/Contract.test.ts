import { describe, expect, it } from "bun:test"
import { Effect, Schema } from "effect"
import * as Contract from "./Contract.js"
import * as Ledger from "./Ledger/index.js"
import * as Network from "./Network/index.js"
import * as Uplc from "./Uplc/index.js"

describe("Contract.WitnessFromUplcData", () => {
  it("encodes signer witnesses unchanged", () => {
    const pkh = "22".repeat(28) as Ledger.PubKeyHash.PubKeyHash
    const witness: Contract.Witness = { _tag: "Signer", pkh }

    const encoded = Effect.runSync(
      Schema.encode(Contract.WitnessFromUplcData)(witness).pipe(
        Effect.provideService(Network.IsMainnet, false)
      )
    )

    expect(encoded).toEqual(
      Uplc.Data.makeConstrData(0, [Uplc.Data.makeByteArrayData(pkh)])
    )
  })

  it("encodes withdrawer witnesses as the raw validator hash", () => {
    const hash = "55".repeat(28) as Ledger.ValidatorHash.ValidatorHash
    const witness: Contract.Witness = {
      _tag: "Withdrawer",
      vh: hash
    }

    const encoded = Effect.runSync(
      Schema.encode(Contract.WitnessFromUplcData)(witness).pipe(
        Effect.provideService(Network.IsMainnet, false)
      )
    )

    expect(encoded).toEqual(
      Uplc.Data.makeConstrData(1, [Uplc.Data.makeByteArrayData(hash)])
    )
  })

  it("decodes raw validator-hash withdrawer witnesses to reward addresses", () => {
    const hash = "55".repeat(28) as Ledger.ValidatorHash.ValidatorHash
    const data = Uplc.Data.makeConstrData(1, [
      Uplc.Data.makeByteArrayData(hash)
    ])

    const decoded = Effect.runSync(
      Schema.decodeUnknown(Contract.WitnessFromUplcData)(data).pipe(
        Effect.provideService(Network.IsMainnet, false)
      )
    )

    expect(decoded).toEqual({
      _tag: "Withdrawer",
      vh: hash
    })
  })
})
