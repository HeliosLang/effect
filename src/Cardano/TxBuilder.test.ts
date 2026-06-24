import { describe, expect, it } from "bun:test"
import { Effect } from "effect"
import * as Ledger from "./Ledger/index.js"
import * as Network from "./Network/index.js"
import * as TxBuilder from "./TxBuilder.js"
import * as Uplc from "./Uplc/index.js"
import * as Wallet from "./Wallet.js"
import { testParams } from "./Network/Params.js"

describe("can balance Tx", () => {
  it("sorts minted assets after minting", () => {
    const scripts: Ledger.NativeScript.NativeScript[] = [
      { type: "before", slot: 1 },
      { type: "before", slot: 2 }
    ]
    const policies = scripts
      .map(Ledger.NativeScript.hash)
      .sort(Ledger.MintingPolicy.compare)
    const reversePolicies = policies.slice().reverse()

    const builder = Effect.runSync(
      TxBuilder.start.pipe(
        TxBuilder.attachScriptEffect(scripts[0]),
        TxBuilder.attachScriptEffect(scripts[1]),
        TxBuilder.mintEffect()({
          [Ledger.AssetClass.make(reversePolicies[0], [1])]: 1n,
          [Ledger.AssetClass.make(reversePolicies[1], [1])]: 1n
        })
      )
    )

    expect(Ledger.Assets.isSorted(builder.minted)).toBeTrue()
    expect(Ledger.Assets.nonAdaPolicies(builder.minted)).toEqual(policies)
  })

  it("sorts output assets when building", () => {
    const changeAddress =
      "addr_test1vpvndky904g9whpnuae0ffsd37ysjjyu7m6avse3nqsfysqx3eg5h" as Ledger.Address.Address
    const recipientAddress =
      "addr_test1vzzcg26lxj3twnnx889lrn60pqn0z3km2yahhsz0fvpyxdcj5qp8w" as Ledger.Address.Address
    const policy = "01".repeat(28) as Ledger.MintingPolicy.MintingPolicy
    const longerLexicographicallyEarlier = Ledger.AssetClass.make(
      policy,
      [0x01, 0x01]
    )
    const shorterLexicographicallyLater = Ledger.AssetClass.make(policy, [0x02])
    const unsortedOutputAssets: Ledger.Assets.Assets = {
      [longerLexicographicallyEarlier]: 1n,
      [shorterLexicographicallyLater]: 1n
    }
    const spareUTxO: Ledger.UTxO.UTxO = {
      ref: "5c20a9ab7153e53d17a0b820b2d606b27257a1281d9365acc6d0d3cb8725ccc32" as Ledger.UTxORef.UTxORef,
      output: {
        address: changeAddress,
        assets: {
          "": 10_000_000n,
          [longerLexicographicallyEarlier]: 1n,
          [shorterLexicographicallyLater]: 1n
        }
      }
    }

    expect(Ledger.Assets.isSorted(unsortedOutputAssets)).toBeFalse()

    const program = Effect.gen(function* () {
      const tx: Ledger.Tx.Tx = yield* TxBuilder.start.pipe(
        TxBuilder.payEffect({
          address: recipientAddress,
          assets: unsortedOutputAssets
        }),
        Effect.flatMap(TxBuilder.build())
      )

      yield* Ledger.Tx.validate({ strict: true })(tx)

      expect(
        tx.body.outputs.every((output) => Ledger.Assets.isSorted(output.assets))
      ).toBeTrue()
    })

    Effect.runSync(
      program.pipe(
        Effect.provideService(Wallet.Balancing, {
          changeAddress: Effect.succeed(changeAddress),
          utxos: Effect.succeed([spareUTxO]),
          signTx: () => Effect.succeed([])
        }),
        Effect.provideService(TxBuilder.GetDatum, (h) =>
          Effect.fail(new TxBuilder.DatumNotFound(h))
        ),
        Effect.provideService(Network.IsMainnet, false),
        Effect.provideService(Network.Params.params, testParams),
        Effect.provideService(Network.UTxO, (ref) =>
          ref == spareUTxO.ref
            ? Effect.succeed(spareUTxO)
            : Effect.fail(new Network.UTxONotFound(ref))
        )
      )
    )
  })

  it("ok", () => {
    const addr =
      "addr_test1vpvndky904g9whpnuae0ffsd37ysjjyu7m6avse3nqsfysqx3eg5h" as Ledger.Address.Address

    const seedUTxO: Ledger.UTxO.UTxO = {
      ref: "8c20a9ab7153e53d17a0b820b2d606b27257a1281d9365acc6d0d3cb8725ccc30" as Ledger.UTxORef.UTxORef,
      output: {
        address: addr,
        assets: {
          "": 9999835423n
        }
      }
    }

    const program = Effect.gen(function* () {
      const tx: Ledger.Tx.Tx = yield* TxBuilder.start.pipe(
        TxBuilder.spendEffect({ dedupe: "fail" })(seedUTxO),
        TxBuilder.payEffect({
          address: addr,
          assets: {}
        }),
        Effect.flatMap(TxBuilder.build())
      )

      yield* Ledger.Tx.validate({ strict: true })(tx)
    })

    const p = program.pipe(
      Effect.provideServiceEffect(
        Wallet.Balancing,
        Wallet.Phrase(
          "predict inform unable grit apple thrive girl thank goose vibrant once credit clap segment glow sausage rude battle message ethics mushroom steel jungle need"
        )
      ),
      Effect.provideService(TxBuilder.GetDatum, (h) =>
        Effect.fail(new TxBuilder.DatumNotFound(h))
      ),
      Effect.provideService(Network.IsMainnet, false),
      Effect.provideService(Network.Params.params, testParams),
      Effect.provideService(Network.UTxOsAt, (a) =>
        a == addr ? Effect.succeed([seedUTxO]) : Effect.succeed([])
      ),
      Effect.provideService(Network.UTxO, (ref) =>
        ref == seedUTxO.ref
          ? Effect.succeed(seedUTxO)
          : Effect.fail(new Network.UTxONotFound(ref))
      )
    )

    Effect.runSync(p)
  })

  it("fails with InsufficientBalancingAssets when balancing wallet cannot cover outputs", () => {
    const addr =
      "addr_test1vpvndky904g9whpnuae0ffsd37ysjjyu7m6avse3nqsfysqx3eg5h" as Ledger.Address.Address

    const spareUTxO: Ledger.UTxO.UTxO = {
      ref: "7c20a9ab7153e53d17a0b820b2d606b27257a1281d9365acc6d0d3cb8725ccc32" as Ledger.UTxORef.UTxORef,
      output: {
        address: addr,
        assets: {
          "": 1_000_000n
        }
      }
    }

    const program = TxBuilder.start.pipe(
      TxBuilder.payEffect({
        address: addr,
        assets: {
          "": 2_000_000n
        }
      }),
      Effect.flatMap(TxBuilder.build()),
      Effect.either
    )

    const result = Effect.runSync(
      program.pipe(
        Effect.provideService(Wallet.Balancing, {
          changeAddress: Effect.succeed(addr),
          utxos: Effect.succeed([spareUTxO]),
          signTx: () => Effect.fail(new Error("signTx should not be called"))
        }),
        Effect.provideService(TxBuilder.GetDatum, (h) =>
          Effect.fail(new TxBuilder.DatumNotFound(h))
        ),
        Effect.provideService(Network.IsMainnet, false),
        Effect.provideService(Network.Params.params, testParams),
        Effect.provideService(Network.UTxO, (ref) =>
          ref == spareUTxO.ref
            ? Effect.succeed(spareUTxO)
            : Effect.fail(new Network.UTxONotFound(ref))
        )
      )
    )

    expect(result._tag).toBe("Left")

    if (result._tag == "Right") {
      throw new Error("Expected build to fail")
    }

    const error = result.left

    expect(error).toBeInstanceOf(TxBuilder.InsufficientBalancingAssets)

    if (!(error instanceof TxBuilder.InsufficientBalancingAssets)) {
      throw new Error("Expected InsufficientBalancingAssets")
    }

    expect(error._tag).toBe("Cardano.TxBuilder.InsufficientBalancingAssets")
    expect(error.required[""]).toBeGreaterThan(0n)
    expect(error.available[""] ?? 0n).toBeLessThan(error.required[""] ?? 0n)
  })

  it("balances stake credential deposits for registrations", () => {
    const addr =
      "addr_test1vpvndky904g9whpnuae0ffsd37ysjjyu7m6avse3nqsfysqx3eg5h" as Ledger.Address.Address

    const spareUTxO: Ledger.UTxO.UTxO = {
      ref: "6c20a9ab7153e53d17a0b820b2d606b27257a1281d9365acc6d0d3cb8725ccc32" as Ledger.UTxORef.UTxORef,
      output: {
        address: addr,
        assets: {
          "": 10_000_000n
        }
      }
    }

    const scripts: Ledger.NativeScript.NativeScript[] = [
      { type: "before", slot: 1 },
      { type: "before", slot: 2 }
    ]

    const program = Effect.gen(function* () {
      const tx: Ledger.Tx.Tx = yield* TxBuilder.start.pipe(
        TxBuilder.registerEffect({
          _tag: "Validator",
          hash: Ledger.NativeScript.hash(scripts[0])
        }),
        TxBuilder.registerEffect({
          _tag: "Validator",
          hash: Ledger.NativeScript.hash(scripts[1])
        }),
        Effect.flatMap(TxBuilder.build())
      )

      yield* Ledger.Tx.validate({ strict: true })(tx)

      const inputLovelace = Ledger.UTxO.sumAssets(...tx.body.inputs)[""] ?? 0n
      const outputLovelace =
        Ledger.TxOutput.sumAssets(...tx.body.outputs)[""] ?? 0n
      const registrationDeposits = 2n * BigInt(testParams.stakeAddrDeposit)

      expect(inputLovelace - outputLovelace - tx.body.fee).toEqual(
        registrationDeposits
      )
    })

    const result = Effect.runSync(
      program.pipe(
        Effect.provideService(Wallet.Balancing, {
          changeAddress: Effect.succeed(addr),
          utxos: Effect.succeed([spareUTxO]),
          signTx: () => Effect.succeed([])
        }),
        Effect.provideService(TxBuilder.GetDatum, (h) =>
          Effect.fail(new TxBuilder.DatumNotFound(h))
        ),
        Effect.provideService(Network.IsMainnet, false),
        Effect.provideService(Network.Params.params, testParams),
        Effect.provideService(Network.UTxO, (ref) =>
          ref == spareUTxO.ref
            ? Effect.succeed(spareUTxO)
            : Effect.fail(new Network.UTxONotFound(ref))
        )
      )
    )

    expect(result).toBeUndefined()
  })

  it("auto-selects local collateral for smart txs", () => {
    const addr =
      "addr_test1vpvndky904g9whpnuae0ffsd37ysjjyu7m6avse3nqsfysqx3eg5h" as Ledger.Address.Address

    const seedUTxO: Ledger.UTxO.UTxO = {
      ref: "9c20a9ab7153e53d17a0b820b2d606b27257a1281d9365acc6d0d3cb8725ccc31" as Ledger.UTxORef.UTxORef,
      output: {
        address: addr,
        assets: {
          "": 9999835423n
        }
      }
    }

    const script: Uplc.Script.Script<2> = {
      version: 2,
      root: Uplc.Term.encodeRoot("1.0.0", {
        _tag: "Lambda",
        body: {
          _tag: "Lambda",
          body: {
            _tag: "Const",
            value: 1n
          }
        }
      })
    }

    const policy = Uplc.Script.hash(script)
    const assetClass = Ledger.AssetClass.make(policy, [1])

    const program = Effect.gen(function* () {
      const tx: Ledger.Tx.Tx = yield* TxBuilder.start.pipe(
        TxBuilder.attachScriptEffect(script),
        TxBuilder.mintEffect({ redeemerDedupe: "fail" })(
          {
            [assetClass]: 1n
          },
          Uplc.Data.makeIntData(0)
        ),
        TxBuilder.payEffect({
          address: addr,
          assets: {}
        }),
        Effect.flatMap(TxBuilder.build())
      )

      const expectedCollateral = yield* Ledger.Tx.minCollateral(tx)

      expect(tx.body.collateral.length).toBeGreaterThan(0)
      expect(tx.body.totalCollateral).toEqual(expectedCollateral)
      expect(
        tx.body.collateral.every((utxo) =>
          Ledger.Assets.containsOnlyAda(utxo.output.assets)
        )
      ).toBeTrue()

      if (tx.body.collateralReturn !== undefined) {
        expect(
          Ledger.Assets.containsOnlyAda(tx.body.collateralReturn.assets)
        ).toBeTrue()
      }

      yield* Ledger.Tx.validate({ strict: true })(tx)
    })

    const p = program.pipe(
      Effect.provideServiceEffect(
        Wallet.Balancing,
        Wallet.Phrase(
          "predict inform unable grit apple thrive girl thank goose vibrant once credit clap segment glow sausage rude battle message ethics mushroom steel jungle need"
        )
      ),
      Effect.provideService(TxBuilder.GetDatum, (h) =>
        Effect.fail(new TxBuilder.DatumNotFound(h))
      ),
      Effect.provideService(Network.IsMainnet, false),
      Effect.provideService(Network.Params.params, testParams),
      Effect.provideService(Network.UTxOsAt, (a) =>
        a == addr ? Effect.succeed([seedUTxO]) : Effect.succeed([])
      ),
      Effect.provideService(Network.UTxO, (ref) =>
        ref == seedUTxO.ref
          ? Effect.succeed(seedUTxO)
          : Effect.fail(new Network.UTxONotFound(ref))
      )
    )

    Effect.runSync(p)
  })
})
