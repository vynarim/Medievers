import { describe, expect, it } from 'vitest';
import { MATERIAL_RULES } from '../../../src/content/materials.ts';
import { UNIT_RULES } from '../../../src/content/units.ts';
import { SUBPX, subToPx } from '../../../src/sim/math/fixed.ts';
import { Material, createTerrain, type Terrain } from '../../../src/sim/terrain/index.ts';
import {
  TERMINAL_VELOCITY,
  atRest,
  createUnit,
  fallDamage,
  jump,
  settle,
  stepUnitPhysics,
  walk,
  type PhysicsResult,
  type Unit,
} from '../../../src/sim/units/index.ts';

/** Terrain whose ground top in column x is ground(x) (null = no ground in that column). */
function terrainFrom(width: number, height: number, ground: (x: number) => number | null): Terrain {
  const data = new Uint8Array(width * height);
  for (let x = 0; x < width; x++) {
    const top = ground(x);
    if (top === null) continue;
    for (let y = Math.max(0, top); y < height; y++) data[y * width + x] = Material.Earth;
  }
  return createTerrain({ width, height, data }, MATERIAL_RULES);
}

function standingUnit(t: Terrain, xPx: number): Unit {
  const u = createUnit(1, 0, xPx, 0, UNIT_RULES.startHp);
  expect(settle(u, t)).toBe(true);
  return u;
}

function walkTicks(u: Unit, t: Terrain, dir: -1 | 1, ticks: number): string[] {
  const results: string[] = [];
  for (let i = 0; i < ticks; i++) {
    if (u.grounded) results.push(walk(u, t, dir, UNIT_RULES));
    stepUnitPhysics(u, t, UNIT_RULES);
  }
  return results;
}

/** Runs physics until the unit lands (or gives up), returning the landing result. */
function fallUntilLanded(u: Unit, t: Terrain, maxTicks = 2000): PhysicsResult {
  for (let i = 0; i < maxTicks; i++) {
    const r = stepUnitPhysics(u, t, UNIT_RULES);
    if (r.landed || r.outOfMap) return r;
  }
  throw new Error('unit never landed');
}

const px = (sub: number): number => subToPx(sub);

describe('standing and walking on flat ground', () => {
  it('settles onto the ground and walks 1.5 px per tick', () => {
    const t = terrainFrom(400, 300, () => 200);
    const u = standingUnit(t, 100);
    expect([px(u.y), u.grounded]).toEqual([200, true]);
    const x0 = u.x;
    walkTicks(u, t, 1, 10);
    expect(u.x - x0).toBe(10 * 384);
    expect(px(u.y)).toBe(200);
    expect(u.facing).toBe(1);
  });

  it('comes to rest after 10 still ticks', () => {
    const t = terrainFrom(400, 300, () => 200);
    const u = standingUnit(t, 100);
    for (let i = 0; i < 9; i++) stepUnitPhysics(u, t, UNIT_RULES);
    expect(atRest(u)).toBe(false);
    stepUnitPhysics(u, t, UNIT_RULES);
    expect(atRest(u)).toBe(true);
  });
});

describe('steps', () => {
  it('climbs a 12 px step', () => {
    const t = terrainFrom(400, 300, (x) => (x < 150 ? 200 : 188));
    const u = standingUnit(t, 120);
    walkTicks(u, t, 1, 40);
    expect(px(u.y)).toBe(188);
    expect(px(u.x)).toBeGreaterThan(150);
  });

  it('is blocked by a 13 px step', () => {
    const t = terrainFrom(400, 300, (x) => (x < 150 ? 200 : 187));
    const u = standingUnit(t, 120);
    const results = walkTicks(u, t, 1, 40);
    expect(px(u.y)).toBe(200);
    expect(px(u.x)).toBeLessThan(150);
    expect(results).toContain('blocked');
  });

  it('steps down a 12 px drop without falling', () => {
    const t = terrainFrom(400, 300, (x) => (x < 150 ? 188 : 200));
    const u = standingUnit(t, 120);
    const results = walkTicks(u, t, 1, 40);
    expect(results).not.toContain('fell');
    expect(px(u.y)).toBe(200);
  });
});

describe('slopes', () => {
  it('walks up a 45° slope', () => {
    const t = terrainFrom(400, 300, (x) => (x < 100 ? 250 : x < 200 ? 250 - (x - 100) : 150));
    const u = standingUnit(t, 80);
    walkTicks(u, t, 1, 200);
    expect(px(u.y)).toBe(150);
    expect(px(u.x)).toBeGreaterThan(200);
  });

  it('is blocked by a 70° slope', () => {
    const t = terrainFrom(400, 300, (x) => (x < 100 ? 250 : x < 140 ? 250 - (x - 100) * 3 : 130));
    const u = standingUnit(t, 80);
    const results = walkTicks(u, t, 1, 200);
    expect(results).toContain('blocked');
    expect(px(u.y)).toBeGreaterThan(130);
  });
});

