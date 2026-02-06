import { Schema } from "effect"

/**
 * TODO: more accurate test
 * @param s 
 * @returns 
 */
export function isValid(s: string): s is Type {
    return /^[0-1]+$/.test(s) && s.length >= 4
}

export const Type = Schema.String.pipe(
  Schema.filter((s: string) => isValid(s) || "Invalid Uplc Type bits"),
  Schema.brand("UplcType")
)

export type Type = Schema.Schema.Type<typeof Type>

export const Bool = "0100" as Type

export const ByteArray = "0001" as Type

export const Data = "1000" as Type

export const Int = "0000" as Type

export const String = "0010" as Type

export const Unit = "0011" as Type

export const Bls12_381_G1Element = "1001" as Type

export const Bls12_381_G2Element = "1010" as Type

export const Bls12_381_MlResult =  "1011" as Type

const ContainerHead = "0111" as Type

const ListHead = "0101" as const

export function List(item: Type): Type {
    return [
        ContainerHead,
        ListHead,
        item
    ].join("1") as Type
}

const PairHead = "0110" as const

export function Pair(first: Type, second: Type): Type {
    return [
        ContainerHead,
        ContainerHead,
        PairHead,
        first,
        second
    ].join("1") as Type
}

export const DataPair = /* @__PURE__ */ Pair(Data, Data)

export const DataMap = /* @__PURE__ */ List(DataPair)

/**
 * Stack-based algorithm
 * @param t 
 * @returns 
 */
export function toString(t: Type): string {
    const stack: string[] = []

        function popBits() {
            const b = t.slice(0, 4)
            t = t.slice(5) as Type
            return b
        }

        while (t.length > 0) {
            let b = popBits()

            switch (b) {
                case Int:
                    stack.push("integer")
                    break
                case ByteArray:
                    stack.push("bytestring")
                    break
                case String:
                    stack.push("string")
                    break
                case Unit:
                    stack.push("unit")
                    break
                case Bool:
                    stack.push("bool")
                    break
                case Data:
                    stack.push("data")
                    break
                case Bls12_381_G1Element:
                    stack.push("bls12_381_G1_element")
                    break
                case Bls12_381_G2Element:
                    stack.push("bls12_381_G2_element")
                    break
                case Bls12_381_MlResult:
                    stack.push("bls12_381_mlresult")
                    break
                case ContainerHead: {
                    b = popBits()

                    switch (b) {
                        case ContainerHead: {
                            b = popBits()

                            if (b != PairHead) {
                                throw new Error("invalid Uplc.Type")
                            } else {
                                stack.push("pair")
                            }
                            break
                        }
                        case ListHead:
                            stack.push("list")
                            break
                        default:
                            throw new Error(
                                `invalid Uplc.Type ${t}`
                            )
                    }
                    break
                }
                default:
                    throw new Error("invalid UplcType")
            }
        }

        function stackToString(stack: string[]): [string, string[]] {
            const head = stack[0]
            const tail = stack.slice(1)

            switch (head) {
                case "integer":
                case "bytestring":
                case "string":
                case "unit":
                case "bool":
                case "data":
                case "bls12_381_G1_element":
                case "bls12_381_G2_element":
                case "bls12_381_mlresult":
                    return [head, tail]
                case "list": {
                    const [item, rest] = stackToString(tail)
                    return [`(list ${item})`, rest]
                }
                case "pair": {
                    const [first, rest1] = stackToString(tail)
                    const [second, rest2] = stackToString(rest1)

                    return [`(pair ${first} ${second})`, rest2]
                }
                default:
                    throw new Error(`unhandled Uplc.Type ${head}`)
            }
        }

        const [result, rest] = stackToString(stack)

        if (rest.length != 0) {
            throw new Error("invalid Uplc.Type")
        }

        return result
}