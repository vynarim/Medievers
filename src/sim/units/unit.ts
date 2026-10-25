// Unit body and movement (TECH_SPEC §5.1): a 28 × 80 px capsule sampled at 9 points,
// walking pixel by pixel over steps and slopes, falling under gravity, coming to rest.
import type { UnitRules } from '../../content/units.ts';
import type { WeaponId } from '../../content/weapons.ts';
import { SUBPX, idiv, subToPx } from '../math/fixed.ts';
import { isSolid, type Terrain } from '../terrain/terrain.ts';

/** sub-px/tick²: 90 ≈ 0.35 px/tick² (TECH_SPEC §5.1) */
export const GRAVITY = 90;
/** sub-px/tick: 14 px/tick (TECH_SPEC §5.1) */
export const TERMINAL_VELOCITY = 14 * SUBPX;
/** sub-px: largest move per sub-step, 2 px (TECH_SPEC §5.2) */
export const MAX_SUBSTEP = 2 * SUBPX;
/** ticks a unit must stay still to be at rest (TECH_SPEC §5.1) */
export const REST_TICKS = 10;
/** sub-px/tick: below this speed a grounded unit counts as still */
export const REST_SPEED = 16;
/** percent of vertical speed returned when a knocked unit hits the ground (restitution 0.3) */
export const RESTITUTION_PCT = 30;
/** percent of horizontal speed kept per tick by a sliding knocked unit */
export const GROUND_FRICTION_PCT = 85;
/** sub-px/tick: a knocked unit landing slower than this stops bouncing */
export const BOUNCE_MIN_SPEED = 2 * SUBPX;

export const UNIT_HALF_WIDTH = 14;
export const UNIT_HEIGHT = 80;
/** px: outermost sample column; feet and flanks share it so a unit that loses its footing
 * never has a flank still over the ledge it left */
const EDGE = UNIT_HALF_WIDTH - 1;

/** Sample points relative to the feet centre, in px (y up is negative). */
const FEET: readonly (readonly [number, number])[] = [
  [-EDGE, -1],
  [0, -1],
  [EDGE, -1],
];
const SIDES: readonly (readonly [number, number])[] = [
  [-EDGE, -20],
  [-EDGE, -60],
  [EDGE, -20],
  [EDGE, -60],
];
const HEAD: readonly (readonly [number, number])[] = [
  [-6, -UNIT_HEIGHT],
  [6, -UNIT_HEIGHT],
];
const BODY = [...FEET, ...SIDES, ...HEAD];
const FOOT_COLUMNS = [-EDGE, 0, EDGE];

export interface Unit {
  readonly id: number;
  readonly team: number;
  /** sub-px, feet centre */
  x: number;
  /** sub-px, bottom of the feet: the unit stands on the pixel row subToPx(y) */
  y: number;
  /** sub-px/tick */
  vx: number;
  /** sub-px/tick */
  vy: number;
  hp: number;
  /** -1 left, 1 right */
  facing: -1 | 1;
  grounded: boolean;
  /** Thrown by an explosion: bounces and slides instead of landing dead. */
  knocked: boolean;
  /** px: highest point (smallest y) since leaving the ground, for fall damage */
  airPeakY: number;
  /** px: feet row where the unit left the ground (rules.unit.fallMinHeight) */
  airFromY?: number;
  /** consecutive ticks spent still on the ground */
  stillTicks: number;
  alive: boolean;
  /** clinging to a ladder (rules.unit.climbSpeed): grounded, but held by the ladder */
  climbing?: boolean;
  /** holding up a banner for its next fall (GDD §4.4); only ever set with the banner */
  banner?: boolean;
  /** the weapon this unit last chose (rules.turn.rememberWeapon) */
  weapon?: WeaponId;
}

export function createUnit(id: number, team: number, xPx: number, yPx: number, hp: number): Unit {
  return {
    id,
    team,
    x: xPx * SUBPX + SUBPX / 2,
    y: yPx * SUBPX,
    vx: 0,
    vy: 0,
    hp,
    facing: 1,
    grounded: false,
    knocked: false,
    airPeakY: yPx,
    stillTicks: 0,
    alive: true,
  };
}

