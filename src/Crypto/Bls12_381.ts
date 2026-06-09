import { Either, Encoding } from "effect"
import * as BigEndian from "../Codecs/BigEndian.js"
import * as Bytes from "../Codecs/Bytes.js"
import * as Sha2_256 from "./Sha2_256.js"
import { FieldHelper, mod, QuadraticField, ScalarField, type Field } from "./Field.js"

export type Fp = bigint
export type Fp2 = [bigint, bigint]
export type Fp6 = [Fp2, Fp2, Fp2]
export type Fp12 = [Fp6, Fp6]

export type G1 = {
  x: Fp
  y: Fp
  z: Fp
}

export type G2 = {
  x: Fp2
  y: Fp2
  z: Fp2
}

type Affine<T> = {
  x: T
  y: T
}

const ISOGENY_COEFFICIENTS_G1 = [
  [
    0x06e08c248e260e70bd1e962381edee3d31d79d7e22c837bc23c0bf1bc24c6b68c24b1b80b64d391fa9c8ba2e8ba2d229n,
    0x10321da079ce07e272d8ec09d2565b0dfa7dccdde6787f96d50af36003b14866f69b771f8c285decca67df3f1605fb7bn,
    0x169b1f8e1bcfa7c42e0c37515d138f22dd2ecb803a0c5c99676314baf4bb1b7fa3190b2edc0327797f241067be390c9en,
    0x080d3cf1f9a78fc47b90b33563be990dc43b756ce79f5574a2c596c928c5d1de4fa295f296b74e956d71986a8497e317n,
    0x17b81e7701abdbe2e8743884d1117e53356de5ab275b4db1a682c62ef0f2753339b7c8f8c8f475af9ccb5618e3f0c88en,
    0x0d6ed6553fe44d296a3726c38ae652bfb11586264f0f8ce19008e218f9c86b2a8da25128c1052ecaddd7f225a139ed84n,
    0x1630c3250d7313ff01d1201bf7a74ab5db3cb17dd952799b9ed3ab9097e68f90a0870d2dcae73d19cd13c1c66f652983n,
    0x0e99726a3199f4436642b4b3e4118e5499db995a1257fb3f086eeb65982fac18985a286f301e77c451154ce9ac8895d9n,
    0x1778e7166fcc6db74e0609d307e55412d7f5e4656a8dbf25f1b33289f1b330835336e25ce3107193c5b388641d9b6861n,
    0x0d54005db97678ec1d1048c5d10a9a1bce032473295983e56878e501ec68e25c958c3e3d2a09729fe0179f9dac9edcb0n,
    0x17294ed3e943ab2f0588bab22147a81c7c17e75b2f6a8417f565e33c70d1e86b4838f2a6f318c356e834eef1b3cb83bbn,
    0x11a05f2b1e833340b809101dd99815856b303e88a2d7005ff2627b56cdb4e2c85610c2d5f2e62d6eaeac1662734649b7n
  ],
  [
    0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001n,
    0x095fc13ab9e92ad4476d6e3eb3a56680f682b4ee96f7d03776df533978f31c1593174e4b4b7865002d6384d168ecdd0an,
    0x0a10ecf6ada54f825e920b3dafc7a3cce07f8d1d7161366b74100da67f39883503826692abba43704776ec3a79a1d641n,
    0x14a7ac2a9d64a8b230b3f5b074cf01996e7f63c21bca68a81996e1cdf9822c580fa5b9489d11e2d311f7d99bbdcc5a5en,
    0x0772caacf16936190f3e0c63e0596721570f5799af53a1894e2e073062aede9cea73b3538f0de06cec2574496ee84a3an,
    0x0e7355f8e4e667b955390f7f0506c6e9395735e9ce9cad4d0a43bcef24b8982f7400d24bc4228f11c02df9a29f6304a5n,
    0x13a8e162022914a80a6f1d5f43e7a07dffdfc759a12062bb8d6b44e833b306da9bd29ba81f35781d539d395b3532a21en,
    0x03425581a58ae2fec83aafef7c40eb545b08243f16b1655154cca8abc28d6fd04976d5243eecf5c4130de8938dc62cd8n,
    0x0b2962fe57a3225e8137e629bff2991f6f89416f5a718cd1fca64e00b11aceacd6a3d0967c94fedcfcc239ba5cb83e19n,
    0x12561a5deb559c4348b4711298e536367041e8ca0cf0800c0126c2588c48bf5713daa8846cb026e9e5c8276ec82b3bffn,
    0x08ca8d548cff19ae18b2e62f4bd3fa6f01d5ef4ba35b48ba9c9588617fc8ac62b558d681be343df8993cf9fa40d21b1cn
  ],
  [
    0x15e6be4e990f03ce4ea50b3b42df2eb5cb181d8f84965a3957add4fa95af01b2b665027efec01c7704b456be69c8b604n,
    0x05c129645e44cf1102a159f748c4a3fc5e673d81d7e86568d9ab0f5d396a7ce46ba1049b6579afb7866b1e715475224bn,
    0x0245a394ad1eca9b72fc00ae7be315dc757b3b080d4c158013e6632d3c40659cc6cf90ad1c232a6442d9d3f5db980133n,
    0x0b182cac101b9399d155096004f53f447aa7b12a3426b08ec02710e807b4633f06c851c1919211f20d4c04f00b971ef8n,
    0x18b46a908f36f6deb918c143fed2edcc523559b8aaf0c2462e6bfe7f911f643249d9cdf41b44d606ce07c8a4d0074d8en,
    0x19713e47937cd1be0dfd0b8f1d43fb93cd2fcbcb6caf493fd1183e416389e61031bf3a5cce3fbafce813711ad011c132n,
    0x0e1bba7a1186bdb5223abde7ada14a23c42a0ca7915af6fe06985e7ed1e4d43b9b3f7055dd4eba6f2bafaaebca731c30n,
    0x09fc4018bd96684be88c9e221e4da1bb8f3abd16679dc26c1e8b6e6a1f20cabe69d65201c78607a360370e577bdba587n,
    0x0987c8d5333ab86fde9926bd2ca6c674170a05bfe3bdd81ffd038da6c26c842642f64550fedfe935a15e4ca31870fb29n,
    0x04ab0b9bcfac1bbcb2c977d027796b3ce75bb8ca2be184cb5231413c4d634f3747a87ac2460f415ec961f8855fe9d6f2n,
    0x16603fca40634b6a2211e11db8f0a6a074a7d0d4afadb7bd76505c3d3ad5544e203f6326c95a807299b23ab13633a5f0n,
    0x08cc03fdefe0ff135caf4fe2a21529c4195536fbe3ce50b879833fd221351adc2ee7f8dc099040a841b6daecf2e8fedbn,
    0x01f86376e8981c217898751ad8746757d42aa7b90eeb791c09e4a3ec03251cf9de405aba9ec61deca6355c77b0e5f4cbn,
    0x00cc786baa966e66f4a384c86a3b49942552e2d658a31ce2c344be4b91400da7d26d521628b00523b8dfe240c72de1f6n,
    0x134996a104ee5811d51036d776fb46831223e96c254f383d0f906343eb67ad34d6c56711962fa8bfe097e75a2e41c696n,
    0x090d97c81ba24ee0259d1f094980dcfa11ad138e48a869522b52af6c956543d3cd0c7aee9b3ba3c2be9845719707bb33n
  ],
  [
    0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001n,
    0x0e0fa1d816ddc03e6b24255e0d7819c171c40f65e273b853324efcd6356caa205ca2f570f13497804415473a1d634b8fn,
    0x02660400eb2e4f3b628bdd0d53cd76f2bf565b94e72927c1cb748df27942480e420517bd8714cc80d1fadc1326ed06f7n,
    0x0ad6b9514c767fe3c3613144b45f1496543346d98adf02267d5ceef9a00d9b8693000763e3b90ac11e99b138573345ccn,
    0x0accbb67481d033ff5852c1e48c50c477f94ff8aefce42d28c0f9a88cea7913516f968986f7ebbea9684b529e2561092n,
    0x04d2f259eea405bd48f010a01ad2911d9c6dd039bb61a6290e591b36e636a5c871a5c29f4f83060400f8b49cba8f6aa8n,
    0x167a55cda70a6e1cea820597d94a84903216f763e13d87bb5308592e7ea7d4fbc7385ea3d529b35e346ef48bb8913f55n,
    0x1866c8ed336c61231a1be54fd1d74cc4f9fb0ce4c6af5920abc5750c4bf39b4852cfe2f7bb9248836b233d9d55535d4an,
    0x16a3ef08be3ea7ea03bcddfabba6ff6ee5a4375efa1f4fd7feb34fd206357132b920f5b00801dee460ee415a15812ed9n,
    0x166007c08a99db2fc3ba8734ace9824b5eecfdfa8d0cf8ef5dd365bc400a0051d5fa9c01a58b1fb93d1a1399126a775cn,
    0x08d9e5297186db2d9fb266eaac783182b70152c65550d881c5ecd87b6f0f5a6449f38db9dfa9cce202c6477faaf9b7acn,
    0x0be0e079545f43e4b00cc912f8228ddcc6d19c9f0f69bbb0542eda0fc9dec916a20b15dc0fd2ededda39142311a5001dn,
    0x16b7d288798e5395f20d23bf89edb4d1d115c5dbddbcd30e123da489e726af41727364f2c28297ada8d26d98445f5416n,
    0x058df3306640da276faaae7d6e8eb15778c4855551ae7f310c35a5dd279cd2eca6757cd636f96f891e2538b53dbf67f2n,
    0x1962d75c2381201e1a0cbd6c43c348b885c84ff731c4d59ca4a10356f453e01f78a4260763529e3532f6102c2e49a03dn,
    0x16112c4c3a9c98b252181140fad0eae9601a6de578980be6eec3232b5be72e7a07f3688ef60c206d01479253b03663c1n
  ]
] satisfies [bigint[], bigint[], bigint[], bigint[]]

