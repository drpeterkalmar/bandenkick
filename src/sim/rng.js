// Deterministischer Zufall (sfc32, Seed über xmur3-Hash) – gleiche Folge auf allen Geräten.
export function hashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

export class Rng {
  constructor(seed = 1) {
    const s = hashSeed(String(seed));
    this.a = s(); this.b = s(); this.c = s(); this.d = s();
    for (let i = 0; i < 12; i++) this.next();
  }
  next() { // [0, 1)
    let { a, b, c, d } = this;
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    const t = (a + b | 0) + d | 0;
    d = d + 1 | 0;
    a = b ^ (b >>> 9);
    b = c + (c << 3) | 0;
    c = (c << 21) | (c >>> 11);
    c = c + t | 0;
    this.a = a; this.b = b; this.c = c; this.d = d;
    return (t >>> 0) / 4294967296;
  }
  range(lo, hi) { return lo + (hi - lo) * this.next(); }
  // Normalverteilt (Box-Muller), Mittel 0, SD 1
  gauss() {
    let u = this.next();
    if (u < 1e-12) u = 1e-12;
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * this.next());
  }
  state() { return [this.a, this.b, this.c, this.d]; }
  setState(s) { [this.a, this.b, this.c, this.d] = s; }
}
