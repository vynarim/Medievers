// The map of a match: drawn from its theme and the match seed (generated maps), or, for the logs
// of the first builds, the fixed greybox valley. Pure but for the legacy mask, loaded by main.
import {
  GREYBOX_MAPS,
  MAPS,
  generatedMapId,
  parseMapId,
  type MapDef,
  type MapTheme,
} from '../content/maps.ts';
import type { StructurePlacement } from '../content/structures.ts';
import type { EnginePlacement } from '../content/engines.ts';
import { generateMap } from '../sim/terrain/generate.ts';
import type { Mask } from '../sim/terrain/mask.ts';

export interface BuiltMap {
  readonly def: MapDef;
  /** the id game logs store: theme and seed of a generated map, or the fixed map's id */
  readonly mapId: string;
  readonly mask: Mask;
  readonly structures?: readonly StructurePlacement[];
  readonly engines?: readonly EnginePlacement[];
  /** px: top of the sea, if the map has one */
  readonly waterLevel?: number;
}

/** The map of theme `theme` drawn for the match of seed `seed`. */
export function buildMap(theme: MapTheme, seed: number): BuiltMap {
  const def = MAPS.find((m) => m.theme === theme) ?? MAPS[0];
  if (!def) throw new Error('no map');
  const g = generateMap(def.theme, seed);
  return {
    def,
    mapId: generatedMapId(def.theme, seed),
    mask: g.mask,
    structures: g.structures,
    engines: g.engines,
    ...(g.waterLevel !== undefined ? { waterLevel: g.waterLevel } : {}),
  };
}

/** The map a game log was played on, if it can be drawn again without loading a file. */
export function mapForLog(mapId: string): BuiltMap | null {
  const gen = parseMapId(mapId);
  return gen ? buildMap(gen.theme, gen.seed) : null;
}

/** The fixed greybox map of an old log, with its mask, or null. */
export function legacyMap(mapId: string, mask: Mask): BuiltMap | null {
  const def = GREYBOX_MAPS.find((m) => m.id === mapId);
  return def
    ? { def, mapId, mask, ...(def.structures ? { structures: def.structures } : {}) }
    : null;
}
