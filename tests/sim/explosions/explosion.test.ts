import { describe, expect, it } from 'vitest';
import { MATERIAL_RULES } from '../../../src/content/materials.ts';
import { UNIT_RULES } from '../../../src/content/units.ts';
import { EXPLOSION_RULES } from '../../../src/content/world.ts';
import { SUBPX, subToPx } from '../../../src/sim/math/fixed.ts';
import {
  createExplosionQueue,
  damageAt,
  explode,
  hitboxCentreY,
  queueExplosion,
  takeDueExplosions,
  type Explosion,
} from '../../../src/sim/explosions/index.ts';
import {
  Material,
  createTerrain,
  materialOf,
  type Terrain,
} from '../../../src/sim/terrain/index.ts';
import {
  atRest,
  createUnit,
  settle,
  stepUnitPhysics,
  type Unit,
} from '../../../src/sim/units/index.ts';

function makeTerrain(): Terrain {
  const width = 800;
  const height = 500;
  const data = new Uint8Array(width * height);
  for (let y = 400; y < height; y++) {
    for (let x = 0; x < width; x++) data[y * width + x] = x < 20 ? Material.Rock : Material.Earth;
  }
  return createTerrain({ width, height, data }, MATERIAL_RULES);
}

function unitAt(t: Terrain, id: number, xPx: number): Unit {
  const u = createUnit(id, 0, xPx, 0, 100);
  settle(u, t);
  return u;
}

const blast = (
  x: number,
  y: number,
  radius: number,
  maxDamage: number,
  sourceId = 99,
): Explosion => ({
  x,
  y,
  radius,
  carveRadius: radius,
  maxDamage,
  sourceId,
});

describe('damage falloff', () => {
  it('is max at the centre, half at R/2 and zero at R', () => {
    const R = 60 * SUBPX;
    expect(damageAt(45, R, 0)).toBe(45);
    expect(damageAt(44, R, R / 2)).toBe(22);
    expect(damageAt(45, R, R / 2)).toBe(23); // 22.5 rounds half up
    expect(damageAt(45, R, R)).toBe(0);
    expect(damageAt(45, R, R + 1)).toBe(0);
    expect(damageAt(45, R, R - 1)).toBe(0);
    expect(damageAt(45, R, (R * 3) / 4)).toBe(11);
  });

  it('measures distance to the centre of the hitbox', () => {
    for (const [offsetPx, expected] of [
      [0, 40],
      [30, 20],
      [60, 0],
    ] as const) {
      const t = makeTerrain();
      const u = unitAt(t, 1, 400);
      const res = explode(
        blast(u.x + offsetPx * SUBPX, hitboxCentreY(u), 60, 40),
        t,
        [u],
        EXPLOSION_RULES,
      );
      expect(res.hits.find((h) => h.unitId === 1)?.damage ?? 0).toBe(expected);
      expect(u.hp).toBe(100 - expected);
    }
  });

  it('applies damage multipliers such as the Haubert passive', () => {
    const t = makeTerrain();
    const u = unitAt(t, 1, 400);
    const res = explode(blast(u.x, hitboxCentreY(u), 60, 40), t, [u], EXPLOSION_RULES, () => 75);
    expect(res.hits).toEqual([{ unitId: 1, damage: 30 }]);
  });

  it('never takes HP below zero and reports hits in unit id order', () => {
    const t = makeTerrain();
    const a = unitAt(t, 1, 400);
    const b = unitAt(t, 2, 420);
    a.hp = 10;
    const res = explode(blast(a.x, hitboxCentreY(a), 80, 70), t, [a, b], EXPLOSION_RULES);
    expect(a.hp).toBe(0);
    expect(res.hits.map((h) => h.unitId)).toEqual([1, 2]);
  });
});

describe('carving and knockback', () => {
  it('carves a crater but leaves rock', () => {
    const t = makeTerrain();
    const res = explode(blast(20 * SUBPX, 400 * SUBPX, 30, 40), t, [], EXPLOSION_RULES);
    expect(res.carved).toBeGreaterThan(0);
    expect(materialOf(t, 25, 405)).toBe(Material.Air);
    expect(materialOf(t, 15, 405)).toBe(Material.Rock);
  });

  it('throws units away from the blast and lifts them', () => {
    const t = makeTerrain();
    const u = unitAt(t, 1, 400);
    explode(blast(u.x - 20 * SUBPX, hitboxCentreY(u), 60, 50), t, [u], EXPLOSION_RULES);
    expect(u.vx).toBeGreaterThan(0);
    expect(u.vy).toBeLessThan(0);
    expect([u.knocked, u.grounded]).toEqual([true, false]);
  });

  it('a thrown unit flies, bounces and comes to rest further away', () => {
    const t = makeTerrain();
    const u = unitAt(t, 1, 300);
    const x0 = subToPx(u.x);
    explode(
      blast(u.x - 20 * SUBPX, hitboxCentreY(u) + 20 * SUBPX, 60, 50),
      t,
      [u],
      EXPLOSION_RULES,
    );
    for (let i = 0; i < 1000 && !atRest(u); i++) stepUnitPhysics(u, t, UNIT_RULES);
    expect(atRest(u)).toBe(true);
    expect(subToPx(u.x)).toBeGreaterThan(x0 + 20);
  });

  it('pushes straight up from a blast at the hitbox centre', () => {
    const t = makeTerrain();
    const u = unitAt(t, 1, 400);
    explode(blast(u.x, hitboxCentreY(u), 60, 40), t, [u], EXPLOSION_RULES);
    expect(u.vx).toBe(0);
    expect(u.vy).toBeLessThan(0);
  });

  it('ignores units outside the radius and dead units', () => {
    const t = makeTerrain();
    const far = unitAt(t, 1, 700);
    const dead = unitAt(t, 2, 400);
    dead.alive = false;
    const res = explode(
      blast(400 * SUBPX, hitboxCentreY(dead), 60, 40),
      t,
      [far, dead],
      EXPLOSION_RULES,
    );
    expect(res.hits).toEqual([]);
    expect([far.hp, far.grounded]).toEqual([100, true]);
  });
});

describe('chain reactions', () => {
  it('defers queued explosions to their tick and orders them by source id', () => {
    const q = createExplosionQueue();
    queueExplosion(q, 6, blast(0, 0, 10, 10, 7));
    queueExplosion(q, 5, blast(0, 0, 10, 10, 9));
    queueExplosion(q, 5, blast(0, 0, 10, 10, 3));
    queueExplosion(q, 5, blast(1, 0, 10, 10, 3));
    expect(takeDueExplosions(q, 4)).toEqual([]);
    const due = takeDueExplosions(q, 5);
    expect(due.map((e) => [e.sourceId, e.x])).toEqual([
      [3, 0],
      [3, 1],
      [9, 0],
    ]);
    expect(takeDueExplosions(q, 5)).toEqual([]);
    expect(takeDueExplosions(q, 6).map((e) => e.sourceId)).toEqual([7]);
  });
});
