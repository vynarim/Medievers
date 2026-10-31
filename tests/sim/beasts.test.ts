import { describe, expect, it } from 'vitest';
import { BEAST_RULES, BeastKind, Trick } from '../../src/content/beasts.ts';
import { CLASSIC_RULES, weaponIndexIn, type MatchRules } from '../rules-fixture.ts';
import {
  Material,
  Sim,
  beastsTurnEnd,
  createPrng,
  type Mask,
  type SimEvent,
  type SimState,
} from '../../src/sim/index.ts';

/** Element i of a list, which the test knows is there. */
function at<T>(list: readonly T[], i: number): T {
  const x = list[i];
  if (x === undefined) throw new Error(`no element ${i}`);
  return x;
}

function flatMask(): Mask {
  const width = 1200;
  const height = 600;
  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // A 60 px high wall at x = 700..709.
      const wall = x >= 700 && x < 710 && y >= 440;
      if (y >= 500 || wall) data[y * width + x] = Material.Earth;
    }
  }
  return { width, height, data };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { kitchen, burn, barrels, crates, ...BASE } = CLASSIC_RULES;
const RULES: MatchRules = {
  ...BASE,
  wind: { ...CLASSIC_RULES.wind, max: 0 },
  beasts: { ...BEAST_RULES, spawnPermille: 0 },
};

/** A state with one unit per side and a beast of `kind` right next to unit 1. */
function setup(kind: number): SimState {
  const s = new Sim(
    { rules: RULES, teams: [{ spawns: [300] }, { spawns: [1000] }] },
    3,
    flatMask(),
  ).snapshot();
  s.beast = { id: 99, kind, x: 310 * 256, y: 500 * 256 };
  return s;
}

/** Plays the beast's move until it strikes with `trick` (the PRNG picks it). */
function strikeWith(kind: number, trick: number): { s: SimState; events: SimEvent[] } {
  for (let seed = 0; seed < 200; seed++) {
    const s = setup(kind);
    Object.assign(s.prng, createPrng(seed));
    const events: SimEvent[] = [];
    beastsTurnEnd(s, events);
    const hit = events.find((e) => e.e === 'beastStruck');
    if (hit && hit.e === 'beastStruck' && hit.trick === trick) return { s, events };
  }
  throw new Error(`trick ${trick} never drawn`);
}

