// Turn structure and match rules (GDD §2, §6). Times in ticks (60 per second).

export const TICKS_PER_SECOND = 60;

export interface TurnRules {
  /** ticks: camera moves to the active unit, wind shown (GDD §2.2: 2 s) */
  readonly transitionTicks: number;
  /** ticks: free action time (GDD §2.2: 45 s) */
  readonly actionTicks: number;
  /** ticks: move-only time after firing (GDD §2.2: 3 s) */
  readonly retreatTicks: number;
  /** ticks: hard cap on a resolution, so a stuck entity cannot freeze the game */
  readonly maxResolutionTicks: number;
}

export interface MatchRules {
  readonly turn: TurnRules;
  /** HP of every unit at match start (GDD §3.1: 100, options 50 / 150 / 200) */
  readonly startHp: number;
}

/** « Classique » rules scheme (GDD §6). */
export const CLASSIC_RULES: MatchRules = {
  turn: {
    transitionTicks: 2 * TICKS_PER_SECOND,
    actionTicks: 45 * TICKS_PER_SECOND,
    retreatTicks: 3 * TICKS_PER_SECOND,
    maxResolutionTicks: 30 * TICKS_PER_SECOND,
  },
  startHp: 100,
};
