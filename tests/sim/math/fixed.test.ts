import { describe, expect, it } from 'vitest';
import {
  clamp,
  idiv,
  ilength,
  isqrt,
  mulDiv,
  mulQ14,
  pxToSub,
  subToPx,
} from '../../../src/sim/math';

describe('fixed-point helpers', () => {
  it('truncates division toward zero', () => {
    expect([idiv(7, 2), idiv(-7, 2), idiv(7, -2), idiv(-7, -2), idiv(0, 3)]).toEqual([
      3, -3, -3, 3, 0,
    ]);
    expect(() => idiv(1, 0)).toThrow(RangeError);
  });

  it('multiplies by Q14 factors', () => {
    expect(mulQ14(1000, 16384)).toBe(1000);
    expect(mulQ14(1000, 8192)).toBe(500);
    expect(mulQ14(-1000, 8193)).toBe(-500);
    expect(mulDiv(5120 * 256, 3, 7)).toBe(561737);
  });

  it('converts between pixels and sub-pixels', () => {
    expect(pxToSub(3)).toBe(768);
    expect([subToPx(767), subToPx(768), subToPx(-1), subToPx(-256), subToPx(-257)]).toEqual([
      2, 3, -1, -1, -2,
    ]);
    expect(clamp(5, 0, 3)).toBe(3);
  });
});

describe('isqrt', () => {
  it('matches floor(sqrt(n)) exhaustively on 0..200000', () => {
    for (let n = 0; n <= 200000; n++) {
      if (isqrt(n) !== Math.floor(Math.sqrt(n))) expect.fail(`isqrt(${n})`);
    }
  });

  it('is exact around large perfect squares', () => {
    for (const r of [46340, 46341, 1 << 20, 67108863]) {
      expect(isqrt(r * r)).toBe(r);
      expect(isqrt(r * r - 1)).toBe(r - 1);
      expect(isqrt(r * r + 1)).toBe(r);
    }
    expect(isqrt(4503599627370496)).toBe(67108864);
    expect(isqrt(4503599627370495)).toBe(67108863);
  });

  it('rejects inputs outside its domain', () => {
    expect(() => isqrt(-1)).toThrow(RangeError);
    expect(() => isqrt(2.5)).toThrow(RangeError);
    expect(() => isqrt(4503599627370497)).toThrow(RangeError);
  });

  it('measures vector length', () => {
    expect(ilength(3, 4)).toBe(5);
    expect(ilength(-3 * 256, 4 * 256)).toBe(1280);
  });
});
