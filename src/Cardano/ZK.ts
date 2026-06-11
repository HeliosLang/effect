import { Context, Data, Effect, Either, Schema } from "effect"
import * as Uplc from "./Uplc/index.js"

export const fieldModulus =
  52435875175126190479447740508185965837690552500527637822603658699938581184513n

export const ProverInput = Schema.Struct({
  name: Schema.String,
  type: Schema.String
})

export type ProverInput = Schema.Schema.Type<typeof ProverInput>

export const WitnessInput = Schema.extend(
  ProverInput,
  Schema.Struct({
    captureId: Schema.String
  })
)

export type WitnessInput = Schema.Schema.Type<typeof WitnessInput>

export const VerificationKey = Schema.Struct({
  alphaG1: Schema.Uint8ArrayFromHex,
  betaG2: Schema.Uint8ArrayFromHex,
  gammaG2: Schema.Uint8ArrayFromHex,
  deltaG2: Schema.Uint8ArrayFromHex,
  publicInputsG1: Schema.Array(Schema.Uint8ArrayFromHex)
})

export type VerificationKey = Schema.Schema.Type<typeof VerificationKey>

export type InputValue = bigint | boolean | Uint8Array | readonly InputValue[]

export type InputValueList = {
  readonly items: readonly InputValue[]
}

type EncodedInputValue = string | boolean | readonly EncodedInputValue[]

export const InputValue: Schema.Schema<InputValue, EncodedInputValue> =
  Schema.Union(
    Schema.BigInt,
    Schema.Boolean,
    Schema.Uint8ArrayFromHex,
    Schema.Array(
      Schema.suspend(
        (): Schema.Schema<InputValue, EncodedInputValue> => InputValue
      )
    )
  )

/**
 * Describes the public/private inputs required by a prover.
 *
 * This is the part of a prover that callers need in order to construct
 * witnesses, but it does not include constraints, keys, or evaluator metadata.
 *
 * Compiler-v2 emits the circuit so that the proof-engine private input vector is
 * `privateInputs` first, followed by captured `witnessInputs`. Public inputs
 * are prepared independently from `publicInputs`.
 */
export const ProverInputs = Schema.Struct({
  privateInputs: Schema.Array(ProverInput),
  witnessInputs: Schema.Array(WitnessInput),
  publicInputs: Schema.Array(ProverInput)
})

export type ProverInputs = Schema.Schema.Type<typeof ProverInputs>

/**
 * Minimal compiler artifact consumed by a proof engine.
 *
 * This intentionally excludes input metadata and evaluator bytes. Those fields
 * are only needed by this module to prepare positional inputs before calling the
 * proof engine.
 */
export const Prover = Schema.Struct({
  name: Schema.optional(Schema.String),
  constraints: Schema.Uint8ArrayFromHex
})

export type Prover = Schema.Schema.Type<typeof Prover>

/**
 * Compiler artifact with metadata needed to prepare proof inputs.
 *
 * Field roles:
 * - inputs: public, private, and proof-engine witness input interface emitted by
 *   the compiler.
 * - evaluator: verbose latest-version UPLC script bytes used to fill captured
 *   witness inputs before proving.
 */
export const ProverWithMetadata = Schema.extend(
  Prover,
  Schema.Struct({
    evaluator: Schema.optional(Schema.Uint8ArrayFromHex),
    inputs: ProverInputs
  })
)

export type ProverWithMetadata = Schema.Schema.Type<typeof ProverWithMetadata>

/**
 * Minimal proof-engine artifact with derived key material.
 *
 * `provingKey` is used to create proofs for this circuit, while
 * `verificationKey` is public material used to verify those proofs.
 */
export const ProverWithDerivedKeys = Schema.extend(
  Prover,
  Schema.Struct({
    provingKey: Schema.Uint8ArrayFromHex,
    verificationKey: VerificationKey
  })
)

export type ProverWithDerivedKeys = Schema.Schema.Type<
  typeof ProverWithDerivedKeys
