// The match chosen on the setup screen (GDD §2.1, §6): scheme, houses, their line-ups and
// Régicide, saved locally, and the match rules and config it gives. Pure but for the storage.
import { AI_LEVEL_IDS, type AiLevelId } from '../content/ai.ts';
import { CLASS_IDS, defaultLineup, type ClassId } from '../content/classes.ts';
import { CLASSIC_RULES, TICKS_PER_SECOND, type MatchRules } from '../content/rules.ts';
import {
  DEFAULT_UNITS,
  MAX_HOUSES,
  MAX_UNITS,
  MIN_HOUSES,
  SCHEME_IDS,
  SCHEME_OVERRIDES,
  type SchemeId,
} from '../content/schemes.ts';
import { applyOverrides, type TuningOverrides } from '../ui/tuning-model.ts';
import { MAP_THEMES, type MapTheme } from '../content/maps.ts';
import type { StructurePlacement } from '../content/structures.ts';
import type { EnginePlacement } from '../content/engines.ts';
import type { MatchConfig } from '../sim/state.ts';
import type { Mask } from '../sim/terrain/mask.ts';
import { spawnColumns } from './spawns.ts';

const KEY = 'medieverse.setup.v1';

export interface MatchSetup {
  /** the map's theme; the land itself is drawn anew for each match */
  readonly map: MapTheme;
  readonly scheme: SchemeId;
  readonly regicide: boolean;
  /** class of each unit of each house; its length is the number of houses */
  readonly lineups: readonly (readonly ClassId[])[];
  /** seconds to play a turn, one of TURN_SECONDS (2026-10-25); absent from older saves: 45 */
  readonly turnSeconds?: number;
  /**
   * who plays each house (GDD §6): the player, a friend online, or the AI at a level; one house
   * at most is the player's, never two humans on one device. Absent from older saves: the player
   * has the first house, the AI (Chevalier) the others.
   */
  readonly players?: readonly Player[];
}

/**
 * Who plays a house: the person at this device, a friend on another device who joins by the
 * match's code (« Un copain », 2026-10-25), or the AI at one of its levels.
 */
export type Player = 'human' | 'friend' | AiLevelId;

/** The level the AI plays at when nobody chose one. */
export const DEFAULT_AI_LEVEL: AiLevelId = 'knight';

/** Who plays each house of `s`: one entry per house, the player's house at most once. */
export function playersOf(s: MatchSetup): Player[] {
  const out: Player[] = s.lineups.map((_, h) => {
    const p = s.players?.[h];
    if (p === 'human' || p === 'friend' || (p !== undefined && AI_LEVEL_IDS.includes(p))) return p;
    return s.players ? DEFAULT_AI_LEVEL : h === 0 ? 'human' : DEFAULT_AI_LEVEL;
  });
  let human = false;
  for (let h = 0; h < out.length; h++) {
    if (out[h] !== 'human') continue;
    if (human) out[h] = DEFAULT_AI_LEVEL;
    human = true;
  }
  return out;
}

/** The AI's houses and their levels (run by this device, or online by the creator's). */
export function aiHouses(s: MatchSetup): Map<number, AiLevelId> {
  const out = new Map<number, AiLevelId>();
  playersOf(s).forEach((p, h) => {
    if (p !== 'human' && p !== 'friend') out.set(h, p);
  });
  return out;
}

/** A house is a friend's: the match is played online, and waits for them to join. */
export const hasFriends = (s: MatchSetup): boolean => playersOf(s).includes('friend');

/** The turn lengths offered on the setup screen, in seconds; the default one first. */
export const TURN_SECONDS: readonly number[] = [45, 60, 90, 30];
const DEFAULT_TURN_SECONDS = 45;

export function defaultSetup(custom: boolean): MatchSetup {
  return {
    map: 'valley',
    scheme: custom ? 'custom' : 'classic',
    regicide: false,
    // Four units per house: knight, archer, slinger, cleric (2026-10-25).
    lineups: [defaultLineup(DEFAULT_UNITS, false), defaultLineup(DEFAULT_UNITS, false)],
    turnSeconds: DEFAULT_TURN_SECONDS,
  };
}

