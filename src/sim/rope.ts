// Le grappin (GDD §4.4): a hook shot along the aim catches the first solid ground within the
// rope's length; the playing unit then hangs from that point and swings under gravity, pushed
// by ← →, hauling the rope in or paying it out with ↑ ↓. A jump lets go, keeping the swing's
// speed; in the air the hook may be shot again. One anchor at a time: the rope does not wrap
// round corners (V1). The rope is tied to the middle of the unit's body.
import type { RopeDef, WeaponDef } from '../content/weapons.ts';
import type { SimEvent } from './events.ts';
import { cosQ14, sinQ14 } from './math/angle.ts';
import { SUBPX, idiv, mulQ14, subToPx } from './math/fixed.ts';
import { isqrt } from './math/isqrt.ts';
import type { SimState } from './state.ts';
import { isSolid, type Terrain } from './terrain/terrain.ts';
import {
  GRAVITY,
  MAX_SUBSTEP,
  TERMINAL_VELOCITY,
  UNIT_HEIGHT,
  bodyFree,
  supported,
  type Unit,
} from './units/unit.ts';

/** px from the middle of the body the hook starts from */
const HOOK_START = 16;
/** sub-px from the feet up to where the rope is tied: the middle of the body */
const TIE = (UNIT_HEIGHT >> 1) * SUBPX;

/** px: the point the hook would catch along `aim` from unit u, or null within no length. */
export function hookPoint(
  t: Terrain,
  u: Pick<Unit, 'x' | 'y'>,
  aim: number,
  rope: RopeDef,
): { x: number; y: number } | null {
  const cx = u.x;
  const cy = u.y - TIE;
  const c = cosQ14(aim);
  const sn = sinQ14(aim);
  for (let d = HOOK_START; d <= rope.length; d++) {
    const x = subToPx(cx + mulQ14(d * SUBPX, c));
    const y = subToPx(cy + mulQ14(d * SUBPX, sn));
    if (x < 0 || y < 0 || x >= t.width || y >= t.height) return null;
    if (isSolid(t, x, y)) return { x, y };
  }
  return null;
}

/** 1/16 px from the middle of unit u to px (x, y). */
function reach16(u: Pick<Unit, 'x' | 'y'>, x: number, y: number): number {
  const dx = (x * SUBPX + SUBPX / 2 - u.x) >> 4;
  const dy = (y * SUBPX + SUBPX / 2 - (u.y - TIE)) >> 4;
  return isqrt(dx * dx + dy * dy);
}

/** The hook is shot: false (nothing done) when it catches nothing within the rope's length. */
export function shootHook(s: SimState, u: Unit, def: WeaponDef, events: SimEvent[]): boolean {
  const rope = def.rope;
  if (!rope) return false;
  const at = hookPoint(s.terrain, u, s.turn.aim, rope);
  if (!at) return false;
  if (s.turn.grapple) letGo(s, u, events);
  s.turn.grapple = { x: at.x, y: at.y, len: reach16(u, at.x, at.y) };
  s.turn.ropeFlight = true;
  u.grounded = false;
  u.knocked = false;
  if (u.climbing) u.climbing = false;
  u.stillTicks = 0;
  events.push({ e: 'hooked', unitId: u.id, x: at.x, y: at.y });
  return true;
}

/** The unit lets go of its rope: it flies on with the swing's speed, and falls from here. */
export function letGo(s: SimState, u: Unit | undefined, events: SimEvent[]): void {
  if (!s.turn.grapple) return;
  s.turn.grapple = null;
  if (!u) return;
  u.grounded = false;
  u.airPeakY = subToPx(u.y);
  if (u.airFromY !== undefined) u.airFromY = u.airPeakY;
  u.stillTicks = 0;
  events.push({ e: 'unhooked', unitId: u.id });
}

/** Moves u by (dx, dy) sub-px in steps of at most 2 px, stopping each axis at the ground. */
function moveBody(t: Terrain, u: Unit, dx: number, dy: number): void {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / MAX_SUBSTEP));
  let movedX = 0;
  let movedY = 0;
  let blockX = false;
  let blockY = false;
  for (let i = 0; i < steps; i++) {
    const sx = blockX ? 0 : idiv(dx * (i + 1), steps) - idiv(dx * i, steps);
    const sy = blockY ? 0 : idiv(dy * (i + 1), steps) - idiv(dy * i, steps);
    if (sx !== 0) {
      if (bodyFree(t, subToPx(u.x + sx), subToPx(u.y))) {
        u.x += sx;
        movedX += sx;
      } else blockX = true;
    }
    if (sy !== 0) {
      if (bodyFree(t, subToPx(u.x), subToPx(u.y + sy))) {
        u.y += sy;
        movedY += sy;
      } else blockY = true;
    }
  }
  u.vx = movedX;
  u.vy = movedY;
}

/**
 * One tick hanging from the rope: gravity and the push of ← →, the rope hauled in or paid out,
 * then the body kept within the rope's length from the hook (its speed is what it moved). The
 * unit lets go when the ground the hook caught is gone.
 */
export function swing(s: SimState, u: Unit, def: WeaponDef, events: SimEvent[]): void {
  const g = s.turn.grapple;
  const rope = def.rope;
  if (!g || !rope) return;
  if (!isSolid(s.terrain, g.x, g.y)) {
    letGo(s, u, events);
    return;
  }
  const max = rope.length * 16;
  const min = rope.minLength * 16;
  g.len = Math.max(min, Math.min(max, g.len + s.turn.climbDir * (rope.climbSpeed >> 4)));
  const vx = u.vx + s.turn.walkDir * rope.pump;
  const vy = Math.min(u.vy + GRAVITY, TERMINAL_VELOCITY);
  // Where it would be, then back within the rope's length from the hook.
  const ax = g.x * SUBPX + SUBPX / 2;
  const ay = g.y * SUBPX + SUBPX / 2;
  let nx = u.x + vx;
  let ny = u.y - TIE + vy;
  const dx = (nx - ax) >> 4;
  const dy = (ny - ay) >> 4;
  const d = isqrt(dx * dx + dy * dy);
  if (d > g.len) {
    nx = ax + idiv((nx - ax) * g.len, d);
    ny = ay + idiv((ny - ay) * g.len, d);
  }
  moveBody(s.terrain, u, nx - u.x, ny + TIE - u.y);
  u.grounded = false;
  u.stillTicks = 0;
  // Hauled all the way up to a hook on the lip of a ledge: the unit hoists itself onto it.
  if (s.turn.climbDir < 0 && g.len === min) {
    const spot = ledgeBeside(s.terrain, g.x, g.y);
    if (spot) {
      u.x = spot.x * SUBPX + SUBPX / 2;
      u.y = spot.y * SUBPX;
      u.vx = 0;
      u.vy = 0;
      letGo(s, u, events);
      u.grounded = true;
      s.turn.climbDir = 0;
    }
  }
}

/** px a hoist onto a ledge looks around the hook, sideways and up */
const HOIST_X = 24;
const HOIST_UP = 16;

/** Where a unit can stand on the ledge whose lip the hook holds at (x, y), nearest first. */
export function ledgeBeside(t: Terrain, x: number, y: number): { x: number; y: number } | null {
  for (let row = y + 2; row >= y - HOIST_UP; row--) {
    for (let d = 0; d <= HOIST_X; d++) {
      for (const px of d === 0 ? [x] : [x - d, x + d]) {
        if (bodyFree(t, px, row) && supported(t, px, row)) return { x: px, y: row };
      }
    }
  }
  return null;
}