/** True when no body sample point is inside solid terrain at feet position (px, py). */
export function bodyFree(t: Terrain, px: number, py: number): boolean {
  for (const [dx, dy] of BODY) if (isSolid(t, px + dx, py + dy)) return false;
  return true;
}

/** True when ground lies right under the feet at (px, py). */
export function supported(t: Terrain, px: number, py: number): boolean {
  for (const dx of FOOT_COLUMNS) if (isSolid(t, px + dx, py)) return true;
  return false;
}

/** Highest free and supported feet row within ±maxStep of py at column px, or null. */
function findStanding(t: Terrain, px: number, py: number, maxStep: number): number | null {
  for (let y = py - maxStep; y <= py + maxStep; y++) {
    if (bodyFree(t, px, y) && supported(t, px, y)) return y;
  }
  return null;
}

/** Top of the ground in column px, searching downward from py - range; null if none. */
function surfaceAt(t: Terrain, px: number, py: number, range: number): number | null {
  for (let y = py - range; y <= py + range; y++) {
    if (isSolid(t, px, y) && !isSolid(t, px, y - 1)) return y;
  }
  return null;
}

/** Ground rise over the last slopeWindow px, measured on the centre column, exceeds maxStep. */
function tooSteep(t: Terrain, nx: number, dir: -1 | 1, ny: number, rules: UnitRules): boolean {
  const range = UNIT_HEIGHT;
  const here = surfaceAt(t, nx, ny, range);
  const behind = surfaceAt(t, nx - dir * rules.slopeWindow, ny, range);
  return here !== null && behind !== null && behind - here > rules.maxStep;
}

/**
 * The ground falls by more than maxStep over the slopeWindow px ahead of column nx, measured on
 * the centre column (the feet may stand higher, on a trailing foot).
 */
function tooSteepDown(t: Terrain, nx: number, dir: -1 | 1, ny: number, rules: UnitRules): boolean {
  const here = surfaceAt(t, nx, ny, UNIT_HEIGHT);
  const ahead = surfaceAt(t, nx + dir * rules.slopeWindow, ny, UNIT_HEIGHT);
  return here !== null && (ahead === null || ahead - here > rules.maxStep);
}

export type WalkResult = 'moved' | 'blocked' | 'fell';

/**
 * Walks one tick in direction dir. Each pixel crossed is checked: the unit climbs or descends
 * steps up to maxStep, refuses walls and slopes steeper than maxStep over slopeWindow px,
 * and starts falling when no ground is found within maxStep below.
 */
export function walk(u: Unit, t: Terrain, dir: -1 | 1, rules: UnitRules): WalkResult {
  u.facing = dir;
  if (!u.grounded) return 'blocked';
  // Walking off a ladder lets go of it: the unit steps onto ground or falls.
  if (u.climbing) u.climbing = false;
  const startPx = subToPx(u.x);
  const targetPx = subToPx(u.x + dir * rules.walkSpeed);
  let px = startPx;
  let py = subToPx(u.y);
  let result: WalkResult = 'moved';
  while (px !== targetPx) {
    const nx = px + dir;
    const ny = findStanding(t, nx, py, rules.maxStep);
    if (ny === null) {
      if (bodyFree(t, nx, py)) {
        px = nx;
        result = 'fell';
      } else {
        result = 'blocked';
      }
      break;
    }
    if (ny < py && tooSteep(t, nx, dir, ny, rules)) {
      result = 'blocked';
      break;
    }
    // Down a slope steeper than one could walk up: the unit falls off it.
    if (rules.steepFall && ny > py && tooSteepDown(t, nx, dir, ny, rules) && bodyFree(t, nx, py)) {
      px = nx;
      result = 'fell';
      break;
    }
    px = nx;
    py = ny;
  }
  if (result === 'moved') {
    u.x += dir * rules.walkSpeed;
  } else {
    u.x = px * SUBPX + SUBPX / 2;
  }
  u.y = py * SUBPX;
  u.stillTicks = 0;
  if (result === 'fell') leaveGround(u);
  return result;
}

