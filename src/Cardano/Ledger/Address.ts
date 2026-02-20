import { Effect, Either, Option, ParseResult, Schema } from "effect"
import * as Cbor from "../../Codecs/Cbor.js"
import * as Bech32 from "../../Codecs/Bech32.js"
import * as Bytes from "../../Codecs/Bytes.js"
import { IsMainnet } from "../Network/IsMainnet.js"
import { Data } from "../Uplc/index.js"
import * as Credential from "./Credential.js"
import * as PubKeyHash from "./PubKeyHash.js"
import * as ValidatorHash from "./ValidatorHash.js"

export function isValid(addr: string): boolean {
  if (addr.startsWith("addr1") || addr.startsWith("addr_test1")) {
    return Bech32.isValid(addr) // TODO: full validation
  }
  // TODO: validate Byron format

  return false
}

export const Address = Schema.String.pipe(
  Schema.filter((addr: string) => {
    return isValid(addr) || "Invalid Cardano Address"
  }),
  Schema.brand("Cardano.Ledger.Address")
)

export type Address = Schema.Schema.Type<typeof Address>

export const FromUplcData = Schema.transformOrFail(
  Data.EnumVariant(0, {
    spendingCredential: Credential.FromUplcData,
    stakingCredential: Data.Option(Credential.FromUplcData)
  }),
  Schema.typeSchema(Address),
  {
    strict: true,
    decode: (data) =>
      IsMainnet.pipe(
        Effect.map((isMainnet) =>
          make(
            isMainnet,
            data.spendingCredential,
            data.stakingCredential._tag == "Some"
              ? data.stakingCredential.value
              : undefined
          )
        )
      ),
    encode: (address) => {
      const { spendingCredential, stakingCredential } = Effect.runSync(
        decodeInternal(address)
      )

      return ParseResult.succeed({
        spendingCredential,
        stakingCredential: stakingCredential
          ? Option.some(stakingCredential)
          : Option.none()
      })
    }
  }
)

export function make(
  isMainnet: boolean,
  spendingCredential: Credential.Credential,
  stakingCredential?: Credential.Credential
): Address {
  const prefix = isMainnet ? "addr" : "addr_test"
  const bytes: number[] = makeShelleyBytes(
    isMainnet,
    spendingCredential,
    stakingCredential
  )

  const s: string = Bech32.encode(prefix, bytes)

  return s as Address
}

// returns the byte representation of an Address
function makeShelleyBytes(
  isMainnet: boolean,
  spendingCredential: Credential.Credential,
  stakingCredential?: Credential.Credential
): number[] {
  const spendingCredBytes = Bytes.toArray(spendingCredential.hash)

  if (stakingCredential) {
    const stakingCredBytes = Bytes.toArray(stakingCredential.hash)

    if (spendingCredential._tag == "PubKey") {
      if (stakingCredential._tag == "PubKey") {
        return [isMainnet ? 0x01 : 0x00]
          .concat(spendingCredBytes)
          .concat(stakingCredBytes)
      } else {
        return [isMainnet ? 0x21 : 0x20]
          .concat(spendingCredBytes)
          .concat(stakingCredBytes)
      }
    } else {
      if (stakingCredential._tag == "PubKey") {
        return [isMainnet ? 0x11 : 0x10]
          .concat(spendingCredBytes)
          .concat(stakingCredBytes)
      } else {
        return [isMainnet ? 0x31 : 0x30]
          .concat(spendingCredBytes)
          .concat(stakingCredBytes)
      }
    }
  } else if (spendingCredential._tag == "PubKey") {
    return [isMainnet ? 0x61 : 0x60].concat(spendingCredBytes)
  } else {
    return [isMainnet ? 0x71 : 0x70].concat(spendingCredBytes)
  }
}

const decodeInternal = (bytes: Bytes.BytesLike) =>
  Either.gen(function* () {
    if (typeof bytes == "string" && bytes.startsWith("addr")) {
      bytes = (yield* Bech32.decode(bytes)).bytes
    }

    const innerBytes = Cbor.isBytes(bytes)
      ? yield* Cbor.decodeBytes(bytes)
      : Bytes.toArray(bytes)

    const head = innerBytes[0]

    const isMainnet = (head & 0b00001111) != 0

    const type = head & 0b11110000

    const firstPart = () => {
      return innerBytes.slice(1, 29)
    }

    const secondPart = () => {
      return innerBytes.slice(29, 57)
    }

    switch (type) {
      case 0x00:
        return {
          isMainnet,
          spendingCredential: Credential.makePubKey(
            yield* PubKeyHash.make(firstPart())
          ),
          stakingCredential: Credential.makePubKey(
            yield* PubKeyHash.make(secondPart())
          )
        }
      case 0x10:
        return {
          isMainnet,
          spendingCredential: Credential.makeValidator(
            yield* ValidatorHash.make(firstPart())
          ),
          stakingCredential: Credential.makePubKey(
            yield* PubKeyHash.make(secondPart())
          )
        }
      case 0x20:
        return {
          isMainnet,
          spendingCredential: Credential.makePubKey(
            yield* PubKeyHash.make(firstPart())
          ),
          stakingCredential: Credential.makeValidator(
            yield* ValidatorHash.make(secondPart())
          )
        }
      case 0x30:
        return {
          isMainnet,
          spendingCredential: Credential.makeValidator(
            yield* ValidatorHash.make(firstPart())
          ),
          stakingCredential: Credential.makeValidator(
            yield* ValidatorHash.make(secondPart())
          )
        }
      case 0x60:
        return {
          isMainnet,
          spendingCredential: Credential.makePubKey(
            yield* PubKeyHash.make(firstPart())
          )
        }
      case 0x70:
        return {
          isMainnet,
          spendingCredential: Credential.makeValidator(
            yield* ValidatorHash.make(firstPart())
          )
        }
      default:
        return yield* Either.left(
          new Cbor.DecodeError(
            Bytes.makeStream(bytes),
            `invalid Shelley Address header ${head}`
          )
        )
    }
  })

export const decode = (bytes: Bytes.BytesLike): Cbor.DecodeResult<Address> =>
  decodeInternal(bytes).pipe(
    Either.map(({ isMainnet, spendingCredential, stakingCredential }) =>
      make(isMainnet, spendingCredential, stakingCredential)
    ),
    Either.mapLeft((e) => {
      if (e._tag == "ParseError") {
        return new Cbor.DecodeError(Bytes.makeStream(bytes), e.message)
      } else if (e._tag == "DecodeException") {
        return new Cbor.DecodeError(
          Bytes.makeStream(bytes),
          `bech32 decoding failed (${e.message})`
        )
      } else {
        return e
      }
    })
  )

export function encode(address: Address): number[] {
  return Cbor.encodeBytes(bytes(address))
}

export function bytes(address: Address): number[] {
  return Either.getOrThrow(Bech32.decode(address)).bytes
}

export function isMainnet(address: Address): boolean {
  return !address.startsWith("addr_test")
}

export function spendingCredential(address: Address): Credential.Credential {
  return Either.getOrThrow(decodeInternal(address)).spendingCredential
}

export function stakingCredential(
  address: Address
): Credential.Credential | undefined {
  return Either.getOrThrow(decodeInternal(address)).stakingCredential
}

export function isValidator(address: Address): boolean {
  return spendingCredential(address)._tag == "Validator"
}
