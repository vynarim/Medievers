import { describe, expect, it } from 'vitest';
import { BURN_RULES } from '../../src/content/burn.ts';
import { CLASSIC_RULES, type MatchRules } from '../rules-fixture.ts';
import { Material, Sim, type Mask, type SimEvent } from '../../src/sim/index.ts';

function flatMask(): Mask {
  const width = 1200;
  const height = 600;
  const data = new Uint8Array(width * height);
  for (let y = 500; y < height; y++) data.fill(Material.Earth, y * width, (y + 1) * width);
  return { width, height, data };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { kitchen, beasts, crates, barrels, ...RULES } = CLASSIC_RULES;

/** Plays `turns` turns where everybody passes; returns the events. */
function passTurns(sim: Sim, turns: number): SimEvent[] {
  const events: SimEvent[] = [];
  const end = sim.view().turn.number + turns;
  for (let i = 0; i < 100000 && sim.view().turn.number < end; i++) {
    if (sim.view().turn.phase === 'gameOver') break;
    events.push(...sim.step(sim.view().turn.phase === 'action' ? [{ t: 'skip' }] : []));
  }
  return events;
}

describe('burning parchment (GDD §2.5)', () => {
  it('catches fire after the starting rounds, then eats in each round', () => {
    const sim = new Sim(
      { rules: RULES, teams: [{ spawns: [600] }, { spawns: [700] }] },
      1,
      flatMask(),
    );
    passTurns(sim, 2 * BURN_RULES.startRound - 1);
    expect(sim.view().burnPx).toBe(0);
    const events = passTurns(sim, 1); // end of the last round before the fire
    expect(events).toContainEqual({ e: 'burnSpread', px: BURN_RULES.advancePx });
    passTurns(sim, 2);
    expect(sim.view().burnPx).toBe(2 * BURN_RULES.advancePx);
  });

  it('burns units standing in the fire at the end of every turn', () => {
    const rules: MatchRules = { ...RULES, burn: { ...BURN_RULES, startRound: 0 } };
    // Unit 1 stands 50 px from the left end, unit 2 in the middle.
    const sim = new Sim(
      { rules, teams: [{ spawns: [50, 400] }, { spawns: [700] }] },
      1,
      flatMask(),
    );
    passTurns(sim, 2); // the first round ends: the fire reaches 120 px
    expect(sim.view().burnPx).toBe(BURN_RULES.advancePx);
    const events = passTurns(sim, 1);
    expect(events).toContainEqual({ e: 'unitDamaged', unitId: 1, damage: BURN_RULES.damage });
    expect(events.some((e) => e.e === 'unitDamaged' && e.unitId !== 1)).toBe(false);
  });

  it('never burns in logs recorded without it', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { burn, ...old } = RULES;
    const sim = new Sim(
      { rules: old, teams: [{ spawns: [50] }, { spawns: [700] }] },
      1,
      flatMask(),
    );
    passTurns(sim, 10);
    expect(sim.view().burnPx).toBe(0);
    expect(sim.view().units.every((u) => u.hp === CLASSIC_RULES.startHp)).toBe(true);
  });
});
