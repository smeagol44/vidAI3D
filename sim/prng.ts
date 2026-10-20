export class PRNG {
  private s0: number;
  private s1: number;
  private s2: number;
  private s3: number;

  constructor(seed: number = 4242) {
    // SplitMix32 initialization of xoshiro128++ state
    let s = (seed | 0);
    const nextSeed = () => {
      s = (s + 0x9e3779b9) | 0;
      let z = s;
      z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
      z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
      return ((z ^ (z >>> 15)) >>> 0);
    };
    this.s0 = nextSeed();
    this.s1 = nextSeed();
    this.s2 = nextSeed();
    this.s3 = nextSeed();
    if (this.s0 === 0 && this.s1 === 0 && this.s2 === 0 && this.s3 === 0) {
      this.s0 = 1;
    }
  }

  public next(): number {
    const rotl = (x: number, k: number) => ((x << k) | (x >>> (32 - k))) >>> 0;
    const result = (rotl((this.s0 + this.s3) >>> 0, 7) + this.s0) >>> 0;
    const t = (this.s1 << 9) >>> 0;

    this.s2 ^= this.s0;
    this.s3 ^= this.s1;
    this.s1 ^= this.s2;
    this.s0 ^= this.s3;

    this.s2 ^= t;
    this.s3 = rotl(this.s3, 11);

    return result / 4294967296;
  }

  public range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  public rangeInt(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  public getState(): [number, number, number, number] {
    return [this.s0, this.s1, this.s2, this.s3];
  }

  public setState(state: [number, number, number, number]) {
    this.s0 = state[0];
    this.s1 = state[1];
    this.s2 = state[2];
    this.s3 = state[3];
  }
}
