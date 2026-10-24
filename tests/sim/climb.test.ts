import { describe, expect, it } from 'vitest';
import { CLASSIC_RULES, type MatchRules } from '../rules-fixture.ts';
import { Material, Sim, type GameCommand, type Mask } from '../../src/sim/index.ts';

/** Flat earth at y = 500, a stone tower x 600–700 up to y = 380, a ladder against its west face. */
function towerMask(): Mask {
  const width = 1200;
  const height = 600;
  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let m: number = y >= 500 ? Material.Earth : Material.Air;
      if (x >= 600 && x < 700 && y >= 380 && y < 500) m = Material.BuiltStone;
      if (x >= 590 && x < 594 && y >= 380 && y < 500) m = Material.Ladder;
      data[y * width + x] = m;
    }
  }
  return { width, height, data };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { kitchen, burn, crates, beasts, barrels, deluge, ...BASE } = CLASSIC_RULES;
const RULES: MatchRules = { ...BASE, unit: { ...BASE.unit, moveBudget: 2000 } };

function start(x: number, rules: MatchRules = RULES): Sim {
  const sim = new Sim({ rules, teams: [{ spawns: [x] }, { spawns: [1100] }] }, 1, towerMask());
  for (let i = 0; i < 2000 && sim.view().turn.phase !== 'action'; i++) sim.step();
  return sim;
}

function hold(sim: Sim, cmd: GameCommand, ticks: number): void {
  sim.step([cmd]);
  for (let i = 0; i < ticks; i++) sim.step();
}

const unit = (sim: Sim) => {
  const u = sim.view().units[0];
  if (!u) throw new Error('no unit');
  return {
    x: u.x >> 8,
    y: u.y >> 8,
    climbing: u.climbing === true,
    grounded: u.grounded,
    hp: u.hp,
  };
};

describe('ladders (GDD §4.4)', () => {
  it('are climbed up to the top, where the unit steps onto the tower unhurt', () => {
    const sim = start(578);
    hold(sim, { t: 'climb', dir: -1 }, 200);
    const u = unit(sim);
    expect(u.climbing).toBe(false);
    expect(u.grounded).toBe(true);
    expect(u.y).toBe(380);
    expect(u.x).toBeGreaterThanOrEqual(587);
    expect(u.hp).toBe(100);
  });

  it('hold the unit where it stops, and are climbed down to the ground', () => {
    const sim = start(578);
    hold(sim, { t: 'climb', dir: -1 }, 40);
    sim.step([{ t: 'climb', dir: 0 }]);
    const mid = unit(sim);
    expect(mid.climbing).toBe(true);
    expect(mid.y).toBeLessThan(470);
    for (let i = 0; i < 60; i++) sim.step();
    expect(unit(sim).y).toBe(mid.y); // no fall while clinging
    hold(sim, { t: 'climb', dir: 1 }, 120);
    const u = unit(sim);
    expect(u.y).toBe(500);
    expect(u.climbing).toBe(false);
  });

  it('are climbed down from the top of the tower', () => {
    const sim = start(578);
    hold(sim, { t: 'climb', dir: -1 }, 200);
    hold(sim, { t: 'climb', dir: 1 }, 200);
    const u = unit(sim);
    expect(u.y).toBe(500);
    expect(u.x).toBeLessThan(600);
  });

  it('cost the walk of the turn, and forbid the jump after', () => {
    const rules: MatchRules = { ...BASE, unit: { ...BASE.unit, moveBudget: 50 } };
    const sim = start(578, rules);
    hold(sim, { t: 'climb', dir: -1 }, 200);
    // 50 px of walk buy 100 px of ladder (climbCostPct 50).
    expect(unit(sim).y).toBe(400);
    expect(sim.view().turn.moveLeft).toBe(0);
  });

  it('cannot be climbed away from them, nor without the rule', () => {
    const away = start(400);
    hold(away, { t: 'climb', dir: -1 }, 60);
    expect(unit(away).y).toBe(500);
    const { climbSpeed, ...old } = RULES.unit;
    expect(climbSpeed).toBeDefined();
    const sim = start(578, { ...RULES, unit: old });
    hold(sim, { t: 'climb', dir: -1 }, 60);
    expect(unit(sim).y).toBe(500);
  });

  it('let go when walking off, and the unit falls', () => {
    const sim = start(578);
    hold(sim, { t: 'climb', dir: -1 }, 60);
    sim.step([{ t: 'climb', dir: 0 }]);
    // Turning round first (turnTicks), then a few steps off the ladder.
    hold(sim, { t: 'move', dir: -1 }, 20);
    sim.step([{ t: 'move', dir: 0 }]);
    for (let i = 0; i < 120; i++) sim.step();
    expect(unit(sim).y).toBe(500);
  });

  it('are grabbed from a unit width away, the unit stepping to the ladder', () => {
    // Ladder at 590–594: a body centre at 552 is 24 px from the body's side to it.
    const sim = start(552);
    hold(sim, { t: 'climb', dir: -1 }, 30);
    const u = unit(sim);
    expect(u.climbing).toBe(true);
    expect(u.x).toBeGreaterThan(575);
    expect(u.y).toBeLessThan(500);
    // Without the tolerance (older logs), the same spot is too far.
    const { ladderReach, ...old } = RULES.unit;
    expect(ladderReach).toBe(28);
    const far = start(552, { ...RULES, unit: old });
    hold(far, { t: 'climb', dir: -1 }, 30);
    expect(unit(far).y).toBe(500);
  });

  it('let the unit hoisted on top stay there while ↑ is still held, without spending the walk', () => {
    const sim = start(578);
    hold(sim, { t: 'climb', dir: -1 }, 200);
    const left = sim.view().turn.moveLeft;
    for (let i = 0; i < 100; i++) sim.step();
    expect(unit(sim).climbing).toBe(false);
    expect(unit(sim).y).toBe(380);
    expect(sim.view().turn.moveLeft).toBe(left);
  });

  it('stop a walk on top at the edge above the ladder, then take it down', () => {
    const sim = start(578);
    hold(sim, { t: 'climb', dir: -1 }, 200);
    sim.step([{ t: 'climb', dir: 0 }]);
    hold(sim, { t: 'move', dir: 1 }, 40);
    sim.step([{ t: 'move', dir: 0 }]);
    expect(unit(sim).x).toBeGreaterThan(620);
    hold(sim, { t: 'move', dir: -1 }, 120);
    sim.step([{ t: 'move', dir: 0 }]);
    for (let i = 0; i < 30; i++) sim.step();
    const edge = unit(sim);
    expect(edge.y).toBe(380);
    expect(edge.grounded).toBe(true);
    hold(sim, { t: 'climb', dir: 1 }, 250);
    expect(unit(sim).y).toBe(500);
  });
});
