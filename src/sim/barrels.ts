// Barils de poudre (GDD §4.6). Only present when the match rules have `barrels` (absent from
// older logs). Barrels are static until the ground under them goes, then they drop.
import {
  BARREL_EDGE_PCT,
  BARREL_HEIGHT,
  BARREL_SPACING,
  BARREL_WIDTH,
} from '../content/barrels.ts';
import type { SimEvent } from './events.ts';
import { queueExplosion, type Explosion } from './explosions/explosion.ts';
import { SUBPX, idiv, subToPx } from './math/fixed.ts';
import { isqrt } from './math/isqrt.ts';
import { nextRange } from './math/prng.ts';
import type { Barrel, SimState } from './state.ts';
import { isSolid } from './terrain/terrain.ts';

/** placement attempts per barrel before giving up on it */
const PLACE_TRIES = 40;
/** px per tick a barrel drops when the ground under it is gone (a plain drop, no physics) */
const FALL_PX = 4;

function surface(s: SimState, x: number): number | null {
  for (let y = 0; y < s.terrain.height; y++) if (isSolid(s.terrain, x, y)) return y;
  return null;
}

/** Scatters the match's barrels on flat ground, away from units and from each other. */
export function placeBarrels(s: SimState): void {
  const r = s.rules.barrels;
  if (!r) return;
  const w = s.terrain.width;
  const edge = idiv(w * BARREL_EDGE_PCT, 100);
  const half = BARREL_WIDTH >> 1;
  for (let n = 0; n < r.count; n++) {
    for (let tries = 0; tries < PLACE_TRIES; tries++) {
      const x = nextRange(s.prng, edge, w - edge - 1);
      const y = surface(s, x);
      if (y === null || y < BARREL_HEIGHT) continue;
      const left = surface(s, x - half);
      const right = surface(s, x + half);
      if (left === null || right === null || Math.abs(left - y) > 4 || Math.abs(right - y) > 4) {
        continue;
      }
      const crowded =
        s.units.some((u) => Math.abs(subToPx(u.x) - x) < BARREL_SPACING) ||
        s.barrels.some((b) => Math.abs(subToPx(b.x) - x) < BARREL_SPACING);
      if (crowded) continue;
      s.barrels.push({ id: s.nextEntityId++, x: x * SUBPX, y: y * SUBPX });
      break;
    }
  }
}

function inBarrel(b: Barrel, x: number, y: number): boolean {
  const half = (BARREL_WIDTH >> 1) * SUBPX;
  return x >= b.x - half && x <= b.x + half && y <= b.y && y >= b.y - BARREL_HEIGHT * SUBPX;
}

/** Id of the first barrel the segment between two sub-px points crosses (2 px samples). */
export function barrelOnSegment(
  s: SimState,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): number | null {
  if (s.barrels.length === 0) return null;
  const steps = Math.max(1, idiv(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)), 2 * SUBPX));
  for (let i = 0; i <= steps; i++) {
    const x = x0 + idiv((x1 - x0) * i, steps);
    const y = y0 + idiv((y1 - y0) * i, steps);
    for (const b of s.barrels) if (inBarrel(b, x, y)) return b.id;
  }
  return null;
}

/** Removes a barrel and queues its blast `delay` ticks from now. */
export function igniteBarrel(s: SimState, id: number, delay: number): void {
  const r = s.rules.barrels;
  const i = s.barrels.findIndex((b) => b.id === id);
  const b = s.barrels[i];
  if (!r || !b) return;
  s.barrels.splice(i, 1);
  queueExplosion(s.explosions, s.tick + delay, {
    x: b.x,
    y: b.y - (BARREL_HEIGHT >> 1) * SUBPX,
    radius: r.radius,
    carveRadius: r.radius,
    maxDamage: r.damage,
    sourceId: b.id,
  });
}

/** A blast sets off every barrel it reaches, after the chain delay. */
export function blastReachesBarrels(s: SimState, e: Explosion): void {
  const r = s.rules.barrels;
  if (!r || s.barrels.length === 0) return;
  const reach = (e.radius + (BARREL_WIDTH >> 1)) * SUBPX;
  // Ids first: igniting removes barrels from the list.
  const hit = s.barrels
    .filter((b) => {
      const dx = b.x - e.x;
      const dy = b.y - (BARREL_HEIGHT >> 1) * SUBPX - e.y;
      return isqrt(dx * dx + dy * dy) <= reach;
    })
    .map((b) => b.id);
  for (const id of hit) igniteBarrel(s, id, r.chainDelay);
}

/** Barrels in the burnt ends of the map go up (GDD §2.5). */
export function burnBarrels(s: SimState): void {
  const r = s.rules.barrels;
  if (!r || s.burnPx === 0) return;
  const w = s.terrain.width;
  const lit = s.barrels
    .filter((b) => subToPx(b.x) < s.burnPx || subToPx(b.x) >= w - s.burnPx)
    .map((b) => b.id);
  for (const id of lit) igniteBarrel(s, id, r.chainDelay);
}

/** Each tick: barrels drop when the ground under them is gone, and are lost off the map. */
export function stepBarrels(s: SimState, events: SimEvent[]): void {
  if (s.barrels.length === 0) return;
  const half = BARREL_WIDTH >> 1;
  // Backwards, so removing a barrel keeps the order of the others (sorted by id).
  for (let k = s.barrels.length - 1; k >= 0; k--) {
    const b = s.barrels[k];
    if (!b) continue;
    const x = subToPx(b.x);
    for (let i = 0; i < FALL_PX; i++) {
      const y = subToPx(b.y);
      const t = s.terrain;
      if (isSolid(t, x - half, y) || isSolid(t, x, y) || isSolid(t, x + half, y)) break;
      if (y >= t.height) {
        s.barrels.splice(k, 1);
        events.push({ e: 'barrelLost', id: b.id });
        break;
      }
      b.y += SUBPX;
    }
  }
}
