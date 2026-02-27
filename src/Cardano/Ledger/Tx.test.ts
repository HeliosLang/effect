import { describe, expect, it } from "bun:test"
import { Effect } from "effect"
import * as Bytes from "../../Codecs/Bytes.js"
import * as Network from "../Network/index.js"
import { testParams } from "../Network/Params.js"
import * as Address from "./Address.js"
import * as Assets from "./Assets.js"
import * as UTxO from "./UTxO.js"
import * as UTxORef from "./UTxORef.js"
import * as Tx from "./Tx.js"

describe(`basic Tx`, () => {
  /**
   * send 10 tAda on preview net from wallet1 to wallet 2
   * (input is 10000 tAda, change is 9990 tAda minus fees)
   * wallet1 address: addr_test1vzzcg26lxj3twnnx889lrn60pqn0z3km2yahhsz0fvpyxdcj5qp8w
   * wallet2 address: addr_test1vqzhgmkqsyyzxthk7vzxet4283wx8wwygu9nq0v94mdldxs0d56ku
   * input utxo: d4b22d33611fb2b3764080cb349b3f12d353aef1d4319ee33e44594bbebe5e83#0
   * command: cardano-cli transaction build --tx-in d4b22d33611fb2b3764080cb349b3f12d353aef1d4319ee33e44594bbebe5e83#0 --tx-out addr_test1vqzhgmkqsyyzxthk7vzxet4283wx8wwygu9nq0v94mdldxs0d56ku+10000000 --change-address addr_test1vzzcg26lxj3twnnx889lrn60pqn0z3km2yahhsz0fvpyxdcj5qp8w --testnet-magic 2 --out-file /data/preview/transactions/202209042119.tx --babbage-era --cddl-format
   */
  const unsignedHex =
    "84a30081825820d4b22d33611fb2b3764080cb349b3f12d353aef1d4319ee33e44594bbebe5e83000182a200581d6085842b5f34a2b74e6639cbf1cf4f0826f146db513b7bc04f4b024337011b000000025370c627a200581d6005746ec08108232ef6f3046caeaa3c5c63b9c4470b303d85aedbf69a011a00989680021a00028759a0f5f6"
  const signedHex =
    "84a30081825820d4b22d33611fb2b3764080cb349b3f12d353aef1d4319ee33e44594bbebe5e83000182a200581d6085842b5f34a2b74e6639cbf1cf4f0826f146db513b7bc04f4b024337011b000000025370c627a200581d6005746ec08108232ef6f3046caeaa3c5c63b9c4470b303d85aedbf69a011a00989680021a00028759a10081825820a0e006bbd52e9db2dcd904e90c335212d2968fcae92ee9dd01204543c314359b584073afc3d75355883cd9a83140ed6480354578148f861f905d65a75b773d004eca5869f7f2a580c6d9cc7d54da3b307aa6cb1b8d4eb57603e37eff83ca56ec620cf5f6"

  const decodeTx = (cborHex: string) =>
    Effect.runSync(
      Tx.decode()(cborHex).pipe(
        Network.provideKnownUTxOs({
          d4b22d33611fb2b3764080cb349b3f12d353aef1d4319ee33e44594bbebe5e830: {
            ref: "d4b22d33611fb2b3764080cb349b3f12d353aef1d4319ee33e44594bbebe5e830" as UTxORef.UTxORef,
            output: {
              address:
                "addr_test1vzzcg26lxj3twnnx889lrn60pqn0z3km2yahhsz0fvpyxdcj5qp8w" as Address.Address,
              assets: { "": 0n } satisfies Assets.Assets
            }
          } satisfies UTxO.UTxO
        })
      )
    )

  const unsigned = decodeTx(unsignedHex)
  const signed = decodeTx(signedHex)

  it("unsigned tx contains a single input", () => {
    expect(unsigned.body.inputs.length).toBe(1)
  })

  //it("unsigned tx validateSignatures fails", () => {
  //    throws(() => unsigned.validateSignatures())
  //})
  //
  //it("signed tx validateSignatures fails (not yet recovered)", () => {
  //    throws(() => signed.validateSignatures())
  //})

  //it("unsigned fails regular validations (not yet recovered)", () => {
  //    throws(() => unsigned.validate(params))
  //})
  //
  //it("signed fails regular validations (not yet recovered)", () => {
  //    throws(() => signed.validate(params))
  //})
  //
  it("minted value is zero", () => {
    expect(unsigned.body.minted).toEqual({})
  })

  it("unsigned.toCbor() should give exactly the same as original encoding", () => {
    expect(Bytes.toHex(Tx.encode()(unsigned))).toBe(unsignedHex)
  })

  it("signed.toCbor() should give exactly the same as original encoding", () => {
    expect(Bytes.toHex(Tx.encode()(signed))).toBe(signedHex)
  })

  //it("signed size should be equal to original encoding size", () => {
  //    strictEqual(signed.calcSize(), hexToBytes(signedHex).length)
  //})
  //
  it("fee is larger or equal to min calculated fee", () => {
    const calculatedFee = Effect.runSync(
      Tx.minFee(signed).pipe(
        Effect.provideService(Network.Params.params, testParams)
      )
    )
    expect(signed.body.fee).toBeGreaterThanOrEqual(calculatedFee)
  })
  //
  //it("signed tx id is equal to unsigned tx id", () => {
  //    deepEqual(signed.id().bytes, unsigned.id().bytes)
  //})

  //it("recovered signed doesn't fail regular validations", async () => {
  //    await signed.recover({
  //        getUtxo: async (id) =>
  //            makeTxInput(
  //                id,
  //                makeTxOutput(
  //                    makeAddress(
  //                        "addr_test1vzzcg26lxj3twnnx889lrn60pqn0z3km2yahhsz0fvpyxdcj5qp8w"
  //                    ),
  //                    makeValue(10_000_000_000n)
  //                )
  //            )
  //    })
  //    signed.validate(params)
  //})
})

