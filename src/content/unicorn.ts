// La licorne (GDD §4.12, 2026-10-25): very rarely, a unicorn of the margins gallops across the
// hills during a turn. Whoever's shot touches it gets back all its HP; then it is gone.

export interface UnicornRules {
  /** per mille: chance it gallops across at the start of a turn's action */
  readonly spawnPermille: number;
  /** sub-px/tick: its gallop */
  readonly speed: number;
}

export const UNICORN_RULES: UnicornRules = {
  spawnPermille: 25,
  speed: 4 * 256,
};

/** px: its body, standing on its base point, where a shot or a blast touches it */
export const UNICORN_WIDTH = 64;
export const UNICORN_HEIGHT = 56;
