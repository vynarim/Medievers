// Determinism probes run identically in Node and in each browser; results must match exactly.
import { decodeMaskPng } from '../../src/app/loaders/mask-png.ts';
import {
  FNV_OFFSET,
  atan2Bam,
  createPrng,
  hashBytes,
  hashInt,
  isqrt,
  nextU32,
} from '../../src/sim/math/index.ts';
import { SIN_Q14 } from '../../src/sim/math/trig-lut.ts';

export type CheckResults = Record<string, number>;

/** Each probe returns a 32-bit hash summarising its outputs. */
export function runChecks(maskPng: Uint8Array): CheckResults {
  let math = FNV_OFFSET;
  for (let i = 0; i < 4096; i++) math = hashInt(math, SIN_Q14[i] ?? 0);
  for (let y = -300; y <= 300; y += 7) {
    for (let x = -300; x <= 300; x += 11) math = hashInt(math, atan2Bam(y * 4099, x * 4093));
  }
  for (let n = 0; n < 4503599627370496; n = n * 3 + 7) math = hashInt(math, isqrt(n));

  let prng = FNV_OFFSET;
  const s = createPrng(20261024);
  for (let i = 0; i < 10000; i++) prng = hashInt(prng, nextU32(s));

  const mask = decodeMaskPng(maskPng);
  return { math, prng, mask: hashBytes(FNV_OFFSET, mask.data) };
}
