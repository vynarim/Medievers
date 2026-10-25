// The simulation: init, one tick per step(), hash, snapshot and restore (TECH_SPEC §2.1).
// Turn loop (GDD §2.2): transition → action → (retreat) → resolution → next turn.
import { MATERIAL_RULES } from '../content/materials.ts';
import { weaponDefIn, weaponIndexIn } from '../content/rules.ts';
import type { GameCommand } from './commands.ts';
import type { SimEvent } from './events.ts';
import { createExplosionQueue, explode, takeDueExplosions } from './explosions/explosion.ts';
import { ANGLE_MASK, cosQ14 } from './math/angle.ts';
import { FNV_OFFSET, hashInt } from './math/hash.ts';
import { createPrng, nextRange } from './math/prng.ts';
import { SUBPX, idiv, subToPx } from './math/fixed.ts';
import type { Phase, MatchConfig, SimState, TeamState } from './state.ts';
import type { Mask } from './terrain/mask.ts';
import { createTerrain, isSolid, terrainHash } from './terrain/terrain.ts';
import { climb, ladderAt, ropeTarget } from './units/climb.ts';
import {
  blastHitsStructures,
  initStructures,
  stepBlocks,
  undermineStructures,
  burnTowersTurnEnd,
} from './structures.ts';
import { drownFlames, flamesTurnEnd, flamesTurnStart, spawnFlames, stepFlames } from './flames.ts';
import {
  atRest,
  bodyFree,
  createUnit,
  jump,
  release,
  settle,
  stepUnitPhysics,
  walk,
  GRAVITY,
  UNIT_HALF_WIDTH,
  type Unit,
} from './units/unit.ts';
import { blastReachesBarrels, burnBarrels, placeBarrels, stepBarrels } from './barrels.ts';
import { blastReachesCrates, burnCrates, maybeDropCrate, stepCrates, stepLift } from './crates.ts';
import { beastsTurnEnd, blastReachesBeast, hasAffliction, panicAtAction } from './beasts.ts';
import { blastReachesDragon, dragonAtAction, dragonBusy, stepDragon } from './dragon.ts';
import { blastReachesUnicorn, stepUnicorn, unicornAtAction } from './unicorn.ts';
import { Trick } from '../content/beasts.ts';
import { blastMovesPots, potsTurn, stepPots } from './pots.ts';
import { kitchenTurn, inKitchen, stepKitchen, useKitchen } from './kitchen.ts';
import { blowAngle, fire, stepCharge, stepShots, strikeHasTarget } from './weapons/weapons.ts';
import { blastReachesMines, stepDig, stepMines } from './tools.ts';
import { weatherTurnEnd } from './weather.ts';
import { blastReachesWalkers, detonateWalkers, stepWalkers } from './walkers.ts';
import { stepSwarms } from './swarms.ts';
import { letGo, swing } from './rope.ts';
import { isTargeted, type WeaponId } from '../content/weapons.ts';
import { MAX_POWER } from './commands.ts';
import { delugeTurnEnd, drownThings, drownUnits, hasWater, underWater } from './deluge.ts';
import {
  blastTakenPct,
  blessAtTurnEnd,
  hpForClass,
  kingOf,
  maxHpOf,
  mayUse,
  unitRulesOf,
} from './classes.ts';

/** BAM: default aim, 45° above the horizon on the facing side */
export const AIM_UP_RIGHT = 3584;
export const AIM_UP_LEFT = 2560;
const PHASES: readonly Phase[] = [
  'transition',
  'action',
  'retreat',
  'resolution',
  'gameOver',
  'placement',
];

export type DeepReadonly<T> = T extends (infer E)[]
  ? readonly DeepReadonly<E>[]
  : T extends Uint8Array | Uint32Array
    ? Readonly<T>
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;

export type SimView = DeepReadonly<SimState>;

export class Sim {
  private s: SimState;

  constructor(config: MatchConfig, seed: number, mask: Mask) {
    this.s = createState(config, seed, mask);
    const events: SimEvent[] = [];
    if (this.s.placing.length > 0) beginPlacement(this.s, events);
    else startTurn(this.s, events);
  }

  /** A simulation that goes on from `state`, which it takes over as it is (the AI's sandboxes). */
  static fromState(state: SimState): Sim {
    const sim = Object.create(Sim.prototype) as Sim;
    sim.s = state;
    return sim;
  }

  /** Advances exactly one tick, applying `cmds` to the active unit first. */
  step(cmds: readonly GameCommand[] = []): SimEvent[] {
    const s = this.s;
    const events: SimEvent[] = [];
    if (s.turn.phase === 'gameOver') return events;
    s.tick++;
    const phase = s.turn.phase;
    for (const c of cmds) applyCommand(s, c, events);
    // A phase entered by a command this tick starts counting down on the next tick.
    advanceTick(s, s.turn.phase !== phase, events);
    return events;
  }

  view(): SimView {
    return this.s;
  }

  /**
   * The weapon in hand is a melee one that would strike nothing along the aim (needsTarget): the
   * blow would be refused, so Fire is greyed.
   */
  strikeRefused(): boolean {
    const s = this.s;
    const def = s.rules.weapons.find((w) => w.id === s.turn.weapon);
    const u = s.units.find((x) => x.id === s.turn.activeUnitId);
    if (!def || !u || def.behavior !== 'melee' || !def.needsTarget) return false;
    return !strikeHasTarget(s, u, def, blowAngle(def, u, s.turn.aim));
  }

  /** 32-bit FNV-1a over the canonical state (TECH_SPEC §3). */
  hash(): number {
    return hashState(this.s);
  }

  snapshot(): SimState {
    return structuredClone(this.s);
  }

  restore(snapshot: SimState): void {
    this.s = structuredClone(snapshot);
  }
}

