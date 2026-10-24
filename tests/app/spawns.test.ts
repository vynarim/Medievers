import { describe, expect, it } from 'vitest';
import { spawnColumns } from '../../src/app/spawns.ts';
import { Material, type Mask } from '../../src/sim/index.ts';

/** Flat ground at y = 500, with a 6 px wide pillar at x = 600 rising to y = 100. */
function mask(): Mask {
  const width = 2000;
  const height = 600;
  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pillar = x >= 597 && x < 603 && y >= 100;
      if (y >= 500 || pillar) data[y * width + x] = Material.Earth;
    }
  }
  return { width, height, data };
}

describe('spawnColumns', () => {
  it('gives each house the number of units asked, on its own side', () => {
    for (const n of [1, 3, 4, 6]) {
      const cols = spawnColumns(mask(), 2, n);
      expect(cols.map((c) => c.length)).toEqual([n, n]);
      for (const x of cols[0] ?? []) expect(x).toBeLessThan(1000);
      for (const x of cols[1] ?? []) expect(x).toBeGreaterThan(1000);
    }
  });

  it('keeps clear of the map ends and of pillars', () => {
    const all = spawnColumns(mask(), 2, 6).flat();
    for (const x of all) {
      expect(x).toBeGreaterThanOrEqual(160);
      expect(x).toBeLessThanOrEqual(1840);
      expect(Math.abs(x - 600)).toBeGreaterThan(20);
    }
  });
});