describe("decode trusted conway tx with scripts and encoding/decoding roundtrip", () => {
  const signedTx =
    "84a500d9010281828258208c20a9ab7153e53d17a0b820b2d606b27257a1281d9365acc6d0d3cb8725ccc300a200581d605936d8857d50575c33e772f4a60d8f8909489cf6f5d6433198209240011b000000025409611f0182a300581d7051d90ef6da996ea05a678151c41cf1224a6328351f98ec8af1296c86018200a1581c51d90ef6da996ea05a678151c41cf1224a6328351f98ec8af1296c86a14001028201d818582aa1466f7261636c65d87a9f581cb8b8b420e136b84b06639fe9140c6d3e1e866c7166da086c06d28c47ff82581d605936d8857d50575c33e772f4a60d8f8909489cf6f5d64331982092401b000000025405adae021a0003bb2d075820d36a2619a672494604e11bb447cbcf5231e9f2ba25c2169177edc941bd50ad6c098200a1581c51d90ef6da996ea05a678151c41cf1224a6328351f98ec8af1296c86a14001a200d90102818258202b444408e0f589782a4769bb6c17393373024494033dc4ca6793c2e9b9d823195840118ef850914e7d266e10b5b56aa629118ea1cbedfd69fc5a4965e4b943a4a987e41542629be7a6a3ab1850dd623c69f40425a20ec898c21adb9f3adf4c8fe60e07d901028159065b5906580101003229800aba2aba1aba0aab9faab9eaab9dab9a4888888966003300130033754011370e90004dd2a400123007300830080019b874800a4600e60100029111114c004c03401a601800d2225980080145300103d87a80008acc004c0200062600e6601c601e00497ae08cc00400e6020005337000029000a0064028806a444600a6466446600400400244b3001001801c4c8cc896600266e4401c00a2b30013371e00e00510018032020899802802980b0022020375c601e0026eb4c040004c048005010191919800800803112cc00400600713233225980099b910090028acc004cdc78048014400600c808a26600a00a602e0088088dd718080009bab301100130130014044297adef6c6014800244b30013007300a3754005132323322598009809801c0162c8080c966002601c00315980099b8948010c0340062d13007300d001403116403c6ea8c040004dd69808001180800098059baa0028b2012488888cc88ca60024446466446600400400244b30010018a508acc004cdd7801980b180d000c528c4cc008008c06c005015203037566030603260326032603260326032602a6ea8010c966002602260286ea8006264b300198009bab300e30163754003004a4410040291325980099b8748010c058dd5000c4c8c8cc004004008896600200313259800980b980d1baa00189919912cc004c06800626464b300130240028024590211bae3022001301e3754007159800980b800c4c8c96600260480050048b2042375c6044002603c6ea800e2c80e101c0800980d9baa001301e301b3754003164064646600200200844b30010018a6103d87a80008992cc004cdd7a6107466f7261636c6500301d0018980c1980f980e000a5eb82266006006604200480d8c07c00501d44c8cc88cc014014c084010dd7180d000980d800980e800a03637566034602e6ea80062c80a8c040c058dd5000c590141806980a9baa30183015375400316404cb3001300d30133754601860286ea80062660086eb0c05cc050dd50019bad3017301437540031330043758601860286ea800cdd6980b980a1baa0014049301400898081baa00348896600260200031323322598009809800c4c8c966002603a0050048b2034375a6036002602e6ea80162b300130100018992cc004c0700062660166036002007164064602e6ea80162c80a90150acc004c044c050dd5001c56600264660020026eb0c064c058dd5006112cc00400629422b30013375e6034602e6ea8c068004c068c05cdd500ec528c4cc008008c06c00501520308acc004cdd7980c180c980c980c980c980a9baa00b374cb30014a114bd6f7b63044c8c8cc0040052f5bded8c044b300100189980d19bb037520086e9800d2f5bded8c113298009bae30180019bab3019001980e8012444b30013372001000713301e337606ea4020dd3003802c56600266e3c02000e26603c66ec0dd48041ba600700189980f19bb037520066e98008cc01801800501a2034180d800a03232330010014bd6f7b630112cc00400626603266ec13010140004c010101004bd6f7b63044ca60026eb8c05c0066eb4c06000660380049112cc004cdc824410000389980e99bb04c010140004c010101000058acc004cdc7a4410000389980e99bb04c010140004c0101010000189980e99bb037520066ea0008cc0180180050192032180d000a030404d132598009809180a9baa0018992cc004cdd7980d180b9baa301a3017375400266e95200233019375200697ae08cc004dd59807980b9baa001801d220100402d1640546032602c6ea80062c80a0cc014dd61807980a9baa00b375a6030602a6ea800e2c809a2c809a3300100b800cc060c054dd5001a008404c60286ea800cdd7180b980a1baa0068acc004c03400626466446601400a264b3001301430173754003132598009809180c1baa0018cc00403e6eb8c070c064dd5000c01d008459017180d980c1baa301b30183754602060306ea8c06cc060dd5000c5901619198008009bac301b3018375401c44b30010018a6103d87a80008992cc004cdd7980e980d1baa0010058980a9980e000a5eb82266006006603c00480c0c07000501a180c000980c180c800980a1baa0068b20244048225980099b88001480022980103d87a8000899801801000a020301130120053003003229344d95900113001299fd8799f58208c20a9ab7153e53d17a0b820b2d606b27257a1281d9365acc6d0d3cb8725ccc300ffff0001f4a0"

  const decodeTx = (cborHex: string) =>
    Effect.runSync(
      Tx.decode({ trusted: true })(cborHex).pipe(
        Network.provideKnownUTxOs({
          "8c20a9ab7153e53d17a0b820b2d606b27257a1281d9365acc6d0d3cb8725ccc30": {
            ref: "8c20a9ab7153e53d17a0b820b2d606b27257a1281d9365acc6d0d3cb8725ccc30" as UTxORef.UTxORef,
            output: {
              address:
                "addr_test1vpvndky904g9whpnuae0ffsd37ysjjyu7m6avse3nqsfysqx3eg5h" as Address.Address,
              assets: { "": 9999835423n } satisfies Assets.Assets
            }
          } satisfies UTxO.UTxO
        })
      )
    )

  const tx = decodeTx(signedTx)

  const encodedFromFull = Tx.encode()(tx)

  const tx2 = decodeTx(Bytes.toHex(encodedFromFull))

  const encoded = Tx.encode()(tx2)

  expect(encodedFromFull).toEqual(encoded)
})