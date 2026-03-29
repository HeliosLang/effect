import { Context, Effect, Schema } from "effect"
import { Bytes } from "../Codecs/index.js"
import {
  Address,
  Assets,
  PubKeyHash,
  RewardAddress,
  Tx,
  ValidatorHash,
  UTxO,
  UTxORef
} from "./Ledger/index.js"
import { Data, Script, Value } from "./Uplc/index.js"
import * as Network from "./Network/index.js"
import * as TxBuilder from "./TxBuilder.js"

/**
 * A 'Contract' is a special validator which can be 'upgraded'
 */
const cborHex =
  "010100223232323232323232323232323232325333573466e1c00d200013300d3375e6ae84d55cf1baa333300f00f37586ae8401400520000114910e73656564206e6f74207370656e740013232325333573466e1c01920021323357366602266601e01e6eacd5d09aba20010024911c6f757470757420646f65736e277420636f6e7461696e20746f6b656e003357366602266ebcd5d09aab9e37546ae84004cdd2a400466ae80008dd8a4c9201136f7574707574206e6f742072657475726e656400323357366660180020140086602466ebc004cccc050050dd61aba135573c6ea8d5d09aba2357440046eb4d5d09aba2357446ae88d5d1003a400092011d7769746e657373206e6f742070726573656e7420696e206f757470757400333300d37586ae84024014008010d55cf1baa333301201237586ae84d5d11aba2008375a6ae84d5d11aba23574400a9000099980519998061bac357426ae8802001000400c020008c8c8c8c94ccd5cd19b87002480004c94ccd5cd1998090091bab357426ae88d5d11aba23574400a0022602a92011063616e2774206d696e7420746f6b656e001001357420022a666ae68cdc38012400426ae84d55cf1baa357426aae78dd51aba135573c6ea8d5d09aba235573c6ea8ccc040040dd61aba1004357420022a666ae68cdc38012400826ae84d55cf1baa357426aae78dd51aba100115333573466e1c0092006132325333573466e20d55ce8012401026ae84d55cf1baa3574200226ae84d55cf1baa357426aae78dd51aba100135573c0026ea8d5d09aba200115333573466e1c00920081357426aae78dd51aba135573c6ea8d5d09aab9e37546ae840044c05124113756e737570706f7274656420707572706f73650035573c0046aae74004dd51aba1357446ae8802401cdd69aba1357446ae8800cdd69aba1357440046eb4d5d08009aab9e00235573a0026ea8d5d09aba200235573c6ea8d5d08009aab9e37540144446464a666ae68cdc39aab9d002480004cc02ccdd799998068069bac357426ae88d5d11aba2357446ae88d5d11aba2357440080069000000a4916756e657870656374656420706b68207769746e6573730013300b3375e6ae84d55cf1baa357426aae78dd51aab9d333300600637566ae84d5d11aba2357446ae88d5d11aba20040034800000524011a756e6578706563746564207769746864726177616c206372656400357426aae78004dd500191112999ab9a3370e00400226ae8400c4cccc010010d5d100180119b80001480088888c8cd5cd998049998038039bab357426ae8800400d2411b696e70757420646f65736e277420636f6e7461696e20746f6b656e00333300b00b37586ae84d55cf1baa357426ae88d5d1000801240006aae78dd51aba1357446aae78dd51999805005002001a400044464a666ae68cdd79aba135573c6ea800400840044ccc010010d5d10018011aba1002222533357346ae8c0085280992999ab9a3375e6aae740040084ccc014014dd59aab9e00137529101001333004004357440060046ae840088894ccd5cd1aba300214a02a666ae68cdd79aab9d3574200400229444ccc00c00cd5d1001000912999ab9a00214984c00c00494cd5ce0008b11112999ab9a3370e00400226ae8400c4cccc01001000c008cdc0000a40041"

export function make(seed: UTxORef.UTxORef) {
  const unapplied: Script.Script<3> = {
    version: 3,
    root: Bytes.toUint8Array(cborHex)
  }

  return Script.apply(unapplied, [
    { data: Schema.encodeSync(UTxORef.FromUplcDataV3)(seed) }
  ])
}

export class Contract extends Context.Tag("Cardano.Contract")<
  Contract,
  Script.Script<3>
>() {}

export const WitnessFromUplcData = Data.Enum({
  Signer: {
    pkh: PubKeyHash.FromUplcData
  },
  Withdrawer: {
    addr: RewardAddress.FromUplcData
  }
})

