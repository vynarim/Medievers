import { describe, expect, it } from 'vitest';
import { MATERIAL_RULES } from '../../../src/content/materials.ts';
import { WIND_RULES } from '../../../src/content/world.ts';
import { SUBPX, subToPx } from '../../../src/sim/math/fixed.ts';
import {
  bounce,
  createProjectile,
  stepProjectile,
  surfaceNormal,
  type Impact,
  type Projectile,
  type ProjectileSpec,
} from '../../../src/sim/projectiles/index.ts';
import { Material, createTerrain, type Terrain } from '../../../src/sim/terrain/index.ts';
import { createUnit, settle, type Unit } from '../../../src/sim/units/index.ts';

const ARROW: ProjectileSpec = { radius: 0, windPct: 100, gravityPct: 100 };
const FLAT: ProjectileSpec = { radius: 0, windPct: 0, gravityPct: 0 };
const POT: ProjectileSpec = { radius: 6, windPct: 0, gravityPct: 0 };

/** Empty 1000 × 600 map with optional solid rectangles [x, y, w, h]. */
function makeTerrain(rects: readonly (readonly [number, number, number, number])[] = []): Terrain {
  const width = 1000;
  const height = 600;
  const data = new Uint8Array(width * height);
  for (const [rx, ry, rw, rh] of rects) {
    for (let y = ry; y < ry + rh; y++) {
      for (let x = rx; x < rx + rw; x++) data[y * width + x] = Material.Earth;
    }
  }
  return createTerrain({ width, height, data }, MATERIAL_RULES);
}

function fly(
  p: Projectile,
  t: Terrain,
  units: readonly Unit[] = [],
  wind = 0,
  maxTicks = 1000,
): Impact | null {
  for (let i = 0; i < maxTicks; i++) {
    const hit = stepProjectile(p, t, units, wind, WIND_RULES.accelPerUnit);
    if (hit) return hit;
  }
  return null;
}

describe('no tunneling', () => {
  it('stops a 40 px/tick projectile on a 2 px wall, whatever its sub-pixel start', () => {
    const t = makeTerrain([[500, 0, 2, 600]]);
    for (let offset = 0; offset < SUBPX; offset += 17) {
      const p = createProjectile(1, 0, 100 * SUBPX + offset, 300 * SUBPX, 40 * SUBPX, 0, FLAT);
      const hit = fly(p, t);
      expect(hit?.kind).toBe('terrain');
      expect([500, 501]).toContain(subToPx(hit?.x ?? 0));
    }
  });

  it('stops a fast diagonal shot on a 2 px wall', () => {
    const t = makeTerrain([[500, 0, 2, 600]]);
    const p = createProjectile(1, 0, 100 * SUBPX, 100 * SUBPX, 40 * SUBPX, 23 * SUBPX, FLAT);
    const hit = fly(p, t);
    expect(hit?.kind).toBe('terrain');
    expect(subToPx(hit?.x ?? 0)).toBeLessThanOrEqual(501);
  });

  it('stops a fast shot on a 2 px floor', () => {
    const t = makeTerrain([[0, 400, 1000, 2]]);
    const p = createProjectile(1, 0, 300 * SUBPX, 0, 0, 40 * SUBPX, FLAT);
    const hit = fly(p, t);
    expect([400, 401]).toContain(subToPx(hit?.y ?? 0));
  });

  it('hits earlier with a disc than with a point', () => {
    const t = makeTerrain([[500, 0, 2, 600]]);
    const disc = fly(createProjectile(1, 0, 100 * SUBPX, 300 * SUBPX, 10 * SUBPX, 0, POT), t);
    expect(subToPx(disc?.x ?? 0)).toBe(494);
  });
});