function createState(config: MatchConfig, seed: number, mask: Mask): SimState {
  const terrain = createTerrain(mask, MATERIAL_RULES);
  const units: Unit[] = [];
  const teams: TeamState[] = [];
  let nextId = 1;
  const placing: { unitId: number; team: number; x: number; rank: number }[] = [];
  const placement = config.rules.turn.placementTicks !== undefined;
  config.teams.forEach((team, teamId) => {
    const unitIds: number[] = [];
    team.spawns.forEach((xPx, rank) => {
      const id = nextId++;
      unitIds.push(id);
      // With a placement, units are created when their house puts them down.
      if (placement) {
        placing.push({ unitId: id, team: teamId, x: xPx, rank });
        return;
      }
      const cls = (config.rules.classes && team.classes?.[rank]) || null;
      const u = createUnit(id, teamId, xPx, 0, hpForClass(config.rules, cls));
      settle(u, terrain);
      units.push(u);
    });
    teams.push({
      id: teamId,
      unitIds,
      lastPlayed: -1,
      ammo: config.rules.weapons.map((w) => w.ammo),
      ...(config.rules.classes && team.classes ? { classes: [...team.classes] } : {}),
    });
  });
  const built = initStructures(terrain, config.rules.structures, config.structures);
  const s: SimState = {
    tick: 0,
    prng: createPrng(seed),
    terrain,
    units,
    shots: [],
    explosions: createExplosionQueue(),
    teams,
    turn: {
      number: 0,
      phase: 'transition',
      phaseTicks: 0,
      resolutionTicks: 0,
      activeTeam: teams.length - 1,
      activeUnitId: 0,
      restingUnitId: -1,
      wind: 0,
      aim: AIM_UP_RIGHT,
      weapon: 'bow',
      fuse: 0,
      walkDir: 0,
      climbDir: 0,
      rope: null,
      turnHold: 0,
      moveLeft: 0,
      fired: false,
    },
    nextEntityId: nextId,
    kitchen: null,
    barrels: [],
    crates: [],
    beast: null,
    dragon: null,
    unicorn: null,
    lift: null,
    pots: [],
    dig: null,
    charge: null,
    walkers: [],
    swarms: [],
    mines: [],
    // One unit per house in turn: first units of every house, then the second ones…
    placing: placing
      .sort((a, b) => a.rank - b.rank || a.team - b.team)
      .map(({ unitId, team, x }) => ({ unitId, team, x })),
    afflictions: [],
    burnPx: 0,
    structures: built.structures,
    owners: built.owners,
    blocks: [],
    flames: [],
    scorched: [],
    waterY: config.waterLevel ?? terrain.height,
    deluge: false,
    rain: 0,
    kitchenCounts: teams.map(() => 0),
    winner: null,
    rules: config.rules,
  };
  placeBarrels(s);
  return s;
}

function unitById(s: SimState, id: number): Unit | undefined {
  return s.units.find((u) => u.id === id);
}

function teamAlive(s: SimState, team: TeamState): boolean {
  // Régicide: the house stands as long as its king does (GDD §2.3).
  const king = kingOf(s, team.id);
  if (king) return king.alive;
  return team.unitIds.some((id) => unitById(s, id)?.alive === true);
}

function setPhase(s: SimState, phase: Phase, ticks: number, events: SimEvent[]): void {
  // The rope is let go once the turn's moves are over.
  if (s.turn.grapple && phase !== 'action' && phase !== 'retreat') {
    letGo(s, unitById(s, s.turn.activeUnitId), events);
  }
  s.turn.phase = phase;
  s.turn.phaseTicks = ticks;
  s.turn.resolutionTicks = 0;
  s.turn.walkDir = 0;
  s.turn.climbDir = 0;
  s.turn.rope = null;
  events.push({ e: 'phase', phase });
}

function startTurn(s: SimState, events: SimEvent[]): void {
  const n = s.teams.length;
  let team: TeamState | undefined;
  for (let i = 1; i <= n; i++) {
    const candidate = s.teams[(s.turn.activeTeam + i) % n];
    if (candidate && teamAlive(s, candidate)) {
      team = candidate;
      break;
    }
  }
  if (!team) return;
  const count = team.unitIds.length;
  // The unit that played last time rests this turn, if another one can play (rules.noRepeat).
  const last = team.lastPlayed >= 0 ? (team.unitIds[team.lastPlayed] ?? -1) : -1;
  const others = team.unitIds.filter((id) => id !== last && unitById(s, id)?.alive).length;
  s.turn.restingUnitId = s.rules.turn.noRepeat && others > 0 ? last : -1;
  let unit: Unit | undefined;
  for (let i = 1; i <= count; i++) {
    const idx = (team.lastPlayed + i) % count;
    const candidate = unitById(s, team.unitIds[idx] ?? -1);
    if (candidate?.alive && candidate.id !== s.turn.restingUnitId) {
      team.lastPlayed = idx;
      unit = candidate;
      break;
    }
  }
  if (!unit) return;
  const t = s.turn;
  t.number++;
  t.activeTeam = team.id;
  t.activeUnitId = unit.id;
  t.wind = nextRange(s.prng, -s.rules.wind.max, s.rules.wind.max);
  faceInward(s, unit);
  t.aim = unit.facing > 0 ? AIM_UP_RIGHT : AIM_UP_LEFT;
  t.weapon = weaponFor(s, unit);
  t.fuse = 0;
  t.fired = false;
  t.turnHold = 0;
  t.moveLeft = (s.rules.unit.moveBudget ?? 0) * SUBPX;
  flamesTurnStart(s);
  kitchenTurn(s, events);
  potsTurn(s, events);
  setPhase(s, 'transition', s.rules.turn.transitionTicks, events);
  events.push({ e: 'turnStarted', turn: t.number, team: team.id, unitId: unit.id, wind: t.wind });
}

/** The placement begins (or goes on): the house of the next unit to place has the hand. */
function beginPlacement(s: SimState, events: SimEvent[]): void {
  const next = s.placing[0];
  if (!next) return;
  s.turn.activeTeam = next.team;
  s.turn.activeUnitId = next.unitId;
  setPhase(s, 'placement', s.rules.turn.placementTicks ?? 0, events);
}

/** px: a unit cannot be placed closer than this to another one, nor to the map's sides */
const PLACE_CLEARANCE = 36;

/**
 * Puts the next unit of the placement down at column x, dropping it onto the ground; returns
 * false (nothing done) when the column is not allowed. The last one starts the first turn.
 */