export type Witness = Schema.Schema.Type<typeof WitnessFromUplcData>

const equalsWitness = (a: Witness, b: Witness) => {
  if (a._tag == "Signer") {
    return b._tag == "Signer" && b.pkh == a.pkh
  } else {
    return b._tag == "Withdrawer" && b.addr == a.addr
  }
}

const WitnessesFromUplcData = Data.Array(WitnessFromUplcData)

export const seed = (contract: Script.Script<3>) =>
  Effect.gen(function* () {
    // get seed from contract
    const [seedValue] = yield* Script.extractParams(contract)

    if (!Value.isData(seedValue)) {
      return yield* Effect.fail(new Error("expected seed data parameter"))
    }

    return yield* Schema.decode(UTxORef.FromUplcDataV3)(seedValue.data)
  })

export const initialize = (witness: Witness) => (b: TxBuilder.TxBuilder) =>
  Effect.gen(function* () {
    const contract = yield* Contract

    // get seed from contract
    const [seedValue] = yield* Script.extractParams(contract)

    if (!Value.isData(seedValue)) {
      return yield* Effect.fail(new Error("expected seed data parameter"))
    }

    const getUTxO = yield* Network.UTxO
    const seedResolved = yield* getUTxO(yield* seed(contract))

    // spend the seed
    b = yield* TxBuilder.spend(seedResolved)(b)

    // get the contract validator hash
    const vh = Script.hash(contract)
    const nft: Assets.Assets = { [vh]: 1n }
    const address = yield* Address.script(vh)

    b = TxBuilder.attachScript(contract)(b)

    // mint the state token
    b = yield* TxBuilder.mint(nft, (builtTx) => {
      const seedInputPtr = builtTx.body.inputs
        .map((input) => input.ref)
        .indexOf(seedResolved.ref)

      if (seedInputPtr < 0) {
        throw new Error("seed input not found in tx inputs")
      }

      return Data.makeConstrData(0, [Data.makeIntData(seedInputPtr)])
    })(b)

    b = yield* TxBuilder.pay({
      address,
      assets: nft,
      datum: Schema.encodeSync(WitnessesFromUplcData)([witness])
    })(b)

    return b
  })

export const addValidator =
  (vh: ValidatorHash.ValidatorHash) => (b: TxBuilder.TxBuilder) =>
    Effect.gen(function* () {
      const witness: Witness = {
        _tag: "Withdrawer",
        addr: yield* RewardAddress.script(vh)
      }
      return yield* addWitness(witness)(b)
    })

export const addValidatorEffect = (vh: ValidatorHash.ValidatorHash) =>
  Effect.flatMap(addValidator(vh))

export const addAdmin =
  (pkh: PubKeyHash.PubKeyHash) => (b: TxBuilder.TxBuilder) =>
    Effect.gen(function* () {
      const witness: Witness = { _tag: "Signer", pkh }
      return yield* addWitness(witness)(b)
    })

export const addAdminEffect = (pkh: PubKeyHash.PubKeyHash) =>
  Effect.flatMap(addAdmin(pkh))

// assume the input witess has already been called correctly
export const addWitness = (witness: Witness) => (b: TxBuilder.TxBuilder) =>
  Effect.gen(function* () {
    const contract = yield* Contract

    const vh = Script.hash(contract)
    const nft: Assets.Assets = { [vh]: 1n }
    const address = yield* Address.script(vh)

    const getUTxOsAt = yield* Network.UTxOsAt
    const utxos = yield* getUTxOsAt(address)
    const [utxo] = utxos.filter((utxo) => vh in utxo.output.assets)

    if (utxo === undefined) {
      return yield* Effect.fail(new Error("Couldn't find contract state UTxO"))
    }

    const inputWitnesses: readonly Witness[] = yield* Schema.decodeUnknown(
      WitnessesFromUplcData
    )(utxo.output.datum)

    b = TxBuilder.attachScript(contract)(b)
    b = yield* TxBuilder.spend(
      utxo,
      buildUpdateRedeemer(vh, address, utxo.ref, inputWitnesses)
    )(b)

    // TODO: throw an error if the witness already exists in the inputWitnesses list
    if (inputWitnesses.some((iw) => equalsWitness(iw, witness))) {
      return yield* Effect.fail("Witness already added before")
    }

    // create the output
    b = yield* TxBuilder.pay({
      address,
      assets: nft,
      datum: yield* Schema.encode(WitnessesFromUplcData)(
        inputWitnesses.concat([witness])
      )
    })(b)

    return b
  })

