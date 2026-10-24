import { describe, expect, it } from 'vitest';
import { DELUGE_RULES } from '../../src/content/deluge.ts';
import { CLASSIC_RULES, type MatchRules } from '../rules-fixture.ts';
import { Material, Sim, type Mask, type SimEvent } from '../../src/sim/index.ts';

/** Flat earth at y = 500, with a pit down to y = 590 between x = 600 and 700. */
function pitMask(): Mask {
  const width = 1200;
  const height = 600;
  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ground = x >= 600 && x < 700 ? 590 : 500;
      if (y >= ground) data[y * width + x] = Material.Earth;
    }
  }
  return { width, height, data };
}

// Only the water changes things.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { kitchen, burn, crates, beasts, barrels, deluge, ...BASE } = CLASSIC_RULES;
const CALM: MatchRules = { ...BASE, wind: { ...CLASSIC_RULES.wind, max: 0 } };

function skipTurns(sim: Sim, n: number): SimEvent[] {
  const events: SimEvent[] = [];
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < 2000 && sim.view().turn.phase !== 'action'; i++) events.push(...sim.step());
    events.push(...sim.step([{ t: 'skip' }]));
    for (let i = 0; i < 2000 && sim.view().turn.phase !== 'transition'; i++) {
      events.push(...sim.step());
    }
  }
  return events;
}

describe('water and the Déluge (GDD §2.4)', () => {
  it('has no water without a water level or a Déluge', () => {
    const sim = new Sim(
      { rules: CALM, teams: [{ spawns: [200] }, { spawns: [1000] }] },
      1,
      pitMask(),
    );
    expect(sim.view().waterY).toBe(600);
    skipTurns(sim, 4);
    expect(sim.view().waterY).toBe(600);
  });

  it('starts at the end of turn N, then the water rises and bites every turn', () => {
    const rules: MatchRules = { ...CALM, deluge: { ...DELUGE_RULES, startTurn: 3 } };
    const sim = new Sim({ rules, teams: [{ spawns: [200] }, { spawns: [1000] }] }, 1, pitMask());
    const before = skipTurns(sim, 2);
    expect(before.some((e) => e.e === 'delugeStarted')).toBe(false);
    const third = skipTurns(sim, 1);
    expect(third).toContainEqual({ e: 'delugeStarted' });
    expect(sim.view().waterY).toBe(600 - DELUGE_RULES.risePx);
    expect(sim.view().units.map((u) => u.hp)).toEqual([95, 95]);
    skipTurns(sim, 1);
    expect(sim.view().waterY).toBe(600 - 2 * DELUGE_RULES.risePx);
    expect(sim.view().units.map((u) => u.hp)).toEqual([90, 90]);
  });

  it('also starts after its time, whatever the turn', () => {
    const rules: MatchRules = {
      ...CALM,
      deluge: { ...DELUGE_RULES, startTurn: 99, startTicks: 60 },
    };
    const sim = new Sim({ rules, teams: [{ spawns: [200] }, { spawns: [1000] }] }, 1, pitMask());
    expect(skipTurns(sim, 1)).toContainEqual({ e: 'delugeStarted' });
  });

  it('washes up on the nearest dry ground the units it reaches, which lose 20 HP', () => {
    // The unit in the pit stands at 590; the water rises from 600 to 552 and covers it.
    const rules: MatchRules = {
      ...CALM,
      deluge: { ...DELUGE_RULES, startTurn: 1, damage: 0 },
    };
    const sim = new Sim({ rules, teams: [{ spawns: [650] }, { spawns: [1000] }] }, 1, pitMask());
    const events = skipTurns(sim, 1);
    expect(events).toContainEqual({ e: 'unitDamaged', unitId: 1, damage: DELUGE_RULES.wetDamage });
    expect(events.some((e) => e.e === 'unitDied')).toBe(false);
    const u = sim.view().units[0];
    expect(u?.alive).toBe(true);
    // On the edge of the pit, out of the water.
    expect((u?.y ?? 0) >> 8).toBe(500);
    expect(Math.abs(((u?.x ?? 0) >> 8) - 650)).toBeLessThanOrEqual(80);
  });

  it('drowns the units it reaches when it rises in logs recorded before it washed them up', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { wetDamage, ...old } = DELUGE_RULES;
    const rules: MatchRules = { ...CALM, deluge: { ...old, startTurn: 1, damage: 0 } };
    const sim = new Sim({ rules, teams: [{ spawns: [650] }, { spawns: [1000] }] }, 1, pitMask());
    const events = skipTurns(sim, 1);
    expect(events).toContainEqual({ e: 'unitDied', unitId: 1, cause: 'drowned' });
    expect(sim.view().winner).toBe(1);
  });

  it('drowns a unit that walks into it during its turn', () => {
    const sim = new Sim(
      { rules: CALM, teams: [{ spawns: [560] }, { spawns: [1000] }], waterLevel: 550 },
      1,
      pitMask(),
    );
    for (let i = 0; i < 2000 && sim.view().turn.phase !== 'action'; i++) sim.step();
    const events: SimEvent[] = [...sim.step([{ t: 'move', dir: 1 }])];
    for (let i = 0; i < 120; i++) events.push(...sim.step());
    expect(events).toContainEqual({ e: 'unitDied', unitId: 1, cause: 'drowned' });
    expect(sim.view().units[0]?.alive).toBe(false);
  });

  it('swallows a shot that falls in', () => {
    const sim = new Sim(
      { rules: CALM, teams: [{ spawns: [500] }, { spawns: [1100] }], waterLevel: 550 },
      1,
      pitMask(),
    );
    for (let i = 0; i < 2000 && sim.view().turn.phase !== 'action'; i++) sim.step();
    // A gentle sling stone, down into the pit.
    const events: SimEvent[] = [
      ...sim.step([
        { t: 'selectWeapon', id: 'sling' },
        { t: 'aim', angle: 3900 },
        { t: 'fire', power: 300 },
      ]),
    ];
    for (let i = 0; i < 200; i++) events.push(...sim.step());
    const ended = events.find((e) => e.e === 'shotEnded');
    expect(ended).toBeDefined();
    expect(sim.view().shots).toHaveLength(0);
    expect(events.some((e) => e.e === 'terrainCarved')).toBe(false);
  });

  it('refuses to place a unit under water', () => {
    const rules: MatchRules = { ...CALM, turn: { ...CALM.turn, placementTicks: 600 } };
    const sim = new Sim(
      { rules, teams: [{ spawns: [200] }, { spawns: [1000] }], waterLevel: 550 },
      1,
      pitMask(),
    );
    expect(sim.step([{ t: 'place', x: 650 }])).toContainEqual({ e: 'placeRefused', x: 650 });
  });
});