/**
 * The line-up fixed to the rules (GDD §3.2): 1 to 6 units, one king at most, and in Régicide a
 * king always (the first unit becomes one if none is there).
 */
export function fixLineup(lineup: readonly ClassId[], regicide: boolean): ClassId[] {
  const out = lineup.filter((c) => CLASS_IDS.includes(c)).slice(0, MAX_UNITS);
  if (out.length === 0) out.push('knight');
  let king = false;
  for (let i = 0; i < out.length; i++) {
    if (out[i] !== 'king') continue;
    if (king) out[i] = 'knight';
    king = true;
  }
  if (regicide && !king) out[0] = 'king';
  return out;
}

/** A setup made valid: known scheme, 2 to 4 houses, fixed line-ups. */
export function fixSetup(s: MatchSetup): MatchSetup {
  const scheme = SCHEME_IDS.includes(s.scheme) ? s.scheme : 'classic';
  const lineups = s.lineups.slice(0, MAX_HOUSES).map((l) => fixLineup(l, s.regicide));
  while (lineups.length < MIN_HOUSES) lineups.push(defaultLineup(DEFAULT_UNITS, s.regicide));
  const map = MAP_THEMES.includes(s.map) ? s.map : 'valley';
  const turnSeconds = TURN_SECONDS.includes(s.turnSeconds ?? 0)
    ? (s.turnSeconds ?? DEFAULT_TURN_SECONDS)
    : DEFAULT_TURN_SECONDS;
  const players = playersOf({ ...s, lineups });
  return { map, scheme, regicide: s.regicide, lineups, turnSeconds, players };
}

export function loadSetup(custom: boolean): MatchSetup {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as MatchSetup;
      if (Array.isArray(s.lineups)) return fixSetup(s);
    }
  } catch {
    // Unreadable: the default match.
  }
  return defaultSetup(custom);
}

export function saveSetup(s: MatchSetup): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Blocked storage: the choice lasts for this page.
  }
}

/** The rules of the match: the scheme over Classique (or the player's settings), Régicide. */
export function rulesFor(s: MatchSetup, custom: TuningOverrides): MatchRules {
  const base = applyOverrides(
    CLASSIC_RULES,
    s.scheme === 'custom' ? custom : SCHEME_OVERRIDES[s.scheme],
  );
  // The turn lasts what was chosen, before and after the shot alike.
  const turn = (s.turnSeconds ?? DEFAULT_TURN_SECONDS) * TICKS_PER_SECOND;
  return {
    ...base,
    turn: { ...base.turn, actionTicks: turn, retreatMaxTicks: turn },
    regicide: s.regicide,
    unitsPerTeam: Math.max(...s.lineups.map((l) => l.length)),
  };
}

/** The sim's config for a match of `setup` on a map: each house on its spawn columns. */
export function matchConfig(
  map: {
    readonly mask: Mask;
    readonly structures?: readonly StructurePlacement[];
    readonly engines?: readonly EnginePlacement[];
    readonly waterLevel?: number;
  },
  setup: MatchSetup,
  rules: MatchRules,
): MatchConfig {
  const lineups = setup.lineups;
  const perTeam = Math.max(...lineups.map((l) => l.length));
  return {
    rules,
    ...(map.structures ? { structures: map.structures } : {}),
    ...(map.engines && map.engines.length > 0 && rules.engines ? { engines: map.engines } : {}),
    ...(map.waterLevel !== undefined ? { waterLevel: map.waterLevel } : {}),
    // Each house takes as many of its spawn columns as it has units.
    teams: spawnColumns(map.mask, lineups.length, perTeam).map((columns, h) => {
      const lineup = lineups[h] ?? [];
      return {
        spawns: columns.slice(0, lineup.length),
        ...(rules.classes ? { classes: [...lineup] } : {}),
      };
    }),
  };
}
