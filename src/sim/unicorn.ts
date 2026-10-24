// La licorne (GDD §4.12). Only present when the match rules have `unicorn` (absent from older
// logs). It may gallop across the hills at the start of a turn's action, on the ground, whatever
// the slope; the unit whose shot touches it gets back all its HP, and it is gone.
import { UNICORN_HEIGHT, UNICORN_WIDTH } from '../content/unicorn.ts';
import { maxHpOf } from './classes.ts';
import type { SimEvent } from './events.ts';
import type { Explosion } from './explosions/explosion.ts';
import { SUBPX, idiv, subToPx } from './math/fixed.ts';
import { isqrt } from './math/isqrt.ts';
import { nextRange } from './math/prng.ts';
import type { SimState } from './state.ts';
import { isSolid } from './terrain/terrain.ts';

/** px: the top of the ground in column x, or the map height when there is none. */
function groundAt(s: SimState, x: number): number {
  const t = s.terrain;
  const cx = Math.max(0, Math.min(t.width - 1, x));
  for (let y = 0; y < t.height; y++) if (isSolid(t, cx, y)) return y;
  return t.height;
}

/** Start of a turn's action: now and then, the unicorn gallops in from one side. */
export function unicornAtAction(s: SimState, events: SimEvent[]): void {
  const r = s.rules.unicorn;
  if (!r || s.unicorn || nextRange(s.prng, 0, 999) >= r.spawnPermille) return;
  const dir: -1 | 1 = nextRange(s.prng, 0, 1) === 0 ? 1 : -1;
  const x = dir > 0 ? -UNICORN_WIDTH : s.terrain.width + UNICORN_WIDTH;
  s.unicorn = { id: s.nextEntityId++, x: x * SUBPX, y: groundAt(s, x) * SUBPX, dir };
  events.push({ e: 'unicornAppeared', dir });
}

/** Each tick: it gallops on along the ground, and leaves at the other side. */
export function stepUnicorn(s: SimState, events: SimEvent[]): void {
  const r = s.rules.unicorn;
  const u = s.unicorn;
  if (!r || !u) return;
  u.x += u.dir * r.speed;
  const x = subToPx(u.x);
  u.y = groundAt(s, x) * SUBPX;
  if (x < -2 * UNICORN_WIDTH || x > s.terrain.width + 2 * UNICORN_WIDTH) {
    s.unicorn = null;
    events.push({ e: 'unicornGone' });
  }
}

function inUnicorn(s: SimState, x: number, y: number): boolean {
  const u = s.unicorn;
  if (!u) return false;
  const half = (UNICORN_WIDTH >> 1) * SUBPX;
  return x >= u.x - half && x <= u.x + half && y <= u.y && y >= u.y - UNICORN_HEIGHT * SUBPX;
}

/** True when the segment between two sub-px points crosses the unicorn (2 px samples). */
export function unicornOnSegment(
  s: SimState,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): boolean {
  if (!s.unicorn) return false;
  const steps = Math.max(1, idiv(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)), 2 * SUBPX));
  for (let i = 0; i <= steps; i++) {
    if (inUnicorn(s, x0 + idiv((x1 - x0) * i, steps), y0 + idiv((y1 - y0) * i, steps))) {
      return true;
    }
  }
  return false;
}

/** Touched by unit `unitId`'s shot: that unit gets back all its HP, and the unicorn is gone. */
export function touchUnicorn(s: SimState, unitId: number, events: SimEvent[]): void {
  if (!s.unicorn) return;
  s.unicorn = null;
  const u = s.units.find((x) => x.id === unitId);
  const heal = u?.alive ? Math.max(0, maxHpOf(s, u) - u.hp) : 0;
  if (u?.alive) u.hp += heal;
  events.push({ e: 'unicornTouched', unitId, heal });
}

/** A blast that reaches the unicorn counts as a touch by the unit whose turn it is. */
export function blastReachesUnicorn(s: SimState, e: Explosion, events: SimEvent[]): void {
  const u = s.unicorn;
  if (!u) return;
  const dx = u.x - e.x;
  const dy = u.y - (UNICORN_HEIGHT >> 1) * SUBPX - e.y;
  if (isqrt(dx * dx + dy * dy) <= (e.radius + (UNICORN_WIDTH >> 1)) * SUBPX) {
    touchUnicorn(s, s.turn.activeUnitId, events);
  }
}
