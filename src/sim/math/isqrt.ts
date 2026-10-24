// Integer square root (Newton's method on integers), replaces Math.sqrt in src/sim.

/** 2^52: keeps x * x and n / x exact in doubles. */
const MAX_INPUT = 4503599627370496;

/** floor(sqrt(n)) for an integer 0 <= n <= 2^52. */
export function isqrt(n: number): number {
  if (!Number.isInteger(n) || n < 0 || n > MAX_INPUT) {
    throw new RangeError(`isqrt domain is integers in [0, 2^52], got ${n}`);
  }
  if (n < 2) return n;
  // Start above the root: 2^ceil(bits/2).
  let x = 1;
  for (let v = n; v > 0; v = Math.floor(v / 4)) x *= 2;
  for (;;) {
    const y = Math.floor((x + Math.floor(n / x)) / 2);
    if (y >= x) break;
    x = y;
  }
  return x;
}

/** Euclidean length of an integer vector, floored. */
export function ilength(x: number, y: number): number {
  return isqrt(x * x + y * y);
}
