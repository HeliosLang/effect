import { Either, Schema } from "effect"
import * as Bytes from "../../Codecs/Bytes.js"
import * as Cbor from "../../Codecs/Cbor.js"
import * as Data from "../Uplc/Data.js"
import * as Credential from "./Credential.js"
import * as PubKeyHash from "./PubKeyHash.js"
import * as ValidatorHash from "./ValidatorHash.js"

export type Registration = {
  _tag: "Registration"
  credential: Credential.Credential
}

export type Deregistration = {
  _tag: "Deregistration"
  credential: Credential.Credential
}

export type Delegation = {
  _tag: "Delegation"
  credential: Credential.Credential
  poolId: PubKeyHash.PubKeyHash
}

export type RegisterPool = {
  _tag: "RegisterPool"
  id: PubKeyHash.PubKeyHash
  vrf: PubKeyHash.PubKeyHash
  pledge: bigint
  margin: number
  //rewardAccount: any // TODO
  owners: readonly PubKeyHash.PubKeyHash[]
  //relays: any[] // TODO
  //metadata?: any // TODO
}

export type RetirePool = {
  _tag: "RetirePool"
  poolId: PubKeyHash.PubKeyHash
  epoch: number
}

export type DCert =
  | Registration
  | Deregistration
  | Delegation
  | RegisterPool
  | RetirePool

export const FromUplcData: Schema.Schema<DCert, Data.Data> = Data.Enum({
  Registration: {
    credential: Credential.FromUplcData
  },
  Deregistration: {
    credential: Credential.FromUplcData
  },
  Delegation: {
    credential: Credential.FromUplcData,
    poolId: PubKeyHash.FromUplcData
  },
  RegisterPool: {
    id: PubKeyHash.FromUplcData,
    vrf: PubKeyHash.FromUplcData,
    pledge: Data.BigInt,
    margin: Data.Int,
    owners: Data.Array(PubKeyHash.FromUplcData)
  },
  RetirePool: {
    poolId: PubKeyHash.FromUplcData,
    epoch: Data.Int
  }
})

export const decode = (bytes: Bytes.BytesLike): Cbor.DecodeResult<DCert> =>
  Either.gen(function* () {
    const stream = Bytes.makeStream(bytes)

    const [tag, decodeItem] = yield* Cbor.decodeTagged(stream)

    switch (tag) {
      case 0:
        return {
          _tag: "Registration",
          credential: yield* decodeItem(Credential.decode)
        }
      case 1:
        return {
          _tag: "Deregistration",
          credential: yield* decodeItem(Credential.decode)
        }
      case 2:
        return {
          _tag: "Delegation",
          credential: yield* decodeItem(Credential.decode),
          poolId: yield* decodeItem(PubKeyHash.decode)
        }
      default:
        return yield* Either.left(
          new Cbor.DecodeError(stream, `unhandled tag '${tag}'`)
        )
    }
  })

export function encode(dcert: DCert): number[] {
  switch (dcert._tag) {
    case "Registration":
      return Cbor.encodeTuple([
        Cbor.encodeInt(0),
        Credential.encode(dcert.credential)
      ])
    case "Deregistration":
      return Cbor.encodeTuple([
        Cbor.encodeInt(1),
        Credential.encode(dcert.credential)
      ])
    case "Delegation":
      return Cbor.encodeTuple([
        Cbor.encodeInt(2),
        Credential.encode(dcert.credential),
        PubKeyHash.encode(dcert.poolId)
      ])
    case "RegisterPool":
      throw new Error("not yet implemented")
    case "RetirePool":
      return Cbor.encodeTuple([
        Cbor.encodeInt(4),
        PubKeyHash.encode(dcert.poolId),
        Cbor.encodeInt(dcert.epoch)
      ])
  }
}

export function equals(a: DCert, b: DCert): boolean {
  if (a._tag == "Delegation" && b._tag == "Delegation") {
    return Credential.equals(a.credential, b.credential) && a.poolId == b.poolId
  } else if (a._tag == "Deregistration" && b._tag == "Deregistration") {
    return Credential.equals(a.credential, b.credential)
  } else if (a._tag == "RegisterPool" && b._tag == "RegisterPool") {
    // I don't think we have to check equality of the pool parameters because only one pool with a given id can be registered at a time, and this equality check is mainly used for that
    return a.id == b.id
  } else if (a._tag == "Registration" && b._tag == "Registration") {
    return Credential.equals(a.credential, b.credential)
  } else if (a._tag == "RetirePool" && b._tag == "RetirePool") {
    return a.poolId == b.poolId
  } else {
    return false
  }
}

export function validatorHash(dcert: DCert): ValidatorHash.ValidatorHash {
  switch (dcert._tag) {
    case "Registration":
    case "Deregistration":
    case "Delegation": {
      if (dcert.credential._tag != "Validator") {
        throw new Error(`${dcert._tag} dcert not controlled by script`)
      }

      return dcert.credential.hash
    }
    default:
      throw new Error(`${dcert._tag} not controlled by script`)
  }
}
