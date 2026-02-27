import { describe, it } from "bun:test"
import { Effect } from "effect"
import * as Ledger from "./Ledger/index.js"
import * as Network from "./Network/index.js"
import * as TxBuilder from "./TxBuilder.js"
import * as Wallet from "./Wallet.js"
import { testParams } from "./Network/Params.js"

describe("can balance Tx", () => {
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
        TxBuilder.spendEffect(seedUTxO),
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
})
