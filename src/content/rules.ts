// Match rules (GDD §2, §6): every tunable value of a match. They travel in the match config,
// so a game log replays with the values it was played with. Times in ticks (60 per second).
import { BARREL_RULES, type BarrelRules } from './barrels.ts';
import { BEAST_RULES, type BeastRules } from './beasts.ts';
import { BURN_RULES, type BurnRules } from './burn.ts';
import { CLASS_RULES, type ClassRules } from './classes.ts';
import { CRATE_RULES, type CrateRules } from './crates.ts';
import { KITCHEN_RULES, type KitchenRules } from './kitchen.ts';
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
   * ticks: with moveAfterShot, the time left after the shot is capped at this (but never below
   * retreatTicks), so the position is chosen before shooting, as in Worms (GDD §2.2, 2026-10-24).
   * Absent from older logs: all the action time left.
   */
  readonly retreatMaxTicks?: number;
  /**
   * The team picks which of its units plays, at the start of each turn, even the same one turn
   * after turn (GDD §2.2, 2026-10-24). Absent from older logs: fixed rotation.
   */
  readonly freeSelect?: boolean;
  /**
   * With freeSelect, the unit that played the team's previous turn sits this one out, unless it
   * is the last one standing (GDD §2.2, 2026-10-24). Absent from older logs: any unit.
   */
  readonly noRepeat?: boolean;
  /**
   * ticks: the match opens with the houses placing their units one at a time, in turn, with
   * this long for each; when the time runs out the unit goes to its default column (GDD §2.1,
   * 2026-10-24). Absent from older logs: units start on their spawn columns.
   */
  readonly placementTicks?: number;
}

export interface MatchRules {
  readonly turn: TurnRules;
  /**
   * units per house when the match is set up (GDD §2.1: 3 to 6). Read by the app to place the
   * spawns; the sim only sees the resulting spawn list.
   */
  readonly unitsPerTeam?: number;
  /** HP of every unit at match start (GDD §3.1: 100, options 50 / 150 / 200) */
  readonly startHp: number;
  readonly unit: UnitRules;
  readonly wind: WindRules;
  readonly explosion: ExplosionRules;
  /** the arsenal of this match, in selection order */
  readonly weapons: readonly WeaponDef[];
  /** la cuisine de campagne (GDD §4.9); absent from logs recorded before 2026-10-24: none */
  readonly kitchen?: KitchenRules;
  /** the parchment burning from both ends (GDD §2.5); absent from older logs: no fire */
  readonly burn?: BurnRules;
  /** powder barrels on the map (GDD §4.6); absent from older logs: none */
  readonly barrels?: BarrelRules;
  /** reliquaries brought down by angels (GDD §4.5); absent from older logs: none */
  readonly crates?: CrateRules;
  /** hares and snails out of the margins (GDD §4.10); absent from older logs: none */
  readonly beasts?: BeastRules;
  /**
   * class passives (GDD §3.2); the line-up of each house is in its TeamConfig. Absent from logs
   * recorded before 2026-10-25: no classes.
   */
  readonly classes?: ClassRules;
  /** Régicide (GDD §2.3): a house whose king dies is out of the match */
  readonly regicide?: boolean;
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
    retreatMaxTicks: 5 * TICKS_PER_SECOND,
    freeSelect: true,
    noRepeat: true,
    placementTicks: 20 * TICKS_PER_SECOND,
  },
  unitsPerTeam: 4,
  startHp: 100,
  unit: UNIT_RULES,
  wind: WIND_RULES,
  explosion: EXPLOSION_RULES,
  weapons: WEAPONS,
  kitchen: KITCHEN_RULES,
  burn: BURN_RULES,
  barrels: BARREL_RULES,
  crates: CRATE_RULES,
  beasts: BEAST_RULES,
  classes: CLASS_RULES,
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
