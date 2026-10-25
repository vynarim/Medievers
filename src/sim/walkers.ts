// Le cochon enflammé (GDD §4.1): a beast let loose on the facing side that trots on over the
// ground by itself, up steps and down slopes, hops over what blocks its way, and goes up at a
// second press of Fire, at the end of its fuse, or when a blast reaches it. Its small body is
// tested against the mask like a unit's, with its own size; it walks through the units.
import { weaponDefIn } from '../content/rules.ts';
import type { WeaponDef } from '../content/weapons.ts';
import { underWater } from './deluge.ts';
import type { SimEvent } from './events.ts';
import { queueExplosion, type Explosion } from './explosions/explosion.ts';
import { SUBPX, idiv, subToPx } from './math/fixed.ts';
import { isqrt } from './math/isqrt.ts';
import type { SimState, Walker } from './state.ts';
import { isSolid, type Terrain } from './terrain/terrain.ts';
import {
  GRAVITY,
  MAX_SUBSTEP,
  TERMINAL_VELOCITY,
  UNIT_HALF_WIDTH,
  type Unit,
} from './units/unit.ts';

/** px: half the width of the pig's body, and its height */
export const PIG_HALF_WIDTH = 10;
export const PIG_HEIGHT = 20;
/** hops in a row that take it nowhere before it turns round */
const HOPS_BEFORE_TURN = 3;
/** px a hop must take the pig forward to count as progress (WalkerDef.hopProgress) */
const HOP_PROGRESS = 4;

/** Nothing solid in the pig's body with its feet at (px, py). */
function free(t: Terrain, px: number, py: number): boolean {
  for (const dx of [-PIG_HALF_WIDTH, 0, PIG_HALF_WIDTH]) {
    for (const dy of [1, PIG_HEIGHT >> 1, PIG_HEIGHT])
      if (isSolid(t, px + dx, py - dy)) return false;
  }
  return true;
}

/** Ground right under the pig's feet at (px, py). */
function standing(t: Terrain, px: number, py: number): boolean {
  for (const dx of [-PIG_HALF_WIDTH + 2, 0, PIG_HALF_WIDTH - 2])
    if (isSolid(t, px + dx, py)) return true;
  return false;
}

/** The pig is let loose just ahead of the unit, on its facing side. */
export function letLoose(s: SimState, u: Unit, def: WeaponDef, id: number, pct: number): boolean {
  if (!def.walker) return false;
  const t = s.terrain;
  const px = subToPx(u.x) + u.facing * (UNIT_HALF_WIDTH + PIG_HALF_WIDTH + 2);
  const py = subToPx(u.y);
  // Room for it there, or at the unit's own feet against a wall.
  let x = px;
  if (!free(t, x, py)) x = subToPx(u.x);
  if (!free(t, x, py)) return false;
  s.walkers.push({
    id,
    ownerId: u.id,
    weapon: def.id,
    x: x * SUBPX + SUBPX / 2,
    y: py * SUBPX,
    vx: 0,
    vy: 0,
    dir: u.facing,
    grounded: standing(t, x, py),
    fuse: def.walker.fuse,
    hops: 0,
    damagePct: pct,
  });
  s.walkers.sort((a, b) => a.id - b.id);
  return true;
}

/** The pig goes up where it stands (at once: a press of Fire, its fuse, a blast). */
function goUp(s: SimState, w: Walker, events: SimEvent[]): void {
  const def = weaponDefIn(s.rules, w.weapon);
  queueExplosion(s.explosions, s.tick, {
    x: w.x,
    y: w.y - (PIG_HEIGHT >> 1) * SUBPX,
    radius: def.explosionRadius,
    carveRadius: def.walker?.carve ?? def.explosionRadius,
    maxDamage: idiv(def.damage * w.damagePct + 50, 100),
    sourceId: w.id,
    ...(s.rules.structures ? { weapon: def.id } : {}),
    ...(def.sparesUnits ? { sparesUnits: true } : {}),
  });
  events.push({ e: 'walkerGone', id: w.id, fizzled: false });
  events.push({ e: 'shotEnded', shotId: w.id });
}

/** A second press of Fire: the pigs of unit `ownerId` go up. True if there was one. */
export function detonateWalkers(s: SimState, ownerId: number, events: SimEvent[]): boolean {
  const mine = s.walkers.filter((w) => w.ownerId === ownerId);
  if (mine.length === 0) return false;
  for (const w of mine) goUp(s, w, events);
  s.walkers = s.walkers.filter((w) => w.ownerId !== ownerId);
  return true;
}

