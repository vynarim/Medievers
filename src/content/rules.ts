// Match rules (GDD §2, §6): every tunable value of a match. They travel in the match config,
// so a game log replays with the values it was played with. Times in ticks (60 per second).
import { UNIT_RULES, type UnitRules } from './units.ts';
import { WEAPONS, type WeaponDef, type WeaponId } from './weapons.ts';
import { EXPLOSION_RULES, WIND_RULES, type ExplosionRules, type WindRules } from './world.ts';

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
  /**
   * ticks: pause once everything has stopped, before the next turn, so the last impact and its
   * commentary can be seen (GDD §2.2: 2 s). Absent from logs recorded before 2026-10-24: 0.
   */
  readonly settleTicks?: number;
  /**
   * After the shot, the unit keeps the action time left (at least retreatTicks) to use the
   * moves it has not used, and may end the turn itself (GDD §2.2, 2026-10-24). Absent from
   * older logs: a fixed retreatTicks.
   */
  readonly moveAfterShot?: boolean;
  /**
   * The team picks which of its units plays, at the start of each turn, even the same one turn
   * after turn (GDD §2.2, 2026-10-24). Absent from older logs: fixed rotation.
   */
  readonly freeSelect?: boolean;
}

export interface MatchRules {
  readonly turn: TurnRules;
  /** HP of every unit at match start (GDD §3.1: 100, options 50 / 150 / 200) */
  readonly startHp: number;
  readonly unit: UnitRules;
  readonly wind: WindRules;
  readonly explosion: ExplosionRules;
  /** the arsenal of this match, in selection order */
  readonly weapons: readonly WeaponDef[];
}

/** « Classique » rules scheme (GDD §6). */
export const CLASSIC_RULES: MatchRules = {
  turn: {
    transitionTicks: 2 * TICKS_PER_SECOND,
    actionTicks: 45 * TICKS_PER_SECOND,
    retreatTicks: 3 * TICKS_PER_SECOND,
    maxResolutionTicks: 30 * TICKS_PER_SECOND,
    settleTicks: 2 * TICKS_PER_SECOND,
    moveAfterShot: true,
    freeSelect: true,
  },
  startHp: 100,
  unit: UNIT_RULES,
  wind: WIND_RULES,
  explosion: EXPLOSION_RULES,
  weapons: WEAPONS,
};

/** Index of a weapon in the match arsenal; throws for a weapon the match does not have. */
export function weaponIndexIn(rules: MatchRules, id: WeaponId): number {
  const i = rules.weapons.findIndex((w) => w.id === id);
  if (i < 0) throw new Error(`weapon ${id} is not in this match's arsenal`);
  return i;
}

export function weaponDefIn(rules: MatchRules, id: WeaponId): WeaponDef {
  const def = rules.weapons[weaponIndexIn(rules, id)];
  if (!def) throw new Error(`weapon ${id} is not in this match's arsenal`);
  return def;
}
