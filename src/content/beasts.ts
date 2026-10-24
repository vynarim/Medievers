// Les bêtes des marges (GDD §4.10): hares and snails out of the manuscript's margins walk into
// the battle between turns, belong to nobody and play one trick on the first unit they reach.

export interface BeastRules {
  /** per mille: chance a beast comes out at the end of a turn, when there is none */
  readonly spawnPermille: number;
  /** px a hare bounds towards the nearest unit at the end of each turn */
  readonly hareStep: number;
  /** px a snail crawls, at the end of each turn, through walls and all */
  readonly snailStep: number;
  /** px: a hare cannot bound up a rise higher than this (a wall stops it) */
  readonly hareClimb: number;
  /** HP and knockback (sub-px/tick) of the hare's kick */
  readonly kickDamage: number;
  readonly kickSpeed: number;
  /** turns of the victim slowed by snail slime: its walk counts double */
  readonly slimeTurns: number;
  /** HP lost at the end of every turn, and how many turns, after a snail bite */
  readonly biteDamage: number;
  readonly biteTurns: number;
}

export const BEAST_RULES: BeastRules = {
  spawnPermille: 80,
  hareStep: 300,
  snailStep: 60,
  hareClimb: 40,
  kickDamage: 15,
  kickSpeed: 2400,
  slimeTurns: 2,
  biteDamage: 3,
  biteTurns: 3,
};

/** Species. */
export const BeastKind = { Hare: 0, Snail: 1 } as const;

/** What a beast did to its victim; the lasting ones are kept as afflictions. */
export const Trick = {
  /** hare: 15 HP and a strong kick */
  Kick: 0,
  /** hare: steals one shot of the house's scarcest limited weapon */
  Steal: 1,
  /** hare: an uncontrolled backward jump at the start of the victim's next turn */
  Panic: 2,
  /** snail: walking counts double for two of the victim's turns */
  Slime: 3,
  /** snail: neither walk nor jump on the victim's next turn (shooting is fine) */
  Shell: 4,
  /** snail: 3 HP at the end of every turn, three times */
  Bite: 5,
} as const;

/** px: a beast's box, standing on its base point, and the distance at which it reaches a unit */
export const BEAST_WIDTH = 28;
export const BEAST_HEIGHT = 20;
export const BEAST_REACH = 26;
