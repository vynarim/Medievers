import { describe, expect, it } from 'vitest';
import { DRAGON_HALF_HEIGHT, DRAGON_RULES } from '../../src/content/dragon.ts';
import { WEAPONS } from '../../src/content/weapons.ts';
import { CLASSIC_RULES, type MatchRules } from '../rules-fixture.ts';
import { Material, Sim, type Mask, type SimEvent } from '../../src/sim/index.ts';
import { GRAVITY, UNIT_HEIGHT } from '../../src/sim/units/unit.ts';

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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { swing, swingTicks, ...LEVEL } = DRAGON_RULES;
const RULES: MatchRules = {
  ...BASE,
  wind: { ...CLASSIC_RULES.wind, max: 0 },
  dragon: { ...DRAGON_RULES, spawnPermille: 1000 },
};
/** A level flight, as in older logs, to measure its height over the relief. */
const LEVEL_RULES: MatchRules = { ...RULES, dragon: { ...LEVEL, spawnPermille: 1000 } };

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
  it('hugs the relief just over the units, within reach of an arrow, then leaves', () => {
    const sim = match(LEVEL_RULES);
    const d = sim.view().dragon;
    expect(d).not.toBeNull();
    const low = 500 - DRAGON_RULES.clearance - DRAGON_HALF_HEIGHT;
    const high = 400 - DRAGON_RULES.clearance - DRAGON_HALF_HEIGHT;
    // Over the plain: its belly `clearance` px over the ground, above a standing unit's head.
    expect((d?.y ?? 0) >> 8).toBe(low);
    expect(DRAGON_RULES.clearance).toBeGreaterThan(UNIT_HEIGHT);
    // An arrow at half power, shot straight up from the ground, climbs past it.
    const half = (WEAPONS.find((w) => w.id === 'bow')?.maxSpeed ?? 0) >> 1;
    const apex = Math.trunc((half * half) / (2 * GRAVITY) / 256);
    expect(500 - low).toBeLessThan(apex);
    // It flies on at its speed, rises over the hill (x 950 to 1050) and sinks after it.
    const x0 = d?.x ?? 0;
    run(sim, 10);
    expect(Math.abs((sim.view().dragon?.x ?? 0) - x0)).toBe(10 * DRAGON_RULES.speed);
    const ys: Record<string, number> = {};
    const events: SimEvent[] = [];
    for (let i = 0; i < 4000 && sim.view().dragon; i++) {
      events.push(...sim.step());
      const v = sim.view().dragon;
      if (v) ys[String(Math.trunc((v.x >> 8) / 100))] = v.y >> 8;
    }
    expect(ys['10']).toBe(high);
    expect(ys['3']).toBe(low);
    expect(events).toContainEqual({ e: 'dragonGone' });
  });

  it('climbs and sinks a little as it flies, never under its lowest', () => {
    const sim = match();
    const low = 500 - DRAGON_RULES.clearance - DRAGON_HALF_HEIGHT;
    const ys = new Set<number>();
    for (let i = 0; i < 600; i++) {
      sim.step();
      const d = sim.view().dragon;
      // Over the plain only (the hill is x 950 to 1050).
      if (d && Math.abs((d.x >> 8) - 1000) > 300) ys.add(d.y >> 8);
    }
    expect(Math.max(...ys)).toBeLessThanOrEqual(low);
    expect(low - Math.min(...ys)).toBeGreaterThan((DRAGON_RULES.swing ?? 0) / 2);
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
