// Reliquaires (GDD §4.5). Only present when the match rules have `crates` (absent from older
// logs). A coffer comes down slowly, drifting with the wind, rests on the ground, drops again if
// the ground goes; a unit that touches it takes it; a shot or a blast bursts it.
import {
  CRATE_EDGE_PCT,
  ANGEL_HALF_WIDTH,
  ANGEL_HEIGHT,
  CRATE_HEIGHT,
  CRATE_WIDTH,
  CrateKind,
  type CrateKindId,
} from '../content/crates.ts';
import { maxHpOf } from './classes.ts';
import type { SimEvent } from './events.ts';
import { queueExplosion, type Explosion } from './explosions/explosion.ts';
import { SUBPX, idiv, subToPx } from './math/fixed.ts';
import { isqrt } from './math/isqrt.ts';
import { nextRange } from './math/prng.ts';
import type { Crate, SimState } from './state.ts';
import { isSolid } from './terrain/terrain.ts';
import { UNIT_HALF_WIDTH, UNIT_HEIGHT, bodyFree, release } from './units/unit.ts';

/** px per tick the beam of light lifts a unit */
const LIFT_SPEED = 3;

/** px above the top of the map where a coffer appears */
const DROP_HEIGHT = 60;

/** End of a turn: maybe an angel brings a reliquary down somewhere over the playable page. */
export function maybeDropCrate(s: SimState, events: SimEvent[]): void {
  const r = s.rules.crates;
  if (!r || s.crates.length >= r.maxOnMap) return;
  if (nextRange(s.prng, 0, 999) >= r.chancePermille) return;
  const w = s.terrain.width;
  const lo = Math.max(idiv(w * CRATE_EDGE_PCT, 100), s.burnPx + CRATE_WIDTH);
  const hi = Math.min(w - idiv(w * CRATE_EDGE_PCT, 100), w - s.burnPx - CRATE_WIDTH);
  if (hi <= lo) return;
  const x = nextRange(s.prng, lo, hi);
  const roll = nextRange(s.prng, 0, 999);
  let kind: CrateKindId = CrateKind.Weapon;
  if (roll < r.trapPermille) kind = CrateKind.Trap;
  else if (nextRange(s.prng, 0, 999) < r.balmPermille) kind = CrateKind.Balm;
  // A weapon coffer holds one more shot of a limited weapon.
  const limited = s.rules.weapons.map((wd, i) => (wd.ammo >= 0 ? i : -1)).filter((i) => i >= 0);
  const weapon = limited.length > 0 ? (limited[nextRange(s.prng, 0, limited.length - 1)] ?? 0) : -1;
  if (kind === CrateKind.Weapon && weapon < 0) kind = CrateKind.Balm;
  const id = s.nextEntityId++;
  s.crates.push({ id, x: x * SUBPX, y: -DROP_HEIGHT * SUBPX, kind, weapon, landed: false });
  events.push({ e: 'crateDropped', id, x });
}

function inCrate(c: Crate, x: number, y: number): boolean {
  const half = (CRATE_WIDTH >> 1) * SUBPX;
  return x >= c.x - half && x <= c.x + half && y <= c.y && y >= c.y - CRATE_HEIGHT * SUBPX;
}

/** Id of the first coffer the segment between two sub-px points crosses (2 px samples). */
export function crateOnSegment(
  s: SimState,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): number | null {
  if (s.crates.length === 0) return null;
  const steps = Math.max(1, idiv(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)), 2 * SUBPX));
  for (let i = 0; i <= steps; i++) {
    const x = x0 + idiv((x1 - x0) * i, steps);
    const y = y0 + idiv((y1 - y0) * i, steps);
    for (const c of s.crates) if (inCrate(c, x, y)) return c.id;
  }
  return null;
}

/** Id of the first coffer whose angel the segment crosses (rules.crates.angelLift). */
export function angelOnSegment(
  s: SimState,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): number | null {
  if (s.rules.crates?.angelLift === undefined) return null;
  const flying = s.crates.filter((c) => !c.landed);
  if (flying.length === 0) return null;
  const steps = Math.max(1, idiv(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)), 2 * SUBPX));
  for (let i = 0; i <= steps; i++) {
    const x = x0 + idiv((x1 - x0) * i, steps);
    const y = y0 + idiv((y1 - y0) * i, steps);
    for (const c of flying) {
      const bottom = c.y - CRATE_HEIGHT * SUBPX;
      if (
        Math.abs(x - c.x) <= ANGEL_HALF_WIDTH * SUBPX &&
        y <= bottom &&
        y >= bottom - ANGEL_HEIGHT * SUBPX
      ) {
        return c.id;
      }
    }
  }
  return null;
}

/**
 * Shot by unit `unitId`, the angel of coffer `id` lets its coffer drop and lifts the shooter in
 * a beam of light, rules.crates.angelLift px up, before letting go of it too.
 */
export function shootAngel(s: SimState, id: number, unitId: number, events: SimEvent[]): void {
  const r = s.rules.crates;
  const c = s.crates.find((x) => x.id === id);
  if (!r || r.angelLift === undefined || !c) return;
  c.landed = true;
  const u = s.units.find((x) => x.id === unitId);
  if (!u?.alive || s.lift) return;
  s.lift = { unitId, top: Math.max(UNIT_HEIGHT, subToPx(u.y) - r.angelLift) };
  u.climbing = true;
  u.grounded = true;
  u.vx = 0;
  u.vy = 0;
  events.push({ e: 'angelLift', unitId });
}

