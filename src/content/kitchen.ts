// La cuisine de campagne (GDD §4.9): a hearth with a hanging cauldron that heals whoever shoots it.

export interface KitchenRules {
  /** HP given to the unit whose shot touches the kitchen, up to its starting HP */
  readonly healHp: number;
  /** per mille: chance of an appearance at a turn start, during the first round */
  readonly chanceStartPermille: number;
  /** percent the chance keeps from one round to the next */
  readonly chanceDecayPct: number;
  /** per mille: the chance never drops below this */
  readonly chanceFloorPermille: number;
  /** rounds (one turn per team) before an untouched kitchen goes out */
  readonly lifeRounds: number;
  /** percent of the distance between the two sides allowed off the midpoint, to find flat ground */
  readonly placeTolerancePct: number;
}

export const KITCHEN_RULES: KitchenRules = {
  healHp: 30,
  chanceStartPermille: 250,
  chanceDecayPct: 80,
  chanceFloorPermille: 20,
  lifeRounds: 2,
  placeTolerancePct: 10,
};

/** px: size of the kitchen's hit box, standing on its base point */
export const KITCHEN_WIDTH = 36;
export const KITCHEN_HEIGHT = 40;
/** px: no kitchen is lit within this distance of a unit */
export const KITCHEN_UNIT_CLEARANCE = 40;
/** px: the ground under the whole hearth must be level within this */
export const KITCHEN_FLAT_TOLERANCE = 6;
