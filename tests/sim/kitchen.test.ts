import { describe, expect, it } from 'vitest';
import { KITCHEN_RULES, type KitchenRules } from '../../src/content/kitchen.ts';
import { CLASSIC_RULES, type MatchRules } from '../rules-fixture.ts';
import {
  Material,
  Sim,
  kitchenAllowed,
  kitchenChance,
  kitchenTurn,
  type Mask,
  type SimEvent,
} from '../../src/sim/index.ts';

/** 1200 × 600 flat map, ground at y = 500. */
function flatMask(): Mask {
  const width = 1200;
  const height = 600;
  const data = new Uint8Array(width * height);
  for (let y = 500; y < height; y++) data.fill(Material.Earth, y * width, (y + 1) * width);
  return { width, height, data };
}

const ALWAYS: MatchRules = {
  ...CLASSIC_RULES,
  wind: { ...CLASSIC_RULES.wind, max: 0 },
  kitchen: { ...KITCHEN_RULES, chanceStartPermille: 1000, chanceDecayPct: 100 },
};

describe('field kitchen (GDD §4.9)', () => {
  it('appears less and less often, down to a floor', () => {
    const r: KitchenRules = KITCHEN_RULES;
    expect([0, 1, 2, 3].map((n) => kitchenChance(r, n))).toEqual([250, 200, 160, 128]);
    expect(kitchenChance(r, 100)).toBe(r.chanceFloorPermille);
  });

  it('never lets a team get a second kitchen before the others', () => {
    expect(kitchenAllowed([1, 0], 0, [0, 1])).toBe(false);
    expect(kitchenAllowed([1, 0], 1, [0, 1])).toBe(true);
    expect(kitchenAllowed([1, 1, 0], 0, [0, 1])).toBe(true); // team 2 is out
  });

  it('keeps appearances within one of each other over 1 000 games', () => {
    let worst = 0;
    let total = 0;
    for (let game = 0; game < 1000; game++) {
      const teams = 2 + (game % 3);
      const spawns = Array.from({ length: teams }, (_, i) => ({ spawns: [100 + i * 300] }));
      const s = new Sim({ rules: CLASSIC_RULES, teams: spawns }, game + 1, flatMask()).snapshot();
      // Test-side dice decide whether somebody shoots the kitchen during a turn.
      let dice = game * 2654435761;
      for (let turn = 2; turn <= 40; turn++) {
        dice = (dice * 1103515245 + 12345) >>> 0;
        if (dice % 3 === 0) s.kitchen = null;
        s.turn.number = turn;
        s.turn.activeTeam = (s.turn.activeTeam + 1) % teams;
        kitchenTurn(s, []);
      }
      const counts = s.kitchenCounts;
      total += counts.reduce((a, b) => a + b, 0);
      worst = Math.max(worst, Math.max(...counts) - Math.min(...counts));
    }
    expect(worst).toBeLessThanOrEqual(1);
    expect(total).toBeGreaterThan(1000); // it does appear
  });

  it('appears between the two sides, heals the shooter and goes', () => {
    const sim = new Sim(
      { rules: ALWAYS, teams: [{ spawns: [300] }, { spawns: [900] }] },
      4,
      flatMask(),
    );
    const k = sim.view().kitchen;
    expect(k).not.toBeNull();
    expect(k && k.x / 256).toBe(600);
    expect(k && k.y / 256).toBe(500);
    // The shooter is wounded: 50 HP left.
    const snap = sim.snapshot();
    const shooter = snap.units.find((u) => u.id === 1);
    if (shooter) shooter.hp = 50;
    sim.restore(snap);
    const events: SimEvent[] = [];
    for (let i = 0; i < 500 && sim.view().turn.phase !== 'action'; i++) sim.step();
    events.push(
      ...sim.step([
        { t: 'aim', angle: 0 },
        { t: 'fire', power: 1024 },
      ]),
    );
    for (let i = 0; i < 60; i++) events.push(...sim.step());
    expect(events).toContainEqual({ e: 'kitchenUsed', unitId: 1, heal: 30 });
    expect(sim.view().units.find((u) => u.id === 1)?.hp).toBe(80);
    expect(sim.view().kitchen).toBeNull();
    expect(sim.view().units.find((u) => u.id === 2)?.hp).toBe(100); // the arrow stopped there
  });

  it('never heals above the starting HP', () => {
    const sim = new Sim(
      { rules: ALWAYS, teams: [{ spawns: [300] }, { spawns: [900] }] },
      4,
      flatMask(),
    );
    const events: SimEvent[] = [];
    for (let i = 0; i < 500 && sim.view().turn.phase !== 'action'; i++) sim.step();
    events.push(
      ...sim.step([
        { t: 'aim', angle: 0 },
        { t: 'fire', power: 1024 },
      ]),
    );
    for (let i = 0; i < 60; i++) events.push(...sim.step());
    expect(events).toContainEqual({ e: 'kitchenUsed', unitId: 1, heal: 0 });
    expect(sim.view().units.find((u) => u.id === 1)?.hp).toBe(100);
  });

  it('goes out after two rounds when nobody touches it, then the other side gets one', () => {
    const sim = new Sim(
      { rules: ALWAYS, teams: [{ spawns: [300] }, { spawns: [900] }] },
      4,
      flatMask(),
    );
    expect(sim.view().kitchen?.expiresTurn).toBe(5); // lit at turn 1: 2 rounds × 2 teams
    const seen: string[] = [];
    while (sim.view().turn.number < 6) {
      const events = sim.step(sim.view().turn.phase === 'action' ? [{ t: 'skip' }] : []);
      for (const e of events) {
        if (e.e === 'kitchenGone' || e.e === 'kitchenAppeared') {
          seen.push(`${e.e}@${sim.view().turn.number}`);
        }
      }
    }
    // Turn 5 is team 0's, which already had one: team 1 gets the next at turn 6.
    expect(seen).toEqual(['kitchenGone@5', 'kitchenAppeared@6']);
  });

  it('does nothing for logs recorded without the kitchen', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { kitchen, ...old } = CLASSIC_RULES;
    const sim = new Sim(
      { rules: old, teams: [{ spawns: [300] }, { spawns: [900] }] },
      4,
      flatMask(),
    );
    expect(sim.view().kitchen).toBeNull();
  });
});
