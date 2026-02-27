import { describe, expect, it } from "bun:test"
import { Effect } from "effect"
import * as Bytes from "../../Codecs/Bytes.js"
import * as Network from "../Network/index.js"
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
        Effect.provideService(Network.Params.params, params)
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

const params: Network.Params.Params = {
  txFeeFixed: 155381,
  txFeePerByte: 44,
  exMemFeePerUnit: 0.0577,
  exCpuFeePerUnit: 0.0000721,
  utxoDepositPerByte: 4310,
  refScriptsFeePerByte: 15,
  collateralPercentage: 150,
  maxCollateralInputs: 3,
  maxTxExMem: 16500000,
  maxTxExCpu: 10000000000,
  maxTxSize: 16384,
  secondsPerSlot: 1,
  stakeAddrDeposit: 2000000,
  refTipSlot: 116294635,
  refTipTime: 1771977835000,
  costModelParamsV1: [
    100788, 420, 1, 1, 1000, 173, 0, 1, 1000, 59957, 4, 1, 11183, 32, 201305,
    8356, 4, 16000, 100, 16000, 100, 16000, 100, 16000, 100, 16000, 100, 16000,
    100, 100, 100, 16000, 100, 94375, 32, 132994, 32, 61462, 4, 72010, 178, 0,
    1, 22151, 32, 91189, 769, 4, 2, 85848, 228465, 122, 0, 1, 1, 1000, 42921, 4,
    2, 24548, 29498, 38, 1, 898148, 27279, 1, 51775, 558, 1, 39184, 1000, 60594,
    1, 141895, 32, 83150, 32, 15299, 32, 76049, 1, 13169, 4, 22100, 10, 28999,
    74, 1, 28999, 74, 1, 43285, 552, 1, 44749, 541, 1, 33852, 32, 68246, 32,
    72362, 32, 7243, 32, 7391, 32, 11546, 32, 85848, 228465, 122, 0, 1, 1,
    90434, 519, 0, 1, 74433, 32, 85848, 228465, 122, 0, 1, 1, 85848, 228465,
    122, 0, 1, 1, 270652, 22588, 4, 1457325, 64566, 4, 20467, 1, 4, 0, 141992,
    32, 100788, 420, 1, 1, 81663, 32, 59498, 32, 20142, 32, 24588, 32, 20744,
    32, 25933, 32, 24623, 32, 53384111, 14333, 10
  ],
  costModelParamsV2: [
    100788, 420, 1, 1, 1000, 173, 0, 1, 1000, 59957, 4, 1, 11183, 32, 201305,
    8356, 4, 16000, 100, 16000, 100, 16000, 100, 16000, 100, 16000, 100, 16000,
    100, 100, 100, 16000, 100, 94375, 32, 132994, 32, 61462, 4, 72010, 178, 0,
    1, 22151, 32, 91189, 769, 4, 2, 85848, 228465, 122, 0, 1, 1, 1000, 42921, 4,
    2, 24548, 29498, 38, 1, 898148, 27279, 1, 51775, 558, 1, 39184, 1000, 60594,
    1, 141895, 32, 83150, 32, 15299, 32, 76049, 1, 13169, 4, 22100, 10, 28999,
    74, 1, 28999, 74, 1, 43285, 552, 1, 44749, 541, 1, 33852, 32, 68246, 32,
    72362, 32, 7243, 32, 7391, 32, 11546, 32, 85848, 228465, 122, 0, 1, 1,
    90434, 519, 0, 1, 74433, 32, 85848, 228465, 122, 0, 1, 1, 85848, 228465,
    122, 0, 1, 1, 955506, 213312, 0, 2, 270652, 22588, 4, 1457325, 64566, 4,
    20467, 1, 4, 0, 141992, 32, 100788, 420, 1, 1, 81663, 32, 59498, 32, 20142,
    32, 24588, 32, 20744, 32, 25933, 32, 24623, 32, 43053543, 10, 53384111,
    14333, 10, 43574283, 26308, 10
  ],
  costModelParamsV3: [
    100788, 420, 1, 1, 1000, 173, 0, 1, 1000, 59957, 4, 1, 11183, 32, 201305,
    8356, 4, 16000, 100, 16000, 100, 16000, 100, 16000, 100, 16000, 100, 16000,
    100, 100, 100, 16000, 100, 94375, 32, 132994, 32, 61462, 4, 72010, 178, 0,
    1, 22151, 32, 91189, 769, 4, 2, 85848, 123203, 7305, -900, 1716, 549, 57,
    85848, 0, 1, 1, 1000, 42921, 4, 2, 24548, 29498, 38, 1, 898148, 27279, 1,
    51775, 558, 1, 39184, 1000, 60594, 1, 141895, 32, 83150, 32, 15299, 32,
    76049, 1, 13169, 4, 22100, 10, 28999, 74, 1, 28999, 74, 1, 43285, 552, 1,
    44749, 541, 1, 33852, 32, 68246, 32, 72362, 32, 7243, 32, 7391, 32, 11546,
    32, 85848, 123203, 7305, -900, 1716, 549, 57, 85848, 0, 1, 90434, 519, 0, 1,
    74433, 32, 85848, 123203, 7305, -900, 1716, 549, 57, 85848, 0, 1, 1, 85848,
    123203, 7305, -900, 1716, 549, 57, 85848, 0, 1, 955506, 213312, 0, 2,
    270652, 22588, 4, 1457325, 64566, 4, 20467, 1, 4, 0, 141992, 32, 100788,
    420, 1, 1, 81663, 32, 59498, 32, 20142, 32, 24588, 32, 20744, 32, 25933, 32,
    24623, 32, 43053543, 10, 53384111, 14333, 10, 43574283, 26308, 10, 16000,
    100, 16000, 100, 962335, 18, 2780678, 6, 442008, 1, 52538055, 3756, 18,
    267929, 18, 76433006, 8868, 18, 52948122, 18, 1995836, 36, 3227919, 12,
    901022, 1, 166917843, 4307, 36, 284546, 36, 158221314, 26549, 36, 74698472,
    36, 333849714, 1, 254006273, 72, 2174038, 72, 2261318, 64571, 4, 207616,
    8310, 4, 1293828, 28716, 63, 0, 1, 1006041, 43623, 251, 0, 1, 100181, 726,
    719, 0, 1, 100181, 726, 719, 0, 1, 100181, 726, 719, 0, 1, 107878, 680, 0,
    1, 95336, 1, 281145, 18848, 0, 1, 180194, 159, 1, 1, 158519, 8942, 0, 1,
    159378, 8813, 0, 1, 107490, 3298, 1, 106057, 655, 1, 1964219, 24520, 3
  ]
}
