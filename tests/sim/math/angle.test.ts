import { describe, expect, it } from 'vitest';
import { angleDelta, atan2Bam, cosQ14, normAngle, sinQ14 } from '../../../src/sim/math/index.ts';

const toBam = (rad: number): number => ((((rad * 4096) / (2 * Math.PI)) % 4096) + 4096) % 4096;
const bamDistance = (a: number, b: number): number =>
  Math.min(Math.abs(a - b), 4096 - Math.abs(a - b));

describe('binary angles', () => {
  it('wraps any integer into 0..4095', () => {
    expect([normAngle(-1), normAngle(4096), normAngle(4097), normAngle(-4096)]).toEqual([
      4095, 0, 1, 0,
    ]);
  });

  it('derives cos from sin', () => {
    expect([cosQ14(0), cosQ14(1024), cosQ14(2048), cosQ14(3072)]).toEqual([16384, 0, -16384, 0]);
    expect(sinQ14(-1024)).toBe(-16384);
    expect(cosQ14(-1)).toBe(cosQ14(1));
  });

  it('returns exact angles on the axes and diagonals', () => {
    expect(atan2Bam(0, 0)).toBe(0);
    expect(atan2Bam(0, 5)).toBe(0);
    expect(atan2Bam(5, 0)).toBe(1024);
    expect(atan2Bam(0, -5)).toBe(2048);
    expect(atan2Bam(-5, 0)).toBe(3072);
    expect(atan2Bam(7, 7)).toBe(512);
    expect(atan2Bam(-7, -7)).toBe(2560);
  });

  it('stays within 1 BAM of Math.atan2', () => {
    for (let y = -60; y <= 60; y += 3) {
      for (let x = -60; x <= 60; x += 3) {
        if (x === 0 && y === 0) continue;
        expect(bamDistance(atan2Bam(y, x), toBam(Math.atan2(y, x)))).toBeLessThanOrEqual(1);
      }
    }
  });

  it('handles world-scale sub-pixel vectors', () => {
    const x = 5120 * 256;
    const y = -2560 * 256;
    expect(bamDistance(atan2Bam(y, x), toBam(Math.atan2(y, x)))).toBeLessThanOrEqual(1);
    // Beyond int32: no bit operator may truncate the inputs.
    const big = 3 * 2147483648;
    expect(atan2Bam(big, big)).toBe(512);
    expect(bamDistance(atan2Bam(big, 2 * big), toBam(Math.atan2(1, 2)))).toBeLessThanOrEqual(1);
  });

  it('inverts sin/cos to within 1 BAM', () => {
    for (let a = 0; a < 4096; a += 7) {
      expect(bamDistance(atan2Bam(sinQ14(a), cosQ14(a)), a)).toBeLessThanOrEqual(1);
    }
  });

  it('computes the shortest signed delta', () => {
    expect(angleDelta(10, 20)).toBe(10);
    expect(angleDelta(4090, 5)).toBe(11);
    expect(angleDelta(5, 4090)).toBe(-11);
    expect(angleDelta(0, 2048)).toBe(-2048);
  });
});
