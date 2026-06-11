import { describe, expect, it } from "bun:test"
import { Effect, Schema } from "effect"
import * as ZK from "./ZK.js"
import * as Uplc from "./Uplc/index.js"

const verificationKey: ZK.VerificationKey = {
  alphaG1: new Uint8Array([1]),
  betaG2: new Uint8Array([2]),
  gammaG2: new Uint8Array([3]),
  deltaG2: new Uint8Array([4]),
  publicInputsG1: []
}

const provingKey = new Uint8Array([5])

const baseProver: ZK.ProverWithMetadata = {
  name: "test::prove",
  constraints: new Uint8Array([1, 2, 3]),
  inputs: {
    privateInputs: [{ name: "n", type: "UInt64" }],
    witnessInputs: [],
    publicInputs: [{ name: "q", type: "UInt64" }]
  }
}

const proverWithCapturedWitness: ZK.ProverWithMetadata = {
  ...baseProver,
  evaluator: Uplc.Term.encodeRoot(
    "1.1.0",
    {
      _tag: "Lambda",
      body: {
        _tag: "Lambda",
        body: {
          _tag: "Var",
          index: 1,
          capture: "private:n-copy"
        }
      }
    },
    true
  ),
  inputs: {
    ...baseProver.inputs,
    privateInputs: [{ name: "n", type: "UInt64" }],
    witnessInputs: [
      {
        name: "__captured_n",
        type: "UInt64",
        captureId: "private:n-copy"
      }
    ]
  }
}