describe('beasts of the margins (GDD §4.10)', () => {
  it('hare kick: 15 HP and thrown away', () => {
    const { s, events } = strikeWith(BeastKind.Hare, Trick.Kick);
    expect(events).toContainEqual({
      e: 'unitDamaged',
      unitId: 1,
      damage: BEAST_RULES.kickDamage,
      source: 'beast',
    });
    expect(s.units[0]?.vx).toBeLessThan(0);
    expect(s.beast).toBeNull();
  });

  it('hare theft: one shot of the scarcest limited weapon', () => {
    const { s } = strikeWith(BeastKind.Hare, Trick.Steal);
    const crossbow = weaponIndexIn(RULES, 'crossbow');
    const pitch = weaponIndexIn(RULES, 'pitchPot');
    // Pitch pot (1 shot) is scarcer than the crossbow (3): it goes.
    expect(s.teams[0]?.ammo[pitch]).toBe(0);
    expect(s.teams[0]?.ammo[crossbow]).toBe(3);
  });

  it('hare panic: an uncontrolled backward jump at the start of the next turn', () => {
    const { s } = strikeWith(BeastKind.Hare, Trick.Panic);
    expect(s.afflictions).toEqual([{ unitId: 1, trick: Trick.Panic, turns: 1 }]);
    const sim = new Sim(
      { rules: RULES, teams: [{ spawns: [300] }, { spawns: [1000] }] },
      3,
      flatMask(),
    );
    sim.restore(s);
    const events: SimEvent[] = [];
    for (let i = 0; i < 2000 && sim.view().turn.number < 3; i++) {
      events.push(...sim.step(sim.view().turn.phase === 'action' ? [{ t: 'skip' }] : []));
    }
    // Turn 1 was unit 1's: skipped. Turn 2 is the enemy's. Turn 3 is unit 1's again: panic.
    for (let i = 0; i < 200 && sim.view().turn.phase !== 'action'; i++) events.push(...sim.step());
    expect(events).toContainEqual({ e: 'panicked', unitId: 1 });
    expect(sim.view().afflictions).toHaveLength(0);
  });

  it('snail slime: walking counts double for two turns', () => {
    const { s } = strikeWith(BeastKind.Snail, Trick.Slime);
    const sim = new Sim(
      { rules: RULES, teams: [{ spawns: [300] }, { spawns: [1000] }] },
      3,
      flatMask(),
    );
    sim.restore(s);
    for (let i = 0; i < 200 && sim.view().turn.phase !== 'action'; i++) sim.step();
    const budget = sim.view().turn.moveLeft;
    const x0 = at(sim.view().units, 0).x;
    sim.step([{ t: 'move', dir: -1 }]); // facing right: turns round first, then walks
    for (let i = 0; i < 40; i++) sim.step();
    const walked = Math.abs(at(sim.view().units, 0).x - x0);
    expect(budget - sim.view().turn.moveLeft).toBe(2 * walked);
  });

  it('snail shell: no walking nor jumping on the next turn', () => {
    const { s } = strikeWith(BeastKind.Snail, Trick.Shell);
    const sim = new Sim(
      { rules: RULES, teams: [{ spawns: [300] }, { spawns: [1000] }] },
      3,
      flatMask(),
    );
    sim.restore(s);
    for (let i = 0; i < 200 && sim.view().turn.phase !== 'action'; i++) sim.step();
    const x0 = at(sim.view().units, 0).x;
    sim.step([{ t: 'move', dir: 1 }]);
    for (let i = 0; i < 30; i++) sim.step();
    sim.step([{ t: 'jump', kind: 'forward' }]);
    sim.step();
    expect(at(sim.view().units, 0).x).toBe(x0);
    expect(at(sim.view().units, 0).grounded).toBe(true);
  });

  it('snail bite: 3 HP at the end of every turn, three times', () => {
    const { s } = strikeWith(BeastKind.Snail, Trick.Bite);
    const hp = at(s.units, 0).hp;
    for (let i = 0; i < 5; i++) beastsTurnEnd(s, []);
    expect(at(s.units, 0).hp).toBe(hp - 3 * BEAST_RULES.biteDamage);
    expect(s.afflictions).toHaveLength(0);
  });

  it('a hare bounds towards its prey but a wall stops it; a snail crawls through', () => {
    for (const [kind, expected] of [
      [BeastKind.Hare, 712],
      [BeastKind.Snail, 1000 - BEAST_RULES.snailStep],
    ] as const) {
      const s = setup(kind);
      // Unit 1 at 300 is the only prey; the beast starts at 1000, the wall stands at 700.
      s.beast = { id: 99, kind, x: 1000 * 256, y: 500 * 256 };
      at(s.units, 1).alive = false;
      const events: SimEvent[] = [];
      beastsTurnEnd(s, events);
      const moved = events.find((e) => e.e === 'beastMoved');
      expect(moved && moved.e === 'beastMoved' && moved.x).toBe(expected);
    }
  });

  it('is put down by a shot', () => {
    const s = setup(BeastKind.Hare);
    s.beast = { id: 99, kind: BeastKind.Hare, x: 500 * 256, y: 500 * 256 };
    const sim = new Sim(
      { rules: RULES, teams: [{ spawns: [300] }, { spawns: [1000] }] },
      3,
      flatMask(),
    );
    sim.restore(s);
    for (let i = 0; i < 200 && sim.view().turn.phase !== 'action'; i++) sim.step();
    const events: SimEvent[] = [
      ...sim.step([
        { t: 'aim', angle: 40 },
        { t: 'fire', power: 1024 },
      ]),
    ];
    for (let i = 0; i < 60; i++) events.push(...sim.step());
    expect(events).toContainEqual({ e: 'beastKilled' });
    expect(sim.view().beast).toBeNull();
  });
});