/** Each tick: the lifted unit rises in its beam, and is let go at the top or under a ceiling. */
export function stepLift(s: SimState, events: SimEvent[]): void {
  const lift = s.lift;
  if (!lift) return;
  const u = s.units.find((x) => x.id === lift.unitId);
  if (!u?.alive) {
    s.lift = null;
    return;
  }
  const px = subToPx(u.x);
  let y = subToPx(u.y);
  for (let i = 0; i < LIFT_SPEED && y > lift.top && bodyFree(s.terrain, px, y - 1); i++) y--;
  const done = y <= lift.top || !bodyFree(s.terrain, px, y - 1);
  u.y = y * SUBPX;
  if (!done) return;
  s.lift = null;
  release(u);
  events.push({ e: 'angelDropped', unitId: u.id });
}

/** A coffer shot or caught in a blast bursts: a small blast, a big one if it was trapped. */
export function burstCrate(s: SimState, id: number, events: SimEvent[]): void {
  const r = s.rules.crates;
  const i = s.crates.findIndex((c) => c.id === id);
  const c = s.crates[i];
  if (!r || !c) return;
  s.crates.splice(i, 1);
  const trap = c.kind === CrateKind.Trap;
  queueExplosion(s.explosions, s.tick + 1, {
    x: c.x,
    y: c.y - (CRATE_HEIGHT >> 1) * SUBPX,
    radius: trap ? r.trapRadius : r.blastRadius,
    carveRadius: trap ? r.trapRadius : r.blastRadius,
    maxDamage: trap ? r.trapDamage : r.blastDamage,
    sourceId: c.id,
  });
  events.push({ e: 'crateBurst', id: c.id, trap });
}

/** A blast bursts every coffer it reaches. */
export function blastReachesCrates(s: SimState, e: Explosion, events: SimEvent[]): void {
  if (s.crates.length === 0) return;
  const reach = (e.radius + (CRATE_WIDTH >> 1)) * SUBPX;
  const hit = s.crates
    .filter((c) => {
      const dx = c.x - e.x;
      const dy = c.y - (CRATE_HEIGHT >> 1) * SUBPX - e.y;
      return isqrt(dx * dx + dy * dy) <= reach;
    })
    .map((c) => c.id);
  for (const id of hit) burstCrate(s, id, events);
}

/** Coffers in the burnt ends of the map burn up (GDD §2.5). */
export function burnCrates(s: SimState, events: SimEvent[]): void {
  if (s.crates.length === 0 || s.burnPx === 0) return;
  const w = s.terrain.width;
  const lost = s.crates
    .filter((c) => subToPx(c.x) < s.burnPx || subToPx(c.x) >= w - s.burnPx)
    .map((c) => c.id);
  for (const id of lost) burstCrate(s, id, events);
}

function supported(s: SimState, c: Crate): boolean {
  const x = subToPx(c.x);
  const y = subToPx(c.y);
  const half = CRATE_WIDTH >> 1;
  return (
    isSolid(s.terrain, x - half, y) || isSolid(s.terrain, x, y) || isSolid(s.terrain, x + half, y)
  );
}

/** What a unit gets from a coffer it walks into. */
function takeCrate(s: SimState, c: Crate, unitId: number, events: SimEvent[]): void {
  const r = s.rules.crates;
  const u = s.units.find((x) => x.id === unitId);
  if (!r || !u) return;
  if (c.kind === CrateKind.Trap) {
    burstCrate(s, c.id, events);
    return;
  }
  s.crates.splice(s.crates.indexOf(c), 1);
  let heal = 0;
  if (c.kind === CrateKind.Balm) {
    heal = Math.max(0, Math.min(r.balmHp, maxHpOf(s, u) - u.hp));
    u.hp += heal;
  } else {
    const team = s.teams[u.team];
    const ammo = team?.ammo[c.weapon];
    // Most coffers hold one shot; a quiver of fire arrows holds more (WeaponDef.crateAmmo).
    const more = s.rules.weapons[c.weapon]?.crateAmmo ?? 1;
    if (team && ammo !== undefined && ammo >= 0) team.ammo[c.weapon] = ammo + more;
  }
  events.push({ e: 'crateTaken', id: c.id, unitId, kind: c.kind, weapon: c.weapon, heal });
}

/** Each tick: coffers come down with the wind, rest, drop again, and are taken on contact. */
export function stepCrates(s: SimState, events: SimEvent[]): void {
  const r = s.rules.crates;
  if (!r || s.crates.length === 0) return;
  // Backwards: taking or losing a coffer keeps the order of the others (sorted by id).
  for (let k = s.crates.length - 1; k >= 0; k--) {
    const c = s.crates[k];
    if (!c) continue;
    if (supported(s, c)) c.landed = true;
    else {
      // Under the angel, then free fall at the same slow pace if the ground goes.
      if (!c.landed) c.x += s.turn.wind * r.windDrift;
      for (let i = 0; i < r.fallSpeed; i += SUBPX) {
        if (supported(s, c)) break;
        c.y += Math.min(SUBPX, r.fallSpeed - i);
      }
      const px = subToPx(c.x);
      if (subToPx(c.y) >= s.terrain.height || px < 0 || px >= s.terrain.width) {
        s.crates.splice(k, 1);
        events.push({ e: 'crateBurst', id: c.id, trap: false });
        continue;
      }
    }
    const half = CRATE_WIDTH >> 1;
    for (const u of s.units) {
      if (!u.alive) continue;
      const dx = Math.abs(subToPx(u.x) - subToPx(c.x));
      const top = subToPx(u.y) - UNIT_HEIGHT;
      const cy = subToPx(c.y);
      if (dx <= half + UNIT_HALF_WIDTH && cy >= top && cy - CRATE_HEIGHT <= subToPx(u.y)) {
        takeCrate(s, c, u.id, events);
        break;
      }
    }
  }
}