>

type DerivedKeys = Pick<ProverWithDerivedKeys, "provingKey" | "verificationKey">

export class MissingWitnessInput extends Data.TaggedError(
  "Cardano.ZK.MissingWitnessInput"
)<{
  readonly message: string
  readonly kind: "public" | "private" | "witness"
  readonly name: string
}> {
  constructor(kind: "public" | "private" | "witness", name: string) {
    super({
      kind,
      name,
      message: `missing ${kind} witness input '${name}'`
    })
  }
}

export class MissingEvaluator extends Data.TaggedError(
  "Cardano.ZK.MissingEvaluator"
)<{ readonly message: string }> {
  constructor() {
    super({
      message: "missing evaluator script for captured witness inputs"
    })
  }
}

export class EvaluatorFailed extends Data.TaggedError(
  "Cardano.ZK.EvaluatorFailed"
)<{ readonly message: string }> {
  constructor(message: string) {
    super({ message })
  }
}

export class MissingCapture extends Data.TaggedError(
  "Cardano.ZK.MissingCapture"
)<{ readonly message: string; readonly captureId: string }> {
  constructor(captureId: string) {
    super({
      captureId,
      message: `missing captured evaluator value '${captureId}'`
    })
  }
}

export class InvalidCapturedValue extends Data.TaggedError(
  "Cardano.ZK.InvalidCapturedValue"
)<{ readonly message: string; readonly captureId: string }> {
  constructor(captureId: string) {
    super({
      captureId,
      message: `captured evaluator value '${captureId}' is not a valid input value`
    })
  }
}

export class InvalidInputValue extends Data.TaggedError(
  "Cardano.ZK.InvalidInputValue"
)<{
  readonly message: string
  readonly kind: "public" | "private" | "witness"
  readonly name: string
}> {
  constructor(kind: "public" | "private" | "witness", name: string) {
    super({
      kind,
      name,
      message: `input '${name}' cannot be converted to a UPLC evaluator argument`
    })
  }
}

export type ZKError =
  | MissingWitnessInput
  | MissingEvaluator
  | EvaluatorFailed
  | MissingCapture
  | InvalidCapturedValue
  | InvalidInputValue

export type ProofEngineService = {
  readonly setup: (prover: Prover) => Effect.Effect<DerivedKeys, ZKError>
  readonly prove: (
    prover: ProverWithDerivedKeys,
    publicInputs: readonly InputValue[],
    privateInputs: readonly InputValue[]
  ) => Effect.Effect<Uint8Array, ZKError>
  readonly verify: (
    prover: ProverWithDerivedKeys,
    publicInputs: readonly InputValue[],
    proof: Uint8Array
  ) => Effect.Effect<boolean, ZKError>
}

export class ProofEngine extends Context.Tag("Cardano.ZK.ProofEngine")<
  ProofEngine,
  ProofEngineService
>() {}

export const setup = (
  prover: ProverWithMetadata
): Effect.Effect<
  ProverWithMetadata & ProverWithDerivedKeys,
  ZKError,
  ProofEngine
> =>
  Effect.gen(function* () {
    const engine = yield* ProofEngine
    const keys = yield* engine.setup(prover)

    return {
      ...prover,
      ...keys
    }
  })

