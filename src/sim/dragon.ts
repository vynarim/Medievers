// Le dragon des marges (GDD §4.11). Only present when the match rules have `dragon` (absent from
// older logs). It may cross the sky at the start of a turn's action, hugging the relief as low as
// it can, over the units' heads; a shot or
// a blast that touches it sends it swooping on a random unit of the shooter's enemies, which it
// swallows whole, before it flies away.
import { DRAGON_BITE, DRAGON_HALF_HEIGHT, DRAGON_HALF_WIDTH } from '../content/dragon.ts';
import type { SimEvent } from './events.ts';
import type { Explosion } from './explosions/explosion.ts';
import { SUBPX, idiv, subToPx } from './math/fixed.ts';
import { ANGLE_FULL, cosQ14 } from './math/angle.ts';
import { isqrt } from './math/isqrt.ts';
import { nextRange } from './math/prng.ts';
import type { SimState } from './state.ts';
import { isSolid } from './terrain/terrain.ts';
import { UNIT_HEIGHT } from './units/unit.ts';

/** px: a unit's middle, above its feet, where the dragon bites */
const BITE_HEIGHT = UNIT_HEIGHT >> 1;

/** Q14 one: cos runs from -SWING_ONE to SWING_ONE */
const SWING_ONE = 1 << 14;

/** px between two columns sampled to find the ground under the dragon */
const GROUND_SAMPLE = 8;

/**
 * px: the dragon's centre row over column x: its belly `clearance` px above the highest ground or
 * masonry under its body, so it hugs the relief as low as it can.
 */
function flightY(s: SimState, x: number, clearance: number): number {
  const t = s.terrain;
  const x0 = Math.max(0, Math.min(t.width - 1, x - DRAGON_HALF_WIDTH));
  const x1 = Math.max(0, Math.min(t.width - 1, x + DRAGON_HALF_WIDTH));
  let top = t.height;
  for (let cx = x0; cx <= x1; cx += GROUND_SAMPLE) {
    for (let y = 0; y < top; y++) {
      if (isSolid(t, cx, y)) {
        top = y;
        break;
      }
    }
  }
  return Math.max(DRAGON_HALF_HEIGHT, top - clearance - DRAGON_HALF_HEIGHT);
}

/** Start of a turn's action: the dragon may come across the sky, from either side. */
export function dragonAtAction(s: SimState, events: SimEvent[]): void {
  const r = s.rules.dragon;
  if (!r || s.dragon || nextRange(s.prng, 0, 999) >= r.spawnPermille) return;
  const dir: -1 | 1 = nextRange(s.prng, 0, 1) === 0 ? 1 : -1;
  const w = s.terrain.width;
  const x = dir > 0 ? -DRAGON_HALF_WIDTH : w + DRAGON_HALF_WIDTH;
  const y = flightY(s, x, r.clearance);
  s.dragon = {
    id: s.nextEntityId++,
    x: x * SUBPX,
    y: y * SUBPX,
    dir,
    prey: 0,
    fed: false,
    born: s.tick,
  };
  events.push({ e: 'dragonAppeared', dir });
}

/** The dragon swallows unit `id` whole. */
function swallow(s: SimState, id: number, events: SimEvent[]): void {
  const u = s.units.find((x) => x.id === id);
  if (!u?.alive) return;
  u.alive = false;
  u.hp = 0;
  events.push({ e: 'dragonAte', unitId: u.id });
  events.push({ e: 'unitDied', unitId: u.id, cause: 'dragon' });
}