function placeUnit(s: SimState, x: number, events: SimEvent[]): boolean {
  const u = placed(s, x);
  if (!u) return false;
  s.placing.shift();
  s.units.push(u);
  s.units.sort((a, b) => a.id - b.id);
  events.push({ e: 'unitPlaced', unitId: u.id, x });
  if (s.placing.length > 0) beginPlacement(s, events);
  else {
    s.turn.activeTeam = s.teams.length - 1;
    startTurn(s, events);
  }
  return true;
}

/** The next unit of the placement as it would stand at column x, or null if not allowed there. */
function placed(s: SimState, x: number): Unit | null {
  const next = s.placing[0];
  if (!next) return null;
  const w = s.terrain.width;
  if (x < PLACE_CLEARANCE || x >= w - PLACE_CLEARANCE) return null;
  if (s.units.some((u) => Math.abs(subToPx(u.x) - x) < PLACE_CLEARANCE)) return null;
  const u = createUnit(
    next.unitId,
    next.team,
    x,
    0,
    maxHpOf(s, { id: next.unitId, team: next.team }),
  );
  if (!settle(u, s.terrain) || underWater(s, subToPx(u.y))) return null;
  return u;
}

/** The next unit of the placement may be put down at column x (for the AI: nothing changes). */
export function canPlace(v: SimView, x: number): boolean {
  return placed(v as SimState, x) !== null;
}

/** Time is up: the unit goes to its default column, or the nearest allowed one. */
function autoPlace(s: SimState, events: SimEvent[]): void {
  const next = s.placing[0];
  if (!next) return;
  for (let d = 0; d < s.terrain.width; d += 8) {
    if (placeUnit(s, next.x + d, events) || placeUnit(s, next.x - d, events)) return;
  }
  // Nowhere at all: give up on this unit rather than block the match.
  s.placing.shift();
  if (s.placing.length > 0) beginPlacement(s, events);
  else startTurn(s, events);
}

/**
 * The turn may still jump: nothing walked, or no more than rules.unit.jumpGrace px (with a move
 * budget; without one, always).
 */
export function jumpLeft(s: SimView): boolean {
  const budget = s.rules.unit.moveBudget;
  if (budget === undefined) return true;
  const walked = budget * SUBPX - s.turn.moveLeft;
  return walked <= (s.rules.unit.jumpGrace ?? 0) * SUBPX;
}

/** The unit has rules.unit.jumpHeadroom px of free room above its head to jump. */
function headroom(s: SimState, u: Unit): boolean {
  const room = s.rules.unit.jumpHeadroom;
  if (room === undefined) return true;
  const px = subToPx(u.x);
  const py = subToPx(u.y);
  for (let k = 1; k <= room; k++) if (!bodyFree(s.terrain, px, py - k)) return false;
  return true;
}

function applyCommand(s: SimState, c: GameCommand, events: SimEvent[]): void {
  const t = s.turn;
  if (c.t === 'place') {
    if (t.phase === 'placement' && !placeUnit(s, Math.trunc(c.x), events)) {
      events.push({ e: 'placeRefused', x: Math.trunc(c.x) });
    }
    return;
  }
  const canAct = t.phase === 'action';
  const canMove = canAct || t.phase === 'retreat';
  // Fire again while a flaming pig trots: it goes up (GDD §4.1), until the turn is over.
  if (
    c.t === 'fire' &&
    (canMove || t.phase === 'resolution') &&
    detonateWalkers(s, t.activeUnitId, events)
  ) {
    return;
  }
  if (c.t === 'selectUnit') {
    selectUnit(s, c.unitId);
    return;
  }
  const u = unitById(s, t.activeUnitId);
  if (!u?.alive || !canMove) return;
  // Hanging from the grappling hook: ↑ ↓ haul the rope in or pay it out, a jump lets go.
  if (t.grapple && c.t === 'climb') {
    t.climbDir = c.dir;
    return;
  }
  if (t.grapple && c.t === 'jump') {
    letGo(s, u, events);
    return;
  }
  // On its way up or down a ladder that ends the turn, the unit only climbs (GDD §4.4).
  if (s.rules.unit.ladderEndsTurn && t.climbDir !== 0) return;
  // In its shell (snail trick): no walking nor jumping this turn, shooting is fine.
  const shelled = s.rules.beasts !== undefined && hasAffliction(s, u.id, Trick.Shell);
  if (shelled && (c.t === 'move' || c.t === 'jump' || c.t === 'climb')) return;
  // Lifted by an angel: nothing to do but wait to be let go.
  if (s.lift?.unitId === u.id && (c.t === 'move' || c.t === 'jump' || c.t === 'climb')) return;
  // Digging with the pick or the sap, or charging: the tool moves the unit, nothing else does.
  if ((s.dig || s.charge) && (c.t === 'move' || c.t === 'jump' || c.t === 'climb')) return;
  switch (c.t) {
    case 'climb':
      if (s.rules.unit.climbSpeed === undefined) return;
      // Taking a ladder is the turn's action: before the shot only (rules.unit.ladderIsAction).
      if (s.rules.unit.ladderIsAction && c.dir !== 0 && !canAct) return;
      // A press that cannot climb a pixel (no ladder, or already at its end) spends nothing,
      // unless a wall stands there to climb with a rope (rules.unit.wallClimb).
      if (s.rules.unit.ladderEndsTurn && c.dir !== 0) {
        if (climb({ ...u }, s.terrain, c.dir, s.rules.unit) === 0) {
          if (!u.grounded || u.climbing) return;
          const rope = ropeTarget(
            s.terrain,
            subToPx(u.x),
            subToPx(u.y),
            u.facing,
            c.dir,
            s.rules.unit,
          );
          if (!rope) return;
          t.rope = rope;
          u.climbing = true;
          u.vx = 0;
          u.vy = 0;
          events.push({ e: 'ropeThrown', unitId: u.id });
        }
      }
      t.climbDir = c.dir;
      if (c.dir !== 0) t.walkDir = 0;
      break;
    case 'move': {
      t.walkDir = c.dir;
      if (c.dir !== 0) t.climbDir = 0;
      // Walking the other way turns round on the spot first: no walk spent (rules.unit.turnTicks).
      const turnTicks = s.rules.unit.turnTicks;
      if (turnTicks !== undefined && c.dir !== 0 && c.dir !== u.facing && u.grounded) {
        u.facing = c.dir;
        t.turnHold = turnTicks;
      }
      break;
    }
    case 'jump': {
      // With a move budget, a turn has either a walk or a single jump (GDD §3.1); a step or two
      // taken by mistake still leaves the jump (rules.unit.jumpGrace).
      const budget = s.rules.unit.moveBudget;
      if (budget !== undefined && !jumpLeft(s)) return;
      // No room above the head: no jump, and nothing spent (rules.unit.jumpHeadroom).
      if (u.grounded && !headroom(s, u)) {
        events.push({ e: 'jumpRefused', unitId: u.id });
        return;
      }
      const facing = u.facing;
      if (c.dir !== undefined) u.facing = c.dir;
      if (!jump(u, c.kind, unitRulesOf(s, u))) {
        u.facing = facing;
        break;
      }
      // Turned round to jump: the aim is mirrored so its elevation stays the same.
      if (u.facing !== facing) t.aim = (2048 - t.aim) & ANGLE_MASK;
      if (budget !== undefined) t.moveLeft = 0;
      break;
    }
    case 'aim':
      if (!canAct) return;
      t.aim = c.angle & ANGLE_MASK;
      u.facing = cosQ14(t.aim) < 0 ? -1 : 1;
      break;
    case 'selectWeapon':
      if (canAct && mayUse(s, u, weaponDefIn(s.rules, c.id))) {
        t.weapon = c.id;
        t.fuse = weaponDefIn(s.rules, c.id).defaultFuse;
        if (s.rules.turn.rememberWeapon) u.weapon = c.id;
      }
      break;
    case 'setFuse':
      if (canAct) t.fuse = c.seconds * 60;
      break;
    case 'fire':
    case 'fireAt': {
      if (!canAct) return;
      const team = s.teams[t.activeTeam];
      const wi = weaponIndexIn(s.rules, t.weapon);
      const ammo = team?.ammo[wi] ?? 0;
      const def = weaponDefIn(s.rules, t.weapon);
      // Shot again in the air, the grapple costs nothing more (GDD §4.4).
      const flying = def.rope !== undefined && t.ropeFlight === true;
      if (!team || (ammo === 0 && !flying) || !mayUse(s, u, def)) return;
      // A clicked point only means something to a weapon aimed at a point.
      if (c.t === 'fireAt' && !isTargeted(def)) return;
      if (t.fuse === 0) t.fuse = def.defaultFuse;
      const at = c.t === 'fireAt' ? { x: Math.trunc(c.x), y: Math.trunc(c.y) } : null;
      if (!fire(s, u, c.t === 'fire' ? c.power : MAX_POWER, events, at)) {
        events.push({ e: 'toolRefused', weapon: def.id });
        return;
      }
      if (ammo > 0 && !flying) team.ammo[wi] = ammo - 1;
      // The ladder and the banner are not the turn's action; the miracle ends the turn.
      if (def.free) break;
      t.fired = true;
      if (def.endsTurn) {
        setPhase(s, 'resolution', 0, events);
        break;
      }
      const rt = s.rules.turn;
      const left = Math.min(t.phaseTicks, rt.retreatMaxTicks ?? t.phaseTicks);
      const after = rt.moveAfterShot ? Math.max(left, rt.retreatTicks) : rt.retreatTicks;
      setPhase(s, 'retreat', after, events);
      break;
    }
    case 'skip':
      // « Fin du tour »: before the shot, or after it when the moves outlive the shot.
      if (canAct || s.rules.turn.moveAfterShot) setPhase(s, 'resolution', 0, events);
      break;
  }
}

