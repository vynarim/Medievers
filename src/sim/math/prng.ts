// Seeded PRNG for gameplay (TECH_SPEC §3): sfc32, state stored in the sim state as four uint32.

export interface PrngState {
  a: number;
  b: number;
  c: number;
  d: number;
}

/** splitmix32 step, used only to expand a 32-bit seed into the sfc32 state. */
function splitmix32(x: number): number {
  let z = (x + 0x9e3779b9) | 0;
  z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
  z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
  return (z ^ (z >>> 15)) >>> 0;
}

/** Number of outputs dropped after seeding so that close seeds diverge. */
const WARMUP = 12;

export function createPrng(seed: number): PrngState {
  let s = seed >>> 0;
  const next = (): number => {
    s = (s + 0x9e3779b9) >>> 0;
    return splitmix32(s);
  };
  const state: PrngState = { a: next(), b: next(), c: next(), d: 1 };
  for (let i = 0; i < WARMUP; i++) nextU32(state);
  return state;
}

/** Next uint32 (0..2^32-1); advances the state in place. */
export function nextU32(s: PrngState): number {
  const t = (((s.a + s.b) | 0) + s.d) | 0;
  s.d = (s.d + 1) | 0;
  s.a = s.b ^ (s.b >>> 9);
  s.b = (s.c + (s.c << 3)) | 0;
  s.c = (s.c << 21) | (s.c >>> 11);
  s.c = (s.c + t) | 0;
  s.a >>>= 0;
  s.b >>>= 0;
  s.c >>>= 0;
  s.d >>>= 0;
  return t >>> 0;
}

/** Largest range accepted by nextInt: keeps u32 * n below 2^53. */
const MAX_RANGE = 1 << 21;
const U32_RANGE = 4294967296;

/** Uniform integer in [0, n), 1 <= n <= 2^21. */
export function nextInt(s: PrngState, n: number): number {
  if (!Number.isInteger(n) || n < 1 || n > MAX_RANGE) {
    throw new RangeError(`nextInt range must be an integer in [1, 2^21], got ${n}`);
  }
  return Math.floor((nextU32(s) * n) / U32_RANGE);
}

/** Uniform integer in [min, max], both inclusive. */
export function nextRange(s: PrngState, min: number, max: number): number {
  return min + nextInt(s, max - min + 1);
}

export function clonePrng(s: PrngState): PrngState {
  return { a: s.a, b: s.b, c: s.c, d: s.d };
}
