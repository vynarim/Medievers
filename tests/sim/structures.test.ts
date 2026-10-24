import { describe, expect, it } from 'vitest';
import { STRUCTURE_RULES, StructureState } from '../../src/content/structures.ts';
import { CLASSIC_RULES, type MatchRules } from '../rules-fixture.ts';
import { Material, Sim, type SimEvent } from '../../src/sim/index.ts';
import { loadMask } from '../../tools/lib/maps-node.ts';
import { TOWER_STRUCTURES } from '../fixtures/maps/test-maps.ts';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { kitchen, burn, crates, beasts, barrels, deluge, flames, ...BASE } = CLASSIC_RULES;
const CALM: MatchRules = { ...BASE, wind: { ...CLASSIC_RULES.wind, max: 0 } };

function match(rules: MatchRules, spawns: [number[], number[]]): Sim {
  return new Sim(
    {
      rules,
      teams: [{ spawns: spawns[0] }, { spawns: spawns[1] }],
      structures: TOWER_STRUCTURES,
    },
    1,
    loadMask('tower'),
  );
}

/** Queues a blast of `damage` at px (x, y), Greek fire by default, for the next tick. */
function blast(sim: Sim, x: number, y: number, damage: number, radius = 60): void {
  const snap = sim.snapshot();
  snap.explosions.items.push({
    tick: snap.tick + 1,
    seq: snap.explosions.nextSeq++,
    explosion: {
      x: x * 256,
      y: y * 256,
      radius,
      carveRadius: 0,
      maxDamage: damage,
      sourceId: 900,
      weapon: 'greekFire',
    },
  });
  sim.restore(snap);
}

function run(sim: Sim, ticks: number): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) events.push(...sim.step());
  return events;
}

const tower = (sim: Sim) => sim.view().structures[0];

describe('structures with hit points (GDD §4.7)', () => {
  it('take the declared HP, and only with rules.structures', () => {
    expect(tower(match(CALM, [[200], [1000]]))?.hp).toBe(STRUCTURE_RULES.defs.tower.hp);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { structures, ...old } = CALM;
    const sim = match(old, [[200], [1000]]);
    expect(sim.view().structures).toHaveLength(0);
    expect(sim.view().owners).toBeNull();
  });

  it('crack, then fall to ruin as the Greek fire hits them', () => {
    const sim = match(CALM, [[200], [1000]]);
    const max = STRUCTURE_RULES.defs.tower.hp;
    blast(sim, 560, 450, 90);
    sim.step();
    expect(tower(sim)?.hp).toBe(max - 90);
    expect(tower(sim)?.state).toBe(StructureState.Cracked);
    blast(sim, 560, 450, 90);
    sim.step();
    expect(tower(sim)?.state).toBe(StructureState.Ruin);
  });

  it('take a quarter of an arrow, a whole Greek fire', () => {
    const sim = match(CALM, [[400], [1000]]);
    for (let i = 0; i < 2000 && sim.view().turn.phase !== 'action'; i++) sim.step();
    sim.step([
      { t: 'aim', angle: 0 },
      { t: 'fire', power: 1024 },
    ]);
    const events = run(sim, 60);
    const bow = CALM.weapons.find((w) => w.id === 'bow')?.damage ?? 0;
    expect(events).toContainEqual({
      e: 'structureHit',
      id: 1,
      damage: Math.trunc((bow * 25 + 50) / 100),
      state: StructureState.Intact,
    });
  });

  it('collapse at 0 HP, toppling away from the hit onto the units on that side', () => {
    // A unit stands right against the tower on each side; the hit comes from the left.
    const sim = match(CALM, [[520], [690]]);
    run(sim, 30);
    blast(sim, 590, 270, STRUCTURE_RULES.defs.tower.hp, 20);
    const events = run(sim, 600);
    expect(events).toContainEqual({ e: 'structureFell', id: 1 });
    expect(tower(sim)?.state).toBe(StructureState.Fallen);
    expect(sim.view().blocks).toHaveLength(0);
    // Struck once per collapse, however many blocks fall on it.
    expect(events.filter((e) => e.e === 'crushed')).toEqual([{ e: 'crushed', unitId: 2 }]);
    expect(sim.view().units.map((u) => u.hp < 100)).toEqual([false, true]);
    // No built stone is left; rubble (earth) lies above the old ground.
    const v = sim.view();
    const t = v.terrain;
    let stone = 0;
    let rubble = 0;
    for (let y = 200; y < 500; y++) {
      for (let x = 500; x < 700; x++) {
        const m = t.data[y * t.width + x];
        if (m === Material.BuiltStone) stone++;
        if (m === Material.Earth) rubble++;
      }
    }
    expect(stone).toBe(0);
    expect(rubble).toBeGreaterThan(1000);
  });

  it('keep the resolution waiting until every block has landed', () => {
    const sim = match(CALM, [[200], [1000]]);
    for (let i = 0; i < 2000 && sim.view().turn.phase !== 'action'; i++) sim.step();
    blast(sim, 600, 270, STRUCTURE_RULES.defs.tower.hp, 20);
    sim.step([{ t: 'skip' }]);
    sim.step();
    expect(sim.view().blocks.length).toBeGreaterThan(0);
    while (sim.view().blocks.length > 0) {
      expect(sim.view().turn.phase).toBe('resolution');
      sim.step();
    }
  });
});
