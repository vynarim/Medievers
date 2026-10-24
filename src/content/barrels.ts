// Barils de poudre (GDD §4.6): scattered over the map at the start, they blow up when a shot
// or a blast touches them, and set each other off in chains.

export interface BarrelRules {
  /** barrels placed on the map when the match starts */
  readonly count: number;
  /** HP at the centre of a barrel's blast */
  readonly damage: number;
  /** px: blast radius (damage and crater) */
  readonly radius: number;
  /** ticks between a barrel being touched by a blast and its own blast (chain reactions) */
  readonly chainDelay: number;
}

export const BARREL_RULES: BarrelRules = {
  count: 5,
  damage: 40,
  radius: 70,
  chainDelay: 8,
};

/** px: size of a barrel's hit box, standing on its base point */
export const BARREL_WIDTH = 22;
export const BARREL_HEIGHT = 28;
/** px: no barrel within this distance of a unit or another barrel at the start */
export const BARREL_SPACING = 70;
/** percent of the map width kept free of barrels at each end */
export const BARREL_EDGE_PCT = 10;
