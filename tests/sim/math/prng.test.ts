import { describe, expect, it } from 'vitest';
import { clonePrng, createPrng, nextInt, nextRange, nextU32 } from '../../../src/sim/math/index.ts';

/** Reference sfc32 (Chris Doty-Humphrey, PractRand) in its common JS form. */
function referenceSfc32(a: number, b: number, c: number, d: number): () => number {
  return () => {
    a |= 0;
    b |= 0;
    c |= 0;
    d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return t >>> 0;
  };
}

/** First outputs for seed 42. A change here breaks every replay: never update to pass a test. */
const GOLDEN_SEED_42 = [2256871619, 352704449, 1081242612, 2871885822];

describe('sfc32 PRNG', () => {
  it('matches the reference sfc32 from the same state', () => {
    const s = createPrng(12345);
    const ref = referenceSfc32(s.a, s.b, s.c, s.d);
    for (let i = 0; i < 1000; i++) expect(nextU32(s)).toBe(ref());
  });

  it('is reproducible from a seed (golden values)', () => {
    const s = createPrng(42);
    expect([nextU32(s), nextU32(s), nextU32(s), nextU32(s)]).toEqual(GOLDEN_SEED_42);
  });

  it('keeps an integer uint32 state', () => {
    const s = createPrng(-7);
    for (let i = 0; i < 100; i++) nextU32(s);
    for (const v of [s.a, s.b, s.c, s.d]) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(4294967296);
    }
  });

  it('diverges for neighbouring seeds', () => {
    expect(nextU32(createPrng(1))).not.toBe(nextU32(createPrng(2)));
  });

  it('clones into an independent stream', () => {
    const s = createPrng(9);
    const c = clonePrng(s);
    expect(nextU32(c)).toBe(nextU32(s));
    nextU32(s);
    expect(c).not.toEqual(s);
  });

  it('draws bounded, roughly uniform integers', () => {
    const s = createPrng(2024);
    const counts = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 60000; i++) {
      const v = nextInt(s, 6);
      counts[v] = (counts[v] ?? 0) + 1;
    }
    for (const c of counts) expect(Math.abs(c - 10000)).toBeLessThan(400);
    for (let i = 0; i < 1000; i++) {
      const v = nextRange(s, -10, 10);
      expect(v).toBeGreaterThanOrEqual(-10);
      expect(v).toBeLessThanOrEqual(10);
    }
    expect(() => nextInt(s, 0)).toThrow(RangeError);
    expect(() => nextInt(s, (1 << 21) + 1)).toThrow(RangeError);
  });
});