function advanceTick(s: SimState, phaseJustSet: boolean, events: SimEvent[]): void {
  const t = s.turn;
  const active = unitById(s, t.activeUnitId);
  const hpBefore = active?.hp ?? 0;
  const firstEvent = events.length;

  const budgeted = s.rules.unit.moveBudget !== undefined;
  if (t.turnHold > 0) t.turnHold--;
  else if (t.grapple) {
    // Hanging from the hook: the swing is done with the units' physics below.
  } else if (
    active?.alive &&
    t.walkDir !== 0 &&
    (t.phase === 'action' || t.phase === 'retreat') &&
    (!budgeted || t.moveLeft > 0)
  ) {
    const x0 = active.x;
    const y0 = active.y;
    const wasClimbing = active.climbing === true;
    const r = walk(active, s.terrain, t.walkDir, s.rules.unit);
    // At the edge beside a ladder (the top of a tower), the unit stops instead of stepping off,
    // so it can take the ladder down (rules.unit.ladderReach, 2026-10-25). Nor does it walk off
    // a tower or a curtain wall, into the air before a tower's body: up there, it jumps or takes
    // a ladder; only on the ground does it pass in front of a castle.
    const high = !wasClimbing && onStructure(s, subToPx(x0), subToPx(y0));
    if (
      (r === 'fell' &&
        !wasClimbing &&
        s.rules.unit.ladderReach !== undefined &&
        ladderAt(s.terrain, subToPx(x0), subToPx(y0), s.rules.unit) &&
        deepDrop(s, subToPx(active.x), subToPx(y0))) ||
      // Up there, its middle stays over the masonry: it does not lean out over the void.
      (high && r !== 'blocked' && deepDrop(s, subToPx(active.x), subToPx(active.y), [0]))
    ) {
      active.x = x0;
      active.y = y0;
      active.grounded = true;
      active.airPeakY = subToPx(y0);
    }
    // Snail slime: every step counts double (GDD §4.10).
    const slimed = s.rules.beasts !== undefined && hasAffliction(s, active.id, Trick.Slime);
    const spent = Math.abs(active.x - x0) * (slimed ? 2 : 1);
    if (budgeted) t.moveLeft = Math.max(0, t.moveLeft - spent);
  } else if (
    active?.alive &&
    t.climbDir !== 0 &&
    (t.phase === 'action' || t.phase === 'retreat') &&
    s.rules.unit.ladderEndsTurn
  ) {
    // The whole ladder, for free, and the turn ends at its end (rules.unit.ladderEndsTurn).
    if (t.rope) {
      // Up or down the rope, then over the edge or onto the ground: the turn ends there.
      if (ropeStep(active, t.rope)) {
        t.rope = null;
        t.climbDir = 0;
        setPhase(s, 'resolution', 0, events);
      }
      return;
    }
    const wasClimbing = active.climbing === true;
    const px = climb(active, s.terrain, t.climbDir, s.rules.unit);
    if (!wasClimbing && active.climbing !== true && px === 0) t.climbDir = 0;
    else if (active.climbing !== true || px === 0) {
      t.climbDir = 0;
      setPhase(s, 'resolution', 0, events);
    }
  } else if (
    active?.alive &&
    t.climbDir !== 0 &&
    (t.phase === 'action' || t.phase === 'retreat') &&
    (!budgeted || t.moveLeft > 0)
  ) {
    // Climbing spends the walk like walking (GDD §4.4).
    const px = climb(active, s.terrain, t.climbDir, s.rules.unit);
    const slimed = s.rules.beasts !== undefined && hasAffliction(s, active.id, Trick.Slime);
    const cost = idiv(px * SUBPX * (s.rules.unit.climbCostPct ?? 100), 100) * (slimed ? 2 : 1);
    if (budgeted) t.moveLeft = Math.max(0, t.moveLeft - cost);
  }
  // A unit whose ladder has gone (carved away) lets go.
  for (const u of s.units) {
    if (
      u.climbing &&
      s.lift?.unitId !== u.id &&
      !(s.turn.rope && s.turn.activeUnitId === u.id) &&
      !ladderAt(s.terrain, subToPx(u.x), subToPx(u.y), s.rules.unit)
    ) {
      release(u);
    }
  }

  stepDig(s, events);
  stepCharge(s, events);
  stepWalkers(s, events);
  for (const u of s.units) {
    if (!u.alive) continue;
    if (t.grapple && u.id === t.activeUnitId) {
      swing(s, u, weaponDefIn(s.rules, 'grapple'), events);
      continue;
    }
    const held = u.banner === true && !u.grounded && !u.climbing;
    if (held) holdBanner(s, u);
    const r = stepUnitPhysics(u, s.terrain, s.rules.unit);
    // The banner is folded once its bearer is down (or thrown about by a blow).
    if (held && (u.grounded || u.knocked)) u.banner = false;
    if (r.fallDamage > 0) {
      u.hp = Math.max(0, u.hp - r.fallDamage);
      events.push({ e: 'unitDamaged', unitId: u.id, damage: r.fallDamage });
    }
    if (r.outOfMap) {
      u.alive = false;
      u.hp = 0;
      events.push({ e: 'unitDied', unitId: u.id, cause: 'outOfMap' });
    }
  }

  // Down on the ground again: the next grapple is a new one.
  if (t.ropeFlight && !t.grapple && active?.grounded) t.ropeFlight = false;
  drownUnits(s, events);
  stepShots(s, events);
  stepSwarms(s, events);
  stepMines(s, events);
  stepDragon(s, events);
  stepUnicorn(s, events);
  stepLift(s, events);

  for (const e of takeDueExplosions(s.explosions, s.tick)) {
    const res = explode(e, s.terrain, s.units, s.rules.explosion, (u) => blastTakenPct(s, u));
    events.push({ e: 'explosion', x: e.x, y: e.y, radius: e.radius });
    if (res.carved > 0) {
      events.push({ e: 'terrainCarved', x: subToPx(e.x), y: subToPx(e.y), radius: e.carveRadius });
    }
    for (const h of res.hits) events.push({ e: 'unitDamaged', unitId: h.unitId, damage: h.damage });
    blastReachesBarrels(s, e);
    blastReachesCrates(s, e, events);
    blastReachesBeast(s, e, events);
    blastReachesDragon(s, e, events);
    blastReachesUnicorn(s, e, events);
    blastMovesPots(s, e);
    blastReachesMines(s, e, events);
    blastReachesWalkers(s, e, events);
    spawnFlames(s, e);
    blastHitsStructures(s, e, events);
    // A blast that reaches the kitchen counts as a touch (GDD §4.9).
    if (inKitchen(s, e.x, e.y, e.radius * SUBPX)) useKitchen(s, events);
  }
  stepKitchen(s, events);
  stepBarrels(s, events);
  stepCrates(s, events);
  stepPots(s);
  stepFlames(s, events);
  // Ground dug away this tick may leave a tower or a wall without its footing.
  for (let i = firstEvent; i < events.length; i++) {
    if (events[i]?.e === 'terrainCarved') {
      undermineStructures(s, events);
      break;
    }
  }
  stepBlocks(s, events);
  drownThings(s, events);
  drownFlames(s);

  const hurt = active !== undefined && (active.hp < hpBefore || !active.alive);
  advancePhase(s, hurt, phaseJustSet, events);
}