export const addWitnessEffect = (witness: Witness) =>
  Effect.flatMap(addWitness(witness))

export const removeValidator =
  (vh: ValidatorHash.ValidatorHash) => (b: TxBuilder.TxBuilder) =>
    Effect.gen(function* () {
      const witness: Witness = {
        _tag: "Withdrawer",
        addr: yield* RewardAddress.script(vh)
      }
      return yield* removeWitness(witness)(b)
    })

export const removeValidatorEffect = (vh: ValidatorHash.ValidatorHash) =>
  Effect.flatMap(removeValidator(vh))

export const removeAdmin =
  (pkh: PubKeyHash.PubKeyHash) => (b: TxBuilder.TxBuilder) =>
    Effect.gen(function* () {
      const witness: Witness = { _tag: "Signer", pkh }
      return yield* removeWitness(witness)(b)
    })

export const removeAdminEffect = (pkh: PubKeyHash.PubKeyHash) =>
  Effect.flatMap(removeAdmin(pkh))

// assume the input witess has already been called correctly
export const removeWitness = (witness: Witness) => (b: TxBuilder.TxBuilder) =>
  Effect.gen(function* () {
    const contract = yield* Contract

    const vh = Script.hash(contract)
    const nft: Assets.Assets = { [vh]: 1n }
    const address = yield* Address.script(vh)

    const getUTxOsAt = yield* Network.UTxOsAt
    const utxos = yield* getUTxOsAt(address)
    const [utxo] = utxos.filter((utxo) => vh in utxo.output.assets)

    if (utxo === undefined) {
      return yield* Effect.fail(new Error("Couldn't find contract state UTxO"))
    }

    const inputWitnesses = yield* Schema.decodeUnknown(WitnessesFromUplcData)(
      utxo.output.datum
    )

    b = TxBuilder.attachScript(contract)(b)
    b = yield* TxBuilder.spend(
      utxo,
      buildUpdateRedeemer(vh, address, utxo.ref, inputWitnesses)
    )(b)

    // TODO: throw an error if the witness already exists in the inputWitnesses list
    if (!inputWitnesses.some((iw) => equalsWitness(iw, witness))) {
      return yield* Effect.fail(
        "Witness to be remove not found in contract state"
      )
    }

    // create the output
    b = yield* TxBuilder.pay({
      address,
      assets: nft,
      datum: yield* Schema.encode(WitnessesFromUplcData)(
        inputWitnesses.filter((iw) => !equalsWitness(iw, witness))
      )
    })(b)

    return b
  })

export const removeWitnessEffect = (witness: Witness) =>
  Effect.flatMap(removeWitness(witness))

export const mint = (assets: Assets.Assets) => (b: TxBuilder.TxBuilder) =>
  Effect.gen(function* () {
    const contract = yield* Contract

    const vh = Script.hash(contract)
    const address = yield* Address.script(vh)

    for (const key in assets) {
      if (!key.startsWith(vh)) {
        return yield* Effect.fail(
          new Error("minted asset not related to contract")
        )
      }
    }

    const getUTxOsAt = yield* Network.UTxOsAt
    const utxos = yield* getUTxOsAt(address)
    const [utxo] = utxos.filter((utxo) => vh in utxo.output.assets)

    if (utxo === undefined) {
      return yield* Effect.fail(new Error("Couldn't find contract state UTxO"))
    }

    b = TxBuilder.attachScript(contract)(b)

    b = yield* TxBuilder.refer(utxo)(b)

    const inputWitnesses = yield* Schema.decodeUnknown(WitnessesFromUplcData)(
      utxo.output.datum
    )

    b = yield* TxBuilder.mint(
      assets,
      buildWitnessRedeemer(vh, address, utxo.ref, inputWitnesses)
    )(b)

    return b
  })

export const mintEffect = (assets: Assets.Assets) =>
  Effect.flatMap(mint(assets))