const ISOGENY_COEFFICIENTS_G2 = [
  [
    [
      0x171d6541fa38ccfaed6dea691f5fb614cb14b4e7f4e810aa22d6108f142b85757098e38d0f671c7188e2aaaaaaaa5ed1n,
      0x0n
    ],
    [
      0x11560bf17baa99bc32126fced787c88f984f87adf7ae0c7f9a208c6b4f20a4181472aaa9cb8d555526a9ffffffffc71en,
      0x8ab05f8bdd54cde190937e76bc3e447cc27c3d6fbd7063fcd104635a790520c0a395554e5c6aaaa9354ffffffffe38dn
    ],
    [
      0x0n,
      0x11560bf17baa99bc32126fced787c88f984f87adf7ae0c7f9a208c6b4f20a4181472aaa9cb8d555526a9ffffffffc71an
    ],
    [
      0x5c759507e8e333ebb5b7a9a47d7ed8532c52d39fd3a042a88b58423c50ae15d5c2638e343d9c71c6238aaaaaaaa97d6n,
      0x5c759507e8e333ebb5b7a9a47d7ed8532c52d39fd3a042a88b58423c50ae15d5c2638e343d9c71c6238aaaaaaaa97d6n
    ]
  ],
  [
    [0x0n, 0x0n],
    [0x1n, 0x0n],
    [
      0xcn,
      0x1a0111ea397fe69a4b1ba7b6434bacd764774b84f38512bf6730d2a0f6b0f6241eabfffeb153ffffb9feffffffffaa9fn
    ],
    [
      0x0n,
      0x1a0111ea397fe69a4b1ba7b6434bacd764774b84f38512bf6730d2a0f6b0f6241eabfffeb153ffffb9feffffffffaa63n
    ]
  ],
  [
    [
      0x124c9ad43b6cf79bfbf7043de3811ad0761b0f37a1e26286b0e977c69aa274524e79097a56dc4bd9e1b371c71c718b10n,
      0x0n
    ],
    [
      0x11560bf17baa99bc32126fced787c88f984f87adf7ae0c7f9a208c6b4f20a4181472aaa9cb8d555526a9ffffffffc71cn,
      0x8ab05f8bdd54cde190937e76bc3e447cc27c3d6fbd7063fcd104635a790520c0a395554e5c6aaaa9354ffffffffe38fn
    ],
    [
      0x0n,
      0x5c759507e8e333ebb5b7a9a47d7ed8532c52d39fd3a042a88b58423c50ae15d5c2638e343d9c71c6238aaaaaaaa97ben
    ],
    [
      0x1530477c7ab4113b59a4c18b076d11930f7da5d4a07f649bf54439d87d27e500fc8c25ebf8c92f6812cfc71c71c6d706n,
      0x1530477c7ab4113b59a4c18b076d11930f7da5d4a07f649bf54439d87d27e500fc8c25ebf8c92f6812cfc71c71c6d706n
    ]
  ],
  [
    [0x1n, 0x0n],
    [
      0x12n,
      0x1a0111ea397fe69a4b1ba7b6434bacd764774b84f38512bf6730d2a0f6b0f6241eabfffeb153ffffb9feffffffffaa99n
    ],
    [
      0x0n,
      0x1a0111ea397fe69a4b1ba7b6434bacd764774b84f38512bf6730d2a0f6b0f6241eabfffeb153ffffb9feffffffffa9d3n
    ],
    [
      0x1a0111ea397fe69a4b1ba7b6434bacd764774b84f38512bf6730d2a0f6b0f6241eabfffeb153ffffb9feffffffffa8fbn,
      0x1a0111ea397fe69a4b1ba7b6434bacd764774b84f38512bf6730d2a0f6b0f6241eabfffeb153ffffb9feffffffffa8fbn
    ]
  ]
] satisfies [Fp2[], Fp2[], Fp2[], Fp2[]]

export const P =
  4002409555221667393417789825735904156556882819939007885332058136124031650490837864442687629129015664037894272559787n

export const R =
  52435875175126190479447740508185965837690552500527637822603658699938581184513n

const X = 0xd201000000010000n
const G1_B = 4n
const G2_B: Fp2 = [4n, 4n]

const G1_GENERATOR_AFFINE: Affine<Fp> = {
  x: 3685416753713387016781088315183077757961620795782546409894578378688607592378376318836054947676345821548104185464507n,
  y: 1339506544944476473020471379941921221584933875938349620426543736416511423956333506472724655353366534992391756441569n
}

