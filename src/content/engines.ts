// Siege engines (GDD §4.8): fixed machines of the maps that any unit standing beside one may
// serve, shooting with it instead of its own weapon. Each type shoots with its own weapon of the
// arsenal (content/weapons.ts, `engine`); its body, HP and reload live here.
export type EngineType = 'ballista' | 'scorpion' | 'catapult' | 'trebuchet' | 'ram';

export const ENGINE_TYPES: readonly EngineType[] = [
  'ballista',
  'scorpion',
  'catapult',
  'trebuchet',
  'ram',
];

export interface EngineDef {
  readonly hp: number;
  /** turns it cannot be served again after a shot, whoever's turn they are */
  readonly reloadTurns: number;
  /** px: width and height of its body, standing on the ground */
  readonly w: number;
  readonly h: number;
}

export interface EngineRules {
  readonly defs: Readonly<Record<EngineType, EngineDef>>;
  /** px: a unit serves a machine standing within this much of its side */
  readonly reach: number;
  /** percent of a weapon's damage a machine takes (they are all timber); absent weapons: 100 */
  readonly weaponPct: Readonly<Partial<Record<string, number>>>;
  /** px: height of the heap of rubble a destroyed machine leaves */
  readonly rubble: number;
  /**
   * The reload scales with the houses in play, so that whatever their number the house that
   * shot skips as many of its own turns as in a duel, and the others wait as long (2026-10-25,
   * playtest: with three houses, a catapult shot again at its shooter's very next turn). Absent
   * from older logs: reloadTurns + 1 turn ends, whoever's.
   */
  readonly reloadPerHouses?: boolean;
}

/** A machine of the map, at column x (px), as the map declares it (`MatchConfig.engines`). */
export interface EnginePlacement {
  readonly id: number;
  readonly type: EngineType;
  readonly x: number;
}

export const ENGINE_RULES: EngineRules = {
  defs: {
    ballista: { hp: 120, reloadTurns: 2, w: 60, h: 40 },
    scorpion: { hp: 80, reloadTurns: 1, w: 44, h: 36 },
    catapult: { hp: 150, reloadTurns: 2, w: 70, h: 50 },
    trebuchet: { hp: 200, reloadTurns: 3, w: 80, h: 110 },
    ram: { hp: 150, reloadTurns: 1, w: 90, h: 46 },
  },
  reach: 40,
  // Timber: arrows barely bite, fire eats it twice as fast, the ram crushes it.
  weaponPct: {
    bow: 50,
    fireArrow: 50,
    crossbow: 60,
    sling: 50,
    arrowRain: 50,
    greekFire: 200,
    pitchPot: 200,
    flamingPig: 150,
    siegeRam: 400,
  },
  rubble: 24,
  reloadPerHouses: true,
};
