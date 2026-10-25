// Rules schemes (GDD §6): presets of the match rules, as overrides of the Classique values by
// dotted path (the same paths as ⚙ Réglages). « Personnalisé » is the player's own settings.

export type SchemeId = 'classic' | 'siege' | 'fortune' | 'custom';

export const SCHEME_IDS: readonly SchemeId[] = ['classic', 'siege', 'fortune', 'custom'];

/** Overrides of each preset; `custom` takes the player's saved settings instead. */
export const SCHEME_OVERRIDES: Readonly<
  Record<Exclude<SchemeId, 'custom'>, Readonly<Record<string, number>>>
> = {
  classic: {},
  // Siège: high, sturdy towers and walls, many stone walls to build forts, trebuchet ×3 and the
  // fire, pick and sap to bring the walls down, ladders and grapples to go up them.
  siege: {
    'structures.towerHeight': 440,
    'structures.defs.tower.hp': 360,
    'structures.defs.wall.hp': 240,
    'weapons.greekFire.ammo': 5,
    'weapons.pitchPot.ammo': 2,
    'weapons.stoneWall.ammo': 8,
    'weapons.trebuchet.ammo': 3,
    'weapons.pick.ammo': 3,
    'weapons.sap.ammo': 3,
    'weapons.ladder.ammo': 4,
    'weapons.grapple.ammo': 8,
  },
  // Fortune: no limited weapon at the start; everything comes down with the reliquaries.
  fortune: {
    'weapons.greekFire.ammo': 0,
    'weapons.crossbow.ammo': 0,
    'weapons.pitchPot.ammo': 0,
    'weapons.pick.ammo': 0,
    'weapons.sap.ammo': 0,
    'weapons.caltrop.ammo': 0,
    'weapons.stoneWall.ammo': 0,
    'weapons.trebuchet.ammo': 0,
    'weapons.arrowRain.ammo': 0,
    'weapons.flamingPig.ammo': 0,
    'weapons.beehive.ammo': 0,
    'weapons.falcon.ammo': 0,
    'weapons.grapple.ammo': 0,
    'weapons.ladder.ammo': 0,
    'weapons.banner.ammo': 0,
    'weapons.miracle.ammo': 0,
    'crates.chancePermille': 700,
    'crates.maxOnMap': 5,
  },
};

/** houses in a match (GDD §2.1: 2 to 4) */
export const MIN_HOUSES = 2;
export const MAX_HOUSES = 4;
/** units per house (GDD §2.1: 1 to 6) */
export const MAX_UNITS = 6;