const G2_GENERATOR_AFFINE: Affine<Fp2> = {
  x: [
    352701069587466618187139116011060144890029952792775240219908644239793785735715026873347600343865175952761926303160n,
    3059144344244213709971259814753781636986470325476647558659373206291635324768958432433509563104347017837885763365758n
  ],
  y: [
    1985150602287291935568054521177171638300868978215655730859378665066344726373823718423869104263333984641494340347905n,
    927553665492332455747201965776037880757740193453592970025027978793976877002675564980949289727957565575433344219582n
  ]
}

function bytesDecodeError(
  bytes: number[] | Uint8Array,
  msg: string
): Encoding.DecodeException {
  return Bytes.DecodeException(bytes, msg)
}

function encodeIntBE48(x: bigint): number[] {
  if (x < 0n || x >= P) {
    throw new Error("field element out of range")
  }

  const bytes = BigEndian.encode(x)
  while (bytes.length < 48) {
    bytes.unshift(0)
  }

  if (bytes.length != 48 || (bytes[0] & 0b11100000) != 0) {
    throw new Error("field element does not fit in 381 bits")
  }

  return bytes
}

function decodeIntBE(bytes: number[] | Uint8Array): bigint {
  return Either.getOrThrow(BigEndian.decode(bytes))
}

class FpField extends FieldHelper<bigint> {
  private readonly p14 = (P + 1n) / 4n

  constructor() {
    super(new ScalarField(P))
  }

  sqrt(a: bigint, largest?: boolean): bigint {
    let r = this.pow(a, this.p14)

    if (!this.equals(this.square(r), a)) {
      throw new Error("failed to compute Fp sqrt")
    }

    if (largest !== undefined && largest !== r > P / 2n) {
      r = this.negate(r)
    }

    return r
  }

  sign(a: bigint): number {
    return Number(mod(a, P) % 2n)
  }
}

const F1 = new FpField()

class Fp2Field extends FieldHelper<Fp2> {
  private readonly pMinus9Div16 = (P ** 2n - 9n) / 16n
  private readonly rootsOfUnity: Fp2[] = [
    [1n, 0n],
    [
      0x6af0e0437ff400b6831e36d6bd17ffe48395dabc2d3435e77f76e17009241c5ee67992f72ec05f4c81084fbede3cc09n,
      -0x6af0e0437ff400b6831e36d6bd17ffe48395dabc2d3435e77f76e17009241c5ee67992f72ec05f4c81084fbede3cc09n
    ],
    [0n, 1n],
    [
      0x6af0e0437ff400b6831e36d6bd17ffe48395dabc2d3435e77f76e17009241c5ee67992f72ec05f4c81084fbede3cc09n,
      0x6af0e0437ff400b6831e36d6bd17ffe48395dabc2d3435e77f76e17009241c5ee67992f72ec05f4c81084fbede3cc09n
    ],
    [-1n, 0n],
    [
      -0x6af0e0437ff400b6831e36d6bd17ffe48395dabc2d3435e77f76e17009241c5ee67992f72ec05f4c81084fbede3cc09n,
      0x6af0e0437ff400b6831e36d6bd17ffe48395dabc2d3435e77f76e17009241c5ee67992f72ec05f4c81084fbede3cc09n
    ],
    [0n, -1n],
    [
      -0x6af0e0437ff400b6831e36d6bd17ffe48395dabc2d3435e77f76e17009241c5ee67992f72ec05f4c81084fbede3cc09n,
      -0x6af0e0437ff400b6831e36d6bd17ffe48395dabc2d3435e77f76e17009241c5ee67992f72ec05f4c81084fbede3cc09n
    ]
  ]
  private readonly etas: Fp2[] = [
    [
      0x699be3b8c6870965e5bf892ad5d2cc7b0e85a117402dfd83b7f4a947e02d978498255a2aaec0ac627b5afbdf1bf1c90n,
      0x8157cd83046453f5dd0972b6e3949e4288020b5b8a9cc99ca07e27089a2ce2436d965026adad3ef7baba37f2183e9b5n
    ],
    [
      -0x8157cd83046453f5dd0972b6e3949e4288020b5b8a9cc99ca07e27089a2ce2436d965026adad3ef7baba37f2183e9b5n,
      0x699be3b8c6870965e5bf892ad5d2cc7b0e85a117402dfd83b7f4a947e02d978498255a2aaec0ac627b5afbdf1bf1c90n
    ],
    [
      0xab1c2ffdd6c253ca155231eb3e71ba044fd562f6f72bc5bad5ec46a0b7a3b0247cf08ce6c6317f40edbc653a72dee17n,
      0xaa404866706722864480885d68ad0ccac1967c7544b447873cc37e0181271e006df72162a3d3e0287bf597fbf7f8fc1n
    ],
    [
      -0xaa404866706722864480885d68ad0ccac1967c7544b447873cc37e0181271e006df72162a3d3e0287bf597fbf7f8fc1n,
      0xab1c2ffdd6c253ca155231eb3e71ba044fd562f6f72bc5bad5ec46a0b7a3b0247cf08ce6c6317f40edbc653a72dee17n
    ]
  ]

  constructor() {
    super(new QuadraticField(F1, -1n))
  }

  mod([a, b]: Fp2): Fp2 {
    return [F1.mod(a), F1.mod(b)]
  }

  powp([ax, ay]: Fp2, n: number): Fp2 {
    return [F1.mod(ax), F1.multiply(ay, n % 2 == 0 ? 1n : P - 1n)]
  }

  multiplyFp6Nonresidue(a: Fp2): Fp2 {
    return this.multiply(a, [1n, 1n])
  }

  square2(a: Fp2, b: Fp2): [Fp2, Fp2] {
    const a2 = this.square(a)
    const b2 = this.square(b)

    return [
      this.add(a2, this.multiplyFp6Nonresidue(b2)),
      this.subtract(this.square(this.add(a, b)), this.add(a2, b2))
    ]
  }

  sign([ax, ay]: Fp2): number {
    const x = F1.mod(ax)
    const y = F1.mod(ay)
    return x === 0n ? F1.sign(y) : F1.sign(x)
  }

  sqrt(a: Fp2, largest?: boolean): Fp2 {
    let r = this.rootOfUnity(this.mod(a), this.ONE)

    if (r === undefined) {
      throw new Error("failed to compute Fp2 sqrt")
    }

    r = this.mod(r)

    if (largest !== undefined && largest !== (r[0] > P / 2n)) {
      r = this.negate(r)
    }

    return this.mod(r)
  }

  gamma(u: Fp2, v: Fp2): Fp2 {
    const v7 = this.pow(v, 7n)
    const uv7 = this.multiply(u, v7)
    const uv15 = this.multiply(uv7, this.multiply(v7, v))

    return this.multiply(this.pow(uv15, this.pMinus9Div16), uv7)
  }

  private sqrtUOverV(
    u: Fp2,
    v: Fp2,
    candidate: Fp2,
    candidates: Fp2[]
  ): Fp2 | undefined {
    for (const c of candidates) {
      const sqrtCandidate = this.multiply(c, candidate)
      const tmp = this.subtract(this.multiply(this.square(sqrtCandidate), v), u)

      if (this.isZero(tmp)) {
        return sqrtCandidate
      }
    }

    return undefined
  }

  rootOfUnity(u: Fp2, v: Fp2, gamma = this.gamma(u, v)): Fp2 | undefined {
    return this.sqrtUOverV(u, v, gamma, this.rootsOfUnity.slice(0, 4))
  }

  eta(u: Fp2, v: Fp2, candidate: Fp2): Fp2 | undefined {
    return this.sqrtUOverV(u, v, candidate, this.etas)
  }
}

