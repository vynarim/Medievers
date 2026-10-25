import { describe, expect, it } from 'vitest';
import { MATERIALS, MATERIAL_RULES } from '../../../src/content/materials.ts';
import {
  CHUNK_SIZE,
  Material,
  carveCircle,
  cloneTerrain,
  createTerrain,
  fullTerrainHash,
  isSolid,
  materialOf,
  rectShape,
  stamp,
  terrainHash,
  type Mask,
  type Terrain,
} from '../../../src/sim/terrain/index.ts';

/** 600 × 400 map (3 × 2 chunks): earth below y = 200, a rock column at x 300..309. */
function makeTerrain(): Terrain {
  const width = 600;
  const height = 400;
  const data = new Uint8Array(width * height);
  for (let y = 200; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data[y * width + x] = x >= 300 && x < 310 ? Material.Rock : Material.Earth;
    }
  }
  const mask: Mask = { width, height, data };
  return createTerrain(mask, MATERIAL_RULES);
}

function countMaterial(t: Terrain, m: number): number {
  let n = 0;
  for (const v of t.data) if (v === m) n++;
  return n;
}

describe('material table', () => {
  it('is indexed by material id', () => {
    MATERIALS.forEach((m, i) => expect(m.id).toBe(i));
  });

  it('lets an explosion break ice far wider than earth (the frozen lake, 2026-10-25)', () => {
    // A crust of ice 20 px thick over the air, beside a slab of earth as thick.
    const width = 400;
    const height = 100;
    const data = new Uint8Array(width * height);
    for (let y = 40; y < 60; y++) {
      for (let x = 0; x < width; x++) data[y * width + x] = x < 200 ? Material.Ice : Material.Earth;
    }
    const t = createTerrain({ width, height, data }, MATERIAL_RULES);
    const hole = (x0: number, x1: number): number => {
      let n = 0;
      for (let x = x0; x < x1; x++) if (materialOf(t, x, 50) === Material.Air) n++;
      return n;
    };
    carveCircle(t, 100, 50, 30);
    carveCircle(t, 300, 50, 30);
    expect(hole(200, 400)).toBe(61);
    // Ice resists at 40 %: the same blast opens a hole 2.5 times as wide.
    expect(hole(0, 200)).toBeGreaterThanOrEqual(150);
  });
});

describe('terrain chunks and hash', () => {
  it('splits the map into 256 px chunks', () => {
    const t = makeTerrain();
    expect(CHUNK_SIZE).toBe(256);
    expect([t.chunkCols, t.chunkRows]).toEqual([3, 2]);
  });

  it('gives the same hash to identical terrains and copies the source mask', () => {
    const a = makeTerrain();
    const b = makeTerrain();
    expect(terrainHash(a)).toBe(terrainHash(b));
    expect(terrainHash(a)).toBe(fullTerrainHash(a));
  });

  it('carving then hashing is stable and matches a full recompute', () => {
    const t = makeTerrain();
    const before = terrainHash(t);
    carveCircle(t, 100, 210, 30);
    const after = terrainHash(t);
    expect(after).not.toBe(before);
    expect(terrainHash(t)).toBe(after);
    expect(after).toBe(fullTerrainHash(t));
    expect(t.hashDirty.every((d) => d === 0)).toBe(true);
  });

  it('only rehashes the chunks a carve touched', () => {
    const t = makeTerrain();
    terrainHash(t);
    carveCircle(t, 100, 210, 30);
    expect(Array.from(t.hashDirty)).toEqual([1, 0, 0, 0, 0, 0]);
    carveCircle(t, 256, 256, 10);
    expect(Array.from(t.hashDirty)).toEqual([1, 1, 0, 1, 1, 0]);
  });

  it('gives the same hash whatever the order of disjoint carves', () => {
    const a = makeTerrain();
    const b = makeTerrain();
    carveCircle(a, 100, 210, 20);
    carveCircle(a, 500, 300, 40);
    carveCircle(b, 500, 300, 40);
    carveCircle(b, 100, 210, 20);
    expect(terrainHash(a)).toBe(terrainHash(b));
  });

  it('distinguishes chunks with identical content at different places', () => {
    const a = makeTerrain();
    const b = makeTerrain();
    carveCircle(a, 100, 300, 20);
    carveCircle(b, 100 + 256, 300, 20);
    expect(terrainHash(a)).not.toBe(terrainHash(b));
  });

  it('clones independently', () => {
    const t = makeTerrain();
    const c = cloneTerrain(t);
    carveCircle(c, 100, 250, 20);
    expect(terrainHash(t)).not.toBe(terrainHash(c));
    expect(materialOf(t, 100, 250)).toBe(Material.Earth);
  });
});

describe('carveCircle', () => {
  it('carves exactly the pixels within the radius', () => {
    const t = makeTerrain();
    // Fully inside earth: the disc of radius 10 has 317 lattice points.
    expect(carveCircle(t, 100, 300, 10)).toBe(317);
    expect(materialOf(t, 100, 300)).toBe(Material.Air);
    expect(materialOf(t, 110, 300)).toBe(Material.Air);
    expect(materialOf(t, 111, 300)).toBe(Material.Earth);
    expect(materialOf(t, 108, 308)).toBe(Material.Earth);
  });

  it('leaves rock intact', () => {
    const t = makeTerrain();
    const rock = countMaterial(t, Material.Rock);
    carveCircle(t, 305, 300, 60);
    expect(countMaterial(t, Material.Rock)).toBe(rock);
    expect(materialOf(t, 305, 300)).toBe(Material.Rock);
    expect(materialOf(t, 250, 300)).toBe(Material.Air);
  });

  it('carves built stone over a smaller radius (resistance 150 %)', () => {
    const t = makeTerrain();
    stamp(t, 50, 100, rectShape(100, 60), Material.BuiltStone);
    carveCircle(t, 100, 130, 30);
    // 30 × 100 / 150 = 20 px into stone.
    expect(materialOf(t, 120, 130)).toBe(Material.Air);
    expect(materialOf(t, 121, 130)).toBe(Material.BuiltStone);
  });

  it('clips at the map edges and ignores empty radii', () => {
    const t = makeTerrain();
    expect(carveCircle(t, 0, 399, 15)).toBeGreaterThan(0);
    expect(carveCircle(t, -100, -100, 15)).toBe(0);
    expect(carveCircle(t, 100, 300, 0)).toBe(0);
    expect(terrainHash(t)).toBe(fullTerrainHash(t));
  });
});

describe('stamp', () => {
  it('fills air only and never overwrites ground', () => {
    const t = makeTerrain();
    const written = stamp(t, 10, 190, rectShape(20, 20), Material.BuiltStone);
    expect(written).toBe(20 * 10);
    expect(materialOf(t, 10, 190)).toBe(Material.BuiltStone);
    expect(materialOf(t, 10, 205)).toBe(Material.Earth);
    expect(terrainHash(t)).toBe(fullTerrainHash(t));
  });

  it('clips at the map edges', () => {
    const t = makeTerrain();
    expect(stamp(t, -5, -5, rectShape(10, 10), Material.Wood)).toBe(25);
  });

  it('makes ladders walkable but not solid', () => {
    const t = makeTerrain();
    stamp(t, 400, 0, rectShape(4, 200), Material.Ladder);
    expect(materialOf(t, 401, 100)).toBe(Material.Ladder);
    expect(isSolid(t, 401, 100)).toBe(false);
    expect(isSolid(t, 401, 250)).toBe(true);
    expect(isSolid(t, -1, 250)).toBe(false);
  });
});
