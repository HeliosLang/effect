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
  "010100223232323232323232323232323232325333573466e1c00d200013300d3375e6ae84d55cf1baa33300f00f37586ae8401400404524010e73656564206e6f74207370656e740013232325333573466e1c01920021323357366602266601e01e6eacd5d09aba20010024911c6f757470757420646f65736e277420636f6e7461696e20746f6b656e003357366602266ebcd5d09aab9e37546ae84004cdd2a400466ae80008dd8a4c9201136f7574707574206e6f742072657475726e656400323357366660180020140086602466ebc004ccc050050dd61aba135573c6ea8d5d09aba2357440046eb4d5d09aba2357446ae88d5d1003a4811d7769746e657373206e6f742070726573656e7420696e206f757470757400333300d37586ae84024014008010d55cf1baa33301201237586ae84d5d11aba2008375a6ae84d5d11aba23574400a266601466660186eb0d5d09aba2008004001003008002323232325333573466e1c00920001533357346660220226eacd5d09aba2357446ae88d5d10020008980a24811063616e2774206d696e7420746f6b656e00100115333573466e1c00920021357426aae78dd51aba135573c6ea8d5d09aab9e37546ae84d5d11aab9e37546660200206eb0d5d08020008a999ab9a3370e004900209aba135573c6ea8d5d09aab9e37540022a666ae68cdc38012400c26464a666ae68cdc41aab9d002480204d5d09aab9e37546ae840044d5d09aab9e37546ae84d55cf1baa357420026aae78004dd50008a999ab9a3370e004900409aba135573c6ea8d5d09aab9e37546ae84d55cf1baa0011301449113756e737570706f7274656420707572706f736500357426aae78008d55ce8009baa357426ae88d5d10048039bad357426ae88d5d10019bad357426ae88008dd69aba100135573c0046aae74004dd51aba1357440046aae78dd51aba100135573c6ea8028888c8c94ccd5cd19b8735573a004900009980599baf33300d00d37586ae84d5d11aba2357446ae88d5d11aba2357446ae8801000c00524116756e657870656374656420706b68207769746e6573730013300b3375e6ae84d55cf1baa357426aae78dd51aab9d33300600637566ae84d5d11aba2357446ae88d5d11aba200400300149011a756e6578706563746564207769746864726177616c206372656400357426aae78004dd50019112999ab9a3370e002900009aba100213330030033574400466e0400520022222323357366601266600e00e6eacd5d09aba20010034911b696e70757420646f65736e277420636f6e7461696e20746f6b656e0033300b00b37586ae84d55cf1baa357426ae88d5d10008011aab9e37546ae84d5d11aab9e375466601401400800644464a666ae68cdd79aba135573c6ea800400840044ccc010010d5d10018011aba1002222533357346ae8c0085280992999ab9a3375e6aae740040084ccc014014dd59aab9e0013752911001333004004357440060046ae840088894ccd5cd1aba300214a02a666ae68cdd79aab9d3574200400229444ccc00c00cd5d1001000912999ab9a00214984c00c00494cd5ce0008b1112999ab9a3370e002900009aba100213330030033574400466e04005200201"

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

export const hash = Effect.map(Contract, Script.hash)

/**
 * @returns
 * The list UTxOs stored at the contract address containing a contract asset.
 * The state UTxO is returned first
 */
const $utxos = () =>
  Effect.gen(function* () {
    const vh = yield* hash
    const address = yield* Address.script(vh)
    const getUTxOsAt = yield* Network.UTxOsAt
    const utxos = yield* getUTxOsAt(address)

    return utxos
      .filter((utxo) =>
        Object.keys(utxo.output.assets).some((key) => key.startsWith(vh))
      )
      .sort((a, b) => {
        const aIsStateUTxO = Object.keys(a.output.assets).some(
          (key) => key == vh
        )
        const bIsStateUTxO = Object.keys(b.output.assets).some(
          (key) => key == vh
        )

        return Number(bIsStateUTxO) - Number(aIsStateUTxO)
      })
  })

export { $utxos as utxos }

