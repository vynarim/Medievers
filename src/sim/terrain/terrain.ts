// Destructible terrain: the collision mask split into 256 × 256 chunks with an incremental hash
// (TECH_SPEC §4.2, §3). Coordinates are in px; callers convert from sub-pixels.
import { FNV_OFFSET, hashBytes, hashInt } from '../math/hash.ts';
import { Material } from './material.ts';
import type { Mask } from './mask.ts';

export const CHUNK_SHIFT = 8;
export const CHUNK_SIZE = 1 << CHUNK_SHIFT;

/** Per-material rules the terrain needs, indexed by material id (built from src/content). */
export interface MaterialRules {
  readonly solid: readonly boolean[];
  readonly destructible: readonly boolean[];
  /** percent, 100 = earth */
  readonly resistancePct: readonly number[];
}

export interface Terrain {
  /** px */
  readonly width: number;
  /** px */
  readonly height: number;
  readonly data: Uint8Array;
  readonly chunkCols: number;
  readonly chunkRows: number;
  /** FNV-1a of each chunk, valid when its hashDirty flag is 0 */
  readonly chunkHash: Uint32Array;
  readonly hashDirty: Uint8Array;
  /** XOR of all valid chunk hashes */
  maskHash: number;
  readonly rules: MaterialRules;
  /**
   * percent of its radius a carve may reach: 100, or more when the map holds a material that
   * breaks easier than earth (the ice of a frozen lake: 250)
   */
  readonly reachPct: number;
}

/** How far a carve may reach on a mask, in percent of its radius (see Terrain.reachPct). */
function reachOf(data: Uint8Array, rules: MaterialRules): number {
  const present = new Uint8Array(rules.solid.length);
  for (const m of data) present[m] = 1;
  let reach = 100;
  present.forEach((p, m) => {
    const res = rules.resistancePct[m] ?? 100;
    if (p && rules.destructible[m] && res > 0 && res < 100) {
      reach = Math.max(reach, Math.ceil(10000 / res));
    }
  });
  return reach;
}

export function createTerrain(mask: Mask, rules: MaterialRules): Terrain {
  const chunkCols = Math.ceil(mask.width / CHUNK_SIZE);
  const chunkRows = Math.ceil(mask.height / CHUNK_SIZE);
  const t: Terrain = {
    width: mask.width,
    height: mask.height,
    data: mask.data.slice(),
    chunkCols,
    chunkRows,
    chunkHash: new Uint32Array(chunkCols * chunkRows),
    hashDirty: new Uint8Array(chunkCols * chunkRows).fill(1),
    maskHash: 0,
    rules,
    reachPct: reachOf(mask.data, rules),
  };
  terrainHash(t);
  return t;
}

/** Deep copy, for snapshots and AI look-ahead. */
export function cloneTerrain(t: Terrain): Terrain {
  return {
    ...t,
    data: t.data.slice(),
    chunkHash: t.chunkHash.slice(),
    hashDirty: t.hashDirty.slice(),
  };
}

export function materialOf(t: Terrain, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= t.width || y >= t.height) return Material.Air;
  return t.data[y * t.width + x] ?? Material.Air;
}

/** Blocks units and projectiles. Outside the map is open air. */
export function isSolid(t: Terrain, x: number, y: number): boolean {
  return t.rules.solid[materialOf(t, x, y)] ?? false;
}

function hashChunk(t: Terrain, index: number): number {
  const cx = index % t.chunkCols;
  const cy = Math.trunc(index / t.chunkCols);
  const x0 = cx * CHUNK_SIZE;
  const y0 = cy * CHUNK_SIZE;
  const x1 = Math.min(x0 + CHUNK_SIZE, t.width);
  const y1 = Math.min(y0 + CHUNK_SIZE, t.height);
  let h = hashInt(FNV_OFFSET, index);
  for (let y = y0; y < y1; y++) {
    h = hashBytes(h, t.data.subarray(y * t.width + x0, y * t.width + x1));
  }
  return h;
}

/** Hash of the whole mask; only chunks modified since the last call are rehashed. */
export function terrainHash(t: Terrain): number {
  for (let i = 0; i < t.hashDirty.length; i++) {
    if (t.hashDirty[i] === 0) continue;
    const next = hashChunk(t, i);
    t.maskHash = (t.maskHash ^ (t.chunkHash[i] ?? 0) ^ next) >>> 0;
    t.chunkHash[i] = next;
    t.hashDirty[i] = 0;
  }
  return t.maskHash;
}

/** Same value as terrainHash, recomputed from scratch (tests and desync diagnosis). */
export function fullTerrainHash(t: Terrain): number {
  let h = 0;
  for (let i = 0; i < t.chunkHash.length; i++) h = (h ^ hashChunk(t, i)) >>> 0;
  return h;
}

/** Every chunk's hash must be computed again (the terrain was edited in place). */
export function markAllDirty(t: Terrain): void {
  t.hashDirty.fill(1);
}

