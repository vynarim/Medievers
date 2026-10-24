// Resolves a map id to its collision mask in Node: shipped maps first, then test fixtures.
import { existsSync, readFileSync } from 'node:fs';
import { decodeMaskPng } from '../../src/app/loaders/mask-png.ts';
import type { Mask } from '../../src/sim/terrain/mask.ts';
import { parseMapId } from '../../src/content/maps.ts';
import { generateMap } from '../../src/sim/terrain/generate.ts';

const root = new URL('../../', import.meta.url);

export function maskPathFor(mapId: string): URL {
  const shipped = new URL(`public/assets/maps/${mapId}/mask.png`, root);
  if (existsSync(shipped)) return shipped;
  const fixture = new URL(`tests/fixtures/maps/${mapId}.png`, root);
  if (existsSync(fixture)) return fixture;
  throw new Error(`no mask for map "${mapId}"`);
}

export function loadMask(mapId: string): Mask {
  // A generated map is drawn again from its theme and seed.
  const gen = parseMapId(mapId);
  if (gen) return generateMap(gen.theme, gen.seed).mask;
  return decodeMaskPng(new Uint8Array(readFileSync(maskPathFor(mapId))));
}
