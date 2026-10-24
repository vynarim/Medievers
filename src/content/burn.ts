// The parchment burns from both ends of the map (GDD §2.5): the fire eats inward each round,
// and units standing in it lose many HP, so the armies have to close in.

export interface BurnRules {
  /** rounds (one turn per house) played before the ends catch fire */
  readonly startRound: number;
  /** px the fire eats into each end of the map at the end of every round from then on */
  readonly advancePx: number;
  /** HP lost at the end of every turn by each unit standing in the burnt part */
  readonly damage: number;
}

export const BURN_RULES: BurnRules = {
  startRound: 2,
  advancePx: 120,
  damage: 20,
};
