// Writes the greybox maps (code-drawn placeholders, ASSETS §2.1) to public/assets/maps/<id>/mask.png.
// Usage: node tools/gen-greybox-maps.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { GREYBOX_MAPS } from '../src/content/maps.ts';
import { Material } from '../src/sim/terrain/material.ts';
import { buildMaskPng } from './gen-test-maps.ts';

/** Integer triangle wave in [0, amplitude], period p. */
const tri = (x: number, p: number, amplitude: number): number =>
  Math.trunc((Math.abs((x % p) - p / 2) * 2 * amplitude) / p);

/**
 * A square tower of built stone from `top` down into the ground, `x0` to `x1`, crowned with
 * merlons; the battlement is left clear for 40 px on the ladder's side so a climber can step on.
 */
function tower(x: number, y: number, x0: number, x1: number, top: number, ladderSide: -1 | 1) {
  if (x < x0 || x >= x1) return false;
  if (y >= top) return true;
  const clear = ladderSide < 0 ? x < x0 + 40 : x >= x1 - 40;
  // Merlons 18 px high, 16 px wide every 32 px.
  return !clear && y >= top - 18 && (x - x0) % 32 < 16;
}

/** « Vallée grise »: two hills, a central valley with a stone wall, two towers with ladders. */
function valley(x: number, y: number): number {
  const width = 3840;
  if (y >= 1560) return Material.Rock;
  const edge = Math.min(x, width - 1 - x);
  const rise = edge < 500 ? Math.trunc(((500 - edge) * 260) / 500) : 0;
  const ground = 980 + tri(x, 1280, 260) + tri(x, 170, 28) - rise;
  if (x >= 1900 && x < 1940 && y >= ground - 140 && y < ground) return Material.BuiltStone;
  // West tower, its ladder against the west face.
  if (y < ground + 40 && tower(x, y, 1340, 1460, 900, -1)) return Material.BuiltStone;
  if (x >= 1330 && x < 1334 && y >= 900 && y < ground) return Material.Ladder;
  // East tower, its ladder against the east face.
  if (y < ground + 40 && tower(x, y, 2560, 2690, 880, 1)) return Material.BuiltStone;
  if (x >= 2696 && x < 2700 && y >= 880 && y < ground) return Material.Ladder;
  return y >= ground ? Material.Earth : Material.Air;
}

const GENERATORS: Record<string, (x: number, y: number) => number> = { 'greybox-valley': valley };

for (const map of GREYBOX_MAPS) {
  const material = GENERATORS[map.id];
  if (!material) throw new Error(`no generator for ${map.id}`);
  const dir = new URL(`../public/assets/maps/${map.id}/`, import.meta.url);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    new URL('mask.png', dir),
    buildMaskPng({ id: map.id, width: map.width, height: map.height, material }),
  );
  console.log(`wrote public/assets/maps/${map.id}/mask.png`);
}
