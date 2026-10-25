// Generated maps (GDD §10, 2026-10-25): the land of a theme drawn from a seed, with its towers,
// walls and rocks placed at random. Integer arithmetic and the sim's PRNG only, so the same id
// gives the same map in every browser and in Node, and a replay redraws the map it was played on.
import { MAP_GEN, type MapGen, type MapTheme } from '../../content/maps.ts';
import type { StructurePlacement } from '../../content/structures.ts';
import type { EnginePlacement } from '../../content/engines.ts';
import { createPrng, nextRange, type PrngState } from '../math/prng.ts';
import { Material } from './material.ts';
import type { Mask } from './mask.ts';

export interface GeneratedMap {
  readonly mask: Mask;
  /** the map's structures, ids from 1 (towers are built by the match) */
  readonly structures: readonly StructurePlacement[];
  /** px: top of the sea, when the theme has one */
  readonly waterLevel?: number;
  /** the map's siege engines (GDD §4.8) */
  readonly engines: readonly EnginePlacement[];
}

/** px of indestructible rock at the bottom of every map */
const BEDROCK = 40;
/** px kept free of towers and walls at each end of the map */
const END_MARGIN = 420;
/** px between two structures */
const STRUCTURE_GAP = 360;
/** Q14 one */
const ONE = 16384;

/** Smoothstep in Q14: 0 at t = 0, 1 at t = 1, flat at both ends. */
const smooth = (t: number): number => Math.trunc((t * t * (3 * ONE - 2 * t)) / (ONE * ONE));

/** A rock outcrop or pocket: an ellipse of rock. */
interface Blob {
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
}

/** A stone wall standing on the ground: its rectangle of built stone. */
interface Wall {
  readonly x: number;
  readonly top: number;
  readonly w: number;
  readonly bottom: number;
}

/** Adds a hill (h > 0) or a dip (h < 0) centred on c to the ground profile. */
function bump(ground: Int32Array, c: number, half: number, h: number, leePct: number): void {
  const left = half;
  // A dune climbs gently on one side and drops steeply on the other.
  const right = leePct > 0 ? Math.max(20, Math.trunc((half * leePct) / 100)) : half;
  for (let x = Math.max(0, c - left); x < Math.min(ground.length, c + right); x++) {
    const span = x < c ? left : right;
    const d = Math.abs(x - c);
    const t = ONE - Math.trunc((d * ONE) / span);
    ground[x] = (ground[x] ?? 0) - Math.trunc((h * smooth(t)) / ONE);
  }
}

/** Flattens the ground over [x0, x1) to its mean, easing into it over `ease` px each side. */
function flatten(ground: Int32Array, x0: number, x1: number, ease: number): number {
  let sum = 0;
  for (let x = x0; x < x1; x++) sum += ground[x] ?? 0;
  const level = Math.trunc(sum / Math.max(1, x1 - x0));
  for (let x = Math.max(0, x0 - ease); x < Math.min(ground.length, x1 + ease); x++) {
    const d = x < x0 ? x0 - x : x >= x1 ? x - x1 + 1 : 0;
    const k = d === 0 ? ONE : smooth(ONE - Math.trunc((d * ONE) / ease));
    const g = ground[x] ?? level;
    ground[x] = g + Math.trunc(((level - g) * k) / ONE);
  }
  return level;
}

/** px: height of the earthen motte under a wooden tower, and the run of its slopes */
const MOTTE_HEIGHT = 70;
const MOTTE_SLOPE = 90;

/** Raises a motte castrale between x0 and x1: a flat top, eased slopes on both sides. */
function motte(ground: Int32Array, x0: number, x1: number): void {
  for (let x = Math.max(0, x0 - MOTTE_SLOPE); x < Math.min(ground.length, x1 + MOTTE_SLOPE); x++) {
    const d = x < x0 ? x0 - x : x >= x1 ? x - x1 + 1 : 0;
    const k = d === 0 ? ONE : smooth(ONE - Math.trunc((d * ONE) / MOTTE_SLOPE));
    ground[x] = (ground[x] ?? 0) - Math.trunc((MOTTE_HEIGHT * k) / ONE);
  }
}

/** A column for a structure of width w, clear of the ends and of the others; null if none. */
function freeColumn(
  prng: PrngState,
  width: number,
  w: number,
  taken: [number, number][],
  lo = END_MARGIN,
  hi = width - END_MARGIN,
): number | null {
  for (let tries = 0; tries < 40; tries++) {
    const x = nextRange(prng, lo, Math.max(lo, hi - w));
    if (taken.every(([a, b]) => x + w + STRUCTURE_GAP <= a || x >= b + STRUCTURE_GAP)) {
      taken.push([x, x + w]);
      return x;
    }
  }
  return null;
}

/** first id of the siege engines, apart from the structures' */
const ENGINE_ID = 200;
/** where the pair of siege engines stands, in percent of the width from each end */
const ENGINE_AT_PCT = 28;
/** px a siege engine keeps from the towers and walls */
const ENGINE_GAP = 120;
/** chance in percent of an engine in the middle of the map, when the theme has one */
const MIDDLE_PCT = 50;

