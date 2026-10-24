import { describe, expect, it } from 'vitest';
import { BARREL_RULES } from '../../src/content/barrels.ts';
import { FLAME_RULES } from '../../src/content/flames.ts';
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
const { kitchen, burn, crates, beasts, barrels, deluge, ...BASE } = CLASSIC_RULES;
const CALM: MatchRules = { ...BASE, wind: { ...CLASSIC_RULES.wind, max: 0 } };

function toPhase(sim: Sim, phase: string): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < 4000 && sim.view().turn.phase !== phase; i++) events.push(...sim.step());
  return events;
}

/** Puts flames on the ground (y = 500) at the given columns, through a snapshot. */
function withFlames(sim: Sim, xs: number[], turns = FLAME_RULES.turns): void {
  const snap = sim.snapshot();
  for (const x of xs)
    snap.flames.push({ id: snap.nextEntityId++, x: x * 256 + 128, y: 500 * 256, turns });
  sim.restore(snap);
}

const hp = (sim: Sim, id: number): number => sim.view().units.find((u) => u.id === id)?.hp ?? -1;

describe('flames (GDD §4.1, §4.6)', () => {
  it('are left on the ground by a Greek fire blast', () => {
    const sim = new Sim(
      { rules: CALM, teams: [{ spawns: [200] }, { spawns: [1000] }] },
      1,
      flatMask(),
    );
    const snap = sim.snapshot();
    snap.explosions.items.push({
      tick: snap.tick + 1,
      seq: snap.explosions.nextSeq++,
      explosion: {
        x: 600 * 256,
        y: 495 * 256,
        radius: 60,
        carveRadius: 0,
        maxDamage: 0,
        sourceId: 900,
        flames: true,
      },
    });
    sim.restore(snap);
    sim.step();
    const flames = sim.view().flames;
    expect(flames).toHaveLength(FLAME_RULES.count);
    for (const f of flames) {
      expect(f.y / 256).toBe(500);
      expect(Math.abs((f.x >> 8) - 600)).toBeLessThanOrEqual(48);
    }
  });

  it('burn a unit standing in them, 3 HP a tick, 10 at most per turn', () => {
    const sim = new Sim(
      { rules: CALM, teams: [{ spawns: [200] }, { spawns: [1000] }] },
      1,
      flatMask(),
    );
    withFlames(sim, [1000]);
    for (let i = 0; i < 30; i++) sim.step();
    expect(hp(sim, 2)).toBe(100 - FLAME_RULES.maxPerTurn);
    // A new turn, a new cap.
    toPhase(sim, 'resolution');
    toPhase(sim, 'action');
    for (let i = 0; i < 30; i++) sim.step();
    expect(hp(sim, 2)).toBe(100 - 2 * FLAME_RULES.maxPerTurn);
    expect(hp(sim, 1)).toBe(100);
  });

  it('go out after their turns', () => {
    const sim = new Sim(
      { rules: CALM, teams: [{ spawns: [200] }, { spawns: [1000] }] },
      1,
      flatMask(),
    );
    withFlames(sim, [600], 2);
    toPhase(sim, 'action');
    sim.step([{ t: 'skip' }]);
    toPhase(sim, 'action');
    expect(sim.view().flames).toHaveLength(1);
    sim.step([{ t: 'skip' }]);
    toPhase(sim, 'action');
    expect(sim.view().flames).toHaveLength(0);
  });

  it('set a powder barrel off', () => {
    const sim = new Sim(
      {
        rules: { ...CALM, barrels: BARREL_RULES },
        teams: [{ spawns: [200] }, { spawns: [1000] }],
      },
      1,
      flatMask(),
    );
    const snap = sim.snapshot();
    snap.barrels.length = 0;
    snap.barrels.push({ id: 500, x: 600 * 256, y: 500 * 256 });
    sim.restore(snap);
    withFlames(sim, [600]);
    const events: SimEvent[] = [];
    for (let i = 0; i < 10; i++) events.push(...sim.step());
    expect(events.some((e) => e.e === 'explosion')).toBe(true);
    expect(sim.view().barrels).toHaveLength(0);
  });

  it('go out under the water', () => {
    const sim = new Sim(
      { rules: CALM, teams: [{ spawns: [200] }, { spawns: [1000] }], waterLevel: 450 },
      1,
      flatMask(),
    );
    withFlames(sim, [600]);
    sim.step();
    expect(sim.view().flames).toHaveLength(0);
  });

  it('are left by nothing without rules.flames', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { flames, ...old } = CALM;
    const sim = new Sim(
      { rules: old, teams: [{ spawns: [200] }, { spawns: [1000] }] },
      1,
      flatMask(),
    );
    const snap = sim.snapshot();
    snap.explosions.items.push({
      tick: snap.tick + 1,
      seq: snap.explosions.nextSeq++,
      explosion: {
        x: 600 * 256,
        y: 495 * 256,
        radius: 60,
        carveRadius: 0,
        maxDamage: 0,
        sourceId: 900,
        flames: true,
      },
    });
    sim.restore(snap);
    sim.step();
    expect(sim.view().flames).toHaveLength(0);
  });
});
