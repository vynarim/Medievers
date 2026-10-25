// Siege engines (GDD §4.8): fixed machines standing on the ground of the map. A unit beside a
// ready one may serve it (its weapon in content/weapons.ts, `engine`): the shot leaves from the
// machine, which then reloads for a few turns, whoever's they are. Shots and blasts damage it;
// at 0 HP it falls to a heap of rubble. It drops when the ground under it goes.
import type { EnginePlacement, EngineRules, EngineType } from '../content/engines.ts';
import type { MatchRules } from '../content/rules.ts';
import type { SimEvent } from './events.ts';
import { damageAt, type Explosion } from './explosions/explosion.ts';
import { SUBPX, idiv, subToPx } from './math/fixed.ts';
import { isqrt } from './math/isqrt.ts';
import type { Engine, SimState } from './state.ts';
import { Material } from './terrain/material.ts';
import { isSolid, rectShape, stamp, type Terrain } from './terrain/terrain.ts';
import type { Unit } from './units/unit.ts';

/** px a machine drops per tick when the ground under it is gone */
const ENGINE_FALL_PX = 4;

/** What the serving helpers read (a SimView fits). */
export interface EngineView {
  readonly rules: MatchRules;
  readonly engines?: readonly Readonly<Engine>[];
}

/** Highest row at or below y where the machine's base, `w` px wide around x, rests. */
function restingRow(t: Terrain, x: number, y: number, w: number): number {
  for (let row = Math.max(0, y); row < t.height; row++) {
    for (let dx = -(w >> 1); dx <= w >> 1; dx += 4) if (isSolid(t, x + dx, row)) return row;
  }
  return t.height;
}

/** The machines of a new match, standing on the ground of their columns. */
export function initEngines(
  t: Terrain,
  rules: EngineRules | undefined,
  placements: readonly EnginePlacement[] | undefined,
): Engine[] {
  if (!rules || !placements) return [];
  return [...placements]
    .sort((a, b) => a.id - b.id)
    .map((p) => {
      const def = rules.defs[p.type];
      return {
        id: p.id,
        type: p.type,
        x: p.x * SUBPX + SUBPX / 2,
        y: restingRow(t, p.x, 0, def.w) * SUBPX,
        hp: def.hp,
        reload: 0,
      };
    });
}

/** The ready machine of `type` unit u stands beside (the nearest), or null. */
export function engineFor(
  v: EngineView,
  u: Pick<Unit, 'x' | 'y'>,
  type: EngineType,
): Engine | null {
  const r = v.rules.engines;
  if (!r || !v.engines) return null;
  let best: Engine | null = null;
  let bestD = 0;
  for (const e of v.engines) {
    if (e.type !== type || e.reload > 0 || e.hp <= 0) continue;
    const half = r.defs[e.type].w >> 1;
    const d = Math.abs(subToPx(u.x) - subToPx(e.x));
    if (d > half + r.reach || Math.abs(subToPx(u.y) - subToPx(e.y)) > r.reach) continue;
    if (!best || d < bestD) {
      best = e as Engine;
      bestD = d;
    }
  }
  return best;
}

/** sub-px: where a machine's shot leaves it, above its middle. */
export function engineMuzzle(s: EngineView, e: Readonly<Engine>): { x: number; y: number } {
  const h = s.rules.engines?.defs[e.type].h ?? 0;
  return { x: e.x, y: e.y - (h + 6) * SUBPX };
}

/** The machine has shot: it reloads for its turns (counted at each turn's end). */
export function engineShot(s: SimState, e: Engine, events: SimEvent[]): void {
  const def = s.rules.engines?.defs[e.type];
  if (!def) return;
  // One more, for the end of the turn it shot in.
  const turns = def.reloadTurns + 1;
  if (s.rules.engines?.reloadPerHouses) {
    // In a duel, as many turn ends as before; with n houses, n / 2 times as many (rounded up),
    // so the shooter misses as many of its own turns, whatever the number of houses.
    const houses = s.teams.filter((t) =>
      t.unitIds.some((id) => s.units.some((u) => u.id === id && u.alive)),
    ).length;
    e.reload = Math.trunc((turns * Math.max(2, houses) + 1) / 2);
  } else e.reload = turns;
  events.push({ e: 'engineShot', id: e.id });
}

