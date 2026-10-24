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
import { subToPx } from './math/fixed.ts';
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
      wind: 0,
      aim: AIM_UP_RIGHT,
      weapon: 'bow',
      fuse: 0,
      walkDir: 0,
      fired: false,
    },
    nextEntityId: nextId,
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
  let unit: Unit | undefined;
  for (let i = 1; i <= count; i++) {
    const idx = (team.lastPlayed + i) % count;
    const candidate = unitById(s, team.unitIds[idx] ?? -1);
    if (candidate?.alive) {
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
  setPhase(s, 'transition', s.rules.turn.transitionTicks, events);
  events.push({ e: 'turnStarted', turn: t.number, team: team.id, unitId: unit.id, wind: t.wind });
}

function applyCommand(s: SimState, c: GameCommand, events: SimEvent[]): void {
  const t = s.turn;
  const canAct = t.phase === 'action';
  const canMove = canAct || t.phase === 'retreat';
  const u = unitById(s, t.activeUnitId);
  if (!u?.alive || !canMove) return;
  switch (c.t) {
    case 'move':
      t.walkDir = c.dir;
      break;
    case 'jump':
      jump(u, c.kind, s.rules.unit);
      break;
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
      setPhase(s, 'retreat', s.rules.turn.retreatTicks, events);
      break;
    }
    case 'skip':
      if (canAct) setPhase(s, 'resolution', 0, events);
      break;
  }
}

function advanceTick(s: SimState, phaseJustSet: boolean, events: SimEvent[]): void {
  const t = s.turn;
  const active = unitById(s, t.activeUnitId);
  const hpBefore = active?.hp ?? 0;

  if (active?.alive && t.walkDir !== 0 && (t.phase === 'action' || t.phase === 'retreat')) {
    walk(active, s.terrain, t.walkDir, s.rules.unit);
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
  }

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
      if (activeHurt || --t.phaseTicks <= 0) setPhase(s, 'resolution', 0, events);
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
  int(s.nextEntityId);
  int(s.winner ?? -2);
  return h;
}
