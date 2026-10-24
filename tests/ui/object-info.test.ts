import { describe, expect, it } from 'vitest';
import { CLASSIC_RULES } from '../rules-fixture.ts';
import { Material, Sim, type Mask } from '../../src/sim/index.ts';
import { objectAt, objectInfo } from '../../src/ui/object-info.ts';

function flatMask(): Mask {
  const width = 1200;
  const height = 600;
  const data = new Uint8Array(width * height);
  for (let y = 500; y < height; y++) data.fill(Material.Earth, y * width, (y + 1) * width);
  return { width, height, data };
}

function view() {
  const sim = new Sim(
    { rules: CLASSIC_RULES, teams: [{ spawns: [100] }, { spawns: [1100] }] },
    1,
    flatMask(),
  );
  const s = sim.snapshot();
  s.barrels.length = 0;
  s.barrels.push({ id: 50, x: 300 * 256, y: 500 * 256 });
  s.crates.push({ id: 51, x: 500 * 256, y: 500 * 256, kind: 2, weapon: -1, landed: true });
  s.pots.push({ id: 52, x: 700 * 256, y: 495 * 256, turns: 2, weapon: 'greekFire' });
  s.kitchen = { x: 900 * 256, y: 500 * 256, expiresTurn: 5 };
  s.beast = { id: 53, kind: 1, x: 1000 * 256, y: 500 * 256 };
  sim.restore(s);
  return sim.view();
}

describe('object bubbles', () => {
  it('finds the object under a click', () => {
    const v = view();
    expect(objectAt(v, 300, 490, 0)).toEqual({ kind: 'barrel', id: 50 });
    expect(objectAt(v, 500, 490, 0)).toEqual({ kind: 'crate', id: 51 });
    expect(objectAt(v, 700, 495, 0)).toEqual({ kind: 'pot', id: 52 });
    expect(objectAt(v, 900, 480, 0)).toEqual({ kind: 'kitchen' });
    expect(objectAt(v, 1000, 490, 0)).toEqual({ kind: 'beast' });
    expect(objectAt(v, 600, 300, 0)).toBeNull();
  });

  it('describes it with the values of the rules, without giving a trap away', () => {
    const v = view();
    expect(objectInfo(v, { kind: 'barrel', id: 50 })?.text).toContain('40 dégâts');
    expect(objectInfo(v, { kind: 'crate', id: 51 })?.text).toContain('piège');
    expect(objectInfo(v, { kind: 'pot', id: 52 })?.text).toContain('2 tour(s)');
    expect(objectInfo(v, { kind: 'beast' })?.title).toBe('Escargot des marges');
    expect(objectInfo(v, { kind: 'barrel', id: 999 })).toBeNull();
  });

  it('name the unit under a tombstone, with its epitaph', () => {
    const sim = new Sim(
      { rules: CLASSIC_RULES, teams: [{ spawns: [100] }, { spawns: [1100] }] },
      1,
      flatMask(),
    );
    const s = sim.snapshot();
    const u = s.units[1];
    if (u) {
      u.alive = false;
      u.hp = 0;
      u.y = 500 * 256;
    }
    sim.restore(s);
    const v = sim.view();
    const ref = objectAt(v, 1100, 485, 0);
    expect(ref).toEqual({ kind: 'grave', id: 2 });
    const info = ref ? objectInfo(v, ref) : null;
    expect(info?.title).toBe('Aubri');
    // Its epitaph names it, and stays the same from one look to the next.
    expect(info?.text).toContain('Aubri');
    expect(objectInfo(v, { kind: 'grave', id: 2 })?.text).toBe(info?.text);
  });
});
