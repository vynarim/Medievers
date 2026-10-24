import { describe, expect, it } from 'vitest';
import { MAP_THEMES, generatedMapId, parseMapId } from '../../src/content/maps.ts';
import { Material, generateMap } from '../../src/sim/index.ts';
import { FNV_OFFSET, hashBytes } from '../../src/sim/math/hash.ts';

const hash = (d: Uint8Array): number => hashBytes(FNV_OFFSET, d) >>> 0;

describe('generated maps (GDD §10)', () => {
  it('draw the same map from the same seed, and another from another seed', () => {
    for (const theme of MAP_THEMES) {
      const a = generateMap(theme, 42);
      const b = generateMap(theme, 42);
      const c = generateMap(theme, 43);
      expect(hash(a.mask.data)).toBe(hash(b.mask.data));
      expect(a.structures).toEqual(b.structures);
      expect(hash(a.mask.data)).not.toBe(hash(c.mask.data));
    }
  });

  it('keep the reference map of each theme (a change here moves every generated replay)', () => {
    const got = MAP_THEMES.map((t) => hash(generateMap(t, 7).mask.data).toString(16));
    expect(got).toMatchSnapshot();
  });

  it('build some wooden towers on mottes in the valley and on the coast, none in the Holy Land', () => {
    const kinds = (theme: (typeof MAP_THEMES)[number]) =>
      [1, 2, 3, 4, 5, 6, 7, 8].flatMap((seed) =>
        generateMap(theme, seed).structures.map((s) => s.type),
      );
    expect(kinds('valley')).toContain('woodTower');
    expect(kinds('valley')).toContain('tower');
    expect(kinds('coast')).toContain('woodTower');
    expect(kinds('holyLand')).not.toContain('woodTower');
  });

  it('have bedrock at the bottom, open sky at the top, and structures inside the map', () => {
    for (const theme of MAP_THEMES) {
      for (const seed of [1, 2, 3, 4, 5]) {
        const { mask, structures } = generateMap(theme, seed);
        const w = mask.width;
        expect(mask.data[(mask.height - 1) * w + 100]).toBe(Material.Rock);
        expect(mask.data[10 * w + 100]).toBe(Material.Air);
        for (const s of structures) {
          const x = 'build' in s ? s.build.x : s.rect[0];
          expect(x).toBeGreaterThan(300);
          expect(x).toBeLessThan(w - 300);
        }
      }
    }
  });

  it('give the coast its sea and a beach running into it, and the Holy Land its fortress', () => {
    const coast = generateMap('coast', 9);
    expect(coast.waterLevel).toBeDefined();
    const w = coast.mask.width;
    const level = coast.waterLevel ?? 0;
    const wet = [0, w - 1].some((x) => coast.mask.data[level * w + x] === Material.Air);
    expect(wet).toBe(true);
    const holy = generateMap('holyLand', 9);
    expect(holy.structures.map((s) => s.type)).toEqual(['tower', 'wall', 'tower']);
  });

  it('are named by theme and seed in the logs', () => {
    const id = generatedMapId('holyLand', 0xdeadbeef);
    expect(id).toBe('holyLand@deadbeef');
    expect(parseMapId(id)).toEqual({ theme: 'holyLand', seed: 0xdeadbeef });
    expect(parseMapId('greybox-valley')).toBeNull();
    expect(parseMapId('moon@12')).toBeNull();
  });
});