export const spend =
  (utxos: UTxO.UTxO | UTxO.UTxO[]) => (b: TxBuilder.TxBuilder) =>
    Effect.gen(function* () {
      const contract = yield* Contract

      const vh = Script.hash(contract)
      const address = yield* Address.script(vh)

      for (const utxo of Array.isArray(utxos) ? utxos : [utxos]) {
        if (utxo.output.address != address) {
          return yield* Effect.fail(new Error("spending unrelated UTxO"))
        }
      }

      const getUTxOsAt = yield* Network.UTxOsAt
      const stateUtxos = yield* getUTxOsAt(address)
      const [stateUtxO] = stateUtxos.filter((utxo) => vh in utxo.output.assets)

      if (stateUtxO === undefined) {
        return yield* Effect.fail(
          new Error("Couldn't find contract state UTxO")
        )
      }

      b = TxBuilder.attachScript(contract)(b)

      b = yield* TxBuilder.refer(stateUtxO)(b)

      const inputWitnesses = yield* Schema.decodeUnknown(WitnessesFromUplcData)(
        stateUtxO.output.datum
      )

      b = yield* TxBuilder.spend(
        utxos,
        buildWitnessRedeemer(vh, address, stateUtxO.ref, inputWitnesses)
      )(b)

      return b
    })

export const spendEffect = (utxos: UTxO.UTxO | UTxO.UTxO[]) =>
  Effect.flatMap(spend(utxos))

const buildUpdateRedeemer =
  (
    contractHash: ValidatorHash.ValidatorHash,
    contractAddress: Address.Address,
    inputRef: UTxORef.UTxORef,
    inputWitnesses: readonly Witness[]
  ) =>
  (tx: Tx.Tx) => {
    const inputPtr = tx.body.inputs.map((input) => input.ref).indexOf(inputRef)

    if (inputPtr < 0) {
      throw new Error("state input not found in tx inputs")
    }

    const witnessPtr = inputWitnesses.findIndex((w) => {
      if (w._tag == "Signer") {
        return tx.body.signers.includes(w.pkh)
      } else {
        return tx.body.withdrawals.some(([wk]) => wk == w.addr)
      }
    })

    if (witnessPtr < 0) {
      throw new Error("Tx not yet witnessed by a witness mentioned in contract")
    }

    const inputWitness = inputWitnesses[witnessPtr]

    let signerPtr: number
    if (inputWitness._tag == "Signer") {
      signerPtr = tx.body.signers.indexOf(inputWitness.pkh)
    } else {
      signerPtr = tx.body.withdrawals.findIndex(
        ([wk]) => wk == inputWitness.addr
      )
    }

    if (signerPtr < 0) {
      throw new Error("Signer not found")
    }

    const outputPtr = tx.body.outputs.findIndex((output) => {
      return output.address == contractAddress && contractHash in output.assets
    })

    if (outputPtr < 0) {
      throw new Error("Output not found")
    }

    const output = tx.body.outputs[outputPtr]

    const outputWitnesses = Schema.decodeUnknownSync(WitnessesFromUplcData)(
      output.datum
    )

    const outputWitnessPtr = outputWitnesses.findIndex((ow) =>
      equalsWitness(inputWitness, ow)
    )

    if (outputWitnessPtr < 0) {
      throw new Error("Output witness not found")
    }

    return Data.makeConstrData(1, [
      Data.makeIntData(inputPtr),
      Data.makeIntData(witnessPtr),
      Data.makeIntData(signerPtr),
      Data.makeIntData(outputPtr),
      Data.makeIntData(outputWitnessPtr)
    ])
  }

const buildWitnessRedeemer =
  (
    contractHash: ValidatorHash.ValidatorHash,
    contractAddress: Address.Address,
    inputRef: UTxORef.UTxORef,
    inputWitnesses: readonly Witness[]
  ) =>
  (tx: Tx.Tx) => {
    const inputPtr = tx.body.refInputs
      .map((input) => input.ref)
      .indexOf(inputRef)

    if (inputPtr < 0) {
      throw new Error("state ref input not found in tx inputs")
    }

    const witnessPtr = inputWitnesses.findIndex((w) => {
      if (w._tag == "Signer") {
        return tx.body.signers.includes(w.pkh)
      } else {
        return tx.body.withdrawals.some(([wk]) => wk == w.addr)
      }
    })

    if (witnessPtr < 0) {
      throw new Error("Tx not yet witnessed by a witness mentioned in contract")
    }

    const inputWitness = inputWitnesses[witnessPtr]

    let signerPtr: number
    if (inputWitness._tag == "Signer") {
      signerPtr = tx.body.signers.indexOf(inputWitness.pkh)
    } else {
      signerPtr = tx.body.withdrawals.findIndex(
        ([wk]) => wk == inputWitness.addr
      )
    }

    if (signerPtr < 0) {
      throw new Error("Signer not found")
    }

    return Data.makeConstrData(2, [
      Data.makeIntData(inputPtr),
      Data.makeIntData(witnessPtr),
      Data.makeIntData(signerPtr)
    ])
  }
