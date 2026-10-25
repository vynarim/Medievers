// Generic projectile (TECH_SPEC §5.2): semi-implicit Euler, sub-steps of at most 2 px,
// collision against the mask (point or disc) and against unit capsules.
import { SUBPX, idiv, subToPx } from '../math/fixed.ts';
import { isSolid, type Terrain } from '../terrain/terrain.ts';
import { GRAVITY, MAX_SUBSTEP, UNIT_HALF_WIDTH, UNIT_HEIGHT, type Unit } from '../units/unit.ts';

export interface Projectile {
  readonly id: number;
  /** unit that fired it; ignored until the projectile has left its body */
  readonly ownerId: number;
  /** sub-px */
  x: number;
  /** sub-px */
  y: number;
  /** sub-px/tick */
  vx: number;
  /** sub-px/tick */
  vy: number;
  /** px; 0 = point projectile (arrows), > 0 = disc (pots, stones) */
  readonly radius: number;
  /** percent of the wind acceleration applied (100 full, 40 crossbow, 0 none) */
  readonly windPct: number;
  /** percent of gravity applied */
  readonly gravityPct: number;
  /** true once the projectile no longer overlaps its owner */
  clearOfOwner: boolean;
  /** ticks since launch */
  age: number;
}

export interface ProjectileSpec {
  readonly radius: number;
  readonly windPct: number;
  readonly gravityPct: number;
}

export function createProjectile(
  id: number,
  ownerId: number,
  x: number,
  y: number,
  vx: number,
  vy: number,
  spec: ProjectileSpec,
): Projectile {
  return { id, ownerId, x, y, vx, vy, ...spec, clearOfOwner: false, age: 0 };
}

export type Impact =
  | { readonly kind: 'terrain'; readonly x: number; readonly y: number }
  | { readonly kind: 'unit'; readonly x: number; readonly y: number; readonly unitId: number }
  | { readonly kind: 'outOfMap'; readonly x: number; readonly y: number };

/** Disc samples on the perimeter, in sixteenths of the radius (8 directions). */
const DISC: readonly (readonly [number, number])[] = [
  [16, 0],
  [11, 11],
  [0, 16],
  [-11, 11],
  [-16, 0],
  [-11, -11],
  [0, -16],
  [11, -11],
];

/** First solid sample (px) of the point or disc at sub-px (x, y), or null when free. */
export function terrainContact(
  t: Terrain,
  x: number,
  y: number,
  radius: number,
): { px: number; py: number } | null {
  const px = subToPx(x);
  const py = subToPx(y);
  if (isSolid(t, px, py)) return { px, py };
  if (radius === 0) return null;
  for (const [dx, dy] of DISC) {
    const sx = px + idiv(dx * radius, 16);
    const sy = py + idiv(dy * radius, 16);
    if (isSolid(t, sx, sy)) return { px: sx, py: sy };
  }
  return null;
}

/** True when the point or disc at sub-px (x, y) touches solid terrain. */
export function touchesTerrain(t: Terrain, x: number, y: number, radius: number): boolean {
  return terrainContact(t, x, y, radius) !== null;
}

/** Circle (sub-px centre, px radius) against a unit capsule. */
export function touchesUnit(u: Unit, x: number, y: number, radius: number): boolean {
  const r = UNIT_HALF_WIDTH * SUBPX;
  const top = u.y - UNIT_HEIGHT * SUBPX + r;
  const bottom = u.y - r;
  const cy = y < top ? top : y > bottom ? bottom : y;
  const dx = x - u.x;
  const dy = y - cy;
  const reach = r + radius * SUBPX;
  return dx * dx + dy * dy <= reach * reach;
}

/**
 * Advances a projectile by one tick. `wind` is the turn's wind (-10..10), `windAccel` the
 * acceleration of one wind unit in sub-px/tick². Returns the first impact, or null.
 * Units are tested in the order given (sorted by id by the caller).
 */
export function stepProjectile(
  p: Projectile,
  t: Terrain,
  units: readonly Unit[],
  wind: number,
  windAccel: number,
  /** units it goes through without stopping (a piercing bolt has already struck them) */
  skip?: readonly number[],
): Impact | null {
  p.age++;
  p.vx += idiv(wind * windAccel * p.windPct, 100);
  p.vy += idiv(GRAVITY * p.gravityPct, 100);
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(p.vx), Math.abs(p.vy)) / MAX_SUBSTEP));
  const x0 = p.x;
  const y0 = p.y;
  for (let s = 1; s <= steps; s++) {
    p.x = x0 + idiv(p.vx * s, steps);
    p.y = y0 + idiv(p.vy * s, steps);
    const px = subToPx(p.x);
    const py = subToPx(p.y);
    if (px < 0 || px >= t.width || py >= t.height) return { kind: 'outOfMap', x: p.x, y: p.y };
    if (touchesTerrain(t, p.x, p.y, p.radius)) return { kind: 'terrain', x: p.x, y: p.y };

    let overlapsOwner = false;
    for (const u of units) {
      if (!u.alive || !touchesUnit(u, p.x, p.y, p.radius)) continue;
      if (skip?.includes(u.id)) continue;
      if (u.id === p.ownerId && !p.clearOfOwner) {
        overlapsOwner = true;
        continue;
      }
      return { kind: 'unit', x: p.x, y: p.y, unitId: u.id };
    }
    if (!overlapsOwner) p.clearOfOwner = true;
  }
  return null;
}

/**
 * Surface normal at pixel (px, py) from the mask gradient over a 5 × 5 neighbourhood
 * (TECH_SPEC §5.2), pointing out of the ground. Integer vector, (0, 0) when undefined.
 */
export function surfaceNormal(t: Terrain, px: number, py: number): { nx: number; ny: number } {
  let nx = 0;
  let ny = 0;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (isSolid(t, px + dx, py + dy)) {
        nx -= dx;
        ny -= dy;
      }
    }
  }
  return { nx, ny };
}

/**
 * Bounces a disc projectile off the surface at its position: reflects the velocity about the
 * normal, keeps `restitutionPct` percent of it, then pushes the projectile out of the ground
 * along the normal.
 */
export function bounce(p: Projectile, t: Terrain, restitutionPct: number): void {
  const contact = terrainContact(t, p.x, p.y, p.radius) ?? { px: subToPx(p.x), py: subToPx(p.y) };
  const { nx, ny } = surfaceNormal(t, contact.px, contact.py);
  const n2 = nx * nx + ny * ny;
  if (n2 === 0) {
    p.vx = -idiv(p.vx * restitutionPct, 100);
    p.vy = -idiv(p.vy * restitutionPct, 100);
  } else {
    // v' = v - 2 (v·n / |n|²) n
    const dot = p.vx * nx + p.vy * ny;
    if (dot < 0) {
      p.vx -= idiv(2 * dot * nx, n2);
      p.vy -= idiv(2 * dot * ny, n2);
    }
    p.vx = idiv(p.vx * restitutionPct, 100);
    p.vy = idiv(p.vy * restitutionPct, 100);
  }
  // Step out of the ground along the normal until free (at most 8 px).
  for (let i = 0; i < 8 * 2 && touchesTerrain(t, p.x, p.y, p.radius); i++) {
    if (n2 === 0) p.y -= SUBPX / 2;
    else {
      const len = Math.max(Math.abs(nx), Math.abs(ny));
      p.x += idiv(nx * (SUBPX / 2), len);
      p.y += idiv(ny * (SUBPX / 2), len);
    }
  }
}