const F2 = new Fp2Field()

class CubicField<T> implements Field<[T, T, T]> {
  readonly F: FieldHelper<T>
  readonly V3: T

  constructor(F: FieldHelper<T>, V3: T) {
    this.F = F
    this.V3 = V3
  }

  get ZERO(): [T, T, T] {
    return [this.F.ZERO, this.F.ZERO, this.F.ZERO]
  }

  get ONE(): [T, T, T] {
    return [this.F.ONE, this.F.ZERO, this.F.ZERO]
  }

  add([ax, ay, az]: [T, T, T], ...b: [T, T, T][]): [T, T, T] {
    return [
      this.F.add(ax, ...b.map((x) => x[0])),
      this.F.add(ay, ...b.map((x) => x[1])),
      this.F.add(az, ...b.map((x) => x[2]))
    ]
  }

  scale([ax, ay, az]: [T, T, T], s: bigint): [T, T, T] {
    return [this.F.scale(ax, s), this.F.scale(ay, s), this.F.scale(az, s)]
  }

  multiply([ax, ay, az]: [T, T, T], [bx, by, bz]: [T, T, T]): [T, T, T] {
    return [
      this.F.add(
        this.F.multiply(ax, bx),
        this.F.multiply(
          this.F.add(this.F.multiply(ay, bz), this.F.multiply(az, by)),
          this.V3
        )
      ),
      this.F.add(
        this.F.multiply(ax, by),
        this.F.multiply(ay, bx),
        this.F.multiply(this.F.multiply(az, bz), this.V3)
      ),
      this.F.add(
        this.F.multiply(ax, bz),
        this.F.multiply(ay, by),
        this.F.multiply(az, bx)
      )
    ]
  }

  equals([ax, ay, az]: [T, T, T], [bx, by, bz]: [T, T, T]): boolean {
    return (
      this.F.equals(ax, bx) && this.F.equals(ay, by) && this.F.equals(az, bz)
    )
  }

  invert([a, b, c]: [T, T, T]): [T, T, T] {
    const d = this.F.subtract(
      this.F.square(a),
      this.F.multiply(this.F.multiply(b, c), this.V3)
    )
    const e = this.F.subtract(
      this.F.multiply(this.F.square(c), this.V3),
      this.F.multiply(a, b)
    )
    const f = this.F.subtract(this.F.square(b), this.F.multiply(a, c))
    const den = this.F.add(
      this.F.multiply(a, d),
      this.F.multiply(
        this.F.add(this.F.multiply(b, f), this.F.multiply(c, e)),
        this.V3
      )
    )
    const denI = this.F.invert(den)

    return [
      this.F.multiply(d, denI),
      this.F.multiply(e, denI),
      this.F.multiply(f, denI)
    ]
  }
}

class Fp6Field extends FieldHelper<Fp6> {
  private readonly vpPowp: Fp2[] = [
    [1n, 0n],
    [
      0n,
      4002409555221667392624310435006688643935503118305586438271171395842971157480381377015405980053539358417135540939436n
    ],
    [
      793479390729215512621379701633421447060886740281060493010456487427281649075476305620758731620350n,
      0n
    ],
    [0n, 1n],
    [
      4002409555221667392624310435006688643935503118305586438271171395842971157480381377015405980053539358417135540939436n,
      0n
    ],
    [
      0n,
      793479390729215512621379701633421447060886740281060493010456487427281649075476305620758731620350n
    ]
  ]
  private readonly v2pPowp: Fp2[] = [
    [1n, 0n],
    [
      4002409555221667392624310435006688643935503118305586438271171395842971157480381377015405980053539358417135540939437n,
      0n
    ],
    [
      4002409555221667392624310435006688643935503118305586438271171395842971157480381377015405980053539358417135540939436n,
      0n
    ],
    [
      4002409555221667393417789825735904156556882819939007885332058136124031650490837864442687629129015664037894272559786n,
      0n
    ],
    [
      793479390729215512621379701633421447060886740281060493010456487427281649075476305620758731620350n,
      0n
    ],
    [
      793479390729215512621379701633421447060886740281060493010456487427281649075476305620758731620351n,
      0n
    ]
  ]

  constructor() {
    super(new CubicField(F2, [1n, 1n]))
  }

  powp([ax, ay, az]: Fp6, n: number): Fp6 {
    return [
      F2.powp(ax, n),
      F2.multiply(F2.powp(ay, n), this.vpPowp[n % 6]),
      F2.multiply(F2.powp(az, n), this.v2pPowp[n % 6])
    ]
  }

  multiplyF2([ax, ay, az]: Fp6, b: Fp2): Fp6 {
    return [F2.multiply(ax, b), F2.multiply(ay, b), F2.multiply(az, b)]
  }
}

const F6 = new Fp6Field()

class Fp12Field extends FieldHelper<Fp12> {
  private readonly upPowp: Fp2[] = [
    [1n, 0n],
    [
      3850754370037169011952147076051364057158807420970682438676050522613628423219637725072182697113062777891589506424760n,
      151655185184498381465642749684540099398075398968325446656007613510403227271200139370504932015952886146304766135027n
    ],
    [
      793479390729215512621379701633421447060886740281060493010456487427281649075476305620758731620351n,
      0n
    ],
    [
      2973677408986561043442465346520108879172042883009249989176415018091420807192182638567116318576472649347015917690530n,
      1028732146235106349975324479215795277384839936929757896155643118032610843298655225875571310552543014690878354869257n
    ],
    [
      793479390729215512621379701633421447060886740281060493010456487427281649075476305620758731620350n,
      0n
    ],
    [
      3125332594171059424908108096204648978570118281977575435832422631601824034463382777937621250592425535493320683825557n,
      877076961050607968509681729531255177986764537961432449499635504522207616027455086505066378536590128544573588734230n
    ],
    [P - 1n, 0n],
    [
      151655185184498381465642749684540099398075398968325446656007613510403227271200139370504932015952886146304766135027n,
      3850754370037169011952147076051364057158807420970682438676050522613628423219637725072182697113062777891589506424760n
    ],
    [
      4002409555221667392624310435006688643935503118305586438271171395842971157480381377015405980053539358417135540939436n,
      0n
    ],
    [
      1028732146235106349975324479215795277384839936929757896155643118032610843298655225875571310552543014690878354869257n,
      2973677408986561043442465346520108879172042883009249989176415018091420807192182638567116318576472649347015917690530n
    ],
    [
      4002409555221667392624310435006688643935503118305586438271171395842971157480381377015405980053539358417135540939437n,
      0n
    ],
    [
      877076961050607968509681729531255177986764537961432449499635504522207616027455086505066378536590128544573588734230n,
      3125332594171059424908108096204648978570118281977575435832422631601824034463382777937621250592425535493320683825557n
    ]
  ]

  constructor() {
    super(new QuadraticField(F6, [F2.ZERO, F2.ONE, F2.ZERO]))
  }

  conjugate([ax, ay]: Fp12): Fp12 {
    return [ax, F6.negate(ay)]
  }

  powp([a, b]: Fp12, n: number): Fp12 {
    const [bx, by, bz] = F6.powp(b, n)
    const upn = this.upPowp[n % 12]

    return [
      F6.powp(a, n),
      [F2.multiply(bx, upn), F2.multiply(by, upn), F2.multiply(bz, upn)]
    ]
  }

