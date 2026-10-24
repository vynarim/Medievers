// Climbing ladders (GDD §4.4: « praticable par toutes les unités »). A unit whose body overlaps a
// ladder can climb it up or down; it clings without falling, and at the top it hoists itself
// onto the ground beside the ladder. Only with rules.unit.climbSpeed (absent from older logs).
import type { UnitRules } from '../../content/units.ts';
import { SUBPX, subToPx } from '../math/fixed.ts';
import { Material } from '../terrain/material.ts';
import { materialOf, type Terrain } from '../terrain/terrain.ts';
import { UNIT_HALF_WIDTH, UNIT_HEIGHT, bodyFree, supported, type Unit } from './unit.ts';

/** px either side of the centre within which a ladder can be grabbed, in older logs */
const OLD_REACH = UNIT_HALF_WIDTH + 6;
/** px: how far sideways a unit may shift to get its body clear beside a ladder, in older logs */
const OLD_SHIFT = 2 * UNIT_HALF_WIDTH;
/** px: how far a unit at the top of a ladder may hoist itself, sideways and up */
const HOIST_X = 2 * UNIT_HALF_WIDTH + 8;
const HOIST_Y = 40;

/**
 * px either side of the centre within which a ladder can be grabbed: the body's half width plus
 * the tolerance of rules.unit.ladderReach (2026-10-25: a unit's width), or the old reach.
 */
export const ladderReach = (rules: UnitRules): number =>
  UNIT_HALF_WIDTH + (rules.ladderReach ?? OLD_REACH - UNIT_HALF_WIDTH);

/** px of ladder a grab looks for below the feet, going down */
const GRAB_BELOW = 8;

/**
 * Nearest column to px holding a ladder pixel within `reach`, on the side the unit goes: above
 * its feet to go up, just below them to go down. So a unit that has hoisted itself onto the top
 * does not grab the ladder's last rung again while ↑ is still held.
 */
function ladderColumn(
  t: Terrain,
  px: number,
  py: number,
  reach: number,
  dir: -1 | 1,
): number | null {
  const y0 = dir < 0 ? py - UNIT_HEIGHT : py + 1;
  const y1 = dir < 0 ? py - 4 : py + GRAB_BELOW;
  for (let d = 0; d <= reach; d++) {
    for (const x of d === 0 ? [px] : [px - d, px + d]) {
      for (let y = y0; y <= y1; y++) {
        if (materialOf(t, x, y) === Material.Ladder) return x;
      }
    }
  }
  return null;
}

/** A ladder pixel within reach of a unit whose feet are at (px, py), body height plus a step. */
export function ladderAt(t: Terrain, px: number, py: number, rules: UnitRules): boolean {
  const reach = ladderReach(rules);
  for (let y = py - UNIT_HEIGHT; y <= py + 2; y += 2) {
    for (let x = px - reach; x <= px + reach; x++) {
      if (materialOf(t, x, y) === Material.Ladder) return true;
    }
  }
  return false;
}

/** The unit can start (or keep) climbing where it stands. */
export function canClimb(t: Terrain, u: Unit, rules: UnitRules): boolean {
  return (
    rules.climbSpeed !== undefined &&
    (u.grounded || u.climbing === true) &&
    ladderAt(t, subToPx(u.x), subToPx(u.y), rules)
  );
}

/** Column near px, nearest first, where the body fits at row y next to a ladder. */
function clearColumn(
  t: Terrain,
  px: number,
  y: number,
  rules: UnitRules,
  shift: number,
): number | null {
  for (let d = 0; d <= shift; d++) {
    for (const x of d === 0 ? [px] : [px - d, px + d]) {
      if (bodyFree(t, x, y) && ladderAt(t, x, y, rules)) return x;
    }
  }
  return null;
}

/**
 * Where a unit grabbing the ladder goes, at row y. With rules.unit.ladderReach it steps to the
 * ladder itself (the nearest free column to it), so a unit a body's width away, or standing on
 * the top beside it, still takes it, up or down; in older logs, the nearest free column to px.
 */
function grabColumn(
  t: Terrain,
  px: number,
  py: number,
  dir: -1 | 1,
  rules: UnitRules,
): number | null {
  const y = py + dir;
  if (rules.ladderReach === undefined) return clearColumn(t, px, y, rules, OLD_SHIFT);
  const reach = ladderReach(rules);
  const lx = ladderColumn(t, px, py, reach, dir);
  if (lx === null) return null;
  return clearColumn(t, lx, y, rules, reach + UNIT_HALF_WIDTH);
}

/** At the top: a spot to stand on beside the ladder, facing side first. */
function hoistSpot(t: Terrain, u: Unit, px: number, py: number): [number, number] | null {
  // From a little below the feet (the top of the ladder is the top of the wall) upwards.
  for (let dy = -4; dy <= HOIST_Y; dy++) {
    for (let d = 0; d <= HOIST_X; d++) {
      for (const x of d === 0 ? [px] : [px + u.facing * d, px - u.facing * d]) {
        const y = py - dy;
        if (bodyFree(t, x, y) && supported(t, x, y)) return [x, y];
      }
    }
  }
  return null;
}

/** Stops climbing and stands on the ground at (x, y). */
function standAt(u: Unit, x: number, y: number): void {
  u.climbing = false;
  u.grounded = true;
  u.knocked = false;
  u.vx = 0;
  u.vy = 0;
  u.x = x * SUBPX + SUBPX / 2;
  u.y = y * SUBPX;
  u.airPeakY = y;
}

/**
 * Climbs one tick up (dir -1) or down (dir 1). Returns the px climbed (0 when stuck). Going up
 * past the top of the ladder, the unit hoists itself onto the ground beside it; going down onto
 * the ground, it stands there.
 */
export function climb(u: Unit, t: Terrain, dir: -1 | 1, rules: UnitRules): number {
  const speed = rules.climbSpeed;
  if (speed === undefined || !canClimb(t, u, rules)) return 0;
  let px = subToPx(u.x);
  let py = subToPx(u.y);
  const startY = py;
  if (u.climbing !== true) {
    // Grabbing the ladder: going down from the top means stepping out over the edge first.
    const x = grabColumn(t, px, py, dir, rules);
    if (x === null) return 0;
    px = x;
    u.climbing = true;
    u.grounded = true;
    u.knocked = false;
    u.vx = 0;
    u.vy = 0;
  }
  u.stillTicks = 0;
  const target = subToPx(u.y + dir * speed);
  let moved = 0;
  while (py !== target) {
    const ny = py + dir;
    if (dir > 0 && supported(t, px, py)) {
      standAt(u, px, py);
      return Math.abs(py - startY);
    }
    const x =
      bodyFree(t, px, ny) && ladderAt(t, px, ny, rules)
        ? px
        : clearColumn(t, px, ny, rules, OLD_SHIFT);
    if (x === null) {
      if (dir < 0) {
        const spot = hoistSpot(t, u, px, py);
        if (spot) {
          standAt(u, spot[0], spot[1]);
          return Math.abs(spot[1] - startY);
        }
      }
      break;
    }
    px = x;
    py = ny;
    moved++;
  }
  if (px !== subToPx(u.x)) u.x = px * SUBPX + SUBPX / 2;
  // All the way: keep the sub-pixel part; stopped short: stand on the last pixel reached.
  u.y = py === target ? u.y + dir * speed : py * SUBPX;
  u.airPeakY = py;
  return moved;
}