describe("Cardano.ZK", () => {
  it("encodes binary artifact fields as hex at schema boundaries", () => {
    const prover: ZK.ProverWithMetadata & ZK.ProverWithDerivedKeys = {
      ...baseProver,
      evaluator: new Uint8Array([6]),
      provingKey,
      verificationKey
    }
    const metadataEncoded = Schema.encodeSync(ZK.ProverWithMetadata)(prover)
    const metadataDecoded = Schema.decodeSync(ZK.ProverWithMetadata)(
      metadataEncoded
    )
    const derivedKeysEncoded = Schema.encodeSync(ZK.ProverWithDerivedKeys)(
      prover
    )
    const derivedKeysDecoded = Schema.decodeSync(ZK.ProverWithDerivedKeys)(
      derivedKeysEncoded
    )

    expect(metadataEncoded.constraints).toBe("010203")
    expect(metadataEncoded.evaluator).toBe("06")
    expect(metadataDecoded.constraints).toEqual(new Uint8Array([1, 2, 3]))
    expect(metadataDecoded.evaluator).toEqual(new Uint8Array([6]))
    expect(derivedKeysEncoded.constraints).toBe("010203")
    expect(derivedKeysEncoded.provingKey).toBe("05")
    expect(derivedKeysEncoded.verificationKey.alphaG1).toBe("01")
    expect(derivedKeysDecoded.provingKey).toEqual(new Uint8Array([5]))
    expect(derivedKeysDecoded.verificationKey.alphaG1).toEqual(
      new Uint8Array([1])
    )
  })

  it("encodes recursive input value lists at schema boundaries", () => {
    const inputValues = {
      xs: [1n, 2n]
    }
    const InputValues = Schema.Record({
      key: Schema.String,
      value: ZK.InputValue
    })
    const encoded = Schema.encodeSync(InputValues)(inputValues)
    const decoded = Schema.decodeSync(InputValues)(encoded)

    expect(encoded).toEqual({
      xs: ["1", "2"]
    })
    expect(decoded).toEqual(inputValues)
  })

  it("preserves compiler metadata returned from setup", () => {
    let observedSetupProver: ZK.Prover | undefined
    const engine = makeProofEngine({
      setup: (prover) => {
        observedSetupProver = prover
        return Effect.succeed({
          provingKey,
          verificationKey
        })
      }
    })

    const result = Effect.runSync(
      ZK.setup(proverWithCapturedWitness).pipe(
        Effect.provideService(ZK.ProofEngine, engine)
      )
    )

    expect(observedSetupProver).toEqual(proverWithCapturedWitness)
    expect(result.evaluator).toBe(proverWithCapturedWitness.evaluator)
    expect(result.inputs.witnessInputs).toEqual([
      {
        name: "__captured_n",
        type: "UInt64",
        captureId: "private:n-copy"
      }
    ])
    expect(result.provingKey).toEqual(new Uint8Array([5]))
  })

  it("fills captured witness inputs from evaluator captures", () => {
    let observedProver: ZK.ProverWithDerivedKeys | undefined
    let observedPublicInputs: readonly ZK.InputValue[] | undefined
    let observedPrivateInputs: readonly ZK.InputValue[] | undefined
    const prover: ZK.ProverWithMetadata & ZK.ProverWithDerivedKeys = {
      ...proverWithCapturedWitness,
      provingKey,
      verificationKey
    }
    const engine = makeProofEngine({
      prove: (_prover, publicInputs, privateInputs) => {
        observedProver = _prover
        observedPublicInputs = publicInputs
        observedPrivateInputs = privateInputs
        return Effect.succeed(new Uint8Array([9]))
      }
    })

    const proof = Effect.runSync(
      ZK.prove(prover, { q: 7n }, { n: 22n }).pipe(
        Effect.provideService(ZK.ProofEngine, engine)
      )
    )

    expect(proof).toEqual(new Uint8Array([9]))
    expect(observedProver).toEqual(prover)
    expect(observedPublicInputs).toEqual([7n])
    expect(observedPrivateInputs).toEqual([22n, 22n])
  })

  it("fills captured boolean, byte array and list witness inputs", () => {
    const cases: ReadonlyArray<{
      readonly capturedValue: Uplc.Value.Value
      readonly expected: ZK.InputValue
    }> = [
      {
        capturedValue: true,
        expected: true
      },
      {
        capturedValue: new Uint8Array([0xab]),
        expected: new Uint8Array([0xab])
      },
      {
        capturedValue: {
          itemType: Uplc.Type.Int,
          items: [1n, 2n]
        },
        expected: [1n, 2n]
      }
    ]

    for (const { capturedValue, expected } of cases) {
      let observedPrivateInputs: readonly ZK.InputValue[] | undefined
      const prover: ZK.ProverWithMetadata & ZK.ProverWithDerivedKeys = {
        ...proverWithCapturedValue(capturedValue),
        provingKey,
        verificationKey
      }
      const engine = makeProofEngine({
        prove: (_prover, _publicInputs, privateInputs) => {
          observedPrivateInputs = privateInputs
          return Effect.succeed(new Uint8Array([9]))
        }
      })

      Effect.runSync(
        ZK.prove(prover, { q: 7n }, { n: 22n }).pipe(
          Effect.provideService(ZK.ProofEngine, engine)
        )
      )

      expect(observedPrivateInputs).toEqual([22n, expected])
    }
  })

  it("orders named proof inputs before calling the proof engine", () => {
    let observedPublicInputs: readonly ZK.InputValue[] | undefined
    let observedPrivateInputs: readonly ZK.InputValue[] | undefined
    const prover: ZK.ProverWithMetadata & ZK.ProverWithDerivedKeys = {
      ...baseProver,
      provingKey,
      verificationKey,
      inputs: {
        privateInputs: [
          { name: "p2", type: "UInt64" },
          { name: "p1", type: "UInt64" }
        ],
        witnessInputs: [],
        publicInputs: [
          { name: "q2", type: "UInt64" },
          { name: "q1", type: "UInt64" }
        ]
      }
    }
    const engine = makeProofEngine({
      prove: (_prover, publicInputs, privateInputs) => {
        observedPublicInputs = publicInputs
        observedPrivateInputs = privateInputs
        return Effect.succeed(new Uint8Array([9]))
      }
    })

    Effect.runSync(
      ZK.prove(prover, { q1: 1n, q2: 2n }, { p1: 101n, p2: 202n }).pipe(
        Effect.provideService(ZK.ProofEngine, engine)
      )
    )

    expect(observedPublicInputs).toEqual([2n, 1n])
    expect(observedPrivateInputs).toEqual([202n, 101n])
  })

  it("orders named public inputs before verifying", () => {
    let observedPublicInputs: readonly ZK.InputValue[] | undefined
    const prover: ZK.ProverWithMetadata & ZK.ProverWithDerivedKeys = {
      ...baseProver,
      provingKey,
      verificationKey,
      inputs: {
        ...baseProver.inputs,
        publicInputs: [
          { name: "q2", type: "UInt64" },
          { name: "q1", type: "UInt64" }
        ]
      }
    }
    const engine = makeProofEngine({
      verify: (_prover, publicInputs) => {
        observedPublicInputs = publicInputs
        return Effect.succeed(true)
      }
    })

    const verified = Effect.runSync(
      ZK.verify(prover, { q1: 1n, q2: 2n }, new Uint8Array([9])).pipe(
        Effect.provideService(ZK.ProofEngine, engine)
      )
    )

    expect(verified).toBe(true)
    expect(observedPublicInputs).toEqual([2n, 1n])
  })
})

function makeProofEngine(
  overrides: Partial<ZK.ProofEngineService>
): ZK.ProofEngineService {
  return {
    setup: (_prover) =>
      Effect.succeed({
        provingKey,
        verificationKey
      }),
    prove: () => Effect.succeed(new Uint8Array([])),
    verify: () => Effect.succeed(true),
    ...overrides
  }
}

function proverWithCapturedValue(
  value: Uplc.Value.Value
): ZK.ProverWithMetadata {
  return {
    ...baseProver,
    evaluator: Uplc.Term.encodeRoot(
      "1.1.0",
      {
        _tag: "Lambda",
        body: {
          _tag: "Lambda",
          body: {
            _tag: "Const",
            value,
            capture: "captured"
          }
        }
      },
      true
    ),
    inputs: {
      privateInputs: [{ name: "n", type: "UInt64" }],
      witnessInputs: [
        {
          name: "__captured",
          type: "Any",
          captureId: "captured"
        }
      ],
      publicInputs: [{ name: "q", type: "UInt64" }]
    }
  }
}