function advancePhase(
  s: SimState,
  activeHurt: boolean,
  phaseJustSet: boolean,
  events: SimEvent[],
): void {
  const t = s.turn;
  if (phaseJustSet && t.phase !== 'resolution') return;
  switch (t.phase) {
    case 'placement':
      if (--t.phaseTicks <= 0) autoPlace(s, events);
      break;
    case 'transition':
      if (--t.phaseTicks <= 0) {
        setPhase(s, 'action', s.rules.turn.actionTicks, events);
        panicAtAction(s, events);
        dragonAtAction(s, events);
        unicornAtAction(s, events);
      }
      break;
    case 'action':
    case 'retreat':
      // Hit during its own turn, the active unit stops at once (GDD §2.2).
      // The clock stops while the pick or the sap is at work, and during a charge.
      if (activeHurt || (!s.dig && !s.charge && (--t.phaseTicks <= 0 || nothingLeftToDo(s)))) {
        setPhase(s, 'resolution', 0, events);
      }
      break;
    case 'resolution': {
      t.resolutionTicks++;
      if (t.resolutionTicks >= s.rules.turn.maxResolutionTicks) {
        endTurn(s, events);
        break;
      }
      // phaseTicks counts the ticks spent at rest; any movement starts the count again.
      if (!settled(s)) {
        t.phaseTicks = 0;
        break;
      }
      // Deaths are called as soon as everything stops, then the scene is left to be seen.
      if (t.phaseTicks === 0) callDeaths(s, events);
      if (t.phaseTicks >= (s.rules.turn.settleTicks ?? 0)) endTurn(s, events);
      else t.phaseTicks++;
      break;
    }
    case 'gameOver':
      break;
  }
}