/** End of a turn: every machine reloads by one turn. */
export function enginesTurnEnd(s: SimState): void {
  for (const e of s.engines) if (e.reload > 0) e.reload--;
}

/** px: the box of a machine's body */
function box(s: SimState, e: Engine): { x0: number; x1: number; y0: number; y1: number } {
  const def = s.rules.engines?.defs[e.type];
  const w = def?.w ?? 0;
  const h = def?.h ?? 0;
  const x = subToPx(e.x);
  const y = subToPx(e.y);
  return { x0: x - (w >> 1), x1: x + (w >> 1), y0: y - h, y1: y };
}

/** The first machine the segment from (x0, y0) to (x1, y1), sub-px, goes through, or null. */
export function engineOnSegment(
  s: SimState,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  /** a machine left out: the one being served */
  except = -1,
): Engine | null {
  if (s.engines.length === 0) return null;
  const steps = Math.max(1, subToPx(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))) >> 1);
  for (let i = 0; i <= steps; i++) {
    const x = subToPx(x0 + idiv((x1 - x0) * i, steps));
    const y = subToPx(y0 + idiv((y1 - y0) * i, steps));
    for (const e of s.engines) {
      if (e.id === except) continue;
      const b = box(s, e);
      if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1) return e;
    }
  }
  return null;
}

/** percent of a weapon's damage the machines take */
const pctFor = (s: SimState, weapon: string | undefined): number =>
  (weapon !== undefined ? s.rules.engines?.weaponPct[weapon] : undefined) ?? 100;

/** A machine takes `damage` HP from `weapon`; at 0 it falls to rubble. */
export function hitEngine(
  s: SimState,
  e: Engine,
  damage: number,
  weapon: string | undefined,
  events: SimEvent[],
): void {
  const hp = idiv(damage * pctFor(s, weapon) + 50, 100);
  if (hp <= 0 || e.hp <= 0) return;
  e.hp = Math.max(0, e.hp - hp);
  events.push({ e: 'engineHit', id: e.id, damage: hp });
  if (e.hp === 0) destroy(s, e, events);
}

/** A machine at 0 HP falls apart: a heap of timber and stone where it stood. */
function destroy(s: SimState, e: Engine, events: SimEvent[]): void {
  const r = s.rules.engines;
  const b = box(s, e);
  const h = r?.rubble ?? 0;
  if (h > 0) {
    const w = b.x1 - b.x0;
    stamp(s.terrain, b.x0, b.y1 - h, rectShape(w, h), Material.Earth);
    events.push({ e: 'terrainChanged', x: b.x0, y: b.y1 - h, w, h });
  }
  s.engines = s.engines.filter((x) => x.id !== e.id);
  events.push({ e: 'engineDestroyed', id: e.id, x: subToPx(e.x), y: subToPx(e.y) });
}

/** A blast damages the machines it reaches, by distance from their middle. */
export function blastReachesEngines(s: SimState, ex: Explosion, events: SimEvent[]): void {
  for (const e of [...s.engines]) {
    const h = s.rules.engines?.defs[e.type].h ?? 0;
    const dx = subToPx(e.x - ex.x);
    const dy = subToPx(e.y - (h >> 1) * SUBPX - ex.y);
    const d = isqrt(dx * dx + dy * dy) * SUBPX;
    const dmg = damageAt(ex.maxDamage, ex.radius * SUBPX, d);
    if (dmg > 0) hitEngine(s, e, dmg, ex.weapon, events);
  }
}

/** Each tick: a machine whose ground is gone drops. */
export function stepEngines(s: SimState): void {
  const t = s.terrain;
  for (const e of s.engines) {
    const w = s.rules.engines?.defs[e.type].w ?? 0;
    const x = subToPx(e.x);
    for (let i = 0; i < ENGINE_FALL_PX; i++) {
      const y = subToPx(e.y);
      if (y >= t.height) break;
      let held = false;
      for (let dx = -(w >> 1); dx <= w >> 1 && !held; dx += 4) held = isSolid(t, x + dx, y);
      if (held) break;
      e.y += SUBPX;
    }
  }
  s.engines = s.engines.filter((e) => subToPx(e.y) < t.height);
}
