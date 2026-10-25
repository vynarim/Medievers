// The levels of the AI (GDD §7.3): how much it looks for, how well it aims, which weapons it
// takes up and how long it seems to think. Data only: src/ai reads it, it never branches on a
// level by name.
import type { WeaponId } from './weapons.ts';

export type AiLevelId = 'squire' | 'knight' | 'constable';

export const AI_LEVEL_IDS: readonly AiLevelId[] = ['squire', 'knight', 'constable'];

export interface AiLevel {
  /** units of its house it considers sending, the nearest to the enemy first (1: the one given) */
  readonly units: number;
  /** places it considers shooting from, besides where it stands: walks and jumps */
  readonly positions: number;
  /** BAM between two angles of the first sweep of a throw */
  readonly angleStep: number;
  /** powers (out of 1024) of the first sweep of a throw */
  readonly powers: readonly number[];
  /** throws simulated in full, to the end of the turn, to score them (GDD §7.2) */
  readonly candidates: number;
  /** BAM: the aim is off by up to this much either way (±8° ≈ 91, ±3° ≈ 34, ±1° ≈ 11) */
  readonly angleNoise: number;
  /** percent: the power is off by up to this much either way */
  readonly powerNoisePct: number;
  /** the weapons it takes up; null: all it may use */
  readonly weapons: readonly WeaponId[] | null;
  /** ms it seems to think before acting, at least and at most (TECH_SPEC: shown, not spent) */
  readonly thinkMs: readonly [number, number];
  /** it shoots the dragon crossing the sky to send it on the enemy (GDD §4.11) */
  readonly dragon: boolean;
  /**
   * with the Déluge near or begun: score lost per px the unit it moves stands below the water
   * line of three turns ahead, so that it climbs to safety (0: it does not look ahead)
   */
  readonly floodFear: number;
}

export const AI_LEVELS: Readonly<Record<AiLevelId, AiLevel>> = {
  squire: {
    units: 1,
    positions: 3,
    angleStep: 128,
    powers: [384, 576, 768, 960],
    candidates: 6,
    angleNoise: 91,
    powerNoisePct: 15,
    weapons: ['bow', 'sling', 'greekFire'],
    thinkMs: [2000, 3000],
    dragon: false,
    floodFear: 0,
  },
  knight: {
    units: 2,
    positions: 6,
    angleStep: 96,
    powers: [384, 544, 704, 864, 1024],
    candidates: 14,
    angleNoise: 34,
    powerNoisePct: 6,
    weapons: [
      'bow',
      'fireArrow',
      'sling',
      'greekFire',
      'crossbow',
      'pitchPot',
      'mace',
      'sword',
      'shieldCharge',
      'trebuchet',
      'arrowRain',
    ],
    thinkMs: [2000, 4000],
    dragon: true,
    floodFear: 0.1,
  },
  constable: {
    units: 2,
    positions: 9,
    angleStep: 80,
    powers: [320, 480, 640, 800, 928, 1024],
    candidates: 30,
    angleNoise: 11,
    powerNoisePct: 2,
    weapons: null,
    thinkMs: [3000, 5000],
    dragon: true,
    floodFear: 0.2,
  },
};

/** Score of a move (GDD §7.2): what each HP and each death is worth to the house that plays. */
export const AI_SCORE = {
  enemyHp: 1,
  allyHp: -1.5,
  selfHp: -2,
  enemyKill: 40,
  enemyDrowned: 60,
  allyDeath: -60,
  selfDeath: -100,
  /** Régicide: the enemy king's HP and death count this many times over */
  kingFactor: 3,
  /** per px nearer the nearest enemy, so that, with nothing to shoot, it closes in */
  approachPerPx: 0.02,
} as const;
