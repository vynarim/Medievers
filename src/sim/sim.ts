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
import { SUBPX, subToPx } from './math/fixed.ts';
import type { Phase, MatchConfig, SimState, TeamState } from './state.ts';
import type { Mask } from './terrain/mask.ts';
import { createTerrain, terrainHash } from './terrain/terrain.ts';
import {
  atRest,
  createUnit,
  jump,
  settle,
  stepUnitPhysics,
  walk,
  type Unit,
} from './units/unit.ts';
import { kitchenTurn, inKitchen, stepKitchen, useKitchen } from './kitchen.ts';
import { fire, stepShots } from './weapons/weapons.ts';

/** BAM: default aim, 45° above the horizon on the facing side */
export const AIM_UP_RIGHT = 3584;
export const AIM_UP_LEFT = 2560;
const PHASES: readonly Phase[] = ['transition', 'action', 'retreat', 'resolution', 'gameOver'];

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
    startTurn(this.s, events);
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
  config.teams.forEach((team, teamId) => {
    const unitIds: number[] = [];
    for (const xPx of team.spawns) {
      const u = createUnit(nextId++, teamId, xPx, 0, config.rules.startHp);
      settle(u, terrain);
      units.push(u);
      unitIds.push(u.id);
    }
    teams.push({
      id: teamId,
      unitIds,
      lastPlayed: -1,
      ammo: config.rules.weapons.map((w) => w.ammo),
    });
  });
  return {
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
      turnHold: 0,
      moveLeft: 0,
      fired: false,
    },
    nextEntityId: nextId,
    kitchen: null,
    kitchenCounts: teams.map(() => 0),
    winner: null,
    rules: config.rules,
  };
}

function unitById(s: SimState, id: number): Unit | undefined {
  return s.units.find((u) => u.id === id);
}

function teamAlive(s: SimState, team: TeamState): boolean {
  return team.unitIds.some((id) => unitById(s, id)?.alive === true);
}

function setPhase(s: SimState, phase: Phase, ticks: number, events: SimEvent[]): void {
  s.turn.phase = phase;
  s.turn.phaseTicks = ticks;
  s.turn.resolutionTicks = 0;
  s.turn.walkDir = 0;
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
  t.aim = unit.facing > 0 ? AIM_UP_RIGHT : AIM_UP_LEFT;
  t.weapon = 'bow';
  t.fuse = 0;
  t.fired = false;
  t.turnHold = 0;
  t.moveLeft = (s.rules.unit.moveBudget ?? 0) * SUBPX;
  kitchenTurn(s, events);
  setPhase(s, 'transition', s.rules.turn.transitionTicks, events);
  events.push({ e: 'turnStarted', turn: t.number, team: team.id, unitId: unit.id, wind: t.wind });
}

function applyCommand(s: SimState, c: GameCommand, events: SimEvent[]): void {
  const t = s.turn;
  const canAct = t.phase === 'action';
  const canMove = canAct || t.phase === 'retreat';
  if (c.t === 'selectUnit') {
    selectUnit(s, c.unitId);
    return;
  }
  const u = unitById(s, t.activeUnitId);
  if (!u?.alive || !canMove) return;
  switch (c.t) {
    case 'move': {
      t.walkDir = c.dir;
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
      if (!jump(u, c.kind, s.rules.unit)) {
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
      if (canAct) {
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
      if (!team || ammo === 0) return;
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
    if (budgeted) t.moveLeft = Math.max(0, t.moveLeft - Math.abs(active.x - x0));
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

  stepShots(s, events);

  for (const e of takeDueExplosions(s.explosions, s.tick)) {
    const res = explode(e, s.terrain, s.units, s.rules.explosion);
    events.push({ e: 'explosion', x: e.x, y: e.y, radius: e.radius });
    if (res.carved > 0) {
      events.push({ e: 'terrainCarved', x: subToPx(e.x), y: subToPx(e.y), radius: e.carveRadius });
    }
    for (const h of res.hits) events.push({ e: 'unitDamaged', unitId: h.unitId, damage: h.damage });
    // A blast that reaches the kitchen counts as a touch (GDD §4.9).
    if (inKitchen(s, e.x, e.y, e.radius * SUBPX)) useKitchen(s, events);
  }
  stepKitchen(s, events);

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
    case 'transition':
      if (--t.phaseTicks <= 0) setPhase(s, 'action', s.rules.turn.actionTicks, events);
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
  if (!s.rules.turn.freeSelect || t.fired || t.walkDir !== 0) return false;
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
  t.aim = unit.facing > 0 ? AIM_UP_RIGHT : AIM_UP_LEFT;
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
}

function endTurn(s: SimState, events: SimEvent[]): void {
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
    int((u.grounded ? 1 : 0) | (u.knocked ? 2 : 0) | (u.alive ? 4 : 0));
  }
  int(s.shots.length);
  for (const shot of s.shots) {
    const p = shot.projectile;
    for (const v of [p.id, p.ownerId, p.x, p.y, p.vx, p.vy, p.age, p.clearOfOwner ? 1 : 0]) int(v);
    int(weaponIndexIn(s.rules, shot.weapon));
    int(shot.fuse);
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
  if (s.rules.turn.noRepeat) int(t.restingUnitId);
  if (s.rules.kitchen) {
    const k = s.kitchen;
    for (const v of k ? [k.x, k.y, k.expiresTurn] : [-1]) int(v);
    for (const c of s.kitchenCounts) int(c);
  }
  int(s.nextEntityId);
  int(s.winner ?? -2);
  return h;
}
