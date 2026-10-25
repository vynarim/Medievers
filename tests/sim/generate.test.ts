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

  it('give the snowy pass a frozen lake in its hollow, and no water anywhere else', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const { mask, waterLevel, structures } = generateMap('pass', seed);
      expect(waterLevel).toBeDefined();
      const level = waterLevel ?? 0;
      const w = mask.width;
      const at = (x: number, y: number): number => mask.data[y * w + x] ?? -1;
      // The ice lies just above the water, over a stretch of the middle of the map.
      const iced: number[] = [];
      for (let x = 0; x < w; x++) if (at(x, level - 1) === Material.Ice) iced.push(x);
      expect(iced.length).toBeGreaterThan(300);
      const [first = 0] = iced;
      const last = iced[iced.length - 1] ?? 0;
      expect(first).toBeGreaterThan(w / 4);
      expect(last).toBeLessThan((3 * w) / 4);
      // Under the ice, open water; beyond the lake, the ground stands above the water.
      expect(at((first + last) >> 1, level + 4)).toBe(Material.Air);
      for (let x = 0; x < w; x += 16) {
        if (x >= first - 40 && x <= last + 40) continue;
        expect(at(x, level)).not.toBe(Material.Air);
      }
      // Nothing is built on the ice.
      for (const s of structures) {
        const x = 'build' in s ? s.build.x : s.rect[0];
        const sw = 'build' in s ? s.build.width : s.rect[2];
        expect(x + sw < first || x > last).toBe(true);
      }
    }
  });

  it('are named by theme and seed in the logs', () => {
    const id = generatedMapId('holyLand', 0xdeadbeef);
    expect(id).toBe('holyLand@deadbeef');
    expect(parseMapId(id)).toEqual({ theme: 'holyLand', seed: 0xdeadbeef });
    expect(parseMapId('greybox-valley')).toBeNull();
    expect(parseMapId('moon@12')).toBeNull();
  });
});
