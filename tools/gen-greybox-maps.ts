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
 * « Vallée grise »: two hills and a central valley with a stone wall. Its two towers are built by
 * the match (src/content/maps.ts), so their height is a setting.
 */
function valley(x: number, y: number): number {
  const width = 3840;
  if (y >= 1560) return Material.Rock;
  const edge = Math.min(x, width - 1 - x);
  const rise = edge < 500 ? Math.trunc(((500 - edge) * 260) / 500) : 0;
  const ground = 980 + tri(x, 1280, 260) + tri(x, 170, 28) - rise;
  if (x >= 1900 && x < 1940 && y >= ground - 140 && y < ground) return Material.BuiltStone;
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
