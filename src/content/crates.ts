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
  /**
   * px: shoot the angel bringing a coffer down, and it lifts the shooter this high in a beam of
   * light, then lets go: the fall hurts (2026-10-25). Absent from older logs: angels are not hit.
   */
  readonly angelLift?: number;
  /**
   * A trapped coffer that goes off under the fighter whose turn it is does not end the turn:
   * once on its feet again, it may still walk, aim and shoot (2026-10-25, playtest), unless the
   * trap took its last HP. Absent from older logs: hurt in its own turn, it stops at once.
   */
  readonly trapSparesTurn?: boolean;
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
  // About 300 px: a fall that costs some 17 HP.
  angelLift: 300,
  trapSparesTurn: true,
};

/** px: the angel above a coffer coming down, where a shot touches it: half its wingspan, height */
export const ANGEL_HALF_WIDTH = 40;
export const ANGEL_HEIGHT = 60;

/** px: size of a reliquary's box, standing on its base point */
export const CRATE_WIDTH = 26;
export const CRATE_HEIGHT = 22;
/** percent of the map width kept free of drops at each end (and the burnt ends too) */
export const CRATE_EDGE_PCT = 8;

/** What a coffer holds. */
export const CrateKind = { Weapon: 0, Balm: 1, Trap: 2 } as const;
export type CrateKindId = (typeof CrateKind)[keyof typeof CrateKind];