/**
 * The siege engines of the theme: a pair at the same distance from each end, of the same type,
 * and sometimes one in the middle; moved off towers and walls, and out of the sea. Drawn with a
 * PRNG of their own, so that the land of a seed stays as it was before them.
 */
function placeEngines(
  g: MapGen,
  seed: number,
  ground: Int32Array,
  taken: readonly (readonly [number, number])[],
): EnginePlacement[] {
  const e = g.engines;
  if (!e || e.pair.length === 0) return [];
  const prng = createPrng((seed ^ 0x454e4749) >>> 0);
  const out: EnginePlacement[] = [];
  const clear = (x: number): boolean =>
    taken.every(([a, b]) => x < a - ENGINE_GAP || x > b + ENGINE_GAP) &&
    (g.waterLevel === undefined || (ground[x] ?? 0) < g.waterLevel - 20);
  /** The nearest clear column to x, looking inwards then outwards. */
  const near = (x: number, inward: 1 | -1): number | null => {
    for (let d = 0; d < 600; d += 10) {
      for (const c of [x + inward * d, x - inward * d])
        if (c > 60 && c < g.width - 60 && clear(c)) return c;
    }
    return null;
  };
  const type = e.pair[nextRange(prng, 0, e.pair.length - 1)];
  const at = Math.trunc((g.width * ENGINE_AT_PCT) / 100);
  const left = near(at, 1);
  const right = near(g.width - 1 - at, -1);
  if (type && left !== null && right !== null) {
    out.push({ id: ENGINE_ID, type, x: left }, { id: ENGINE_ID + 1, type, x: right });
  }
  const middle = e.middle;
  if (middle && middle.length > 0 && nextRange(prng, 0, 99) < MIDDLE_PCT) {
    const m = middle[nextRange(prng, 0, middle.length - 1)];
    const x = near(g.width >> 1, 1);
    if (m && x !== null) out.push({ id: ENGINE_ID + 2, type: m, x });
  }
  return out;
}

