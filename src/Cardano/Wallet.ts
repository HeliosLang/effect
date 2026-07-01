import { Context, Effect } from "effect"
import * as Bip32 from "../Crypto/Bip32.js"
import * as Bip39 from "../Crypto/Bip39.js"
import * as Bytes from "../Codecs/Bytes.js"
import * as Cbor from "../Codecs/Cbor.js"
import * as Cose from "./Cose/index.js"
import * as Address from "./Ledger/Address.js"
import * as PubKey from "./Ledger/PubKey.js"
import * as Signature from "./Ledger/Signature.js"
import * as Tx from "./Ledger/Tx.js"
import * as UTxO from "./Ledger/UTxO.js"
import * as Network from "./Network/index.js"

export class Balancing extends Context.Tag("Cardano.Wallet.Balancing")<
  Balancing,
  {
    changeAddress: Effect.Effect<Address.Address, Error> // TODO: a specific kind of error?
    utxos: Effect.Effect<UTxO.UTxO[], Error> // TODO: a specific kind of error?
    signTx(tx: Tx.Tx): Effect.Effect<Signature.Signature[], Error> // TODO: a specific kind of error?
  }
>() {}

export interface Cip30Handle {
  readonly name: string
  readonly icon: string
  enable(): Promise<Cip30FullHandle>
  isEnabled(): boolean
}

export interface Cip30FullHandle {
  getNetworkId(): Promise<number>
  getUsedAddresses(): Promise<string[]>
  getUnusedAddresses(): Promise<string[]>
  getChangeAddress(): Promise<string>
  getUtxos(): Promise<string[] | null>
  getCollateral(): Promise<string[]>
  getRewardAddresses(): Promise<string[]>
  signData(
    addr: string,
    sigStructure: string
  ): Promise<{ signature: string; key: string }>
  signTx(txHex: string, partialSign: boolean): Promise<string>
  submitTx(txHex: string): Promise<string>
  experimental: {
    getCollateral?: () => Promise<string[]>
  }
}

/**
 * @param phrase
 * Space separated
 * @returns
 */
export const Phrase = (
  phrase: string | string[],
  account: number = 0,
  subAccount: number = 0
) =>
  Effect.gen(function* () {
    /**
     * First turn phrase into private key
     */
    const entropy = yield* Bip39.phraseToEntropy(phrase)
    const root = Bip32.skFromEntropy(entropy)

    /**
     * Then derive spending private-public key-pair
     */
    const spendingPrivateKey = Bip32.derivePath(root, [
      1852 + Bip32.HARDEN,
      1815 + Bip32.HARDEN,
      account + Bip32.HARDEN,
      0,
      subAccount
    ])
    const spendingPublicKey = Bip32.deriveVerificationKey(spendingPrivateKey)
    const spendingPubKeyHash = PubKey.hash(spendingPublicKey)

    const isMainnet = yield* Network.IsMainnet
    const address = Address.make(isMainnet, {
      _tag: "PubKey",
      hash: spendingPubKeyHash
    })
    const utxosAt = yield* Network.UTxOsAt

    return {
      addressSync: address,
      changeAddress: Effect.succeed(address),
      utxos: utxosAt(address).pipe(
        Effect.mapError((e) => new Error(e.message))
      ),
      signData: (
        candidateAddress: Address.Address,
        data: Uint8Array | number[] | string
      ) =>
        Effect.gen(function* () {
          if (Address.stakingCredential(candidateAddress)) {
            return yield* Effect.fail(
              new Error(
                "given address contains a staking credential but Phrase wallet only supports enterprise addresses"
              )
            )
          }

          const spendingCredential =
            Address.spendingCredential(candidateAddress)

          if (
            spendingCredential._tag != "PubKey" ||
            spendingCredential.hash != spendingPubKeyHash
          ) {
            return yield* Effect.fail(
              new Error(
                "given address.spendingCredential doesn't correspond to Phrase wallet's spending credential"
              )
            )
          }

          return {
            signature: Cose.Sign1.sign(
              candidateAddress,
              spendingPrivateKey,
              data
            ),
            key: spendingPublicKey
          }
        }),
      signTx: (tx: Tx.Tx) =>
        Effect.succeed([Bip32.sign(spendingPrivateKey)(Tx.hash(tx))])
    }
  })

export const Browser = (handle: Cip30FullHandle) => ({
  changeAddress: Effect.tryPromise({
    try: () => handle.getChangeAddress(),
    catch: (e) => new Error(String(e))
  }).pipe(Effect.flatMap(decodeChangeAddress)),
  utxos: Effect.tryPromise({
    try: () => handle.getUtxos(),
    catch: (e) => new Error(String(e))
  }).pipe(Effect.flatMap(decodeUtxos)),
  signTx: (tx: Tx.Tx) =>
    Effect.tryPromise({
      try: () => handle.signTx(Bytes.toHex(Tx.encode({ full: true })(tx)), true),
      catch: (e) => new Error(String(e))
    }).pipe(Effect.flatMap(decodeWitnessSignatures))
})

const decodeChangeAddress = (addressHex: string) =>
  Effect.try({
    try: () => {
      const address = Address.decode(Bytes.toArray(addressHex))

      if (address._tag == "Left") {
        throw address.left
      }

      return address.right
    },
    catch: (e) => new Error(String(e))
  })

const decodeUtxos = (utxos: string[] | null) =>
  Effect.try({
    try: () =>
      (utxos ?? []).map((utxoHex) => {
        const decoded = UTxO.decode(utxoHex)

        if (decoded._tag == "Left") {
          throw decoded.left
        } else if (typeof decoded.right == "string") {
          throw new Error("expected full CIP-30 UTxO")
        } else {
          return decoded.right
        }
      }),
    catch: (e) => new Error(String(e))
  })

const decodeWitnessSignatures = (witnessSetHex: string) =>
  Effect.try({
    try: () => {
      const decoded = Cbor.decodeObjectIKey({
        0: Cbor.decodeSet(Signature.decode)
      })(witnessSetHex)

      if (decoded._tag == "Left") {
        throw decoded.left
      }

      return decoded.right[0] ?? []
    },
    catch: (e) => new Error(String(e))
  })
