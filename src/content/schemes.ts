// Rules schemes (GDD §6): presets of the match rules, as overrides of the Classique values by
// dotted path (the same paths as ⚙ Réglages). « Personnalisé » is the player's own settings.

export type SchemeId = 'classic' | 'siege' | 'fortune' | 'custom';

export const SCHEME_IDS: readonly SchemeId[] = ['classic', 'siege', 'fortune', 'custom'];

/** Overrides of each preset; `custom` takes the player's saved settings instead. */
export const SCHEME_OVERRIDES: Readonly<
  Record<Exclude<SchemeId, 'custom'>, Readonly<Record<string, number>>>
> = {
  classic: {},
  // Siège: high, sturdy towers and walls, and the fire to bring them down.
  siege: {
    'structures.towerHeight': 440,
    'structures.defs.tower.hp': 360,
    'structures.defs.wall.hp': 240,
    'weapons.greekFire.ammo': 5,
    'weapons.pitchPot.ammo': 2,
  },
  // Fortune: no limited weapon at the start; everything comes down with the reliquaries.
  fortune: {
    'weapons.greekFire.ammo': 0,
    'weapons.crossbow.ammo': 0,
    'weapons.pitchPot.ammo': 0,
    'crates.chancePermille': 700,
    'crates.maxOnMap': 5,
  },
};

/** houses in a match (GDD §2.1: 2 to 4) */
export const MIN_HOUSES = 2;
export const MAX_HOUSES = 4;
/** units per house (GDD §2.1: 1 to 6) */
export const MAX_UNITS = 6;
