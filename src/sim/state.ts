// Complete simulation state. Plain integers, typed arrays and arrays sorted by id only, so it
// can be hashed, cloned for snapshots and sent to the AI worker.
import type { MatchRules } from '../content/rules.ts';
import type { WeaponId } from '../content/weapons.ts';
import type { PrngState } from './math/prng.ts';
import type { ExplosionQueue } from './explosions/explosion.ts';
import type { Projectile } from './projectiles/projectile.ts';
import type { Terrain } from './terrain/terrain.ts';
import type { Unit } from './units/unit.ts';

export type Phase = 'transition' | 'action' | 'retreat' | 'resolution' | 'gameOver';

export interface TeamConfig {
  /** px: spawn column of each unit; units drop to the ground below y = 0 */
  readonly spawns: readonly number[];
}

export interface MatchConfig {
  readonly rules: MatchRules;
  readonly teams: readonly TeamConfig[];
}

export interface TeamState {
  readonly id: number;
  /** ids of the team's units, in play order */
  readonly unitIds: readonly number[];
  /** index in unitIds of the unit that played last */
  lastPlayed: number;
  /** remaining ammo per weapon index; -1 = unlimited */
  readonly ammo: number[];
}

export interface FlyingShot {
  readonly projectile: Projectile;
  readonly weapon: WeaponId;
  /** ticks left before a fused weapon explodes; 0 = no fuse */
  fuse: number;
}

export interface TurnState {
  /** 1-based turn counter */
  number: number;
  phase: Phase;
  /** ticks left in the current phase (transition, action, retreat) */
  phaseTicks: number;
  /** ticks spent in resolution, capped by rules.turn.maxResolutionTicks */
  resolutionTicks: number;
  activeTeam: number;
  activeUnitId: number;
  /** -10..10, drawn at each turn start (GDD §5) */
  wind: number;
  /** BAM */
  aim: number;
  weapon: WeaponId;
  /** ticks */
  fuse: number;
  /** walking state of the active unit */
  walkDir: -1 | 0 | 1;
  fired: boolean;
}

export interface SimState {
  tick: number;
  readonly prng: PrngState;
  readonly terrain: Terrain;
  /** sorted by id */
  readonly units: Unit[];
  /** sorted by projectile id */
  shots: FlyingShot[];
  readonly explosions: ExplosionQueue;
  readonly teams: TeamState[];
  readonly turn: TurnState;
  nextEntityId: number;
  /** team id of the winner, -1 for a draw, null while playing */
  winner: number | null;
  readonly rules: MatchRules;
}