/** The map of theme `theme` drawn from `seed`. */
export function generateMap(theme: MapTheme, seed: number): GeneratedMap {
  const g: MapGen = MAP_GEN[theme];
  const { width, height } = g;
  const prng = createPrng((seed ^ 0x4d415053) >>> 0);
  const ground = new Int32Array(width).fill(g.base);

  // Hills or dunes, then the bowl of the ends, then the ripples.
  const n = nextRange(prng, g.bumps[0], g.bumps[1]);
  for (let i = 0; i < n; i++) {
    const c = nextRange(prng, 0, width - 1);
    const half = nextRange(prng, g.bumpHalfWidth[0], g.bumpHalfWidth[1]);
    const h = nextRange(prng, -g.bumpHeight, g.bumpHeight);
    bump(ground, c, half, theme === 'holyLand' ? Math.abs(h) : h, g.leePct ?? 0);
  }
  const west = nextRange(prng, 0, 1) === 0;
  if (g.cliff !== undefined) {
    // A cliff at one end, its face steep, its top a little rolling.
    const top = nextRange(prng, 380, 620);
    for (let i = 0; i < width; i++) {
      const d = west ? top - i : i - (width - 1 - top);
      if (d <= -60) continue;
      const k = d >= 0 ? ONE : smooth(ONE + Math.trunc((d * ONE) / 60));
      ground[i] = (ground[i] ?? 0) - Math.trunc((g.cliff * k) / ONE);
    }
  }
  const ripplePeriod = nextRange(prng, 140, 220);
  for (let x = 0; x < width; x++) {
    const edge = Math.min(x, width - 1 - x);
    const rise = edge < g.edgePx ? Math.trunc(((g.edgePx - edge) * g.edgeRise) / g.edgePx) : 0;
    const p = x % ripplePeriod;
    const tri = Math.trunc((Math.abs(p - (ripplePeriod >> 1)) * 2 * g.ripple) / ripplePeriod);
    // A beach has no bowl: it runs down into the sea.
    const beachSide = g.beach === true && (west ? x > width >> 1 : x < width >> 1);
    ground[x] = (ground[x] ?? 0) - (beachSide ? 0 : rise) + tri;
  }
  if (g.beach && g.waterLevel !== undefined) {
    // The end opposite the cliff: sand sloping gently under the sea.
    const len = nextRange(prng, 700, 950);
    const sea = g.waterLevel + 90;
    for (let i = 0; i < len; i++) {
      const x = west ? width - 1 - i : i;
      const k = smooth(ONE - Math.trunc((i * ONE) / len));
      const gy = ground[x] ?? g.base;
      ground[x] = gy + Math.trunc((Math.max(0, sea - gy) * k) / ONE);
    }
  }
  for (let x = 0; x < width; x++) {
    ground[x] = Math.max(g.minGround, Math.min(g.maxGround, ground[x] ?? g.base));
  }

  // Structures: a Saracen fortress, towers built by the match, stone walls on the ground.
  const structures: StructurePlacement[] = [];
  const walls: Wall[] = [];
  const taken: [number, number][] = [];
  let id = 1;
  if (g.fortress) {
    const tw = nextRange(prng, 110, 130);
    const curtain = nextRange(prng, 200, 280);
    const span = 2 * tw + curtain;
    const x0 = nextRange(prng, Math.trunc(width / 3), Math.trunc((2 * width) / 3) - span);
    const level = flatten(ground, x0 - 20, x0 + span + 20, 120);
    taken.push([x0, x0 + span]);
    structures.push({ id: id++, type: 'tower', build: { x: x0, width: tw, ladder: -1 } });
    const top = level - nextRange(prng, 90, 120);
    walls.push({ x: x0 + tw, top, w: curtain, bottom: level + 12 });
    structures.push({
      id: id++,
      type: 'wall',
      rect: [x0 + tw, top, curtain, level + 12 - top],
    });
    structures.push({
      id: id++,
      type: 'tower',
      build: { x: x0 + tw + curtain, width: tw, ladder: 1 },
    });
  }
  const towers = nextRange(prng, g.towers[0], g.towers[1]);
  for (let i = 0; i < towers; i++) {
    const tw = nextRange(prng, 110, 140);
    const x = freeColumn(prng, width, tw, taken);
    if (x === null) continue;
    flatten(ground, x - 10, x + tw + 10, 60);
    const ladder = nextRange(prng, 0, 1) === 0 ? -1 : 1;
    // Wood or stone from the column already drawn, so the rest of the map draws as before.
    const wood = g.woodTowers === true && ((x >> 4) & 1) === 1;
    if (wood) motte(ground, x - 10, x + tw + 10);
    structures.push({
      id: id++,
      type: wood ? 'woodTower' : 'tower',
      build: { x, width: tw, ladder },
    });
  }
  const wallCount = nextRange(prng, g.walls[0], g.walls[1]);
  for (let i = 0; i < wallCount; i++) {
    const w = nextRange(prng, 34, 46);
    const x = freeColumn(prng, width, w, taken);
    if (x === null) continue;
    let foot = 0;
    for (let k = x; k < x + w; k++) foot = Math.max(foot, ground[k] ?? 0);
    const top =
      Math.min(...Array.from({ length: w }, (_, k) => ground[x + k] ?? foot)) -
      nextRange(prng, 110, 160);
    walls.push({ x, top, w, bottom: foot + 12 });
    structures.push({ id: id++, type: 'wall', rect: [x, top, w, foot + 12 - top] });
  }

  // Rock: outcrops breaking the surface, pockets deeper down.
  const blobs: Blob[] = [];
  const outcrops = nextRange(prng, g.outcrops[0], g.outcrops[1]);
  for (let i = 0; i < outcrops; i++) {
    const cx = nextRange(prng, END_MARGIN, width - END_MARGIN);
    if (taken.some(([a, b]) => cx > a - 120 && cx < b + 120)) continue;
    blobs.push({
      cx,
      cy: (ground[cx] ?? g.base) + nextRange(prng, 10, 40),
      rx: nextRange(prng, 50, 110),
      ry: nextRange(prng, 30, 60),
    });
  }
  const pockets = nextRange(prng, g.pockets[0], g.pockets[1]);
  for (let i = 0; i < pockets; i++) {
    const cx = nextRange(prng, 200, width - 200);
    const cy = (ground[cx] ?? g.base) + nextRange(prng, 160, 320);
    if (cy > height - BEDROCK - 40) continue;
    blobs.push({ cx, cy, rx: nextRange(prng, 60, 160), ry: nextRange(prng, 30, 70) });
  }

  const data = new Uint8Array(width * height);
  for (let x = 0; x < width; x++) {
    const top = ground[x] ?? g.base;
    for (let y = Math.max(0, top); y < height; y++) {
      data[y * width + x] = y >= height - BEDROCK ? Material.Rock : Material.Earth;
    }
  }
  for (const b of blobs) {
    for (let y = Math.max(0, b.cy - b.ry); y < Math.min(height, b.cy + b.ry); y++) {
      for (let x = Math.max(0, b.cx - b.rx); x < Math.min(width, b.cx + b.rx); x++) {
        const dx = x - b.cx;
        const dy = y - b.cy;
        // Inside the ellipse: (dx/rx)² + (dy/ry)² <= 1, in integers.
        if (dx * dx * b.ry * b.ry + dy * dy * b.rx * b.rx > b.rx * b.rx * b.ry * b.ry) continue;
        if (y >= (ground[x] ?? g.base) - 18) data[y * width + x] = Material.Rock;
      }
    }
  }
  for (const w of walls) {
    for (let y = Math.max(0, w.top); y < Math.min(height, w.bottom); y++) {
      for (let x = w.x; x < w.x + w.w; x++) data[y * width + x] = Material.BuiltStone;
    }
  }
  return {
    mask: { width, height, data },
    structures,
    engines: placeEngines(g, seed, ground, taken),
    ...(g.waterLevel !== undefined ? { waterLevel: g.waterLevel } : {}),
  };
}
