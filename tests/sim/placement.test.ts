import { describe, expect, it } from 'vitest';
import { CLASSIC_RULES as REAL_CLASSIC } from '../../src/content/rules.ts';
import { Material, Sim, type Mask, type SimEvent } from '../../src/sim/index.ts';

function flatMask(): Mask {
  const width = 1200;
  const height = 600;
  const data = new Uint8Array(width * height);
  for (let y = 500; y < height; y++) data.fill(Material.Earth, y * width, (y + 1) * width);
  return { width, height, data };
}

// The real Classique rules, placement included; nothing random on the map.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { kitchen, burn, barrels, crates, beasts, ...RULES } = REAL_CLASSIC;

function newMatch(): Sim {
  return new Sim(
    { rules: RULES, teams: [{ spawns: [100, 200] }, { spawns: [900, 1000] }] },
    1,
    flatMask(),
  );
}

describe('placement at the start of the match', () => {
  it('lets the houses put one unit down each, in turn, then starts turn 1', () => {
    const sim = newMatch();
    const v = () => sim.view();
    expect(v().turn.phase).toBe('placement');
    expect(v().units).toHaveLength(0);
    const order: number[] = [];
    for (const x of [400, 700, 300, 800]) {
      order.push(v().turn.activeTeam);
      sim.step([{ t: 'place', x }]);
    }
    expect(order).toEqual([0, 1, 0, 1]);
    expect(v().units.map((u) => [u.id, u.team, Math.trunc(u.x / 256)])).toEqual([
      [1, 0, 400],
      [2, 0, 300],
      [3, 1, 700],
      [4, 1, 800],
    ]);
    expect(v().turn.phase).toBe('transition');
    expect(v().turn.number).toBe(1);
    expect(v().turn.activeTeam).toBe(0);
  });

  it('refuses a column too close to another unit or to the side of the map', () => {
    const sim = newMatch();
    sim.step([{ t: 'place', x: 400 }]);
    const events: SimEvent[] = [];
    events.push(...sim.step([{ t: 'place', x: 410 }]));
    events.push(...sim.step([{ t: 'place', x: 5 }]));
    expect(events.filter((e) => e.e === 'placeRefused')).toHaveLength(2);
    expect(sim.view().units).toHaveLength(1);
    expect(sim.view().turn.activeTeam).toBe(1);
  });

  it('puts the unit on its default column when the time runs out', () => {
    const sim = newMatch();
    for (let i = 0; i < (RULES.turn.placementTicks ?? 0); i++) sim.step();
    expect(sim.view().units.map((u) => Math.trunc(u.x / 256))).toEqual([100]);
    expect(sim.view().turn.activeTeam).toBe(1);
  });
});
