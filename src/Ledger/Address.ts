import { Effect, Option, ParseResult, Schema } from "effect"
import * as Bech32 from "../Bech32.js"
import * as Cbor from "../Cbor.js"
import * as Bytes from "../internal/Bytes.js"
import { Data } from "../Uplc/index.js"
import * as Credential from "./Credential.js"
import { IsMainnet } from "./IsMainnet.js"
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
  Schema.brand("Address")
)

export type Address = Schema.Schema.Type<typeof Address>

export const FromUplcData = Schema.transformOrFail(
  Data.EnumVariant(0, {
    spendingCredential: Credential.FromUplcData,
    stakingCredential: Data.Option(Credential.FromUplcData)
  }),
  Address,
  {
    strict: true,
    decode: (data) =>
      Effect.gen(function* () {
        const isMainnet = yield* IsMainnet

        return make(
          isMainnet,
          data.spendingCredential,
          data.stakingCredential._tag == "Some"
            ? data.stakingCredential.value
            : undefined
        )
      }),
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
  const bytes: number[] = toShelleyBytes(
    isMainnet,
    spendingCredential,
    stakingCredential
  )

  const s: string = Bech32.encode(prefix, bytes)

  return s as Address
}

// returns the byte representation of an Address
function toShelleyBytes(
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
  Effect.gen(function* () {
    if (typeof bytes == "string" && bytes.startsWith("addr")) {
      bytes = (yield* Bech32.decode(bytes)).bytes
    }

    const innerBytes = (yield* Cbor.isBytes(bytes))
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
        return yield* Effect.fail(
          new Cbor.DecodeError(
            Bytes.makeStream(bytes),
            `invalid Shelley Address header ${head}`
          )
        )
    }
  })

export const decode = (bytes: Bytes.BytesLike): Cbor.DecodeEffect<Address> =>
  decodeInternal(bytes).pipe(
    Effect.map(({ isMainnet, spendingCredential, stakingCredential }) =>
      make(isMainnet, spendingCredential, stakingCredential)
    ),
    Effect.catchTag(
      "ParseError",
      (e) => new Cbor.DecodeError(Bytes.makeStream(bytes), e.message)
    ),
    Effect.catchTag(
      "DecodeException",
      (e) =>
        new Cbor.DecodeError(
          Bytes.makeStream(bytes),
          `bech32 decoding failed (${e.message})`
        )
    )
  )

export function encode(address: Address): number[] {
  return Cbor.encodeBytes(bytes(address))
}

export function bytes(address: Address): number[] {
  return Effect.runSync(Bech32.decode(address)).bytes
}

export function isMainnet(address: Address): boolean {
  return !address.startsWith("addr_test")
}

export function spendingCredential(address: Address): Credential.Credential {
  return Effect.runSync(decodeInternal(address)).spendingCredential
}

export function stakingCredential(
  address: Address
): Credential.Credential | undefined {
  return Effect.runSync(decodeInternal(address)).stakingCredential
}
