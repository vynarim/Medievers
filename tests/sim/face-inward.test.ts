import { describe, expect, it } from 'vitest';
import { CLASSIC_RULES, type MatchRules } from '../rules-fixture.ts';
import { AIM_UP_LEFT, Material, Sim, type Mask } from '../../src/sim/index.ts';

function flatMask(): Mask {
  const width = 1200;
  const height = 600;
  const data = new Uint8Array(width * height);
  for (let y = 500; y < height; y++) data.fill(Material.Earth, y * width, (y + 1) * width);
  return { width, height, data };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { kitchen, burn, crates, beasts, barrels, deluge, ...BASE } = CLASSIC_RULES;

function toTurn(sim: Sim, n: number): void {
  while (sim.view().turn.number < n) {
    if (sim.view().turn.phase === 'action') sim.step([{ t: 'skip' }]);
    else sim.step();
  }
}

describe('facing at the start of a turn (rules.turn.faceInwardPct)', () => {
  it('turns a unit near the right end towards the inside of the map', () => {
    const sim = new Sim(
      { rules: BASE, teams: [{ spawns: [100] }, { spawns: [1100] }] },
      1,
      flatMask(),
    );
    toTurn(sim, 2);
    const u = sim.view().units[1];
    expect(u?.facing).toBe(-1);
    expect(sim.view().turn.aim).toBe(AIM_UP_LEFT);
    expect(sim.view().units[0]?.facing).toBe(1);
  });

  it('leaves the units in the middle as they were, and older logs alone', () => {
    const { faceInwardPct, ...turn } = BASE.turn;
    expect(faceInwardPct).toBeDefined();
    const old: MatchRules = { ...BASE, turn };
    for (const [rules, x, facing] of [
      [BASE, 700, 1],
      [old, 1100, 1],
    ] as const) {
      const sim = new Sim({ rules, teams: [{ spawns: [100] }, { spawns: [x] }] }, 1, flatMask());
      toTurn(sim, 2);
      expect(sim.view().units[1]?.facing).toBe(facing);
    }
  });
});
