// Climbing ladders (GDD §4.4: « praticable par toutes les unités »). A unit whose body overlaps a
// ladder can climb it up or down; it clings without falling, and at the top it hoists itself
// onto the ground beside the ladder. Only with rules.unit.climbSpeed (absent from older logs).
import type { UnitRules } from '../../content/units.ts';
import { SUBPX, subToPx } from '../math/fixed.ts';
import { Material } from '../terrain/material.ts';
import { materialOf, type Terrain } from '../terrain/terrain.ts';
import { UNIT_HALF_WIDTH, UNIT_HEIGHT, bodyFree, supported, type Unit } from './unit.ts';

/** px either side of the centre within which a ladder can be grabbed */
const REACH = UNIT_HALF_WIDTH + 6;
/** px: how far sideways a unit may shift to get its body clear beside a ladder */
const SHIFT = 2 * UNIT_HALF_WIDTH;
/** px: how far a unit at the top of a ladder may hoist itself, sideways and up */
const HOIST_X = 2 * UNIT_HALF_WIDTH + 8;
const HOIST_Y = 40;

/** A ladder pixel within reach of a unit whose feet are at (px, py), body height plus a step. */
export function ladderAt(t: Terrain, px: number, py: number): boolean {
  for (let y = py - UNIT_HEIGHT; y <= py + 2; y += 2) {
    for (let x = px - REACH; x <= px + REACH; x++) {
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
    ladderAt(t, subToPx(u.x), subToPx(u.y))
  );
}

/** Column near px, towards the ladder first, where the body fits at row y next to a ladder. */
function clearColumn(t: Terrain, px: number, y: number): number | null {
  for (let d = 0; d <= SHIFT; d++) {
    for (const x of d === 0 ? [px] : [px - d, px + d]) {
      if (bodyFree(t, x, y) && ladderAt(t, x, y)) return x;
    }
  }
  return null;
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
    const x = clearColumn(t, px, py + (dir > 0 ? 1 : -1));
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
    const x = bodyFree(t, px, ny) && ladderAt(t, px, ny) ? px : clearColumn(t, px, ny);
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
