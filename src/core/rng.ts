// Port of the game's TinyMT32-based generator (reference: random/main.go).
// All arithmetic is unsigned 32-bit: `>>> 0` for wraparound, `Math.imul` for 32-bit multiply.
const u32 = (n: number): number => n >>> 0;
const mul = (a: number, b: number): number => Math.imul(a, b) >>> 0;

const IC0 = 0x40336050,
  IC1 = 0xcfa3723c,
  IC2 = 0x3cac5f6f,
  IC3 = 0x3793fdff;
const SH0 = 1,
  SH1 = 10,
  MASK = 0x7fffffff,
  ALPHA = 0x19660d,
  BRAVO = 0x5d588b65;

const manipAlpha = (v: number): number => mul(u32(v ^ (v >>> 27)), ALPHA);
const manipBravo = (v: number): number => mul(u32(v ^ (v >>> 27)), BRAVO);

export class NumberGenerator {
  private state = new Uint32Array(4);

  reset(passiveGraphId: number, seed: number): void {
    this.state[0] = IC0;
    this.state[1] = IC1;
    this.state[2] = IC2;
    this.state[3] = IC3;
    this.initialize([u32(passiveGraphId), u32(seed)]);
  }

  private initialize(seeds: number[]): void {
    const s = this.state;
    let index = 1;
    for (const seed of seeds) {
      let r = manipAlpha(u32(s[index % 4] ^ s[(index + 1) % 4] ^ s[(index + 3) % 4]));
      s[(index + 1) % 4] = u32(s[(index + 1) % 4] + r);
      r = u32(r + seed + index);
      s[(index + 2) % 4] = u32(s[(index + 2) % 4] + r);
      s[index % 4] = r;
      index = (index + 1) % 4;
    }
    for (let k = 0; k < 5; k++) {
      let r = manipAlpha(u32(s[index % 4] ^ s[(index + 1) % 4] ^ s[(index + 3) % 4]));
      s[(index + 1) % 4] = u32(s[(index + 1) % 4] + r);
      r = u32(r + index);
      s[(index + 2) % 4] = u32(s[(index + 2) % 4] + r);
      s[index % 4] = r;
      index = (index + 1) % 4;
    }
    for (let k = 0; k < 4; k++) {
      let r = manipBravo(u32(s[index % 4] + s[(index + 1) % 4] + s[(index + 3) % 4]));
      s[(index + 1) % 4] = u32(s[(index + 1) % 4] ^ r);
      r = u32(r - index);
      s[(index + 2) % 4] = u32(s[(index + 2) % 4] ^ r);
      s[index % 4] = r;
      index = (index + 1) % 4;
    }
    for (let k = 0; k < 8; k++) this.next();
  }

  private next(): void {
    const s = this.state;
    let a = s[3];
    let b = u32((u32(s[0] & MASK) ^ s[1]) ^ s[2]);
    a = u32(a ^ u32(a << SH0));
    b = u32(b ^ (u32(b >>> SH0) ^ a));
    s[0] = s[1];
    s[1] = s[2];
    s[2] = u32(a ^ u32(b << SH1));
    s[3] = b;
    s[1] = u32(s[1] ^ (u32(-(b & 1)) & 0x8f7011ee));
    s[2] = u32(s[2] ^ (u32(-(b & 1)) & 0xfc78ff1f));
  }

  private temper(): number {
    const s = this.state;
    const b = u32(s[0] + (s[2] >>> 8));
    const a = u32(s[3] ^ b);
    return u32(a ^ (u32(-(b & 1)) & 0x3793fdff));
  }

  generateUInt(): number {
    this.next();
    return this.temper();
  }

  generateSingle(exclusiveMax: number): number {
    return u32(this.generateUInt() % exclusiveMax);
  }

  generate(min: number, max: number): number {
    const a = u32(min + 0x80000000);
    const b = u32(max + 0x80000000);
    const roll = this.generateSingle(u32(b - a + 1));
    return u32(u32(roll + a) + 0x80000000);
  }

  generateSigned(min: number, max: number): number {
    return this.generate(u32(min), u32(max)) | 0;
  }
}