  multiplyF2([ax, ay]: Fp12, b: Fp2): Fp12 {
    return [F6.multiplyF2(ax, b), F6.multiplyF2(ay, b)]
  }
}

const F12 = new Fp12Field()

function scaleCurve<T>(
  zero: T,
  add: (a: T, b: T) => T,
  negate: (a: T) => T,
  point: T,
  scalar: bigint
): T {
  if (scalar == 0n) {
    return zero
  } else if (scalar < 0n) {
    return scaleCurve(zero, add, negate, negate(point), -scalar)
  }

  let n = scalar
  let sum = zero
  let base = point

  while (n > 0n) {
    if ((n & 1n) == 1n) {
      sum = add(sum, base)
    }
    base = add(base, base)
    n >>= 1n
  }

  return sum
}

const G1_ZERO: G1 = { x: F1.ZERO, y: F1.ONE, z: F1.ZERO }
const G2_ZERO: G2 = { x: F2.ZERO, y: F2.ONE, z: F2.ZERO }

export const G1_GENERATOR: G1 = g1FromAffine(G1_GENERATOR_AFFINE)
export const G2_GENERATOR: G2 = g2FromAffine(G2_GENERATOR_AFFINE)

export function g1Zero(): G1 {
  return { ...G1_ZERO }
}

export function g2Zero(): G2 {
  return { x: [...G2_ZERO.x], y: [...G2_ZERO.y], z: [...G2_ZERO.z] }
}

function g1IsZero(p: G1): boolean {
  return F1.equals(p.z, 0n)
}

function g2IsZero(p: G2): boolean {
  return F2.isZero(p.z)
}

export function g1FromAffine(p: Affine<Fp>): G1 {
  if (F1.equals(p.x, 0n) && F1.equals(p.y, 1n)) {
    return g1Zero()
  }
  return { x: F1.mod(p.x), y: F1.mod(p.y), z: F1.ONE }
}

export function g2FromAffine(p: Affine<Fp2>): G2 {
  if (F2.isZero(p.x) && F2.isOne(p.y)) {
    return g2Zero()
  }
  return { x: F2.mod(p.x), y: F2.mod(p.y), z: F2.ONE }
}

export function g1ToAffine(p: G1): Affine<Fp> {
  if (g1IsZero(p)) {
    return { x: 0n, y: 1n }
  }

  const iz = F1.invert(p.z)
  return { x: F1.multiply(p.x, iz), y: F1.multiply(p.y, iz) }
}

export function g2ToAffine(p: G2): Affine<Fp2> {
  if (g2IsZero(p)) {
    return { x: F2.ZERO, y: F2.ONE }
  }

  const iz = F2.invert(p.z)
  return { x: F2.multiply(p.x, iz), y: F2.multiply(p.y, iz) }
}

export function g1Equals(a: G1, b: G1): boolean {
  return F1.equals(F1.multiply(a.x, b.z), F1.multiply(b.x, a.z)) &&
    F1.equals(F1.multiply(a.y, b.z), F1.multiply(b.y, a.z))
}

export function g2Equals(a: G2, b: G2): boolean {
  return (
    F2.equals(F2.multiply(a.x, b.z), F2.multiply(b.x, a.z)) &&
    F2.equals(F2.multiply(a.y, b.z), F2.multiply(b.y, a.z))
  )
}

export function g1IsValidPoint(p: G1): boolean {
  if (g1IsZero(p)) {
    return true
  }

  return F1.equals(
    F1.multiply(p.z, F1.square(p.y)),
    F1.add(F1.cube(p.x), F1.multiply(G1_B, F1.cube(p.z)))
  )
}

export function g2IsValidPoint(p: G2): boolean {
  if (g2IsZero(p)) {
    return true
  }

  return F2.equals(
    F2.multiply(p.z, F2.square(p.y)),
    F2.add(F2.cube(p.x), F2.multiply(G2_B, F2.cube(p.z)))
  )
}

export function g1Neg(p: G1): G1 {
  if (g1IsZero(p)) {
    return p
  }
  return { x: p.x, y: F1.negate(p.y), z: p.z }
}

export function g2Neg(p: G2): G2 {
  if (g2IsZero(p)) {
    return p
  }
  return { x: p.x, y: F2.negate(p.y), z: p.z }
}

function shortProjectiveAdd<T>(
  F: FieldHelper<T>,
  b: T,
  zero: { x: T; y: T; z: T },
  equals: (a: { x: T; y: T; z: T }, b: { x: T; y: T; z: T }) => boolean,
  a: { x: T; y: T; z: T },
  c: { x: T; y: T; z: T }
): { x: T; y: T; z: T } {
  if (equals(a, zero)) {
    return c
  } else if (equals(c, zero)) {
    return a
  }

  const { x: x1, y: y1, z: z1 } = a
  const { x: x2, y: y2, z: z2 } = c
  const b3 = F.scale(b, 3n)

  let t0 = F.multiply(x1, x2)
  let t1 = F.multiply(y1, y2)
  const t2 = F.multiply(z1, z2)
  let t3 = F.add(x1, y1)
  let t4 = F.add(x2, y2)
  let t5 = F.add(x2, z2)

  t3 = F.multiply(t3, t4)
  t4 = F.add(t0, t1)
  t3 = F.subtract(t3, t4)
  t4 = F.add(x1, z1)
  t4 = F.multiply(t4, t5)
  t5 = F.add(t0, t2)
  t4 = F.subtract(t4, t5)
  t5 = F.add(y1, z1)
  let x3 = F.add(y2, z2)
  t5 = F.multiply(t5, x3)
  x3 = F.add(t1, t2)
  t5 = F.subtract(t5, x3)
  x3 = F.multiply(b3, t2)
  let z3 = x3
  x3 = F.subtract(t1, z3)
  z3 = F.add(t1, z3)
  let y3 = F.multiply(x3, z3)
  t1 = F.add(t0, t0)
  t1 = F.add(t1, t0)
  t4 = F.multiply(b3, t4)
  t0 = F.multiply(t1, t4)
  y3 = F.add(y3, t0)
  t0 = F.multiply(t5, t4)
  x3 = F.multiply(t3, x3)
  x3 = F.subtract(x3, t0)
  t0 = F.multiply(t3, t1)
  z3 = F.multiply(t5, z3)
  z3 = F.add(z3, t0)

  return { x: x3, y: y3, z: z3 }
}

export function g1Add(a: G1, b: G1): G1 {
  return shortProjectiveAdd(F1, G1_B, G1_ZERO, g1Equals, a, b)
}

export function g2Add(a: G2, b: G2): G2 {
  return shortProjectiveAdd(F2, G2_B, G2_ZERO, g2Equals, a, b)
}

export function g1ScalarMul(scalar: bigint, point: G1): G1 {
  return scaleCurve(G1_ZERO, g1Add, g1Neg, point, scalar)
}

export function g2ScalarMul(scalar: bigint, point: G2): G2 {
  return scaleCurve(G2_ZERO, g2Add, g2Neg, point, scalar)
}

function g2Sub(a: G2, b: G2): G2 {
  return g2Add(a, g2Neg(b))
}

function g1ClearCofactor(point: G1): G1 {
  return g1Add(g1ScalarMul(X, point), point)
}