export const prove = (
  prover: ProverWithMetadata & ProverWithDerivedKeys,
  publicInputs: Record<string, InputValue>,
  privateInputs: Record<string, InputValue>
): Effect.Effect<Uint8Array, ZKError, ProofEngine> =>
  Effect.gen(function* () {
    const engine = yield* ProofEngine

    const positionalPublicInputs: InputValue[] = []

    for (const { name } of prover.inputs.publicInputs) {
      const publicInput = publicInputs[name]

      if (publicInput === undefined) {
        return yield* Effect.fail(new MissingWitnessInput("public", name))
      }

      positionalPublicInputs.push(publicInput)
    }

    const positionalPrivateInputs: InputValue[] = []

    for (const { name } of prover.inputs.privateInputs) {
      const privateInput = privateInputs[name]
      if (privateInput === undefined) {
        return yield* Effect.fail(new MissingWitnessInput("private", name))
      }

      positionalPrivateInputs.push(privateInput)
    }

    if (prover.inputs.witnessInputs.length > 0) {
      const captured = yield* evaluate(
        prover,
        positionalPublicInputs,
        positionalPrivateInputs
      )

      for (const input of prover.inputs.witnessInputs) {
        const captureId = input.captureId

        const capturedWitnessInput = captured[captureId]

        if (capturedWitnessInput === undefined) {
          return yield* Effect.fail(
            new MissingWitnessInput("witness", captureId)
          )
        }

        positionalPrivateInputs.push(capturedWitnessInput)
      }
    }

    return yield* engine.prove(
      prover,
      positionalPublicInputs,
      positionalPrivateInputs
    )
  })

export const verify = (
  prover: ProverWithMetadata & ProverWithDerivedKeys,
  publicInputs: Record<string, InputValue>,
  proof: Uint8Array
): Effect.Effect<boolean, ZKError, ProofEngine> =>
  Effect.gen(function* () {
    const engine = yield* ProofEngine

    const positionalPublicInputs: InputValue[] = []

    for (const { name } of prover.inputs.publicInputs) {
      const publicInput = publicInputs[name]
      if (publicInput === undefined) {
        return yield* Effect.fail(new MissingWitnessInput("public", name))
      }

      positionalPublicInputs.push(publicInput)
    }

    return yield* engine.verify(prover, positionalPublicInputs, proof)
  })

const evaluate = (
  prover: ProverWithMetadata,
  publicInputs: InputValue[],
  privateInputs: InputValue[]
) =>
  Effect.gen(function* () {
    const evaluator = prover.evaluator

    if (evaluator === undefined) {
      return yield* Effect.fail(new MissingEvaluator())
    }

    const args: Uplc.Value.Value[] = [
      ...publicInputs.map(inputValueToUplcValue),
      ...privateInputs.map(inputValueToUplcValue)
    ]

    const result = yield* Uplc.Script.eval(
      {
        version: 3,
        root: evaluator
      },
      args
    ).pipe(
      Effect.mapError(
        (error) =>
          new EvaluatorFailed(
            error instanceof Error ? error.message : String(error)
          )
      )
    )

    if (Either.isLeft(result.value)) {
      return yield* Effect.fail(new EvaluatorFailed(result.value.left.error))
    }

    const capturedWitnessValue: Record<string, InputValue> = {}

    for (const { id, value } of result.capturedValues) {
      if (value._tag != "Const") {
        throw new Error("Unexpected captured Cek frame")
      }

      capturedWitnessValue[id] = uplcValueToInputValue(value.value)
    }

    return capturedWitnessValue
  })

function inputValueToUplcValue(inputValue: InputValue): Uplc.Value.Value {
  if (typeof inputValue == "bigint") {
    return inputValue
  } else if (typeof inputValue == "boolean") {
    return inputValue
  } else if (inputValue instanceof Uint8Array) {
    return inputValue
  } else {
    const items = inputValue.map(inputValueToUplcValue)

    if (items.length == 0) {
      throw new Error("Expected lists to contain at least 1 entry")
    }

    return {
      itemType: Uplc.Value.toType(items[0]),
      items
    }
  }
}

function uplcValueToInputValue(uplcValue: Uplc.Value.Value): InputValue {
  if (typeof uplcValue == "bigint") {
    return uplcValue
  } else if (typeof uplcValue == "boolean") {
    return uplcValue
  } else if (uplcValue instanceof Uint8Array) {
    return uplcValue
  } else if (
    uplcValue !== null &&
    typeof uplcValue == "object" &&
    "items" in uplcValue
  ) {
    return uplcValue.items.map(uplcValueToInputValue)
  } else {
    throw new Error("Unsupported UplcValue to InputValue conversion")
  }
}