/**
 * A unit falling under its banner (GDD §4.4): its fall is slowed to the banner's speed, the wind
 * carries it sideways, and the height it falls from is reset at every tick, so it lands unhurt.
 */
function holdBanner(s: SimState, u: Unit): void {
  const b = s.rules.weapons.find((w) => w.banner)?.banner;
  if (!b) return;
  if (u.knocked) {
    u.banner = false;
    return;
  }
  if (u.vy > 0) u.vy = Math.min(u.vy, b.fallSpeed - GRAVITY);
  const drift = s.turn.wind * b.windDrift;
  u.vx += Math.max(-SUBPX / 8, Math.min(SUBPX / 8, drift - u.vx));
  u.airPeakY = subToPx(u.y);
  if (u.airFromY !== undefined) u.airFromY = u.airPeakY;
}

/** px per tick a unit goes up or down a rope */
const ROPE_SPEED = 3;

/**
 * One tick on the rope: up or down to the target's row, then across to it; true once there, the
 * unit standing on the ground.
 */
function ropeStep(u: Unit, rope: { readonly x: number; readonly y: number }): boolean {
  const ty = rope.y * SUBPX;
  const tx = rope.x * SUBPX + SUBPX / 2;
  const v = ROPE_SPEED * SUBPX;
  if (u.y !== ty) u.y += Math.max(-v, Math.min(v, ty - u.y));
  else if (u.x !== tx) u.x += Math.max(-v, Math.min(v, tx - u.x));
  if (u.y !== ty || u.x !== tx) return false;
  u.climbing = false;
  u.grounded = true;
  u.airPeakY = rope.y;
  return true;
}

/** px: a drop deeper than this beside a ladder is a ledge the walk stops at */
const LEDGE_DROP = 40;

const FEET_COLUMNS = [-UNIT_HALF_WIDTH + 1, 0, UNIT_HALF_WIDTH - 1];

/** No ground within LEDGE_DROP px below row y, under columns x + dx (all the unit's feet). */
function deepDrop(s: SimState, x: number, y: number, columns = FEET_COLUMNS): boolean {
  for (let dy = 0; dy <= LEDGE_DROP; dy++) {
    for (const dx of columns) {
      if (isSolid(s.terrain, x + dx, y + dy)) return false;
    }
  }
  return true;
}

/** The unit with its feet at (x, y) px stands on a structure's masonry (a tower, a curtain wall). */
function onStructure(s: SimState, x: number, y: number): boolean {
  const o = s.owners;
  const t = s.terrain;
  if (!o || y < 0 || y >= t.height) return false;
  for (const dx of FEET_COLUMNS) {
    const px = x + dx;
    if (px >= 0 && px < t.width && (o[y * t.width + px] ?? 0) !== 0 && isSolid(t, px, y))
      return true;
  }
  return false;
}

/**
 * True while the playing team may still hand the turn to another of its units
 * (rules.turn.freeSelect): the current one has not moved, jumped or fired yet.
 */
export function canSwitchUnit(s: SimView): boolean {
  const t = s.turn;
  if (!s.rules.turn.freeSelect || t.fired || t.walkDir !== 0 || t.climbDir !== 0) return false;
  if (t.phase !== 'transition' && t.phase !== 'action') return false;
  const budget = s.rules.unit.moveBudget;
  return budget === undefined || t.moveLeft === budget * SUBPX;
}

/** The next living unit of the playing team after the active one, in team order. */
export function nextTeammate(s: SimView): number | null {
  const team = s.teams[s.turn.activeTeam];
  if (!team) return null;
  const ids = team.unitIds;
  const from = ids.indexOf(s.turn.activeUnitId);
  for (let i = 1; i < ids.length; i++) {
    const id = ids[(from + i) % ids.length];
    if (id === s.turn.restingUnitId) continue;
    if (s.units.some((u) => u.id === id && u.alive)) return id ?? null;
  }
  return null;
}

/** Hands the turn to another unit of the active team, when canSwitchUnit allows it. */
function selectUnit(s: SimState, unitId: number): void {
  const t = s.turn;
  if (!canSwitchUnit(s)) return;
  const team = s.teams[t.activeTeam];
  const idx = team?.unitIds.indexOf(unitId) ?? -1;
  const unit = unitById(s, unitId);
  if (!team || idx < 0 || !unit?.alive || unitId === t.activeUnitId) return;
  if (unitId === t.restingUnitId) return;
  t.activeUnitId = unitId;
  team.lastPlayed = idx;
  faceInward(s, unit);
  t.aim = unit.facing > 0 ? AIM_UP_RIGHT : AIM_UP_LEFT;
  if (s.rules.turn.rememberWeapon) {
    t.weapon = weaponFor(s, unit);
    t.fuse = 0;
  }
}

/**
 * The weapon a unit starts its turn with: the one it last chose, while it has ammunition for it
 * and may use it (rules.turn.rememberWeapon); otherwise the bow.
 */
function weaponFor(s: SimState, u: Unit): WeaponId {
  const id = u.weapon;
  if (!s.rules.turn.rememberWeapon || id === undefined) return 'bow';
  const ammo = s.teams[u.team]?.ammo[weaponIndexIn(s.rules, id)] ?? 0;
  return ammo !== 0 && mayUse(s, u, weaponDefIn(s.rules, id)) ? id : 'bow';
}

/** A unit near an end of the map turns to face its inside (rules.turn.faceInwardPct). */
function faceInward(s: SimState, u: Unit): void {
  const pct = s.rules.turn.faceInwardPct;
  if (pct === undefined) return;
  const w = s.terrain.width;
  const x = subToPx(u.x);
  const zone = idiv(w * pct, 100);
  if (x < zone) u.facing = 1;
  else if (x >= w - zone) u.facing = -1;
}

/** After the shot, no move left and the shot is over: the turn ends without waiting. */
function nothingLeftToDo(s: SimState): boolean {
  const t = s.turn;
  return (
    t.phase === 'retreat' &&
    s.rules.turn.moveAfterShot === true &&
    s.rules.unit.moveBudget !== undefined &&
    t.moveLeft === 0 &&
    !(s.rules.unit.ladderEndsTurn && t.climbDir !== 0) &&
    settled(s)
  );
}