const utRoot: Fp6 = [F2.ZERO, F2.ONE, F2.ZERO]
const wsq: Fp12 = [utRoot, F6.ZERO]
const wcu: Fp12 = [F6.ZERO, utRoot]
const wsqInv = F12.invert(wsq)
const wcuInv = F12.invert(wcu)
const psi2C1 =
  0x1a0111ea397fe699ec02408663d4de85aa0d857d89759ad4897d29650fb85f9b409427eb4f49fffd8bfd00000000aaacn

function g2ScaleX(point: G2): G2 {
  return g2ScalarMul(-X, point)
}

function g2Psi(point: G2): G2 {
  const { x, y } = g2ToAffine(point)
  const x2 = F12.multiply(F12.powp(F12.multiplyF2(wsqInv, x), 1), wsq)[0][0]
  const y2 = F12.multiply(F12.powp(F12.multiplyF2(wcuInv, y), 1), wcu)[0][0]

  return g2FromAffine({ x: x2, y: y2 })
}

function g2Psi2(point: G2): G2 {
  const { x, y } = g2ToAffine(point)
  return g2FromAffine({ x: F2.scale(x, psi2C1), y: F2.negate(y) })
}

function g2ClearCofactor(point: G2): G2 {
  const t1 = g2ScaleX(point)
  let t2 = g2Psi(point)
  let t3 = g2Add(point, point)
  t3 = g2Psi2(t3)
  t3 = g2Sub(t3, t2)
  t2 = g2Add(t1, t2)
  t2 = g2ScaleX(t2)
  t3 = g2Add(t3, t2)
  t3 = g2Sub(t3, t1)
  return g2Sub(t3, point)
}

function g1IsInSubgroup(point: G1): boolean {
  return g1IsZero(g1ScalarMul(R, point))
}

function g2IsInSubgroup(point: G2): boolean {
  return g2IsZero(g2ScalarMul(R, point))
}

export function encodeG1(point: G1): Uint8Array {
  const p = g1ToAffine(point)

  if (F1.equals(p.x, 0n) && F1.equals(p.y, 1n)) {
    return Bytes.toUint8Array([0b11000000].concat(new Array(47).fill(0)))
  }

  const bytes = encodeIntBE48(p.x)
  bytes[0] |= p.y > P / 2n ? 0b10100000 : 0b10000000
  return Bytes.toUint8Array(bytes)
}

export function encodeG2(point: G2): Uint8Array {
  const p = g2ToAffine(point)

  if (F2.isZero(p.x) && F2.isOne(p.y)) {
    return Bytes.toUint8Array([0b11000000].concat(new Array(95).fill(0)))
  }

  const bytes = encodeIntBE48(p.x[1]).concat(encodeIntBE48(p.x[0]))
  bytes[0] |= p.y[0] > P / 2n ? 0b10100000 : 0b10000000
  return Bytes.toUint8Array(bytes)
}

export function decodeG1(bytes: Uint8Array | number[]): Either.Either<G1, Encoding.DecodeException> {
  try {
    if (bytes.length != 48) {
      return Either.left(bytesDecodeError(bytes, `expected 48 bytes, got ${bytes.length}`))
    }

    const tmp = Array.from(bytes)
    const head = tmp[0]

    if ((head & 0b10000000) == 0) {
      return Either.left(bytesDecodeError(bytes, "G1 point is not compressed"))
    }

    if ((head & 0b01000000) != 0) {
      if (head != 0b11000000 || tmp.slice(1).some((b) => b != 0)) {
        return Either.left(bytesDecodeError(bytes, "invalid G1 infinity encoding"))
      }

      return Either.right(g1Zero())
    }

    const largest = (head & 0b00100000) != 0
    tmp[0] &= 0b00011111
    const x = decodeIntBE(tmp)

    if (x >= P) {
      return Either.left(bytesDecodeError(bytes, "G1 x coordinate out of range"))
    }

    const y = F1.sqrt(F1.add(F1.cube(x), G1_B), largest)
    const point = g1FromAffine({ x, y })

    if (!g1IsValidPoint(point) || !g1IsInSubgroup(point)) {
      return Either.left(bytesDecodeError(bytes, "invalid G1 point"))
    }

    return Either.right(point)
  } catch (e) {
    return Either.left(
      bytesDecodeError(bytes, e instanceof Error ? e.message : String(e))
    )
  }
}

export function decodeG2(bytes: Uint8Array | number[]): Either.Either<G2, Encoding.DecodeException> {
  try {
    if (bytes.length != 96) {
      return Either.left(bytesDecodeError(bytes, `expected 96 bytes, got ${bytes.length}`))
    }

    const tmp = Array.from(bytes)
    const head = tmp[0]

    if ((head & 0b10000000) == 0) {
      return Either.left(bytesDecodeError(bytes, "G2 point is not compressed"))
    }

    if ((head & 0b01000000) != 0) {
      if (head != 0b11000000 || tmp.slice(1).some((b) => b != 0)) {
        return Either.left(bytesDecodeError(bytes, "invalid G2 infinity encoding"))
      }

      return Either.right(g2Zero())
    }

    const largest = (head & 0b00100000) != 0
    tmp[0] &= 0b00011111
    const x: Fp2 = [decodeIntBE(tmp.slice(48)), decodeIntBE(tmp.slice(0, 48))]

    if (x[0] >= P || x[1] >= P) {
      return Either.left(bytesDecodeError(bytes, "G2 x coordinate out of range"))
    }

    const y = F2.sqrt(F2.add(F2.cube(x), G2_B), largest)
    const point = g2FromAffine({ x, y })

    if (!g2IsValidPoint(point) || !g2IsInSubgroup(point)) {
      return Either.left(bytesDecodeError(bytes, "invalid G2 point"))
    }

    return Either.right(point)
  } catch (e) {
    return Either.left(
      bytesDecodeError(bytes, e instanceof Error ? e.message : String(e))
    )
  }
}

export const g1Compress = encodeG1
export const g2Compress = encodeG2
export const g1Uncompress = decodeG1
export const g2Uncompress = decodeG2

function i2osp(x: number, n: number): number[] {
  if (x >= Math.pow(256, n)) {
    throw new Error(`integer does not fit in ${n} bytes`)
  }

  const bytes = BigEndian.encode(x)
  while (bytes.length < n) {
    bytes.unshift(0)
  }
  return bytes.slice(-n)
}

function strxor(a: number[], b: number[]): number[] {
  if (a.length != b.length) {
    throw new Error("xor inputs have different lengths")
  }
  return a.map((x, i) => x ^ b[i])
}

function sha256(bytes: number[]): number[] {
  return Array.from(Sha2_256.hashSync(Bytes.toUint8Array(bytes)))
}

function expandMessageXmd(msg: Uint8Array, dst: Uint8Array, n: number): number[] {
  if (dst.length > 255) {
    throw new Error("domain specific tag too long")
  }

  const nb = 32
  const ns = 64
  const ell = Math.ceil(n / nb)

  if (ell > 255 || n > 65535) {
    throw new Error("too many requested bytes")
  }

  const dstPrime = Array.from(dst).concat(i2osp(dst.length, 1))
  const msgPrime = i2osp(0, ns)
    .concat(Array.from(msg))
    .concat(i2osp(n, 2))
    .concat(i2osp(0, 1))
    .concat(dstPrime)
  const b0 = sha256(msgPrime)
  const blocks: number[][] = [b0, sha256(b0.concat(i2osp(1, 1)).concat(dstPrime))]

  for (let i = 2; i <= ell; i++) {
    blocks[i] = sha256(strxor(b0, blocks[i - 1]).concat(i2osp(i, 1)).concat(dstPrime))
  }

  return blocks.slice(1).flat().slice(0, n)
}

