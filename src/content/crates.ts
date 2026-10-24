// Reliquaires (GDD §4.5): an angel lets a coffer down at the end of some turns; whoever walks
// into it takes what it holds. Probabilities in per mille, speeds in sub-px per tick.

export interface CrateRules {
  /** per mille: chance a reliquary comes down at the end of a turn */
  readonly chancePermille: number;
  /** most reliquaries on the map at once */
  readonly maxOnMap: number;
  /** per mille: share of trapped coffers */
  readonly trapPermille: number;
  /** per mille: share of balm phials among the coffers that are not trapped */
  readonly balmPermille: number;
  /** HP a balm phial gives back, up to the starting HP */
  readonly balmHp: number;
  /** sub-px per tick: descent speed under the angel */
  readonly fallSpeed: number;
  /** sub-px per tick of sideways drift per wind point while coming down */
  readonly windDrift: number;
  /** blast of a coffer that is shot or caught in a blast (HP at the centre, px) */
  readonly blastDamage: number;
  readonly blastRadius: number;
  /** blast of a trapped coffer, touched or shot */
  readonly trapDamage: number;
  readonly trapRadius: number;
}

export const CRATE_RULES: CrateRules = {
  chancePermille: 300,
  maxOnMap: 3,
  trapPermille: 100,
  balmPermille: 350,
  balmHp: 25,
  fallSpeed: 256,
  windDrift: 20,
  blastDamage: 15,
  blastRadius: 40,
  // A small trap, a nasty surprise rather than a disaster (2026-10-25: was 35 HP over 60 px).
  trapDamage: 20,
  trapRadius: 40,
};

/** px: size of a reliquary's box, standing on its base point */
export const CRATE_WIDTH = 26;
export const CRATE_HEIGHT = 22;
/** percent of the map width kept free of drops at each end (and the burnt ends too) */
export const CRATE_EDGE_PCT = 8;

/** What a coffer holds. */
export const CrateKind = { Weapon: 0, Balm: 1, Trap: 2 } as const;
export type CrateKindId = (typeof CrateKind)[keyof typeof CrateKind];
