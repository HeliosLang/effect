import { Context, Effect } from "effect"
import * as Bip32 from "../Crypto/Bip32.js"
import * as Bip39 from "../Crypto/Bip39.js"
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
    changeAddress: Effect.Effect<Address.Address> // TODO: allow a specific kind of error?
    utxos: Effect.Effect<UTxO.UTxO[], Error> // TODO: a specific kind of error?
    signTx(tx: Tx.Tx): Effect.Effect<Signature.Signature[], Error> // TODO: a specific kind of error?
  }
>() {}

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

export const Browser = (_handle: unknown) => {
  throw new Error("not yet implemented")
}