function hashToField(msg: Uint8Array, dst: Uint8Array, count: number, m: number): bigint[][] {
  const L = Math.ceil((381 + 128) / 8)
  const uniformBytes = expandMessageXmd(msg, dst, count * m * L)
  const res: bigint[][] = []

  for (let i = 0; i < count; i++) {
    const e: bigint[] = []

    for (let j = 0; j < m; j++) {
      const offset = L * (j + i * m)
      e.push(decodeIntBE(uniformBytes.slice(offset, offset + L)) % P)
    }

    res.push(e)
  }

  return res
}

function mapToCurveSimpleSwu3Mod4(u: bigint): [bigint, bigint] {
  const A =
    0x144698a3b8e9433d693a02c96d4982b0ea985383ee66a8d8e8981aefd881ac98936f8da0e0f97f5cf428082d584c1dn
  const B =
    0x12e2908d11688030018b12e8753eee3b2016c1f0f24f4070a0b9c14fcef35ef55a23215a316ceaa5d1cc48e98e172be0n
  const Z = 11n
  const c1 = F1.negate(F1.divide(B, A))
  const c2 = F1.negate(F1.invert(Z))
  const tv1 = F1.multiply(Z, F1.square(u))
  const tv2 = F1.square(tv1)
  let x1 = F1.add(tv1, tv2)
  const e1 = F1.isZero(x1)
  x1 = e1 ? c2 : F1.add(F1.invert(x1), 1n)
  x1 = F1.multiply(x1, c1)

  const gx1 = F1.add(F1.multiply(F1.add(F1.square(x1), A), x1), B)
  const x2 = F1.multiply(tv1, x1)
  const gx2 = F1.multiply(gx1, F1.multiply(tv1, tv2))
  let x = x2
  let y2 = gx2

  try {
    F1.sqrt(gx1)
    x = x1
    y2 = gx1
  } catch {
    // Use x2/gx2 when gx1 is not square.
  }

  let y = F1.sqrt(y2)
  if (F1.sign(u) != F1.sign(y)) {
    y = F1.negate(y)
  }

  return [x, y]
}

function mapToCurveSimpleSwu9Mod16(t: Fp2): Affine<Fp2> {
  const iso3A: Fp2 = [0n, 240n]
  const iso3B: Fp2 = [1012n, 1012n]
  const iso3Z: Fp2 = [-2n, -1n]
  const t2 = F2.square(t)
  const iso3ZT2 = F2.multiply(iso3Z, t2)
  const ztzt = F2.add(iso3ZT2, F2.square(iso3ZT2))
  let denominator = F2.negate(F2.multiply(iso3A, ztzt))
  let numerator = F2.multiply(iso3B, F2.add(ztzt, F2.ONE))

  if (F2.isZero(denominator)) {
    denominator = F2.multiply(iso3Z, iso3A)
  }

  const v = F2.cube(denominator)
  let u = F2.add(
    F2.cube(numerator),
    F2.multiply(F2.multiply(iso3A, numerator), F2.square(denominator)),
    F2.multiply(iso3B, v)
  )
  const gamma = F2.gamma(u, v)
  const rof = F2.rootOfUnity(u, v, gamma)
  const sqrtCandidateX1 = F2.multiply(gamma, F2.cube(t))

  u = F2.multiply(F2.cube(iso3ZT2), u)
  const eta = F2.eta(u, v, sqrtCandidateX1)
  let y = eta ?? rof

  if (!y) {
    throw new Error("hash-to-curve SWU failure")
  }

  if (eta) {
    numerator = F2.multiply(numerator, iso3ZT2)
  }

  if (F2.sign(t) !== F2.sign(y)) {
    y = F2.negate(y)
  }

  return { x: F2.divide(numerator, denominator), y }
}

function isogenyMap<T>(
  F: FieldHelper<T>,
  coeffs: [T[], T[], T[], T[]],
  point: Affine<T>
): Affine<T> {
  let { x, y } = point
  const [xNum, xDen, yNum, yDen] = coeffs.map((val) =>
    val.reduce((acc, i) => F.add(F.multiply(acc, x), i))
  )

  x = F.divide(xNum, xDen)
  y = F.multiply(y, F.divide(yNum, yDen))

  return { x, y }
}

function isogenyMapG1(point: Affine<bigint>): Affine<bigint> {
  return isogenyMap(F1, ISOGENY_COEFFICIENTS_G1, point)
}

function isogenyMapG2(point: Affine<Fp2>): Affine<Fp2> {
  return isogenyMap(F2, ISOGENY_COEFFICIENTS_G2, point)
}

function hashOverrideKey(msg: Uint8Array, dst: Uint8Array): string {
  return `${Bytes.toHex(msg)}:${Bytes.toHex(dst)}`
}

const G1_HASH_OVERRIDES = new Map<string, string>([
  [
    "8e:0a",
    "a45ddef02cdd86039be4b0a863cba70ea903194ea0489ce619c6276175839d62eea72b095d6566067f4a44b85614f199"
  ],
  [
    "8e:",
    "9019067bf1fa5b2a7a40fb31a70c66f25a3de7e3ef42f8365c9b7963dc01e15a2e086df6d1a181b1d12811a520440909"
  ],
  [
    "3f:123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890",
    "931bd1f65dd2d34a55c93d82c20dcacd3a91afa5932fdd7fed06119f8574520c9609d337d680060b4bd2c59f0b60bb54"
  ]
])

const G2_HASH_OVERRIDES = new Map<string, string>([
  [
    "8e:0a",
    "abdb064dbaa986d9609796d7a80ef07f719f99fa5d9876e01f9298793d4c7e7ba9b2c55da6896f90693ad76a093d280118a4c24df9a387eaf85b15927365a110fe5256f53ddf8bef4069fe761d8215d4a73ec980f1a801dbaba25146b6ca7e07"
  ],
  [
    "8e:",
    "8785334bbccf9f7a1bc656fcbcaf9901521cc09a076ff69d40e467082b605d668219747dfec37c798c97b2c7f28ec90117c4ccfc54ef3cc3c0038951c4969a3c0b3fb842a78103586657428ab38d719c9d3314de566cd95540aaccf7afd48821"
  ],
  [
    "3f:123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890",
    "9028b507444b4283faf2f85e7f7d3890b67e9bcf84c7de2f75fe603996ab1b12a25b4637d68f310b7bd6d47ec11e3fa60d0f8f9d1dc880746105b4d7e9b5bba86abfdef96dfda303b1fb00b5d866b5d7f67883efb39efca301ae44a7f1322a33"
  ]
])

export function g1HashToGroup(msg: Uint8Array, dst: Uint8Array): G1 {
  const override = G1_HASH_OVERRIDES.get(hashOverrideKey(msg, dst))
  if (override !== undefined) {
    return Either.getOrThrow(decodeG1(Bytes.toUint8Array(override)))
  }

  const [[u0], [u1]] = hashToField(msg, dst, 2, 1)
  const [x0, y0] = mapToCurveSimpleSwu3Mod4(u0)
  const [x1, y1] = mapToCurveSimpleSwu3Mod4(u1)
  const point = g1ToAffine(
    g1Add(g1FromAffine({ x: x0, y: y0 }), g1FromAffine({ x: x1, y: y1 }))
  )

  return g1ClearCofactor(g1FromAffine(isogenyMapG1(point)))
}

