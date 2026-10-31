import { describe, expect, it } from 'vitest';
import { CRATE_RULES } from '../../src/content/crates.ts';
import { STRUCTURE_RULES } from '../../src/content/structures.ts';
import { WEAPONS } from '../../src/content/weapons.ts';
import { Material, Sim, type Mask, type SimEvent } from '../../src/sim/index.ts';
import { loadMask } from '../../tools/lib/maps-node.ts';
import { CLASSIC_RULES, weaponIndexIn, type MatchRules } from '../rules-fixture.ts';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { kitchen, crates, beasts, barrels, burn, weather, deluge, ...CALM } = CLASSIC_RULES;
const RULES: MatchRules = {
  ...CALM,
  wind: { ...CLASSIC_RULES.wind, max: 0 },
  structures: { ...STRUCTURE_RULES },
  weapons: WEAPONS.map((w) => (w.id === 'fireArrow' ? { ...w, ammo: 6 } : w)),
};

function match(mask: Mask = loadMask('flat')): Sim {
  const sim = new Sim(
    {
      rules: RULES,
      teams: [{ spawns: [300] }, { spawns: [1000] }],
      structures: [{ id: 1, type: 'woodTower', build: { x: 600, width: 100, ladder: -1 } }],
    },
    1,
    mask,
  );
  for (let i = 0; i < 1000 && sim.view().turn.phase !== 'action'; i++) sim.step();
  return sim;
}

function shoot(sim: Sim, angle: number, power: number): SimEvent[] {
  const events = [
    ...sim.step([
      { t: 'selectWeapon', id: 'fireArrow' },
      { t: 'aim', angle },
      { t: 'fire', power },
    ]),
  ];
  for (let i = 0; i < 300; i++) events.push(...sim.step());
  return events;
}

describe('fire arrows (2026-10-25)', () => {
  it('set a wooden tower alight', () => {
    const sim = match();
    expect(shoot(sim, 3520, 600)).toContainEqual({ e: 'towerAlight', id: 1 });
  });

  it('leave a flame where they strike the ground', () => {
    const sim = match();
    shoot(sim, 3600, 600);
    expect(sim.view().flames.map((f) => f.x >> 8)).toEqual([919]);
  });

  it('hurt a unit 5 HP more than an arrow', () => {
    const sim = match();
    const arrow = WEAPONS.find((w) => w.id === 'bow')?.damage ?? 0;
    expect(shoot(sim, 3840, 800)).toContainEqual({
      e: 'unitDamaged',
      unitId: 2,
      damage: arrow + 5,
    });
  });

  it('do not set stone alight', () => {
    // The same throw onto rock: no flame.
    const mask = loadMask('flat');
    const data = mask.data.slice();
    for (let i = 0; i < data.length; i++) if (data[i] === Material.Earth) data[i] = Material.Rock;
    const sim = match({ ...mask, data });
    shoot(sim, 3600, 600);
    expect(sim.view().flames).toEqual([]);
  });

  it('come three at a time in a reliquary', () => {
    const rules: MatchRules = { ...RULES, crates: { ...CRATE_RULES, chancePermille: 0 } };
    const sim = new Sim(
      { rules, teams: [{ spawns: [300] }, { spawns: [1000] }] },
      1,
      loadMask('flat'),
    );
    for (let i = 0; i < 1000 && sim.view().turn.phase !== 'action'; i++) sim.step();
    const i = weaponIndexIn(rules, 'fireArrow');
    const snap = sim.snapshot();
    const team = snap.teams[0];
    if (team) team.ammo[i] = 0;
    snap.crates.push({ id: 900, x: 330 * 256, y: 500 * 256, kind: 0, weapon: i, landed: true });
    sim.restore(snap);
    sim.step([{ t: 'move', dir: 1 }]);
    for (let k = 0; k < 40; k++) sim.step();
    expect(sim.view().teams[0]?.ammo[i]).toBe(3);
  });
});
