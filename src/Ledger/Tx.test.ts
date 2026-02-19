import { describe, expect, it } from "bun:test"
import { Effect } from "effect"
import * as Bytes from "../internal/Bytes.js"
import * as Network from "../Network"
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
  //it("fee is larger or equal to min calculated fee", () => {
  //    const calculatedFee = signed.calcMinFee(params)
  //    strictEqual(signed.body.fee >= calculatedFee, true)
  //})
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
