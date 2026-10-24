import { describe, expect, it } from 'vitest';
import { DRAGON_HALF_HEIGHT, DRAGON_RULES } from '../../src/content/dragon.ts';
import { WEAPONS } from '../../src/content/weapons.ts';
import { CLASSIC_RULES, type MatchRules } from '../rules-fixture.ts';
import { Material, Sim, type Mask, type SimEvent } from '../../src/sim/index.ts';
import { GRAVITY } from '../../src/sim/units/unit.ts';

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

// Only the dragon: no wind, kitchen, fire, barrels, reliquaries or beasts; it always comes.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { kitchen, burn, barrels, crates, beasts, deluge, weather, ...BASE } = CLASSIC_RULES;
const RULES: MatchRules = {
  ...BASE,
  wind: { ...CLASSIC_RULES.wind, max: 0 },
  dragon: { ...DRAGON_RULES, spawnPermille: 1000 },
};

function match(rules: MatchRules = RULES): Sim {
  const sim = new Sim({ rules, teams: [{ spawns: [300] }, { spawns: [700, 1300] }] }, 3, mask());
  for (let i = 0; i < 1000 && sim.view().turn.phase !== 'action'; i++) sim.step();
  return sim;
}

function run(sim: Sim, ticks: number): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) events.push(...sim.step());
  return events;
}

describe('dragon (GDD §4.11)', () => {
  it('crosses the sky as low as it can, within reach of a full-power arrow', () => {
    const sim = match();
    const d = sim.view().dragon;
    expect(d).not.toBeNull();
    // Its belly `clearance` px over the top of the hill (400).
    expect((d?.y ?? 0) >> 8).toBe(400 - DRAGON_RULES.clearance - DRAGON_HALF_HEIGHT);
    // A full-power arrow shot straight up from the plain climbs past it.
    const bow = WEAPONS.find((w) => w.id === 'bow')?.maxSpeed ?? 0;
    const apex = Math.trunc((bow * bow) / (2 * GRAVITY) / 256);
    expect(500 - ((d?.y ?? 0) >> 8)).toBeLessThan(apex);
    // It flies on, then leaves the sky.
    const x0 = d?.x ?? 0;
    run(sim, 10);
    expect(Math.abs((sim.view().dragon?.x ?? 0) - x0)).toBe(10 * DRAGON_RULES.speed);
    const events = run(sim, 4000);
    expect(events).toContainEqual({ e: 'dragonGone' });
  });

  it('never comes in a match without the rule', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { dragon, ...old } = RULES;
    expect(match(old).view().dragon).toBeNull();
  });

  it('shot at, swoops on an enemy of the shooter and swallows it, then flies away', () => {
    const sim = match();
    // Put the dragon right above the archer (unit 1, house 0).
    const snap = sim.snapshot();
    const d = snap.dragon;
    const archer = snap.units[0];
    if (d && archer) d.x = archer.x;
    sim.restore(snap);
    const events = [
      ...sim.step([
        { t: 'aim', angle: 3072 },
        { t: 'fire', power: 1024 },
      ]),
      ...run(sim, 60),
    ];
    const enraged = events.find((e) => e.e === 'dragonEnraged');
    expect(enraged).toBeDefined();
    const prey = enraged?.e === 'dragonEnraged' ? enraged.unitId : 0;
    // Units 2 and 3 are the other house's.
    expect([2, 3]).toContain(prey);
    // The arrow stopped on it: no damage to anyone from the shot.
    expect(events.some((e) => e.e === 'unitDamaged')).toBe(false);
    const rest = [...events, ...run(sim, 600)];
    expect(rest).toContainEqual({ e: 'dragonAte', unitId: prey });
    expect(rest).toContainEqual({ e: 'unitDied', unitId: prey, cause: 'dragon' });
    expect(sim.view().units.find((u) => u.id === prey)?.alive).toBe(false);
    expect(sim.view().units[0]?.alive).toBe(true);
    // Fed, it leaves.
    expect(rest).toContainEqual({ e: 'dragonGone' });
  });

  it('keeps the turn waiting while it swoops', () => {
    const sim = match();
    const snap = sim.snapshot();
    const d = snap.dragon;
    if (d) {
      d.prey = 3;
      d.x = 0;
    }
    sim.restore(snap);
    sim.step([{ t: 'skip' }]);
    for (let i = 0; i < 2000 && sim.view().dragon?.prey !== 0; i++) {
      expect(sim.view().turn.phase).toBe('resolution');
      sim.step();
    }
    expect(sim.view().units.find((u) => u.id === 3)?.alive).toBe(false);
  });
});