/** Everything has stopped: no shot, no pending explosion, all units at rest. */
function settled(s: SimState): boolean {
  return (
    s.shots.length === 0 &&
    s.explosions.items.length === 0 &&
    s.blocks.length === 0 &&
    s.dig === null &&
    s.charge === null &&
    s.walkers.length === 0 &&
    s.swarms.length === 0 &&
    !dragonBusy(s) &&
    s.lift === null &&
    s.units.every(atRest)
  );
}

/** Units at 0 HP die now (GDD §3.1: deaths are called once everything has stopped). */
function callDeaths(s: SimState, events: SimEvent[]): void {
  for (const u of s.units) {
    if (u.alive && u.hp <= 0) {
      u.alive = false;
      events.push({ e: 'unitDied', unitId: u.id, cause: 'hp' });
    }
  }
  if (!s.rules.regicide) return;
  // Régicide: a house whose king has fallen leaves the field (GDD §2.3).
  for (const u of s.units) {
    const king = kingOf(s, u.team);
    if (u.alive && king && !king.alive) {
      u.alive = false;
      u.hp = 0;
      events.push({ e: 'unitDied', unitId: u.id, cause: 'kingFell' });
    }
  }
}

/**
 * End of a turn with rules.burn: units in the burnt ends lose HP, then, once a round is over and
 * the fire has started, it eats further in (GDD §2.5).
 */
function burnTurn(s: SimState, events: SimEvent[]): void {
  const r = s.rules.burn;
  if (!r) return;
  const width = s.terrain.width;
  for (const u of s.units) {
    if (!u.alive || s.burnPx === 0) continue;
    const x = subToPx(u.x);
    if (x >= s.burnPx && x < width - s.burnPx) continue;
    const damage = Math.min(u.hp, r.damage);
    u.hp -= damage;
    events.push({ e: 'unitDamaged', unitId: u.id, damage });
  }
  const n = s.turn.number;
  const rounds = idiv(n, s.teams.length);
  burnBarrels(s);
  burnCrates(s, events);
  if (n % s.teams.length === 0 && rounds >= r.startRound && s.burnPx < width >> 1) {
    s.burnPx = Math.min(width >> 1, s.burnPx + r.advancePx);
    events.push({ e: 'burnSpread', px: s.burnPx });
    if (s.kitchen) {
      const kx = subToPx(s.kitchen.x);
      if (kx < s.burnPx || kx >= width - s.burnPx) {
        s.kitchen = null;
        events.push({ e: 'kitchenGone' });
      }
    }
  }
}

function endTurn(s: SimState, events: SimEvent[]): void {
  // A banner held up and never used is folded at the end of the turn.
  for (const u of s.units) if (u.banner) u.banner = false;
  blessAtTurnEnd(s, events);
  burnTurn(s, events);
  delugeTurnEnd(s, events);
  weatherTurnEnd(s, events);
  flamesTurnEnd(s);
  drownFlames(s);
  beastsTurnEnd(s, events);
  burnTowersTurnEnd(s, events);
  maybeDropCrate(s, events);
  callDeaths(s, events);
  const alive = s.teams.filter((team) => teamAlive(s, team));
  // The two fires have met: the house with the most HP left wins (rules.burn.endWhenMet).
  if (alive.length > 1 && s.rules.burn?.endWhenMet && s.burnPx >= s.terrain.width >> 1) {
    const hp = alive.map((team) =>
      team.unitIds.reduce((sum, id) => {
        const u = unitById(s, id);
        return sum + (u?.alive ? u.hp : 0);
      }, 0),
    );
    const best = Math.max(...hp);
    const leaders = alive.filter((_, i) => hp[i] === best);
    s.winner = leaders.length === 1 ? (leaders[0]?.id ?? -1) : -1;
    events.push({ e: 'burnMet' });
    setPhase(s, 'gameOver', 0, events);
    events.push({ e: 'gameOver', winner: s.winner });
    return;
  }
  if (alive.length <= 1) {
    s.winner = alive[0]?.id ?? -1;
    setPhase(s, 'gameOver', 0, events);
    events.push({ e: 'gameOver', winner: s.winner });
    return;
  }
  startTurn(s, events);
}

