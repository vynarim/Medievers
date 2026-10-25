import { describe, expect, it } from 'vitest';
import { DELUGE_RULES } from '../../src/content/deluge.ts';
import { Material, Sim, type Mask, type MatchConfig } from '../../src/sim/index.ts';
import { CLASSIC_RULES } from '../rules-fixture.ts';

function flatMask(): Mask {
  const width = 1200;
  const height = 600;
  const data = new Uint8Array(width * height);
  for (let y = 480; y < height; y++) data.fill(Material.Earth, y * width, (y + 1) * width);
  return { width, height, data };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { kitchen, crates, beasts, barrels, burn, ...RULES } = CLASSIC_RULES;

/**
 * The last enemy, at 1 HP, takes an arrow; the archer has 5 HP left, and the Déluge, which
 * begins at the first turn's end, would take 10 from everyone.
 */
function lastShot(instantWin: boolean): Sim {
  const config: MatchConfig = {
    rules: {
      ...RULES,
      wind: { ...RULES.wind, max: 0 },
      deluge: { ...DELUGE_RULES, startTurn: 0, damage: 10 },
      turn: { ...RULES.turn, instantWin },
    },
    teams: [{ spawns: [300] }, { spawns: [420] }],
  };
  const sim = new Sim(config, 7, flatMask());
  const snap = sim.snapshot();
  const [archer, enemy] = snap.units;
  if (archer) archer.hp = 5;
  if (enemy) enemy.hp = 1;
  sim.restore(snap);
  for (let i = 0; i < 2000 && sim.view().turn.phase !== 'action'; i++) sim.step([]);
  expect(sim.view().turn.activeTeam).toBe(0);
  sim.step([
    { t: 'aim', angle: 0 },
    { t: 'fire', power: 1024 },
  ]);
  for (let i = 0; i < 6000 && sim.view().turn.phase !== 'gameOver'; i++) sim.step([]);
  return sim;
}

describe('the last house standing (rules.turn.instantWin, 2026-10-25)', () => {
  it('wins as soon as the last enemy falls, before the end-of-turn effects', () => {
    const sim = lastShot(true);
    expect(sim.view().turn.phase).toBe('gameOver');
    expect(sim.view().winner).toBe(0);
    expect(sim.view().units[0]?.hp).toBe(5);
  });

  it('used to call the winner after them: the Déluge made it a draw (older logs)', () => {
    const sim = lastShot(false);
    expect(sim.view().winner).toBe(-1);
  });
});