describe('falling', () => {
  it('walks off a ledge, falls and lands below', () => {
    const t = terrainFrom(400, 400, (x) => (x < 150 ? 200 : 300));
    const u = standingUnit(t, 130);
    const results = walkTicks(u, t, 1, 30);
    expect(results).toContain('fell');
    const r = u.grounded ? { landed: true, fallDamage: 0, outOfMap: false } : fallUntilLanded(u, t);
    expect(r.landed).toBe(true);
    expect(px(u.y)).toBe(300);
    expect(r.fallDamage).toBe(0);
  });

  it('applies fall damage beyond 160 px: 1 HP per 8 px, at most 30', () => {
    expect([
      fallDamage(100, UNIT_RULES),
      fallDamage(160, UNIT_RULES),
      fallDamage(168, UNIT_RULES),
      fallDamage(200, UNIT_RULES),
      fallDamage(5000, UNIT_RULES),
    ]).toEqual([0, 0, 1, 5, 30]);
  });

  it('measures the fall from the drop point to the ground', () => {
    const t = terrainFrom(100, 1200, () => 1100);
    for (const [drop, damage] of [
      [0, 0],
      [100, 0],
      [200, 5],
      [1000, 30],
    ] as const) {
      const u = createUnit(1, 0, 50, 1100 - drop, 100);
      const r = fallUntilLanded(u, t);
      expect(r.landed).toBe(true);
      expect(px(u.y)).toBe(1100);
      expect(r.fallDamage).toBe(damage);
    }
  });

  it('never exceeds terminal velocity', () => {
    const t = terrainFrom(100, 4000, () => 3990);
    const u = createUnit(1, 0, 50, 0, 100);
    let max = 0;
    for (let i = 0; i < 400 && !u.grounded; i++) {
      stepUnitPhysics(u, t, UNIT_RULES);
      max = Math.max(max, u.vy);
    }
    expect(max).toBe(TERMINAL_VELOCITY);
    expect(px(u.y)).toBe(3990);
  });

  it('reports a unit that falls out of the map', () => {
    const t = terrainFrom(200, 300, (x) => (x < 100 ? 200 : null));
    const u = standingUnit(t, 80);
    walkTicks(u, t, 1, 40);
    expect(fallUntilLanded(u, t).outOfMap).toBe(true);
  });
});

describe('jumps', () => {
  it('jumps forward and lands ahead, jumps back higher', () => {
    const t = terrainFrom(600, 300, () => 250);
    const a = standingUnit(t, 300);
    expect(jump(a, 'forward', UNIT_RULES)).toBe(true);
    expect(jump(a, 'forward', UNIT_RULES)).toBe(false);
    fallUntilLanded(a, t);
    const forwardPeak = 250 - a.airPeakY;
    expect(px(a.x)).toBeGreaterThan(300);

    const b = standingUnit(t, 300);
    jump(b, 'back', UNIT_RULES);
    fallUntilLanded(b, t);
    expect(px(b.x)).toBeLessThan(300);
    expect(250 - b.airPeakY).toBeGreaterThan(forwardPeak);
  });

  it('stops against a wall in mid-air', () => {
    const t = terrainFrom(600, 300, (x) => (x >= 330 ? 100 : 250));
    const u = standingUnit(t, 300);
    jump(u, 'forward', UNIT_RULES);
    fallUntilLanded(u, t);
    expect(px(u.x)).toBeLessThanOrEqual(330 - 14);
    expect(u.grounded).toBe(true);
  });
});

describe('knocked units', () => {
  it('bounce, slide and come to rest', () => {
    const t = terrainFrom(2000, 400, () => 300);
    const u = createUnit(1, 0, 200, 150, 100);
    u.knocked = true;
    u.vx = 6 * SUBPX;
    u.vy = -4 * SUBPX;
    let bounces = 0;
    let lastVy = u.vy;
    for (let i = 0; i < 600; i++) {
      stepUnitPhysics(u, t, UNIT_RULES);
      if (lastVy > 0 && u.vy < 0) bounces++;
      lastVy = u.vy;
    }
    expect(bounces).toBeGreaterThan(0);
    expect(atRest(u)).toBe(true);
    expect(px(u.y)).toBe(300);
    expect(px(u.x)).toBeGreaterThan(260);
  });
});

describe('determinism', () => {
  it('replays the same inputs to the same state', () => {
    const run = (): Unit => {
      const t = terrainFrom(600, 400, (x) => 300 - ((x * 13) % 29));
      const u = standingUnit(t, 50);
      for (let i = 0; i < 300; i++) {
        if (u.grounded) {
          if (i % 37 === 0) jump(u, i % 2 ? 'back' : 'forward', UNIT_RULES);
          else walk(u, t, i % 90 < 70 ? 1 : -1, UNIT_RULES);
        }
        stepUnitPhysics(u, t, UNIT_RULES);
      }
      return u;
    };
    expect(run()).toEqual(run());
  });
});
