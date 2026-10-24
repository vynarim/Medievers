// Le dragon des marges (GDD §4.11, 2026-10-24): now and then a wyvern crosses the sky during a
// turn, low enough for a full-power arrow to reach it. Shoot it, and it flies into a rage: it
// swoops on a unit of one of the shooter's enemies, at random, and swallows it whole.

export interface DragonRules {
  /** per mille: chance the dragon crosses the sky at the start of a turn's action */
  readonly spawnPermille: number;
  /** sub-px/tick: its flight across the sky */
  readonly speed: number;
  /** sub-px/tick: its swoop on its prey, and its flight away once fed */
  readonly diveSpeed: number;
  /**
   * px between its belly and the highest ground or masonry under it: it hugs the relief, just
   * over the units' heads (80 px), well within an arrow's reach (2026-10-25: was over the highest
   * point of the whole map, out of reach)
   */
  readonly clearance: number;
}

export const DRAGON_RULES: DragonRules = {
  spawnPermille: 120,
  speed: 2 * 256,
  diveSpeed: 12 * 256,
  clearance: 100,
};

/** px: the dragon's body, around its centre, where a shot or a blast touches it */
export const DRAGON_HALF_WIDTH = 120;
export const DRAGON_HALF_HEIGHT = 45;
/** px: it swallows its prey when its centre comes this close to the prey's middle */
export const DRAGON_BITE = 30;
