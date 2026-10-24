// Le Déluge (GDD §2.4): sudden death. After a number of turns or of minutes, the water rises at
// the end of every turn and drowns whoever it reaches.

export interface DelugeRules {
  /** turns played before the water starts rising (GDD §2.4: 20) */
  readonly startTurn: number;
  /** ticks of play before it starts, whichever comes first (GDD §2.4: 15 minutes) */
  readonly startTicks: number;
  /** px the water rises at the end of every turn once it has started */
  readonly risePx: number;
  /** HP every unit loses at the end of every turn once it has started; 0 = off */
  readonly damage: number;
  /**
   * HP a unit loses when the water reaches its feet; it is then washed up on the nearest dry
   * ground, and drowns only if there is none left (2026-10-25). Absent from older logs: the
   * water drowns at once.
   */
  readonly wetDamage?: number;
}

export const DELUGE_RULES: DelugeRules = {
  startTurn: 20,
  startTicks: 15 * 60 * 60,
  risePx: 48,
  damage: 5,
  wetDamage: 20,
};
