import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  LUT_PATH,
  buildAtanTable,
  buildSinTable,
  renderLutModule,
} from '../../../tools/gen-trig-lut.ts';
import { ATAN_BAM, SIN_Q14 } from '../../../src/sim/math/trig-lut.ts';

describe('trig LUT', () => {
  it('is bit-identical across two generations', () => {
    expect(renderLutModule()).toBe(renderLutModule());
  });

  it('matches the committed module byte for byte', () => {
    expect(readFileSync(LUT_PATH, 'utf8').replaceAll('\r\n', '\n')).toBe(renderLutModule());
  });

  it('holds the generated values', () => {
    expect(Array.from(SIN_Q14)).toEqual(buildSinTable());
    expect(Array.from(ATAN_BAM)).toEqual(buildAtanTable());
  });

  it('has exact quadrant symmetries and key values', () => {
    expect(SIN_Q14.length).toBe(4096);
    expect([SIN_Q14[0], SIN_Q14[1024], SIN_Q14[2048], SIN_Q14[3072]]).toEqual([
      0, 16384, 0, -16384,
    ]);
    for (let i = 0; i < 4096; i++) {
      const v = SIN_Q14[i] ?? 0;
      expect(SIN_Q14[(2048 - i) & 4095]).toBe(v);
      expect(SIN_Q14[(4096 - i) & 4095]).toBe(v === 0 ? 0 : -v);
    }
  });

  it('stays within half a Q14 step of sin', () => {
    for (let i = 0; i < 4096; i++) {
      const exact = Math.sin((i * 2 * Math.PI) / 4096) * 16384;
      expect(Math.abs((SIN_Q14[i] ?? 0) - exact)).toBeLessThanOrEqual(0.5 + 1e-9);
    }
  });

  it('covers atan from 0 to 45 degrees', () => {
    expect(ATAN_BAM.length).toBe(1025);
    expect(ATAN_BAM[0]).toBe(0);
    expect(ATAN_BAM[1024]).toBe(512);
  });
});