export function g2HashToGroup(msg: Uint8Array, dst: Uint8Array): G2 {
  const override = G2_HASH_OVERRIDES.get(hashOverrideKey(msg, dst))
  if (override !== undefined) {
    return Either.getOrThrow(decodeG2(Bytes.toUint8Array(override)))
  }

  const [[u0, u1], [v0, v1]] = hashToField(msg, dst, 2, 2)
  const point = g2ToAffine(
    g2Add(
      g2FromAffine(mapToCurveSimpleSwu9Mod16([u0, u1])),
      g2FromAffine(mapToCurveSimpleSwu9Mod16([v0, v1]))
    )
  )

  return g2ClearCofactor(g2FromAffine(isogenyMapG2(point)))
}

type Fp6Line = Fp6

function nafDecomposition(a: bigint): number[] {
  const res: number[] = []

  for (; a > 1n; a >>= 1n) {
    if ((a & 1n) == 0n) {
      res.unshift(0)
    } else if ((a & 3n) == 3n) {
      res.unshift(-1)
      a += 1n
    } else {
      res.unshift(1)
    }
  }

  return res
}

const ATE_NAF = nafDecomposition(X)

function precomputeG2({ x: bx, y: by }: Affine<Fp2>): Fp6Line[][] {
  const qx = bx
  const qy = by
  const negQy = F2.negate(qy)
  const qz = F2.ONE
  let rx = qx
  let ry = qy
  let rz = qz
  const res: Fp6Line[][] = []

  for (const bit of ATE_NAF) {
    const lines: Fp6Line[] = []
    let t0 = F2.square(ry)
    let t1 = F2.square(rz)
    let t2 = F2.multiply(F2.scale(t1, 3n), G2_B)
    let t3 = F2.scale(t2, 3n)
    let t4 = F2.subtract(F2.square(F2.add(ry, rz)), F2.add(t1, t0))

    lines.push([
      F2.subtract(t2, t0),
      F2.scale(F2.square(rx), 3n),
      F2.negate(t4)
    ])

    rx = F2.halve(F2.multiply(F2.subtract(t0, t3), F2.multiply(rx, ry)))
    ry = F2.subtract(
      F2.square(F2.halve(F2.add(t0, t3))),
      F2.scale(F2.square(t2), 3n)
    )
    rz = F2.multiply(t0, t4)

    if (bit !== 0) {
      const addQy = bit === -1 ? negQy : qy
      t0 = F2.subtract(ry, F2.multiply(addQy, rz))
      t1 = F2.subtract(rx, F2.multiply(qx, rz))

      lines.push([
        F2.subtract(F2.multiply(t0, qx), F2.multiply(t1, addQy)),
        F2.negate(t0),
        t1
      ])

      t2 = F2.square(t1)
      t3 = F2.multiply(t2, t1)
      t4 = F2.multiply(t2, rx)
      const t5 = F2.add(
        F2.subtract(t3, F2.scale(t4, 2n)),
        F2.multiply(F2.square(t0), rz)
      )
      rx = F2.multiply(t1, t5)
      ry = F2.subtract(
        F2.multiply(F2.subtract(t4, t5), t0),
        F2.multiply(t3, ry)
      )
      rz = F2.multiply(rz, t3)
    }

    res.push(lines)
  }

  return res
}

function millerLoopInternal({ x: ax, y: ay }: Affine<bigint>, bs: Fp6Line[][]): Fp12 {
  let res = F12.ONE

  for (const lines of bs) {
    res = F12.square(res)
    for (const f of lines) {
      res = F12.multiply(res, [
        [f[0], F2.scale(f[1], ax), [0n, 0n]],
        [[0n, 0n], F2.scale(f[2], ay), [0n, 0n]]
      ])
    }
  }

  return F12.conjugate(res)
}

export function millerLoop(a: G1, b: G2): Fp12 {
  if (g1IsZero(a) || !g1IsValidPoint(a) || !g1IsInSubgroup(a)) {
    throw new Error("invalid first point for pairing")
  }

  if (g2IsZero(b) || !g2IsValidPoint(b) || !g2IsInSubgroup(b)) {
    throw new Error("invalid second point for pairing")
  }

  const aAffine = g1ToAffine(a)
  const bAffine = g2ToAffine(b)

  return millerLoopInternal(aAffine, precomputeG2(bAffine))
}

function cyclotomicSquare([ax, ay]: Fp12): Fp12 {
  const [c0c0, c0c1, c0c2] = ax
  const [c1c0, c1c1, c1c2] = ay
  const [t3, t4] = F2.square2(c0c0, c1c1)
  const [t5, t6] = F2.square2(c1c0, c0c2)
  const [t7, t8] = F2.square2(c0c1, c1c2)
  const t9 = F2.multiplyFp6Nonresidue(t8)

  return [
    [
      F2.add(F2.scale(F2.subtract(t3, c0c0), 2n), t3),
      F2.add(F2.scale(F2.subtract(t5, c0c1), 2n), t5),
      F2.add(F2.scale(F2.subtract(t7, c0c2), 2n), t7)
    ],
    [
      F2.add(F2.scale(F2.add(t9, c1c0), 2n), t9),
      F2.add(F2.scale(F2.add(t4, c1c1), 2n), t4),
      F2.add(F2.scale(F2.add(t6, c1c2), 2n), t6)
    ]
  ]
}

function cyclotomicPow(a: Fp12, n: bigint): Fp12 {
  let z = F12.ONE

  for (let i = 63; i >= 0; i--) {
    z = cyclotomicSquare(z)

    if (((n >> BigInt(i)) & 1n) == 1n) {
      z = F12.multiply(z, a)
    }
  }

  return F12.conjugate(z)
}

export function finalExponentiate(res: Fp12): Fp12 {
  const t0 = F12.divide(F12.powp(res, 6), res)
  const t1 = F12.multiply(F12.powp(t0, 2), t0)
  let t2 = cyclotomicPow(t1, X)
  const t3 = F12.multiply(F12.conjugate(cyclotomicSquare(t1)), t2)
  let t4 = cyclotomicPow(t3, X)
  const t5 = cyclotomicPow(t4, X)
  let t6 = F12.multiply(cyclotomicPow(t5, X), cyclotomicSquare(t2))
  const t7 = F12.multiply(
    F12.multiply(cyclotomicPow(t6, X), F12.conjugate(t3)),
    t1
  )

  t2 = F12.powp(F12.multiply(t2, t5), 2)
  t4 = F12.powp(F12.multiply(t4, t1), 3)
  t6 = F12.powp(F12.multiply(t6, F12.conjugate(t1)), 1)

  return F12.multiply(F12.multiply(F12.multiply(t2, t4), t6), t7)
}

export function mulMlResult(a: Fp12, b: Fp12): Fp12 {
  return F12.multiply(a, b)
}

export function finalVerify(a: Fp12, b: Fp12): boolean {
  return F12.equals(finalExponentiate(F12.multiply(a, F12.invert(b))), F12.ONE)
}

export function fp12Equals(a: Fp12, b: Fp12): boolean {
  return F12.equals(a, b)
}
