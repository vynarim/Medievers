// Persistent flames (GDD §4.1, §4.6): the Greek fire leaves burning patches on the ground for a
// few turns; whoever stands in them gets burnt, a little at a time, up to a cap per turn.

export interface FlameRules {
  /** flames a Greek fire blast leaves, spread over its radius */
  readonly count: number;
  /** turns a flame burns before it goes out */
  readonly turns: number;
  /** HP per tick of contact (GDD §4.6: 3) */
  readonly damagePerTick: number;
  /** HP a unit can lose to flames in one turn (GDD §4.6: 10) */
  readonly maxPerTurn: number;
  /** px around a flame that count as touching it */
  readonly radius: number;
}

export const FLAME_RULES: FlameRules = {
  count: 6,
  turns: 3,
  damagePerTick: 3,
  maxPerTurn: 10,
  radius: 8,
};
