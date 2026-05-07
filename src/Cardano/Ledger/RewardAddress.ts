import { Effect, Either, ParseResult, Schema } from "effect"
import * as Bytes from "../../Codecs/Bytes.js"
import * as Bech32 from "../../Codecs/Bech32.js"
import * as Cbor from "../../Codecs/Cbor.js"
import { IsMainnet } from "../Network/IsMainnet.js"
import * as Data from "../Uplc/Data.js"
import * as Credential from "./Credential.js"
import * as PubKeyHash from "./PubKeyHash.js"
import * as ValidatorHash from "./ValidatorHash.js"

export function isValid(addr: string): boolean {
  if (addr.startsWith("stake")) {
    return Bech32.isValid(addr)
  }

  return false
}

export const RewardAddress = Schema.String.pipe(
  Schema.filter((addr: string) => {
    return isValid(addr) || "Invalid Cardano RewardAddress"
  }),
  Schema.brand("RewardAddress")
)

export type RewardAddress = Schema.Schema.Type<typeof RewardAddress>

export const FromUplcData = Schema.transformOrFail(
  Data.EnumVariant(0, { credential: Credential.FromUplcData }),
  Schema.typeSchema(RewardAddress),
  {
    strict: true,
    decode: ({ credential }) =>
      IsMainnet.pipe(Effect.map((isMainnet) => make(isMainnet, credential))),
    encode: (address: RewardAddress) => {
      const { credential } = Effect.runSync(decodeInternal(address))
      return ParseResult.succeed({ credential })
    }
  }
)

export const script = (vh: ValidatorHash.ValidatorHash) =>
  Effect.gen(function* () {
    const isMainnet = yield* IsMainnet

    return make(isMainnet, Credential.makeValidator(vh))
  })

export function make(
  isMainnet: boolean,
  cred: Credential.Credential
): RewardAddress {
  const prefix = isMainnet ? "stake" : "stake_test"
  const bytes = makeBytes(isMainnet, cred)

  return Bech32.encode(prefix, bytes) as RewardAddress
}

function makeBytes(isMainnet: boolean, cred: Credential.Credential): number[] {
  const credBytes = Bytes.toArray(Credential.bytes(cred))

  if (cred._tag == "PubKey") {
    return [isMainnet ? 0xe1 : 0xe0].concat(credBytes)
  } else {
    return [isMainnet ? 0xf1 : 0xf0].concat(credBytes)
  }
}

const decodeInternal = (bytes: Bytes.BytesLike) =>
  Either.gen(function* () {
    if (typeof bytes == "string" && bytes.startsWith("stake")) {
      bytes = (yield* Bech32.decode(bytes)).bytes
    }

    const innerBytes = Cbor.isBytes(bytes)
      ? yield* Cbor.decodeBytes(bytes)
      : Bytes.toArray(bytes)

    const head = innerBytes[0]

    const mainnet = (head & 0b00001111) != 0

    const type = head & 0b11110000

    const hashBytes = innerBytes.slice(1, 29)

    switch (type) {
      case 0xe0:
        return {
          isMainnet: mainnet,
          credential: Credential.makePubKey(yield* PubKeyHash.make(hashBytes))
        }
      case 0xf0:
        return {
          isMainnet: mainnet,
          credential: Credential.makeValidator(
            yield* ValidatorHash.make(hashBytes)
          )
        }
      default:
        return yield* Either.left(
          new Cbor.DecodeError(
            Bytes.makeStream(bytes),
            `invalid Staking Address header ${head}`
          )
        )
    }
  })

export const decode = (
  bytes: Bytes.BytesLike
): Cbor.DecodeResult<RewardAddress> =>
  decodeInternal(bytes).pipe(
    Either.map(({ isMainnet, credential }) => make(isMainnet, credential)),
    Either.mapLeft((e) => {
      if (e._tag == "ParseError") {
        return new Cbor.DecodeError(
          Bytes.makeStream(bytes),
          `invalid hash (${e.message}`
        )
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

export function encode(addr: RewardAddress): number[] {
  return Cbor.encodeBytes(bytes(addr))
}

export function bytes(address: RewardAddress): number[] {
  return Either.getOrThrow(Bech32.decode(address)).bytes
}

export function isMainnet(address: RewardAddress): boolean {
  return !address.startsWith("stake_test")
}

export function credential(address: RewardAddress): Credential.Credential {
  return Either.getOrThrow(decodeInternal(address)).credential
}

export function compare(a: RewardAddress, b: RewardAddress): number {
  return Bytes.compare(credential(a).hash, credential(b).hash)
}