describe('flight', () => {
  it('follows gravity exactly', () => {
    const t = makeTerrain();
    const p = createProjectile(1, 0, 100 * SUBPX, 100 * SUBPX, 512, -2048, ARROW);
    for (let i = 0; i < 10; i++) stepProjectile(p, t, [], 0, WIND_RULES.accelPerUnit);
    expect(p.vy).toBe(-2048 + 10 * 90);
    expect(p.vx).toBe(512);
    expect(p.x).toBe(100 * SUBPX + 10 * 512);
    // Semi-implicit Euler: y += sum of vy after each update.
    let y = 100 * SUBPX;
    let vy = -2048;
    for (let i = 0; i < 10; i++) {
      vy += 90;
      y += vy;
    }
    expect(p.y).toBe(y);
  });

  it('drifts with the wind according to the weapon factor', () => {
    const t = makeTerrain();
    const drift = (windPct: number): number => {
      const p = createProjectile(1, 0, 500 * SUBPX, 100 * SUBPX, 0, 0, {
        radius: 0,
        windPct,
        gravityPct: 0,
      });
      for (let i = 0; i < 30; i++) stepProjectile(p, t, [], 10, WIND_RULES.accelPerUnit);
      return p.x - 500 * SUBPX;
    };
    expect(drift(0)).toBe(0);
    expect(drift(100)).toBeGreaterThan(0);
    expect(drift(40)).toBeLessThan(drift(100));
    expect(drift(40)).toBeGreaterThan(0);
  });

  it('leaves the map through the sides and bottom, not the top', () => {
    const t = makeTerrain();
    expect(fly(createProjectile(1, 0, 990 * SUBPX, 300 * SUBPX, 5 * SUBPX, 0, FLAT), t)?.kind).toBe(
      'outOfMap',
    );
    expect(fly(createProjectile(1, 0, 10 * SUBPX, 300 * SUBPX, -5 * SUBPX, 0, FLAT), t)?.kind).toBe(
      'outOfMap',
    );
    const up = createProjectile(1, 0, 500 * SUBPX, 10 * SUBPX, 0, -10 * SUBPX, ARROW);
    for (let i = 0; i < 5; i++) {
      expect(stepProjectile(up, t, [], 0, WIND_RULES.accelPerUnit)).toBeNull();
    }
    expect(subToPx(up.y)).toBeLessThan(0);
    expect(fly(up, t)?.kind).toBe('outOfMap');
  });
});

describe('unit collisions', () => {
  function unitsOnGround(t: Terrain): Unit[] {
    const a = createUnit(1, 0, 200, 0, 100);
    const b = createUnit(2, 1, 600, 0, 100);
    settle(a, t);
    settle(b, t);
    return [a, b];
  }

  it('hits the unit in its path', () => {
    const t = makeTerrain([[0, 500, 1000, 100]]);
    const units = unitsOnGround(t);
    const p = createProjectile(1, 1, 300 * SUBPX, 460 * SUBPX, 8 * SUBPX, 0, FLAT);
    const hit = fly(p, t, units);
    expect(hit).toMatchObject({ kind: 'unit', unitId: 2 });
    expect(subToPx(hit?.x ?? 0)).toBeGreaterThanOrEqual(600 - 14 - 2);
  });

  it('ignores its owner at launch but can hit it after leaving its body', () => {
    const t = makeTerrain([[0, 500, 1000, 100]]);
    const units = unitsOnGround(t);
    // Fired straight up from inside unit 1: passes through it, comes back down onto it.
    const p = createProjectile(1, 1, 200 * SUBPX, 470 * SUBPX, 0, -10 * SUBPX, ARROW);
    const hit = fly(p, t, units);
    expect(hit).toMatchObject({ kind: 'unit', unitId: 1 });
    expect(p.age).toBeGreaterThan(20);
  });

  it('misses a unit by one pixel', () => {
    const t = makeTerrain([[0, 500, 1000, 100]]);
    const units = unitsOnGround(t);
    const u = units[1];
    if (!u) throw new Error('missing unit');
    // Passes just above the head (capsule top at y - 80 px).
    const p = createProjectile(1, 1, 300 * SUBPX, u.y - 81 * SUBPX - 1, 8 * SUBPX, 0, FLAT);
    expect(fly(p, t, units, 0, 70)).toBeNull();
  });
});

describe('surface normal and bounce', () => {
  it('points up on flat ground and sideways on a wall', () => {
    const t = makeTerrain([
      [0, 500, 1000, 100],
      [700, 0, 300, 500],
    ]);
    const floor = surfaceNormal(t, 300, 500);
    expect(floor.nx).toBe(0);
    expect(floor.ny).toBeLessThan(0);
    const wall = surfaceNormal(t, 700, 300);
    expect(wall.nx).toBeLessThan(0);
    expect(wall.ny).toBe(0);
  });

  it('reflects off flat ground with restitution and steps out of it', () => {
    const t = makeTerrain([[0, 500, 1000, 100]]);
    const p = createProjectile(1, 0, 300 * SUBPX, 490 * SUBPX, 3 * SUBPX, 6 * SUBPX, POT);
    const hit = fly(p, t);
    expect(hit?.kind).toBe('terrain');
    const vx = p.vx;
    const vy = p.vy;
    bounce(p, t, 50);
    expect(p.vy).toBe(-Math.trunc(vy / 2));
    expect(p.vx).toBe(Math.trunc(vx / 2));
    expect(fly(p, t, [], 0, 1)).toBeNull();
  });
});

describe('determinism', () => {
  it('replays a shot identically', () => {
    const run = (): [Projectile, Impact | null] => {
      const t = makeTerrain([
        [0, 500, 1000, 100],
        [640, 300, 40, 200],
      ]);
      const p = createProjectile(1, 0, 100 * SUBPX, 480 * SUBPX, 1900, -2700, ARROW);
      return [p, fly(p, t, [], -7)];
    };
    expect(run()).toEqual(run());
  });
});