function leaveGround(u: Unit): void {
  if (u.climbing) u.climbing = false;
  u.grounded = false;
  u.airPeakY = subToPx(u.y);
  u.airFromY = u.airPeakY;
}

/** Lets go of whatever holds the unit up (a ladder that is gone): it falls from here. */
export function release(u: Unit): void {
  leaveGround(u);
}

/** Throws a unit (explosion, direct hit): it bounces and slides until it stops. */
export function launch(u: Unit): void {
  u.knocked = true;
  u.stillTicks = 0;
  leaveGround(u);
}

/** Starts a jump; only from the ground. */
export function jump(u: Unit, kind: 'forward' | 'back', rules: UnitRules): boolean {
  if (!u.grounded) return false;
  const j = kind === 'forward' ? rules.jumpForward : rules.jumpBack;
  const dir = kind === 'forward' ? u.facing : -u.facing;
  u.vx = dir * j.vx;
  u.vy = j.vy;
  u.stillTicks = 0;
  leaveGround(u);
  return true;
}

/**
 * Fall damage for a fall of `height` px (GDD §3.1), landing `drop` px below the point the unit
 * left the ground: a jump that comes down where it took off is no fall.
 */
export function fallDamage(height: number, rules: UnitRules, drop = height): number {
  // Off a wall or a cliff, a fall always hurts a little (rules.unit.fallMinDamage).
  const least =
    rules.fallMinHeight !== undefined && drop >= rules.fallMinHeight
      ? (rules.fallMinDamage ?? 0)
      : 0;
  if (height <= rules.fallSafeHeight) return least;
  return Math.max(
    least,
    Math.min(idiv(height - rules.fallSafeHeight, rules.fallPxPerHp), rules.fallMaxDamage),
  );
}

export interface PhysicsResult {
  landed: boolean;
  /** HP lost to the fall on landing */
  fallDamage: number;
  /** left the map through a side or the bottom */
  outOfMap: boolean;
}

/**
 * Advances an airborne or sliding unit by one tick: gravity, sub-steps of at most 2 px,
 * collisions with walls, ceiling and ground. Grounded units only update their rest counter.
 */
export function stepUnitPhysics(u: Unit, t: Terrain, rules: UnitRules): PhysicsResult {
  const res: PhysicsResult = { landed: false, fallDamage: 0, outOfMap: false };
  if (u.climbing) {
    u.stillTicks++;
    return res;
  }
  if (u.grounded) {
    if (u.knocked) slide(u, t);
    if (!u.grounded) return res;
    u.stillTicks = Math.abs(u.vx) < REST_SPEED ? u.stillTicks + 1 : 0;
    const px = subToPx(u.x);
    const py = subToPx(u.y);
    // Wedged units (no support, but nothing below is free either) stay put.
    if (!supported(t, px, py) && bodyFree(t, px, py + 1)) leaveGround(u);
    return res;
  }

  u.vy = Math.min(u.vy + GRAVITY, TERMINAL_VELOCITY);
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(u.vx), Math.abs(u.vy)) / MAX_SUBSTEP));
  for (let s = 0; s < steps; s++) {
    const dx = idiv(u.vx * (s + 1), steps) - idiv(u.vx * s, steps);
    const dy = idiv(u.vy * (s + 1), steps) - idiv(u.vy * s, steps);

    if (dx !== 0) {
      const nx = u.x + dx;
      if (bodyFree(t, subToPx(nx), subToPx(u.y))) u.x = nx;
      else if (
        rules.slopeTakeoff === true &&
        dy < 0 &&
        bodyFree(t, subToPx(nx), subToPx(u.y + dy))
      ) {
        // Taking off from a slope: rising clears the ground that blocks the sideways step.
        u.x = nx;
      } else u.vx = u.knocked ? -idiv(u.vx * RESTITUTION_PCT, 100) : 0;
    }
    if (dy !== 0) {
      const ny = u.y + dy;
      const npx = subToPx(u.x);
      if (dy > 0) {
        const ground = firstSupport(t, npx, subToPx(u.y), subToPx(ny));
        if (ground !== null) {
          u.y = ground * SUBPX;
          if (land(u, rules, res)) break;
          continue;
        }
      }
      if (bodyFree(t, npx, subToPx(ny))) {
        u.y = ny;
        if (subToPx(ny) < u.airPeakY) u.airPeakY = subToPx(ny);
      } else if (dy < 0) {
        u.vy = 0; // ceiling
      } else if (!nudge(u, t, subToPx(ny))) {
        // Wedged in a crevice: treat as a landing.
        if (land(u, rules, res)) break;
      }
    }
  }
  const px = subToPx(u.x);
  if (px < 0 || px >= t.width || subToPx(u.y) - UNIT_HEIGHT >= t.height) res.outOfMap = true;
  return res;
}

