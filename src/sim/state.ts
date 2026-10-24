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
  /** a fragment of a cluster weapon: explodes where it lands */
  readonly fragment?: boolean;
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
  /** unit of the playing team that played its previous turn and may not play this one; -1 none */
  restingUnitId: number;
  /** -10..10, drawn at each turn start (GDD §5) */
  wind: number;
  /** BAM */
  aim: number;
  weapon: WeaponId;
  /** ticks */
  fuse: number;
  /** walking state of the active unit */
  walkDir: -1 | 0 | 1;
  /** ticks left turning round on the spot before walking (rules.unit.turnTicks) */
  turnHold: number;
  /** sub-px of walking left this turn (rules.unit.moveBudget); unused when there is no budget */
  moveLeft: number;
  fired: boolean;
}

/** La cuisine de campagne on the map (GDD §4.9). */
export interface KitchenState {
  /** sub-px: centre of the hearth's base */
  readonly x: number;
  /** sub-px: ground level under it */
  y: number;
  /** turn number at whose start it goes out */
  readonly expiresTurn: number;
}

/** Powder barrel (GDD §4.6). */
export interface Barrel {
  readonly id: number;
  /** sub-px: centre of its base */
  readonly x: number;
  /** sub-px: ground level under it */
  y: number;
}

/** Reliquary (GDD §4.5). kind: 0 weapon, 1 balm, 2 trap (content/crates.ts CrateKind). */
export interface Crate {
  readonly id: number;
  /** sub-px: centre of its base */
  x: number;
  /** sub-px: base */
  y: number;
  readonly kind: number;
  /** index in rules.weapons of the weapon a weapon coffer holds; -1 otherwise */
  readonly weapon: number;
  /** it has touched the ground: no more wind drift */
  landed: boolean;
}

/** A beast of the margins (GDD §4.10). kind: content/beasts.ts BeastKind. */
export interface Beast {
  readonly id: number;
  readonly kind: number;
  /** sub-px: base */
  x: number;
  y: number;
}

/** A lasting trick played by a beast on a unit. trick: content/beasts.ts Trick. */
export interface Affliction {
  readonly unitId: number;
  readonly trick: number;
  /** turns left */
  turns: number;
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
  /** null when there is none; always null without rules.kitchen */
  kitchen: KitchenState | null;
  /** sorted by id */
  barrels: Barrel[];
  /** sorted by id */
  readonly crates: Crate[];
  beast: Beast | null;
  /** sorted by unit id, then trick */
  readonly afflictions: Affliction[];
  /** px burnt away at each end of the map (rules.burn); 0 without it */
  burnPx: number;
  /** kitchens that appeared on each team's turn, for fairness (GDD §4.9) */
  readonly kitchenCounts: number[];
  /** team id of the winner, -1 for a draw, null while playing */
  winner: number | null;
  readonly rules: MatchRules;
}
