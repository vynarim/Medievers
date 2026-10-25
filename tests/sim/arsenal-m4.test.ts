// The weapons of the full arsenal (BACKLOG M4, lot 6): sword, shield charge…
import { describe, expect, it } from 'vitest';
import { CLASSIC_RULES, type MatchRules } from '../rules-fixture.ts';
import { Material, Sim, type GameCommand, type Mask, type SimEvent } from '../../src/sim/index.ts';

function flatMask(): Mask {
  const width = 1200;
  const height = 600;
  const data = new Uint8Array(width * height);
  for (let y = 500; y < height; y++) data.fill(Material.Earth, y * width, (y + 1) * width);
  return { width, height, data };
}

// Only the arsenal under test: no wind, kitchen, fire, barrels or reliquaries.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { kitchen, burn, barrels, crates, beasts, ...BASE } = CLASSIC_RULES;
const CALM: MatchRules = { ...BASE, wind: { ...CLASSIC_RULES.wind, max: 0 } };

function match(rules: MatchRules, a: number, b: readonly number[], mask = flatMask()): Sim {
  const sim = new Sim({ rules, teams: [{ spawns: [a] }, { spawns: [...b] }] }, 2, mask);
  for (let i = 0; i < 1000 && sim.view().turn.phase !== 'action'; i++) sim.step();
  return sim;
}

function run(sim: Sim, cmds: GameCommand[], ticks: number): SimEvent[] {
  const events = [...sim.step(cmds)];
  for (let i = 0; i < ticks; i++) events.push(...sim.step());
  return events;
}

const unit = (sim: Sim, id: number) => sim.view().units.find((u) => u.id === id);
const px = (v: number | undefined) => (v ?? 0) >> 8;

describe('sword (GDD §4.3)', () => {
  it('strikes level on the facing side, whatever the aim, for 25 HP and a light recoil', () => {
    const sim = match(CALM, 300, [340]);
    run(
      sim,
      [
        { t: 'selectWeapon', id: 'sword' },
        // Aimed high on the right: the sword still strikes level, to the right.
        { t: 'aim', angle: 3200 },
        { t: 'fire', power: 0 },
      ],
      200,
    );
    const foe = unit(sim, 2);
    expect(foe?.hp).toBe(75);
    const moved = px(foe?.x) - 340;
    expect(moved).toBeGreaterThan(5);
    expect(moved).toBeLessThan(120);
  });

  it('is refused with nobody in front, the action kept', () => {
    const sim = match(CALM, 300, [800]);
    const events = run(
      sim,
      [
        { t: 'selectWeapon', id: 'sword' },
        { t: 'aim', angle: 0 },
        { t: 'fire', power: 0 },
      ],
      1,
    );
    expect(events.some((e) => e.e === 'toolRefused')).toBe(true);
    expect(sim.view().turn.phase).toBe('action');
  });
});

describe('shield charge (GDD §4.3)', () => {
  it('runs 120 px ahead and throws every unit it meets, once each', () => {
    const sim = match(CALM, 300, [360, 400]);
    run(
      sim,
      [
        { t: 'selectWeapon', id: 'shieldCharge' },
        { t: 'aim', angle: 0 },
        { t: 'fire', power: 0 },
      ],
      400,
    );
    const v = sim.view();
    expect(px(unit(sim, 1)?.x)).toBe(420);
    expect(unit(sim, 2)?.hp).toBe(80);
    expect(unit(sim, 3)?.hp).toBe(80);
    expect(px(unit(sim, 2)?.x)).toBeGreaterThan(420);
    expect(v.charge).toBeNull();
  });

  it('stops against a wall', () => {
    const mask = flatMask();
    for (let y = 300; y < 500; y++) mask.data.fill(Material.Rock, y * 1200 + 380, y * 1200 + 420);
    const sim = match(CALM, 300, [900], mask);
    run(
      sim,
      [
        { t: 'selectWeapon', id: 'shieldCharge' },
        { t: 'aim', angle: 0 },
        { t: 'fire', power: 0 },
      ],
      200,
    );
    expect(px(unit(sim, 1)?.x)).toBeLessThan(380);
    expect(px(unit(sim, 1)?.x)).toBeGreaterThan(340);
  });

  it('is forbidden to a cleric', () => {
    const sim = new Sim(
      {
        rules: CALM,
        teams: [{ spawns: [300], classes: ['cleric'] }, { spawns: [360] }],
      },
      2,
      flatMask(),
    );
    for (let i = 0; i < 1000 && sim.view().turn.phase !== 'action'; i++) sim.step();
    sim.step([{ t: 'selectWeapon', id: 'shieldCharge' }]);
    expect(sim.view().turn.weapon).toBe('bow');
  });
});

describe('rain of arrows (GDD §4.2)', () => {
  it('drops twelve arrows around the point, each one striking like an arrow', () => {
    const sim = match(CALM, 300, [900, 1000]);
    const events = run(
      sim,
      [
        { t: 'selectWeapon', id: 'arrowRain' },
        { t: 'aim', angle: 0 },
        { t: 'fireAt', x: 900, y: 0 },
      ],
      600,
    );
    expect(events.filter((e) => e.e === 'shotEnded')).toHaveLength(12);
    expect(events.some((e) => e.e === 'explosion')).toBe(false);
    const hp = unit(sim, 2)?.hp ?? 100;
    expect(hp).toBeLessThan(100);
    expect((100 - hp) % 10).toBe(0);
    // The other enemy, 100 px off, is out of the rain.
    expect(unit(sim, 3)?.hp).toBe(100);
    expect(events.some((e) => e.e === 'terrainCarved')).toBe(true);
  });
});