export const initialize = (witnesses: Witness[]) => (b: TxBuilder.TxBuilder) =>
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
    b = yield* TxBuilder.spend({ dedupe: "keep" })(seedResolved)(b)

    // get the contract validator hash
    const vh = yield* hash
    const nft: Assets.Assets = { [vh]: 1n }
    const address = yield* Address.script(vh)

    b = TxBuilder.attachScript(contract)(b)

    // mint the state token
    b = yield* TxBuilder.mint({ redeemerDedupe: "update" })(nft, (builtTx) => {
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
      datum: Schema.encodeSync(WitnessesFromUplcData)(witnesses)
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

    const vh = yield* hash
    const nft: Assets.Assets = { [vh]: 1n }
    const address = yield* Address.script(vh)

    const [utxo] = yield* $utxos()

    if (utxo === undefined) {
      return yield* Effect.fail(new Error("Couldn't find contract state UTxO"))
    }

    const inputWitnesses: readonly Witness[] = yield* Schema.decodeUnknown(
      WitnessesFromUplcData
    )(utxo.output.datum)

    b = TxBuilder.attachScript(contract)(b)
    b = yield* TxBuilder.spend({ dedupe: "fail" })(
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

    const vh = yield* hash
    const nft: Assets.Assets = { [vh]: 1n }
    const address = yield* Address.script(vh)

    const [utxo] = yield* $utxos()

    if (utxo === undefined) {
      return yield* Effect.fail(new Error("Couldn't find contract state UTxO"))
    }

    const inputWitnesses = yield* Schema.decodeUnknown(WitnessesFromUplcData)(
      utxo.output.datum
    )

    b = TxBuilder.attachScript(contract)(b)
    b = yield* TxBuilder.spend({ dedupe: "fail" })(
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

    const vh = yield* hash
    const address = yield* Address.script(vh)

    for (const key in assets) {
      if (!key.startsWith(vh)) {
        return yield* Effect.fail(
          new Error("minted asset not related to contract")
        )
      }
    }

    const [utxo] = yield* $utxos()

    if (utxo === undefined) {
      return yield* Effect.fail(new Error("Couldn't find contract state UTxO"))
    }

    b = TxBuilder.attachScript(contract)(b)

    b = yield* TxBuilder.refer({ dedupe: "ignore" })(utxo)(b)

    const inputWitnesses = yield* Schema.decodeUnknown(WitnessesFromUplcData)(
      utxo.output.datum
    )

    b = yield* TxBuilder.mint()(
      assets,
      buildWitnessRedeemer(vh, address, utxo.ref, inputWitnesses)
    )(b)

    return b
  })

export const mintEffect = (assets: Assets.Assets) =>
  Effect.flatMap(mint(assets))

export const spend =
  (inputs: UTxO.UTxO | UTxO.UTxO[]) => (b: TxBuilder.TxBuilder) =>
    Effect.gen(function* () {
      const contract = yield* Contract

      const vh = yield* hash
      const address = yield* Address.script(vh)

      for (const utxo of Array.isArray(inputs) ? inputs : [inputs]) {
        if (utxo.output.address != address) {
          return yield* Effect.fail(new Error("spending unrelated UTxO"))
        }
      }

      const [stateUtxO] = yield* $utxos()

      if (stateUtxO === undefined) {
        return yield* Effect.fail(
          new Error("Couldn't find contract state UTxO")
        )
      }

      b = TxBuilder.attachScript(contract)(b)

      b = yield* TxBuilder.refer({ dedupe: "ignore" })(stateUtxO)(b)

      const inputWitnesses = yield* Schema.decodeUnknown(WitnessesFromUplcData)(
        stateUtxO.output.datum
      )

      b = yield* TxBuilder.spend()(
        inputs,
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

    const witnessPtr = findFirstWitness(tx, inputWitnesses, contractAddress)
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

    const witnessPtr = findFirstWitness(tx, inputWitnesses, contractAddress)
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

const findFirstWitness = (tx: Tx.Tx, contractWitnesses: readonly Witness[], contractAddress: Address.Address) => {
  const witnessPtr = contractWitnesses.findIndex((w) => {
    if (w._tag == "Signer") {
      return tx.body.signers.includes(w.pkh)
    } else {
      return tx.body.withdrawals.some(([wk]) => wk == w.addr)
    }
  })

  if (witnessPtr < 0) {
    throw new Error(`Tx not yet witnessed by one of the witnesses mentioned in contract ${contractAddress}. Expected one of [${contractWitnesses.map(w => `${w._tag}:${w._tag == "Signer" ? w.pkh : w.addr}`).join(", ")}]. Got [${tx.body.signers.map(s => `Signer:${s}`).concat(tx.body.withdrawals.map(w => `Withdrawer:${w[0]}`)).join(", ")}]`)
  }

  return witnessPtr
}
