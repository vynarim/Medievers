// Complete simulation state. Plain integers, typed arrays and arrays sorted by id only, so it
// can be hashed, cloned for snapshots and sent to the AI worker.
import type { ClassId } from '../content/classes.ts';
import type { MatchRules } from '../content/rules.ts';
import type { WeaponId } from '../content/weapons.ts';
import type { PrngState } from './math/prng.ts';
import type { ExplosionQueue } from './explosions/explosion.ts';
import type { Projectile } from './projectiles/projectile.ts';
import type { Terrain } from './terrain/terrain.ts';
import type { Unit } from './units/unit.ts';

export type Phase = 'transition' | 'action' | 'retreat' | 'resolution' | 'gameOver' | 'placement';

export interface TeamConfig {
  /** px: spawn column of each unit; units drop to the ground below y = 0 */
  readonly spawns: readonly number[];
  /** class of each unit, parallel to spawns (rules.classes); absent: no classes */
  readonly classes?: readonly ClassId[];
}

export interface MatchConfig {
  readonly rules: MatchRules;
  readonly teams: readonly TeamConfig[];
  /** px: top of the map's water (map.json waterLevel); absent: no water until the Déluge */
  readonly waterLevel?: number;
}

export interface TeamState {
  readonly id: number;
  /** ids of the team's units, in play order */
  readonly unitIds: readonly number[];
  /** index in unitIds of the unit that played last */
  lastPlayed: number;
  /** remaining ammo per weapon index; -1 = unlimited */
  readonly ammo: number[];
  /** class of each unit, parallel to unitIds; absent without rules.classes */
  readonly classes?: readonly ClassId[];
}

export interface FlyingShot {
  readonly projectile: Projectile;
  readonly weapon: WeaponId;
  /** ticks left before a fused weapon explodes; 0 = no fuse */
  fuse: number;
  /** a fragment of a cluster weapon: explodes where it lands */
  readonly fragment?: boolean;
  /** turn-fused pot: turns before it goes off, once it rests (weapon fuseTurns) */
  readonly turns?: number;
  /** percent of the weapon's damage (king's aura, GDD §3.2); absent: 100 */
  readonly damagePct?: number;
}

/** A pot with a fuse in turns, resting on the map (GDD §4.1). */
export interface PlacedPot {
  readonly id: number;
  /** sub-px: centre of the pot */
  readonly x: number;
  readonly y: number;
  /** turn starts left before it goes off */
  turns: number;
  readonly weapon: WeaponId;
  /** percent of the weapon's damage, from the throw (FlyingShot.damagePct) */
  readonly damagePct?: number;
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
  /** climbing state of the active unit (rules.unit.climbSpeed): -1 up, 1 down */
  climbDir: -1 | 0 | 1;
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

/** A burning patch left by the Greek fire (GDD §4.1). */
export interface Flame {
  readonly id: number;
  /** sub-px: on the ground */
  readonly x: number;
  y: number;
  /** turn ends left before it goes out */
  turns: number;
}

/** HP a unit has lost to flames this turn, for the cap (rules.flames.maxPerTurn). */
export interface Scorch {
  readonly unitId: number;
  hp: number;
}

/** A unit still to be put on the map, in placement order (rules.turn.placementTicks). */
export interface PendingUnit {
  readonly unitId: number;
  readonly team: number;
  /** px: where it goes if its house lets the time run out */
  readonly x: number;
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
  /** sorted by id */
  readonly pots: PlacedPot[];
  /** units still to be placed, the next one first; empty once the battle has begun */
  readonly placing: PendingUnit[];
  /** sorted by unit id, then trick */
  readonly afflictions: Affliction[];
  /** px burnt away at each end of the map (rules.burn); 0 without it */
  burnPx: number;
  /** sorted by id */
  flames: Flame[];
  /** sorted by unit id; emptied at every turn start */
  scorched: Scorch[];
  /** px: top of the water; the map height (or more) when there is none */
  waterY: number;
  /** the Déluge has begun: the water rises at every turn end (rules.deluge) */
  deluge: boolean;
  /** kitchens that appeared on each team's turn, for fairness (GDD §4.9) */
  readonly kitchenCounts: number[];
  /** team id of the winner, -1 for a draw, null while playing */
  winner: number | null;
  readonly rules: MatchRules;
}
