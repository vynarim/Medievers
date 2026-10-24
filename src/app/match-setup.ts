// The match chosen on the setup screen (GDD §2.1, §6): scheme, houses, their line-ups and
// Régicide, saved locally, and the match rules and config it gives. Pure but for the storage.
import { CLASS_IDS, defaultLineup, type ClassId } from '../content/classes.ts';
import { CLASSIC_RULES, type MatchRules } from '../content/rules.ts';
import {
  MAX_HOUSES,
  MAX_UNITS,
  MIN_HOUSES,
  SCHEME_IDS,
  SCHEME_OVERRIDES,
  type SchemeId,
} from '../content/schemes.ts';
import { applyOverrides, type TuningOverrides } from '../ui/tuning-model.ts';
import { MAP_THEMES, type MapTheme } from '../content/maps.ts';

const KEY = 'medieverse.setup.v1';

export interface MatchSetup {
  /** the map's theme; the land itself is drawn anew for each match */
  readonly map: MapTheme;
  readonly scheme: SchemeId;
  readonly regicide: boolean;
  /** class of each unit of each house; its length is the number of houses */
  readonly lineups: readonly (readonly ClassId[])[];
}

export function defaultSetup(custom: boolean): MatchSetup {
  return {
    map: 'valley',
    scheme: custom ? 'custom' : 'classic',
    regicide: false,
    // One unit of each class per house (2026-10-24).
    lineups: [defaultLineup(6, false), defaultLineup(6, false)],
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
  while (lineups.length < MIN_HOUSES) lineups.push(defaultLineup(6, s.regicide));
  const map = MAP_THEMES.includes(s.map) ? s.map : 'valley';
  return { map, scheme, regicide: s.regicide, lineups };
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
  return {
    ...base,
    regicide: s.regicide,
    unitsPerTeam: Math.max(...s.lineups.map((l) => l.length)),
  };
}