/** Each tick: the dragon flies across, swoops on its prey, or flies up and away once fed. */
export function stepDragon(s: SimState, events: SimEvent[]): void {
  const r = s.rules.dragon;
  const d = s.dragon;
  if (!r || !d) return;
  if (d.prey !== 0) {
    const u = s.units.find((x) => x.id === d.prey);
    if (!u?.alive) {
      d.prey = 0;
      d.fed = true;
    } else {
      const dx = u.x - d.x;
      const dy = u.y - BITE_HEIGHT * SUBPX - d.y;
      const len = isqrt(dx * dx + dy * dy);
      if (len <= Math.max(r.diveSpeed, DRAGON_BITE * SUBPX)) {
        d.x += dx;
        d.y += dy;
        swallow(s, u.id, events);
        d.prey = 0;
        d.fed = true;
      } else {
        d.x += idiv(dx * r.diveSpeed, len);
        d.y += idiv(dy * r.diveSpeed, len);
      }
      return;
    }
  }
  if (d.fed) {
    // Fed: up and away, the way it was going.
    d.x += d.dir * (r.diveSpeed >> 1);
    d.y -= r.diveSpeed >> 1;
  } else {
    // Across, rising and sinking with the relief under it, as fast as it flies.
    d.x += d.dir * r.speed;
    // It also climbs and sinks as it goes, never lower than just over the units' heads.
    const swing =
      r.swing && r.swingTicks
        ? (r.swing * (SWING_ONE - cosQ14(idiv((s.tick - d.born) * ANGLE_FULL, r.swingTicks)))) >> 15
        : 0;
    const dy = (flightY(s, subToPx(d.x), r.clearance) - swing) * SUBPX - d.y;
    d.y += Math.max(-r.speed, Math.min(r.speed, dy));
  }
  const w = s.terrain.width;
  if (
    d.x < -2 * DRAGON_HALF_WIDTH * SUBPX ||
    d.x > (w + 2 * DRAGON_HALF_WIDTH) * SUBPX ||
    d.y < -2 * DRAGON_HALF_HEIGHT * SUBPX
  ) {
    s.dragon = null;
    events.push({ e: 'dragonGone' });
  }
}

/** The dragon is swooping on its prey: the turn waits for it. */
export function dragonBusy(s: SimState): boolean {
  return s.dragon !== null && s.dragon.prey !== 0;
}

function inDragon(s: SimState, x: number, y: number): boolean {
  const d = s.dragon;
  if (!d) return false;
  return (
    Math.abs(x - d.x) <= DRAGON_HALF_WIDTH * SUBPX &&
    Math.abs(y - d.y) <= DRAGON_HALF_HEIGHT * SUBPX
  );
}

/** True when the segment between two sub-px points crosses the dragon (2 px samples). */
export function dragonOnSegment(
  s: SimState,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): boolean {
  if (!s.dragon) return false;
  const steps = Math.max(1, idiv(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)), 2 * SUBPX));
  for (let i = 0; i <= steps; i++) {
    if (inDragon(s, x0 + idiv((x1 - x0) * i, steps), y0 + idiv((y1 - y0) * i, steps))) return true;
  }
  return false;
}

/**
 * Touched by a shot of house `team` (whatever the damage): the dragon flies into a rage and
 * swoops on a living unit of another house, drawn at random. Once enraged or fed, it pays no
 * more heed to shots.
 */
export function enrageDragon(s: SimState, team: number, events: SimEvent[]): void {
  const d = s.dragon;
  if (!d || d.prey !== 0 || d.fed) return;
  const preys = s.units.filter((u) => u.alive && u.team !== team);
  const prey = preys[nextRange(s.prng, 0, Math.max(0, preys.length - 1))];
  if (!prey) {
    d.fed = true;
    return;
  }
  d.prey = prey.id;
  events.push({ e: 'dragonEnraged', unitId: prey.id });
}

/** A blast that reaches the dragon enrages it, as the house whose turn it is shot it. */
export function blastReachesDragon(s: SimState, e: Explosion, events: SimEvent[]): void {
  const d = s.dragon;
  if (!d) return;
  const dx = Math.max(0, Math.abs(d.x - e.x) - DRAGON_HALF_WIDTH * SUBPX);
  const dy = Math.max(0, Math.abs(d.y - e.y) - DRAGON_HALF_HEIGHT * SUBPX);
  if (isqrt(dx * dx + dy * dy) <= e.radius * SUBPX) enrageDragon(s, s.turn.activeTeam, events);
}
