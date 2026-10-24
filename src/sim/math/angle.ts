// Binary angles (BAM): 4096 units = 360°, 0 points along +x, angles grow toward +y (screen down).
import { ATAN_BAM, SIN_Q14 } from './trig-lut';

export const ANGLE_BITS = 12;
export const ANGLE_FULL = 1 << ANGLE_BITS;
export const ANGLE_MASK = ANGLE_FULL - 1;
export const ANGLE_QUARTER = ANGLE_FULL >> 2;
export const ANGLE_HALF = ANGLE_FULL >> 1;

const ATAN_STEPS = 1024;

/** Wraps any integer angle into 0..4095. */
export function normAngle(a: number): number {
  return a & ANGLE_MASK;
}

/** sin in Q14 (16384 = 1.0). */
export function sinQ14(a: number): number {
  return SIN_Q14[a & ANGLE_MASK] ?? 0;
}

/** cos in Q14 (16384 = 1.0). */
export function cosQ14(a: number): number {
  return SIN_Q14[(a + ANGLE_QUARTER) & ANGLE_MASK] ?? 0;
}

/**
 * Angle of the vector (x, y) in BAM, 0..4095. atan2Bam(0, 0) is 0.
 * Inputs are integers with |x|, |y| < 2^43 so the ratio stays exact.
 */
export function atan2Bam(y: number, x: number): number {
  if (x === 0 && y === 0) return 0;
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  // First octant: angle of (max, min) in 0..512.
  const swap = ay > ax;
  const big = swap ? ay : ax;
  const small = swap ? ax : ay;
  const idx = Math.trunc((small * ATAN_STEPS + Math.floor(big / 2)) / big);
  let a = ATAN_BAM[idx] ?? 0;
  if (swap) a = ANGLE_QUARTER - a;
  if (x < 0) a = ANGLE_HALF - a;
  if (y < 0) a = ANGLE_FULL - a;
  return a & ANGLE_MASK;
}

/** Shortest signed difference b - a, in -2048..2047. */
export function angleDelta(a: number, b: number): number {
  return ((b - a + ANGLE_HALF) & ANGLE_MASK) - ANGLE_HALF;
}
