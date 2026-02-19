import { Data, Either } from "effect"
import * as Assets from "./Ledger/Assets.js"
import type { UTxO } from "./Ledger/UTxO.js"

export class InsufficientFunds extends Data.TaggedError(
  "Cardano.CoinSelection.InsufficientFunds"
)<{ message: string }> {
  constructor() {
    super({ message: "Insufficient funds" })
  }
}

export type CoinSelection = (
  utxos: UTxO[],
  assets: Assets.Assets
) => Either.Either<UTxO[], InsufficientFunds>

type SelectOptions = {
  allowSelectingUninvolvedAssets?: boolean // defaults to false
}

/**
 * Selects UTxOs from a list by iterating through the tokens in the given `Value` and picking the UTxOs containing the largest corresponding amount first.
 */
export function largestFirst(options: SelectOptions = {}): CoinSelection {
  return extremumFirst(true, options)
}

/**
 * Selects UTxOs from a list by iterating through the tokens in the given `Value` and picking the UTxOs containing the smallest corresponding amount first.
 * This method can be used to eliminate dust UTxOs from a wallet.
 */
export function smallestFirst(options: SelectOptions = {}): CoinSelection {
  return extremumFirst(false, options)
}

/**
 * Loops through the policies and tokens of `amount`
 *   - if for a given asset there isn't enough already included, select the previously unselected utxos until the necessary quantity is filled (starting with the extremum first)
 */
const extremumFirst =
  (
    largestFirst: boolean,
    { allowSelectingUninvolvedAssets = false }: SelectOptions
  ) =>
  (utxos: UTxO[], amount: Assets.Assets) => {
    let sum: Assets.Assets = {}
    let notSelected: UTxO[] = utxos.slice()
    const selected: UTxO[] = []

    /**
     * Selects smallest utxos until 'needed' is reached
     * @param {bigint} neededQuantity
     * @param {(utxo: TxInput) => bigint} getQuantity
     */
    function select(
      neededQuantity: bigint,
      getQuantity: (utxo: UTxO) => bigint
    ) {
      // first sort notYetPicked in ascending order when picking smallest first,
      // and in descending order when picking largest first
      // sort UTxOs that contain more assets last
      notSelected.sort((a, b) => {
        const qa = getQuantity(a)
        const qb = getQuantity(b)

        const sign = largestFirst ? -1 : 1

        if (qa != 0n && qb == 0n) {
          return sign
        } else if (qa == 0n && qb != 0n) {
          return -sign
        } else if (qa == 0n && qb == 0n) {
          return 0
        } else {
          const na = Assets.countTokens(a.output.assets)
          const nb = Assets.countTokens(b.output.assets)

          if (na == nb) {
            return Number(qa - qb) * sign
          } else if (na < nb) {
            return sign
          } else {
            return -sign
          }
        }
      })

      let count = 0n
      const remaining = []

      while (count < neededQuantity || count == 0n) {
        // must select at least one utxo if neededQuantity == 0n
        const utxo = notSelected.shift()

        if (utxo === undefined) {
          return Either.left(new InsufficientFunds())
        } else {
          const qty = getQuantity(utxo)

          if (qty > 0n) {
            count += qty
            selected.push(utxo)
            sum = Assets.add(sum, utxo.output.assets)
          } else {
            remaining.push(utxo)
          }
        }
      }

      notSelected = notSelected.concat(remaining)
    }

    /**
     * Select UTxOs while looping through (MintingPolicyHash,TokenName) entries
     * If the UTxOs happen to contain Asset classes that shouldn't be involved, then those are mixed in
     */
    for (const ac in amount) {
      const need = amount[ac]

      const have = sum[ac] ?? 0n

      if (have < need) {
        const diff = need - have

        select(diff, (utxo) => utxo.output.assets[ac] ?? 0n)
      }
    }

    /**
     * Now use the same strategy for lovelace
     * Except that UTxOs containing Asset classes not involved in this transaction are ignored by default
     */
    const need = amount.lovelace
    const have = sum.lovelace

    if (have < need) {
      const diff = need - have

      const canSelectUtxoForLovelace = (utxo: UTxO): boolean => {
        if (allowSelectingUninvolvedAssets) {
          return true
        }

        const acs = Assets.nonAdaAssetClasses(utxo.output.assets)

        if (acs.length == 0) {
          return true
        } else {
          return acs.some((ac) =>
            Assets.nonAdaAssetClasses(amount).some((act) => act == ac)
          )
        }
      }

      const usuableForLovelace = notSelected.filter(canSelectUtxoForLovelace)
      const unusableForLovelace = notSelected.filter(
        (utxo) => !canSelectUtxoForLovelace(utxo)
      )

      notSelected = usuableForLovelace

      select(diff, (utxo) => utxo.output.assets[""] ?? 0n)

      notSelected = notSelected.concat(unusableForLovelace)
    }

    if (selected.length + notSelected.length != utxos.length) {
      throw new Error("internal error: select algorithm doesn't conserve utxos")
    }

    return Either.right(selected)
  }
