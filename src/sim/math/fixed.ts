// Integer arithmetic for the simulation state (TECH_SPEC §3, §5).
// Every value handled here is an integer; results stay exact while |x| < 2^53.

/** 1 px = 256 sub-pixels. */
export const SUBPX_SHIFT = 8;
export const SUBPX = 1 << SUBPX_SHIFT;

/** Q14 fixed-point: 16384 = 1.0, the scale of the trig LUT. */
export const Q14_SHIFT = 14;
export const Q14_ONE = 1 << Q14_SHIFT;

/**
 * Integer division truncated toward zero, the single division helper of src/sim.
 * IEEE division is correctly rounded, so trunc(a / b) is exact for safe integers.
 */
export function idiv(a: number, b: number): number {
  if (b === 0) throw new RangeError('idiv by zero');
  return Math.trunc(a / b);
}

/** a * b / c with truncation toward zero; a * b must stay below 2^53. */
export function mulDiv(a: number, b: number, c: number): number {
  return idiv(a * b, c);
}

/** Multiplies an integer by a Q14 factor, truncating toward zero. */
export function mulQ14(a: number, q14: number): number {
  return Math.trunc((a * q14) / Q14_ONE);
}

/** Pixels to sub-pixels. */
export function pxToSub(px: number): number {
  return px * SUBPX;
}

/** Sub-pixels to the pixel that contains them (floor, so -1 sub-px is pixel -1). */
export function subToPx(sub: number): number {
  return Math.floor(sub / SUBPX);
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
