import { Data } from "effect"

export class NativeUnavailable extends Data.TaggedError("NativeUnavailable")<{
  message: string
}> {
  constructor(methodName: string) {
    super({
      message: `Native crypto method '${methodName}' unavailable (hint: use fallback function)`
    })
  }
}
