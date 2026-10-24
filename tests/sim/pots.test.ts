import { describe, expect, it } from 'vitest';
import { CLASSIC_RULES, type MatchRules } from '../../src/content/rules.ts';
import { Material, Sim, type Mask, type SimEvent } from '../../src/sim/index.ts';

function flatMask(): Mask {
  const width = 1200;
  const height = 600;
  const data = new Uint8Array(width * height);
  for (let y = 500; y < height; y++) data.fill(Material.Earth, y * width, (y + 1) * width);
  return { width, height, data };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { kitchen, burn, barrels, crates, beasts, ...BASE } = CLASSIC_RULES;
const RULES: MatchRules = { ...BASE, wind: { ...CLASSIC_RULES.wind, max: 0 } };

/** Team 0 throws a Greek fire pot with a fuse of `turns`, everybody passes afterwards. */
function throwPot(turns: 1 | 2 | 3) {
  const sim = new Sim(
    { rules: RULES, teams: [{ spawns: [300] }, { spawns: [1000] }] },
    4,
    flatMask(),
  );
  for (let i = 0; i < 500 && sim.view().turn.phase !== 'action'; i++) sim.step();
  const events: SimEvent[] = [
    ...sim.step([
      { t: 'selectWeapon', id: 'greekFire' },
      { t: 'setFuse', seconds: turns },
      { t: 'aim', angle: 3584 },
      { t: 'fire', power: 500 },
    ]),
  ];
  /** Steps until turn n starts and its explosions are over (passing every action). */
  const toTurn = (n: number): void => {
    for (let i = 0; i < 20000 && sim.view().turn.number < n; i++) {
      events.push(...sim.step(sim.view().turn.phase === 'action' ? [{ t: 'skip' }] : []));
    }
    for (let i = 0; i < 120; i++) events.push(...sim.step());
  };
  return { sim, events, toTurn };
}

const blasts = (events: SimEvent[]) => events.filter((e) => e.e === 'explosion').length;

describe('pot fuse in turns (BACKLOG 4.10)', () => {
  it('1: goes off during the throw', () => {
    const { sim, events, toTurn } = throwPot(1);
    toTurn(2);
    expect(blasts(events)).toBe(1);
    expect(sim.view().pots).toHaveLength(0);
  });

  it('2: rests on the map, then goes off at the start of the next turn', () => {
    const { sim, events, toTurn } = throwPot(2);
    for (let i = 0; i < 600 && sim.view().shots.length > 0; i++) events.push(...sim.step());
    expect(sim.view().pots).toHaveLength(1);
    expect(events.some((e) => e.e === 'potPlaced')).toBe(true);
    expect(blasts(events)).toBe(0);
    toTurn(2);
    expect(events.some((e) => e.e === 'potLit')).toBe(true);
    expect(blasts(events)).toBe(1);
  });

  it('3: waits one more turn', () => {
    const { sim, events, toTurn } = throwPot(3);
    toTurn(2);
    expect(blasts(events)).toBe(0);
    expect(sim.view().pots[0]?.turns).toBe(1);
    toTurn(3);
    expect(blasts(events)).toBe(1);
  });

  it('is thrown about by a blast while it rests', () => {
    const { sim, events } = throwPot(3);
    for (let i = 0; i < 600 && sim.view().shots.length > 0; i++) events.push(...sim.step());
    const pot = sim.view().pots[0];
    expect(pot).toBeDefined();
    if (!pot) return;
    const snap = sim.snapshot();
    snap.explosions.items.push({
      tick: snap.tick + 1,
      seq: 999,
      explosion: {
        x: pot.x - 20 * 256,
        y: pot.y,
        radius: 50,
        carveRadius: 0,
        maxDamage: 0,
        sourceId: 999,
      },
    });
    sim.restore(snap);
    sim.step();
    expect(sim.view().pots).toHaveLength(0);
    expect(sim.view().shots[0]?.projectile.vx).toBeGreaterThan(0);
    expect(sim.view().shots[0]?.turns).toBe(2);
  });
});
