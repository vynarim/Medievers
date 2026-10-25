// Maps (GDD §10). Every map is drawn anew for each match from its theme and the match seed
// (src/sim/terrain/generate.ts): the hills, the towers, the walls and the rocks fall elsewhere each
// time, and a replay redraws the same map from its id. The greybox valley of the first builds is
// kept for the logs recorded on it.
import type { StructurePlacement } from './structures.ts';
import type { EngineType } from './engines.ts';

/** Map themes: the lie of the land, its colours, its scenery and its beasts. */
export type MapTheme = 'valley' | 'coast' | 'holyLand';

export const MAP_THEMES: readonly MapTheme[] = ['valley', 'coast', 'holyLand'];

export interface MapDef {
  readonly id: string;
  /** i18n key of the map name */
  readonly nameKey: string;
  readonly theme: MapTheme;
  /** px */
  readonly width: number;
  /** px */
  readonly height: number;
  /** URL of the mask PNG of a fixed map (the old greybox); absent: generated */
  readonly maskUrl?: string;
  /** px: spawn columns per team, in play order (fixed maps only) */
  readonly spawns?: readonly (readonly number[])[];
  /** structures with HP (GDD §4.7) of a fixed map; a generated map makes its own */
  readonly structures?: readonly StructurePlacement[];
}

/** How a theme's land is drawn. Heights in px from the top of the map; ranges inclusive. */
export interface MapGen {
  readonly width: number;
  readonly height: number;
  /** px: mean ground level */
  readonly base: number;
  /** hills (or dunes) added to the ground: how many, how wide (half width), how high */
  readonly bumps: readonly [number, number];
  readonly bumpHalfWidth: readonly [number, number];
  readonly bumpHeight: number;
  /** dunes: a gentle slope windward, a steep one leeward (percent of the half width) */
  readonly leePct?: number;
  /** px the ground rises over the last edgePx of each end, so the sides make a bowl */
  readonly edgePx: number;
  readonly edgeRise: number;
  /** px: amplitude of the small ripples of the ground */
  readonly ripple: number;
  /** highest and lowest ground allowed */
  readonly minGround: number;
  readonly maxGround: number;
  /** towers built by the match, and free-standing stone walls */
  readonly towers: readonly [number, number];
  /**
   * about one tower in two is a timber keep on an earthen motte, as the mottes castrales were
   * (2026-10-25); absent: stone towers only
   */
  readonly woodTowers?: boolean;
  readonly walls: readonly [number, number];
  /** rock outcrops near the surface, and pockets of rock deeper down */
  readonly outcrops: readonly [number, number];
  readonly pockets: readonly [number, number];
  /** px: the sea at the bottom of the map (coast); absent: no water until the Déluge */
  readonly waterLevel?: number;
  /** a cliff at one end, this many px above the ground (coast) */
  readonly cliff?: number;
  /** the end opposite the cliff slopes down into the sea, as a beach (coast) */
  readonly beach?: boolean;
  /** two towers with a curtain wall between them, in the middle third (Saracen fortress) */
  readonly fortress?: boolean;
  /**
   * siege engines (GDD §4.8): a pair, one in each half of the map at the same distance from its
   * end, of a type drawn from `pair`; and, sometimes, one more in the middle (2026-10-25)
   */
  readonly engines?: {
    readonly pair: readonly EngineType[];
    readonly middle?: readonly EngineType[];
  };
}

export const MAP_GEN: Readonly<Record<MapTheme, MapGen>> = {
  // La vallée: green hills and a central dip, two towers and a stone wall.
  valley: {
    width: 3840,
    height: 1600,
    base: 1060,
    bumps: [8, 11],
    bumpHalfWidth: [180, 520],
    bumpHeight: 300,
    edgePx: 500,
    edgeRise: 240,
    ripple: 22,
    minGround: 640,
    maxGround: 1380,
    towers: [2, 2],
    woodTowers: true,
    walls: [1, 1],
    outcrops: [0, 2],
    pockets: [2, 4],
    engines: { pair: ['catapult', 'ballista', 'scorpion'], middle: ['trebuchet'] },
  },
  // La côte normande: sand and grass by the sea, a cliff at one end, a cove, the sea below.
  coast: {
    width: 3840,
    height: 1600,
    base: 1160,
    bumps: [6, 8],
    bumpHalfWidth: [220, 600],
    bumpHeight: 200,
    edgePx: 420,
    edgeRise: 120,
    ripple: 12,
    minGround: 760,
    maxGround: 1530,
    towers: [1, 2],
    woodTowers: true,
    walls: [0, 1],
    outcrops: [1, 3],
    pockets: [1, 2],
    waterLevel: 1440,
    cliff: 300,
    beach: true,
    engines: { pair: ['scorpion', 'ballista'] },
  },
  // La Terre sainte: dunes, outcrops of rock and a Saracen fortress.
  holyLand: {
    width: 3840,
    height: 1600,
    base: 1120,
    bumps: [11, 15],
    bumpHalfWidth: [140, 360],
    bumpHeight: 260,
    leePct: 35,
    edgePx: 460,
    edgeRise: 200,
    ripple: 6,
    minGround: 700,
    maxGround: 1380,
    towers: [0, 0],
    walls: [0, 0],
    outcrops: [3, 5],
    pockets: [2, 3],
    fortress: true,
    engines: { pair: ['catapult', 'ram'], middle: ['trebuchet'] },
  },
};

/** The maps offered on the setup screen, one per theme. */
export const MAPS: readonly MapDef[] = MAP_THEMES.map((theme) => ({
  id: theme,
  nameKey: `maps.${theme}`,
  theme,
  width: MAP_GEN[theme].width,
  height: MAP_GEN[theme].height,
}));

/** Id of the map of theme `theme` drawn from `seed`, as game logs store it. */
export const generatedMapId = (theme: MapTheme, seed: number): string =>
  `${theme}@${(seed >>> 0).toString(16)}`;

/** Theme and seed of a generated map id, or null for any other id. */
export function parseMapId(id: string): { theme: MapTheme; seed: number } | null {
  const m = /^([a-zA-Z]+)@([0-9a-f]{1,8})$/.exec(id);
  const theme = m?.[1] as MapTheme | undefined;
  if (!m || !theme || !MAP_THEMES.includes(theme)) return null;
  return { theme, seed: parseInt(m[2] ?? '0', 16) >>> 0 };
}

/** The fixed maps of the first builds, kept to replay the logs recorded on them. */
export const GREYBOX_MAPS: readonly MapDef[] = [
  {
    id: 'greybox-valley',
    nameKey: 'maps.greyboxValley',
    theme: 'valley',
    width: 3840,
    height: 1600,
    maskUrl: 'assets/maps/greybox-valley/mask.png',
    spawns: [
      [420, 900, 1450],
      [3420, 2950, 2620],
    ],
    structures: [
      { id: 1, type: 'tower', build: { x: 1340, width: 120, ladder: -1 } },
      { id: 2, type: 'wall', rect: [1900, 700, 40, 600] },
      { id: 3, type: 'tower', build: { x: 2560, width: 130, ladder: 1 } },
    ],
  },
];