/** A blast that reaches a pig sets it off. */
export function blastReachesWalkers(s: SimState, e: Explosion, events: SimEvent[]): void {
  if (s.walkers.length === 0) return;
  const left: Walker[] = [];
  for (const w of s.walkers) {
    const dx = w.x - e.x;
    const dy = w.y - (PIG_HEIGHT >> 1) * SUBPX - e.y;
    if (w.id !== e.sourceId && isqrt(dx * dx + dy * dy) <= e.radius * SUBPX) goUp(s, w, events);
    else left.push(w);
  }
  s.walkers = left;
}

/** One trot of the pig on the ground: pixel by pixel, up steps, down slopes; a hop at a wall. */
function trot(
  s: SimState,
  w: Walker,
  maxStep: number,
  speed: number,
  hop: number,
  hopProgress: boolean,
): void {
  const t = s.terrain;
  let px = subToPx(w.x);
  let py = subToPx(w.y);
  const target = subToPx(w.x + w.dir * speed);
  while (px !== target) {
    const nx = px + w.dir;
    let ny: number | null = null;
    for (let y = py - maxStep; y <= py + maxStep; y++) {
      if (free(t, nx, y) && standing(t, nx, y)) {
        ny = y;
        break;
      }
    }
    if (ny === null) {
      if (free(t, nx, py)) {
        // Over the edge: it falls on.
        w.x = nx * SUBPX + SUBPX / 2;
        w.grounded = false;
        w.vx = w.dir * speed;
        w.vy = 0;
        return;
      }
      // A wall: it hops, and after a few hops that took it nowhere, it turns round. Up a steep
      // slope, each hop takes it a little further: that is progress, not a wall.
      if (hopProgress) {
        if (w.hopX !== undefined && (px - w.hopX) * w.dir >= HOP_PROGRESS) w.hops = 0;
        w.hopX = px;
      }
      if (++w.hops >= HOPS_BEFORE_TURN) {
        w.dir = w.dir > 0 ? -1 : 1;
        w.hops = 0;
      } else {
        w.grounded = false;
        w.vx = w.dir * speed;
        w.vy = -hop;
      }
      w.x = px * SUBPX + SUBPX / 2;
      w.y = py * SUBPX;
      return;
    }
    px = nx;
    py = ny;
  }
  if (px !== subToPx(w.x)) w.hops = 0;
  w.x += w.dir * speed;
  w.y = py * SUBPX;
}

/** The pig in the air: gravity, then sub-steps against the mask; it lands on its feet. */
function fly(t: Terrain, w: Walker): void {
  w.vy = Math.min(w.vy + GRAVITY, TERMINAL_VELOCITY);
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(w.vx), Math.abs(w.vy)) / MAX_SUBSTEP));
  for (let i = 0; i < steps; i++) {
    const dx = idiv(w.vx * (i + 1), steps) - idiv(w.vx * i, steps);
    const dy = idiv(w.vy * (i + 1), steps) - idiv(w.vy * i, steps);
    // Against a wall it keeps pressing on: a hop takes it up and over.
    if (dx !== 0 && free(t, subToPx(w.x + dx), subToPx(w.y))) w.x += dx;
    if (dy !== 0) {
      const ny = w.y + dy;
      if (dy > 0 && standing(t, subToPx(w.x), subToPx(ny))) {
        w.y = subToPx(ny) * SUBPX;
        w.grounded = true;
        w.vx = 0;
        w.vy = 0;
        return;
      }
      if (free(t, subToPx(w.x), subToPx(ny))) w.y = ny;
      else if (dy < 0) w.vy = 0;
      else {
        w.grounded = true;
        w.vx = 0;
        w.vy = 0;
        return;
      }
    }
  }
}

/** Each tick: every pig trots or falls, burns its fuse, drowns, or goes up. */
export function stepWalkers(s: SimState, events: SimEvent[]): void {
  if (s.walkers.length === 0) return;
  const left: Walker[] = [];
  for (const w of s.walkers) {
    const def = weaponDefIn(s.rules, w.weapon).walker;
    if (!def) continue;
    if (w.grounded) {
      trot(s, w, def.maxStep, def.speed, def.hop, def.hopProgress === true);
      if (w.grounded && !standing(s.terrain, subToPx(w.x), subToPx(w.y))) w.grounded = false;
    } else fly(s.terrain, w);
    const px = subToPx(w.x);
    const py = subToPx(w.y);
    if (px < 0 || px >= s.terrain.width || py - PIG_HEIGHT >= s.terrain.height) {
      events.push({ e: 'walkerGone', id: w.id, fizzled: true });
      events.push({ e: 'shotEnded', shotId: w.id });
      continue;
    }
    if (underWater(s, py - (PIG_HEIGHT >> 1))) {
      events.push({ e: 'walkerGone', id: w.id, fizzled: true });
      events.push({ e: 'shotEnded', shotId: w.id });
      continue;
    }
    if (--w.fuse <= 0) {
      goUp(s, w, events);
      continue;
    }
    left.push(w);
  }
  s.walkers = left;
}