function markDirty(t: Terrain, x0: number, y0: number, x1: number, y1: number): void {
  for (let cy = y0 >> CHUNK_SHIFT; cy <= y1 >> CHUNK_SHIFT; cy++) {
    for (let cx = x0 >> CHUNK_SHIFT; cx <= x1 >> CHUNK_SHIFT; cx++) {
      t.hashDirty[cy * t.chunkCols + cx] = 1;
    }
  }
}

/**
 * Carves a disc of radius r px centred on pixel (cx, cy): destructible pixels become air.
 * A material with resistance R% is only carved within r × 100 / R. Returns the pixels carved.
 */
export function carveCircle(
  t: Terrain,
  cx: number,
  cy: number,
  r: number,
  /** digging tools cut every destructible pixel of the disc, slower in hard materials */
  ignoreResistance = false,
): number {
  if (r <= 0) return 0;
  // A weak material (ice) breaks beyond the radius: the scan reaches as far as it can break.
  const reach = ignoreResistance ? r : Math.trunc((r * t.reachPct) / 100);
  const x0 = Math.max(0, cx - reach);
  const y0 = Math.max(0, cy - reach);
  const x1 = Math.min(t.width - 1, cx + reach);
  const y1 = Math.min(t.height - 1, cy + reach);
  if (x0 > x1 || y0 > y1) return 0;
  const r2x10k = r * r * 10000;
  let carved = 0;
  for (let y = y0; y <= y1; y++) {
    const dy = y - cy;
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const d2 = dx * dx + dy * dy;
      if (d2 > reach * reach) continue;
      const i = y * t.width + x;
      const m = t.data[i] ?? Material.Air;
      if (m === Material.Air || !t.rules.destructible[m]) continue;
      const res = ignoreResistance ? 100 : (t.rules.resistancePct[m] ?? 100);
      // d ≤ r × 100 / res  ⇔  d² × res² ≤ r² × 100²
      if (d2 * res * res > r2x10k) continue;
      t.data[i] = Material.Air;
      carved++;
    }
  }
  if (carved > 0) markDirty(t, x0, y0, x1, y1);
  return carved;
}

/**
 * Lifts the pixels of rectangle (x, y, w, h) for which `take(index)` is true out of the
 * terrain: they become air, and their materials are returned row by row (0 where not taken).
 */
export function liftRect(
  t: Terrain,
  x: number,
  y: number,
  w: number,
  h: number,
  take: (index: number) => boolean,
): Uint8Array {
  const out = new Uint8Array(w * h);
  let lifted = 0;
  for (let j = 0; j < h; j++) {
    const ty = y + j;
    if (ty < 0 || ty >= t.height) continue;
    for (let i = 0; i < w; i++) {
      const tx = x + i;
      if (tx < 0 || tx >= t.width) continue;
      const k = ty * t.width + tx;
      const m = t.data[k] ?? Material.Air;
      if (m === Material.Air || !take(k)) continue;
      out[j * w + i] = m;
      t.data[k] = Material.Air;
      lifted++;
    }
  }
  if (lifted > 0) {
    markDirty(
      t,
      Math.max(0, x),
      Math.max(0, y),
      Math.min(t.width - 1, x + w - 1),
      Math.min(t.height - 1, y + h - 1),
    );
  }
  return out;
}

/** A bitmap shape for stamping (walls, ladders); non-zero pixels are filled. */
export interface StampShape {
  /** px */
  readonly width: number;
  /** px */
  readonly height: number;
  readonly data: Uint8Array;
}

/**
 * Writes `material` where the shape is set and the terrain is air, with the shape's top-left
 * corner at (x, y). Existing ground is never overwritten. Returns the pixels written.
 */
export function stamp(
  t: Terrain,
  x: number,
  y: number,
  shape: StampShape,
  material: number,
): number {
  let written = 0;
  let minX = t.width;
  let minY = t.height;
  let maxX = -1;
  let maxY = -1;
  for (let sy = 0; sy < shape.height; sy++) {
    const ty = y + sy;
    if (ty < 0 || ty >= t.height) continue;
    for (let sx = 0; sx < shape.width; sx++) {
      const tx = x + sx;
      if (tx < 0 || tx >= t.width || shape.data[sy * shape.width + sx] === 0) continue;
      const i = ty * t.width + tx;
      if (t.data[i] !== Material.Air) continue;
      t.data[i] = material;
      written++;
      if (tx < minX) minX = tx;
      if (tx > maxX) maxX = tx;
      if (ty < minY) minY = ty;
      if (ty > maxY) maxY = ty;
    }
  }
  if (written > 0) markDirty(t, minX, minY, maxX, maxY);
  return written;
}

/** Filled rectangle shape, the basic stone wall block. */
export function rectShape(width: number, height: number): StampShape {
  return { width, height, data: new Uint8Array(width * height).fill(1) };
}
