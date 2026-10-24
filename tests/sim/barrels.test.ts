import { describe, expect, it } from 'vitest';
import { BARREL_RULES, BARREL_SPACING } from '../../src/content/barrels.ts';
import { CLASSIC_RULES, type MatchRules } from '../../src/content/rules.ts';
import { Material, Sim, type Mask, type SimEvent } from '../../src/sim/index.ts';

function flatMask(): Mask {
  const width = 1200;
  const height = 600;
  const data = new Uint8Array(width * height);
  for (let y = 500; y < height; y++) data.fill(Material.Earth, y * width, (y + 1) * width);
  return { width, height, data };
}

// No wind, no kitchen, no fire: only the barrels change things.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { kitchen, burn, ...BASE } = CLASSIC_RULES;
const CALM: MatchRules = { ...BASE, wind: { ...CLASSIC_RULES.wind, max: 0 } };

function toAction(sim: Sim): void {
  for (let i = 0; i < 1000 && sim.view().turn.phase !== 'action'; i++) sim.step();
}

describe('powder barrels (GDD §4.6)', () => {
  it('are scattered on the ground, away from units and from each other', () => {
    const sim = new Sim(
      { rules: CALM, teams: [{ spawns: [200] }, { spawns: [1000] }] },
      9,
      flatMask(),
    );
    const barrels = sim.view().barrels;
    expect(barrels.length).toBeGreaterThan(0);
    expect(barrels.length).toBeLessThanOrEqual(BARREL_RULES.count);
    const xs = barrels.map((b) => b.x / 256);
    for (const b of barrels) expect(b.y / 256).toBe(500);
    for (const x of xs) {
      expect(Math.abs(x - 200)).toBeGreaterThanOrEqual(BARREL_SPACING);
      expect(Math.abs(x - 1000)).toBeGreaterThanOrEqual(BARREL_SPACING);
      for (const y of xs)
        if (x !== y) expect(Math.abs(x - y)).toBeGreaterThanOrEqual(BARREL_SPACING);
    }
    expect(barrels.map((b) => b.id)).toEqual([...barrels.map((b) => b.id)].sort((a, b) => a - b));
  });

  it('blow up when an arrow hits them, and set their neighbours off', () => {
    // Two barrels side by side in front of the shooter.
    const sim = new Sim(
      {
        rules: { ...CALM, barrels: { ...BARREL_RULES, count: 0 } },
        teams: [{ spawns: [200] }, { spawns: [1100] }],
      },
      1,
      flatMask(),
    );
    const snap = sim.snapshot();
    snap.barrels.push(
      { id: 100, x: 400 * 256, y: 500 * 256 },
      { id: 101, x: 460 * 256, y: 500 * 256 },
    );
    sim.restore(snap);
    toAction(sim);
    const events: SimEvent[] = [];
    events.push(
      ...sim.step([
        { t: 'aim', angle: 60 },
        { t: 'fire', power: 1024 },
      ]),
    );
    for (let i = 0; i < 120; i++) events.push(...sim.step());
    const blasts = events.filter((e) => e.e === 'explosion');
    expect(blasts).toHaveLength(2);
    expect(sim.view().barrels).toHaveLength(0);
    expect(sim.view().units.find((u) => u.id === 2)?.hp).toBe(100); // the arrow stopped there
  });

  it('go up when the fire reaches them', () => {
    const rules: MatchRules = {
      ...CALM,
      burn: { startRound: 0, advancePx: 150, damage: 0 },
      barrels: { ...BARREL_RULES, count: 0 },
    };
    const sim = new Sim({ rules, teams: [{ spawns: [600] }, { spawns: [700] }] }, 1, flatMask());
    const snap = sim.snapshot();
    snap.barrels.push({ id: 100, x: 100 * 256, y: 500 * 256 });
    sim.restore(snap);
    const events: SimEvent[] = [];
    for (let i = 0; i < 5000 && sim.view().turn.number < 5; i++) {
      events.push(...sim.step(sim.view().turn.phase === 'action' ? [{ t: 'skip' }] : []));
    }
    expect(events.some((e) => e.e === 'explosion')).toBe(true);
    expect(sim.view().barrels).toHaveLength(0);
  });

  it('are absent from logs recorded without them', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { barrels, ...old } = CALM;
    const sim = new Sim(
      { rules: old, teams: [{ spawns: [200] }, { spawns: [1000] }] },
      9,
      flatMask(),
    );
    expect(sim.view().barrels).toHaveLength(0);
  });
});