function hashState(s: SimState): number {
  let h = FNV_OFFSET;
  const int = (v: number): void => {
    h = hashInt(h, v);
  };
  int(s.tick);
  int(s.prng.a);
  int(s.prng.b);
  int(s.prng.c);
  int(s.prng.d);
  int(terrainHash(s.terrain));
  int(s.units.length);
  for (const u of s.units) {
    for (const v of [u.id, u.team, u.x, u.y, u.vx, u.vy, u.hp, u.facing, u.airPeakY, u.stillTicks])
      int(v);
    // The climbing bit is only ever set with rules.unit.climbSpeed: older hashes stay the same.
    int((u.grounded ? 1 : 0) | (u.knocked ? 2 : 0) | (u.alive ? 4 : 0) | (u.climbing ? 8 : 0));
    // Only ever set with rules.turn.rememberWeapon: older hashes stay the same.
    if (u.weapon !== undefined) int(weaponIndexIn(s.rules, u.weapon));
    // Only ever set with the banner: older hashes stay the same.
    if (u.banner !== undefined) int(u.banner ? 1 : 0);
    // Only read with rules.unit.fallMinHeight: older hashes stay the same.
    if (s.rules.unit.fallMinHeight !== undefined) int(u.airFromY ?? u.airPeakY);
  }
  int(s.shots.length);
  for (const shot of s.shots) {
    const p = shot.projectile;
    for (const v of [p.id, p.ownerId, p.x, p.y, p.vx, p.vy, p.age, p.clearOfOwner ? 1 : 0]) int(v);
    int(weaponIndexIn(s.rules, shot.weapon));
    int(shot.fuse);
    // Only fragments carry the flag, so logs without cluster weapons keep their hashes.
    if (shot.fragment) int(1);
    if (shot.turns !== undefined) int(shot.turns);
    if (shot.damagePct !== undefined) int(shot.damagePct);
    if (shot.homing) for (const v of [shot.homing.x, shot.homing.y]) int(v);
  }
  int(s.explosions.items.length);
  int(s.explosions.nextSeq);
  for (const q of s.explosions.items) {
    const e = q.explosion;
    for (const v of [q.tick, q.seq, e.x, e.y, e.radius, e.carveRadius, e.maxDamage, e.sourceId])
      int(v);
    if (e.flames) int(1);
    if (e.weapon !== undefined) int(weaponIndexIn(s.rules, e.weapon));
  }
  for (const team of s.teams) {
    int(team.lastPlayed);
    for (const a of team.ammo) int(a);
  }
  const t = s.turn;
  for (const v of [
    t.number,
    PHASES.indexOf(t.phase),
    t.phaseTicks,
    t.resolutionTicks,
    t.activeTeam,
    t.activeUnitId,
    t.wind,
    t.aim,
    weaponIndexIn(s.rules, t.weapon),
    t.fuse,
    t.walkDir,
    t.fired ? 1 : 0,
  ])
    int(v);
  // Hashed only when the rule exists, so logs recorded before it keep their reference hashes.
  if (s.rules.unit.moveBudget !== undefined) int(t.moveLeft);
  if (s.rules.unit.turnTicks !== undefined) int(t.turnHold);
  if (s.rules.unit.climbSpeed !== undefined) int(t.climbDir);
  if (s.rules.unit.wallClimb !== undefined)
    for (const v of t.rope ? [t.rope.x, t.rope.y] : [-1]) int(v);
  if (s.rules.turn.noRepeat) int(t.restingUnitId);
  if (s.rules.turn.placementTicks !== undefined) {
    int(s.placing.length);
    for (const p of s.placing) for (const v of [p.unitId, p.team, p.x]) int(v);
  }
  if (s.rules.burn) int(s.burnPx);
  if (s.rules.structures) {
    int(s.structures.length);
    for (const st of s.structures) {
      for (const v of [st.id, st.hp, st.state]) int(v);
      if (s.rules.structures.burnTurns !== undefined) int(st.fire ?? -1);
      for (const id of st.struck) int(id);
    }
    int(s.blocks.length);
    for (const b of s.blocks) {
      for (const v of [b.id, b.x, b.y, b.vx, b.vy, b.w, b.h, b.fallen, b.from]) int(v);
    }
  }
  if (s.rules.flames) {
    int(s.flames.length);
    for (const f of s.flames) for (const v of [f.id, f.x, f.y, f.turns]) int(v);
    int(s.scorched.length);
    for (const c of s.scorched) for (const v of [c.unitId, c.hp]) int(v);
  }
  if (s.rules.deluge || hasWater(s)) {
    int(s.waterY);
    int(s.deluge ? 1 : 0);
  }
  if (s.rules.weapons.some((w) => w.fuseTurns !== undefined)) {
    int(s.pots.length);
    for (const p of s.pots) {
      for (const v of [p.id, p.x, p.y, p.turns]) int(v);
      if (p.damagePct !== undefined) int(p.damagePct);
    }
  }
  if (s.rules.weather) int(s.rain);
  if (s.rules.weapons.some((w) => w.dig)) {
    const g = s.dig;
    for (const v of g ? [g.id, g.unitId, g.dx, g.dy, g.x, g.y, g.speed, g.ticksLeft] : [-1]) int(v);
  }
  if (s.rules.weapons.some((w) => w.rope)) {
    const g = t.grapple;
    for (const v of g ? [g.x, g.y, g.len] : [-1]) int(v);
    int(t.ropeFlight ? 1 : 0);
  }
  if (s.rules.weapons.some((w) => w.charge)) {
    const c = s.charge;
    for (const v of c ? [c.id, c.unitId, c.dir, c.left, c.damagePct, ...c.hit] : [-1]) int(v);
  }
  if (s.rules.weapons.some((w) => w.hive)) {
    int(s.swarms.length);
    for (const w of s.swarms)
      for (const v of [w.id, w.x, w.y, w.ticks, w.sting, w.damagePct]) int(v);
  }
  if (s.rules.weapons.some((w) => w.walker)) {
    int(s.walkers.length);
    for (const w of s.walkers) {
      for (const v of [w.id, w.ownerId, w.x, w.y, w.vx, w.vy, w.dir, w.fuse, w.hops, w.damagePct])
        int(v);
      int(w.grounded ? 1 : 0);
    }
  }
  if (s.rules.weapons.some((w) => w.mine)) {
    int(s.mines.length);
    for (const m of s.mines) for (const v of [m.id, m.team, m.x, m.y, m.arm]) int(v);
  }
  if (s.rules.beasts) {
    const b = s.beast;
    for (const v of b ? [b.id, b.kind, b.x, b.y] : [-1]) int(v);
    int(s.afflictions.length);
    for (const a of s.afflictions) for (const v of [a.unitId, a.trick, a.turns]) int(v);
  }
  if (s.rules.dragon) {
    const d = s.dragon;
    for (const v of d ? [d.id, d.x, d.y, d.dir, d.prey, d.fed ? 1 : 0] : [-1]) int(v);
    // Hashed only with the swing, so logs recorded before it keep their reference hashes.
    if (d && s.rules.dragon.swing !== undefined) int(d.born);
  }
  if (s.rules.crates?.angelLift !== undefined) {
    const l = s.lift;
    for (const v of l ? [l.unitId, l.top] : [-1]) int(v);
  }
  if (s.rules.unicorn) {
    const u = s.unicorn;
    for (const v of u ? [u.id, u.x, u.y, u.dir] : [-1]) int(v);
  }
  if (s.rules.crates) {
    int(s.crates.length);
    for (const c of s.crates)
      for (const v of [c.id, c.x, c.y, c.kind, c.weapon, c.landed ? 1 : 0]) int(v);
  }
  if (s.rules.barrels) {
    int(s.barrels.length);
    for (const b of s.barrels) for (const v of [b.id, b.x, b.y]) int(v);
  }
  if (s.rules.kitchen) {
    const k = s.kitchen;
    for (const v of k ? [k.x, k.y, k.expiresTurn] : [-1]) int(v);
    for (const c of s.kitchenCounts) int(c);
  }
  int(s.nextEntityId);
  int(s.winner ?? -2);
  return h;
}
