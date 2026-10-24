import { describe, expect, it } from 'vitest';
import { UNICORN_RULES } from '../../src/content/unicorn.ts';
import { CLASSIC_RULES, type MatchRules } from '../rules-fixture.ts';
import { Material, Sim, type Mask, type SimEvent } from '../../src/sim/index.ts';

/** Earth from y = 500 down, a hill rising to y = 400 around x = 1000. */
function mask(): Mask {
  const width = 1600;
  const height = 800;
  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const top = x >= 950 && x < 1050 ? 400 : 500;
      if (y >= top) data[y * width + x] = Material.Earth;
    }
  }
  return { width, height, data };
}

// Only the unicorn: no wind, kitchen, fire, barrels, reliquaries or beasts; it always comes.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { kitchen, burn, barrels, crates, beasts, deluge, weather, ...BASE } = CLASSIC_RULES;
const RULES: MatchRules = {
  ...BASE,
  wind: { ...CLASSIC_RULES.wind, max: 0 },
  unicorn: { ...UNICORN_RULES, spawnPermille: 1000 },
};

function match(rules: MatchRules = RULES): Sim {
  const sim = new Sim({ rules, teams: [{ spawns: [300] }, { spawns: [1300] }] }, 5, mask());
  for (let i = 0; i < 1000 && sim.view().turn.phase !== 'action'; i++) sim.step();
  return sim;
}

describe('unicorn (GDD §4.12)', () => {
  it('gallops across on the ground, over the hill, and leaves', () => {
    const sim = match();
    expect(sim.view().unicorn).not.toBeNull();
    const ys = new Map<number, number>();
    const events: SimEvent[] = [];
    for (let i = 0; i < 2000 && sim.view().unicorn; i++) {
      events.push(...sim.step());
      const u = sim.view().unicorn;
      if (u) ys.set(Math.trunc((u.x >> 8) / 20), u.y >> 8);
    }
    expect(ys.get(50)).toBe(400);
    expect(ys.get(25)).toBe(500);
    expect(events).toContainEqual({ e: 'unicornGone' });
  });

  it('gives back all its HP to the unit whose shot touches it, and is gone', () => {
    const sim = match();
    const snap = sim.snapshot();
    const archer = snap.units[0];
    const uni = snap.unicorn;
    if (archer && uni) {
      archer.hp = 30;
      // Standing just ahead of the archer, who shoots level at it.
      uni.x = archer.x + 60 * 256;
      uni.y = archer.y;
    }
    sim.restore(snap);
    const events = [
      ...sim.step([
        { t: 'aim', angle: 0 },
        { t: 'fire', power: 1024 },
      ]),
    ];
    for (let i = 0; i < 30; i++) events.push(...sim.step());
    expect(events).toContainEqual({ e: 'unicornTouched', unitId: 1, heal: 70 });
    expect(sim.view().units[0]?.hp).toBe(100);
    expect(sim.view().unicorn).toBeNull();
  });

  it('gallops in front of a tower, on the ground it stands on, not over its battlement', () => {
    const sim = new Sim(
      {
        rules: RULES,
        teams: [{ spawns: [300] }, { spawns: [1300] }],
        structures: [{ id: 1, type: 'tower', build: { x: 600, width: 100, ladder: -1 } }],
      },
      5,
      mask(),
    );
    for (let i = 0; i < 1000 && sim.view().turn.phase !== 'action'; i++) sim.step();
    const ys: number[] = [];
    for (let i = 0; i < 2000 && sim.view().unicorn; i++) {
      sim.step();
      const u = sim.view().unicorn;
      if (u && Math.abs((u.x >> 8) - 650) < 40) ys.push(u.y >> 8);
    }
    expect(ys.length).toBeGreaterThan(0);
    expect(new Set(ys)).toEqual(new Set([500]));
  });

  it('never comes in a match without the rule', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { unicorn, ...old } = RULES;
    expect(match(old).view().unicorn).toBeNull();
  });
});