/** px: how far a falling unit may be pushed sideways out of a narrow gap */
const MAX_NUDGE = 3;

/** Shifts a falling unit sideways (toward its motion first) so it can go down to row ny. */
function nudge(u: Unit, t: Terrain, ny: number): boolean {
  const px = subToPx(u.x);
  const first = u.vx < 0 ? -1 : 1;
  for (let d = 1; d <= MAX_NUDGE; d++) {
    for (const side of [first, -first]) {
      if (bodyFree(t, px + side * d, ny)) {
        u.x += side * d * SUBPX;
        u.y = ny * SUBPX;
        return true;
      }
    }
  }
  return false;
}

/** First feet row in [fromRow, toRow] with ground underneath, or null. */
function firstSupport(t: Terrain, px: number, fromRow: number, toRow: number): number | null {
  for (let y = fromRow; y <= toRow; y++) if (supported(t, px, y)) return y;
  return null;
}

/** Touchdown. Returns true when the unit stays on the ground. */
function land(u: Unit, rules: UnitRules, res: PhysicsResult): boolean {
  const height = subToPx(u.y) - u.airPeakY;
  if (u.knocked && u.vy > BOUNCE_MIN_SPEED) {
    u.vy = -idiv(u.vy * RESTITUTION_PCT, 100);
    u.vx = idiv(u.vx * GROUND_FRICTION_PCT, 100);
    return false;
  }
  u.vy = 0;
  if (!u.knocked) u.vx = 0;
  u.grounded = true;
  u.stillTicks = 0;
  res.landed = true;
  res.fallDamage = fallDamage(height, rules, subToPx(u.y) - (u.airFromY ?? u.airPeakY));
  return true;
}

/** Knocked unit sliding on the ground: friction, then a stop. */
function slide(u: Unit, t: Terrain): void {
  const nx = u.x + u.vx;
  if (bodyFree(t, subToPx(nx), subToPx(u.y))) u.x = nx;
  else u.vx = 0;
  u.vx = idiv(u.vx * GROUND_FRICTION_PCT, 100);
  if (Math.abs(u.vx) < REST_SPEED) {
    u.vx = 0;
    u.knocked = false;
  }
  if (!supported(t, subToPx(u.x), subToPx(u.y))) leaveGround(u);
}

/** Still on the ground for REST_TICKS ticks. */
export function atRest(u: Unit): boolean {
  return !u.alive || (u.grounded && !u.knocked && u.stillTicks >= REST_TICKS);
}

/** Drops a freshly placed unit onto the ground below it. */
export function settle(u: Unit, t: Terrain): boolean {
  const px = subToPx(u.x);
  for (let y = subToPx(u.y); y < t.height + UNIT_HEIGHT; y++) {
    if (supported(t, px, y) && bodyFree(t, px, y)) {
      u.y = y * SUBPX;
      u.grounded = true;
      u.vx = 0;
      u.vy = 0;
      u.airPeakY = y;
      return true;
    }
  }
  return false;
}
