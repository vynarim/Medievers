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
import { createTerrain, terrainHash } from './terrain/terrain.ts';
import { climb, ladderAt } from './units/climb.ts';
import {
  atRest,
  createUnit,
  jump,
  release,
  settle,
  stepUnitPhysics,
  walk,
  type Unit,
} from './units/unit.ts';
import { blastReachesBarrels, burnBarrels, placeBarrels, stepBarrels } from './barrels.ts';
import { blastReachesCrates, burnCrates, maybeDropCrate, stepCrates } from './crates.ts';
import { beastsTurnEnd, blastReachesBeast, hasAffliction, panicAtAction } from './beasts.ts';
import { Trick } from '../content/beasts.ts';
import { blastMovesPots, potsTurn, stepPots } from './pots.ts';
import { kitchenTurn, inKitchen, stepKitchen, useKitchen } from './kitchen.ts';
import { fire, stepShots } from './weapons/weapons.ts';
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
      turnHold: 0,
      moveLeft: 0,
      fired: false,
    },
    nextEntityId: nextId,
    kitchen: null,
    barrels: [],
    crates: [],
    beast: null,
    pots: [],
    // One unit per house in turn: first units of every house, then the second ones…
    placing: placing
      .sort((a, b) => a.rank - b.rank || a.team - b.team)
      .map(({ unitId, team, x }) => ({ unitId, team, x })),
    afflictions: [],
    burnPx: 0,
    waterY: config.waterLevel ?? terrain.height,
    deluge: false,
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
  s.turn.phase = phase;
  s.turn.phaseTicks = ticks;
  s.turn.resolutionTicks = 0;
  s.turn.walkDir = 0;
  s.turn.climbDir = 0;
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
  t.weapon = 'bow';
  t.fuse = 0;
  t.fired = false;
  t.turnHold = 0;
  t.moveLeft = (s.rules.unit.moveBudget ?? 0) * SUBPX;
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
  const next = s.placing[0];
  if (!next) return false;
  const w = s.terrain.width;
  if (x < PLACE_CLEARANCE || x >= w - PLACE_CLEARANCE) return false;
  if (s.units.some((u) => Math.abs(subToPx(u.x) - x) < PLACE_CLEARANCE)) return false;
  const u = createUnit(
    next.unitId,
    next.team,
    x,
    0,
    maxHpOf(s, { id: next.unitId, team: next.team }),
  );
  if (!settle(u, s.terrain) || underWater(s, subToPx(u.y))) return false;
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
  if (c.t === 'selectUnit') {
    selectUnit(s, c.unitId);
    return;
  }
  const u = unitById(s, t.activeUnitId);
  if (!u?.alive || !canMove) return;
  // In its shell (snail trick): no walking nor jumping this turn, shooting is fine.
  const shelled = s.rules.beasts !== undefined && hasAffliction(s, u.id, Trick.Shell);
  if (shelled && (c.t === 'move' || c.t === 'jump' || c.t === 'climb')) return;
  switch (c.t) {
    case 'climb':
      if (s.rules.unit.climbSpeed === undefined) return;
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
      // With a move budget, a turn has either a walk or a single jump (GDD §3.1).
      const budget = s.rules.unit.moveBudget;
      if (budget !== undefined && t.moveLeft !== budget * SUBPX) return;
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
      }
      break;
    case 'setFuse':
      if (canAct) t.fuse = c.seconds * 60;
      break;
    case 'fire': {
      if (!canAct) return;
      const team = s.teams[t.activeTeam];
      const wi = weaponIndexIn(s.rules, t.weapon);
      const ammo = team?.ammo[wi] ?? 0;
      if (!team || ammo === 0 || !mayUse(s, u, weaponDefIn(s.rules, t.weapon))) return;
      if (ammo > 0) team.ammo[wi] = ammo - 1;
      if (t.fuse === 0) t.fuse = s.rules.weapons[wi]?.defaultFuse ?? 0;
      fire(s, u, c.power, events);
      t.fired = true;
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

  const budgeted = s.rules.unit.moveBudget !== undefined;
  if (t.turnHold > 0) t.turnHold--;
  else if (
    active?.alive &&
    t.walkDir !== 0 &&
    (t.phase === 'action' || t.phase === 'retreat') &&
    (!budgeted || t.moveLeft > 0)
  ) {
    const x0 = active.x;
    walk(active, s.terrain, t.walkDir, s.rules.unit);
    // Snail slime: every step counts double (GDD §4.10).
    const slimed = s.rules.beasts !== undefined && hasAffliction(s, active.id, Trick.Slime);
    const spent = Math.abs(active.x - x0) * (slimed ? 2 : 1);
    if (budgeted) t.moveLeft = Math.max(0, t.moveLeft - spent);
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
    if (u.climbing && !ladderAt(s.terrain, subToPx(u.x), subToPx(u.y))) release(u);
  }

  for (const u of s.units) {
    if (!u.alive) continue;
    const r = stepUnitPhysics(u, s.terrain, s.rules.unit);
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

  drownUnits(s, events);
  stepShots(s, events);

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
    blastMovesPots(s, e);
    // A blast that reaches the kitchen counts as a touch (GDD §4.9).
    if (inKitchen(s, e.x, e.y, e.radius * SUBPX)) useKitchen(s, events);
  }
  stepKitchen(s, events);
  stepBarrels(s, events);
  stepCrates(s, events);
  stepPots(s);
  drownThings(s, events);

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
      }
      break;
    case 'action':
    case 'retreat':
      // Hit during its own turn, the active unit stops at once (GDD §2.2).
      if (activeHurt || --t.phaseTicks <= 0 || nothingLeftToDo(s)) {
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
    settled(s)
  );
}

/** Everything has stopped: no shot, no pending explosion, all units at rest. */
function settled(s: SimState): boolean {
  return s.shots.length === 0 && s.explosions.items.length === 0 && s.units.every(atRest);
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
  blessAtTurnEnd(s, events);
  burnTurn(s, events);
  delugeTurnEnd(s, events);
  beastsTurnEnd(s, events);
  maybeDropCrate(s, events);
  callDeaths(s, events);
  const alive = s.teams.filter((team) => teamAlive(s, team));
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
  }
  int(s.explosions.items.length);
  int(s.explosions.nextSeq);
  for (const q of s.explosions.items) {
    const e = q.explosion;
    for (const v of [q.tick, q.seq, e.x, e.y, e.radius, e.carveRadius, e.maxDamage, e.sourceId])
      int(v);
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
  if (s.rules.turn.noRepeat) int(t.restingUnitId);
  if (s.rules.turn.placementTicks !== undefined) {
    int(s.placing.length);
    for (const p of s.placing) for (const v of [p.unitId, p.team, p.x]) int(v);
  }
  if (s.rules.burn) int(s.burnPx);
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
  if (s.rules.beasts) {
    const b = s.beast;
    for (const v of b ? [b.id, b.kind, b.x, b.y] : [-1]) int(v);
    int(s.afflictions.length);
    for (const a of s.afflictions) for (const v of [a.unitId, a.trick, a.turns]) int(v);
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
