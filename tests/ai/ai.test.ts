import { describe, expect, it } from 'vitest';
import { AiController } from '../../src/ai/controller.ts';
import { asSeen, planTurn } from '../../src/ai/plan.ts';
import { Sandbox } from '../../src/ai/sandbox.ts';
import { SANDBOX_PACE, TurnScript, type AiPlan } from '../../src/ai/script.ts';
import { buildMap } from '../../src/app/map-build.ts';
import { defaultSetup, matchConfig, rulesFor } from '../../src/app/match-setup.ts';
import { AI_LEVELS, type AiLevel } from '../../src/content/ai.ts';
import { MAP_THEMES } from '../../src/content/maps.ts';
import { Material, Sim, type Mask, type MatchConfig, type SimState } from '../../src/sim/index.ts';
import { CLASSIC_RULES, type MatchRules } from '../rules-fixture.ts';

/** 2000 × 800 flat map, ground at y = 600. */
function flatMask(): Mask {
  const width = 2000;
  const height = 800;
  const data = new Uint8Array(width * height);
  for (let y = 600; y < height; y++) data.fill(Material.Earth, y * width, (y + 1) * width);
  return { width, height, data };
}

// No wind, no beasts nor reliquaries nor kitchen: what is tested is the aim alone.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { kitchen, crates, beasts, barrels, burn, weather, deluge, ...CALM } = CLASSIC_RULES;
const RULES: MatchRules = { ...CALM, wind: { ...CLASSIC_RULES.wind, max: 0 } };

function duel(left: number, right: number): Sim {
  const config: MatchConfig = { rules: RULES, teams: [{ spawns: [left] }, { spawns: [right] }] };
  const sim = new Sim(config, 3, flatMask());
  for (let i = 0; i < 1000 && sim.view().turn.phase !== 'action'; i++) sim.step();
  return sim;
}

/** Plays `plan` on `sim` with the sandbox pace until the turn changes. */
function playOut(sim: Sim, plan: AiPlan): void {
  const script = new TurnScript(plan, SANDBOX_PACE);
  const turn = sim.view().turn.number;
  for (let i = 0; i < 3000 && sim.view().turn.number === turn; i++) {
    sim.step(script.next(sim.view()));
  }
}

const STILL: AiLevel = { ...AI_LEVELS.constable, angleNoise: 0, powerNoisePct: 0 };

describe('the AI sandbox', () => {
  it('loads the same match every time, whatever was played in it before', () => {
    const sim = duel(400, 1400);
    const box = new Sandbox(sim.snapshot());
    const a = box.load();
    expect(a.hash()).toBe(sim.hash());
    a.step([
      { t: 'aim', angle: 3584 },
      { t: 'fire', power: 900 },
    ]);
    for (let i = 0; i < 400; i++) a.step();
    expect(a.hash()).not.toBe(sim.hash());
    expect(box.load().hash()).toBe(sim.hash());
  });

  it('goes on from a state taken over by Sim.fromState', () => {
    const sim = duel(400, 1400);
    const copy = Sim.fromState(sim.snapshot());
    sim.step([{ t: 'move', dir: 1 }]);
    copy.step([{ t: 'move', dir: 1 }]);
    expect(copy.hash()).toBe(sim.hash());
  });
});

describe('the AI turn (GDD §7.2)', () => {
  it('hits a target in range, nine times out of ten at the level Connétable (BACKLOG 5.3)', () => {
    let hits = 0;
    const distances = [300, 420, 540, 660, 780, 900, 1020, 640, 500, 860];
    distances.forEach((d, i) => {
      const sim = duel(300, 300 + d);
      const enemy = sim.view().units.find((u) => u.team === 1);
      const hp = enemy?.hp ?? 0;
      const { plan } = planTurn({
        state: sim.snapshot(),
        team: 0,
        level: AI_LEVELS.constable,
        seed: 100 + i,
      });
      playOut(sim, plan);
      if ((sim.view().units.find((u) => u.team === 1)?.hp ?? hp) < hp) hits++;
    });
    expect(hits).toBeGreaterThanOrEqual(9);
  }, 60_000);

  it('walks to within reach of an enemy it cannot otherwise touch (BACKLOG 5.2)', () => {
    // A wall in front: nothing flies over it from where the unit stands.
    const mask = flatMask();
    for (let y = 300; y < 600; y++) mask.data.fill(Material.Rock, y * 2000 + 700, y * 2000 + 740);
    const config: MatchConfig = { rules: RULES, teams: [{ spawns: [640] }, { spawns: [900] }] };
    const sim = new Sim(config, 3, mask);
    for (let i = 0; i < 1000 && sim.view().turn.phase !== 'action'; i++) sim.step();
    const { plan } = planTurn({ state: sim.snapshot(), team: 0, level: STILL, seed: 1 });
    expect(plan.shot).not.toBeNull();
    const hp = sim.view().units.find((u) => u.team === 1)?.hp ?? 0;
    playOut(sim, plan);
    expect(sim.view().units.find((u) => u.team === 1)?.hp ?? hp).toBeLessThan(hp);
  });

  it('does not shoot its own side: no throw that hurts an ally more than the enemy', () => {
    // An ally stands right before the enemy: a blast there would hurt both.
    const config: MatchConfig = {
      rules: RULES,
      teams: [{ spawns: [300, 980] }, { spawns: [1000] }],
    };
    const sim = new Sim(config, 3, flatMask());
    for (let i = 0; i < 1000 && sim.view().turn.phase !== 'action'; i++) sim.step();
    const before = sim.view().units.map((u) => u.hp);
    const { plan } = planTurn({ state: sim.snapshot(), team: 0, level: STILL, seed: 1 });
    playOut(sim, plan);
    const after = sim.view().units.map((u) => u.hp);
    const allyLoss = (before[1] ?? 0) - (after[1] ?? 0);
    const enemyLoss = (before[2] ?? 0) - (after[2] ?? 0);
    expect(allyLoss).toBeLessThanOrEqual(enemyLoss);
  });

  it('does not see the enemy chausse-trapes (no cheating, GDD §7.3)', () => {
    const sim = duel(400, 1400);
    const state = sim.snapshot() as SimState;
    const mine = (id: number, team: number) =>
      ({ id, team, x: 500 * 256, y: 600 * 256, arm: 0, weapon: 'caltrop' }) as const;
    state.mines.push(mine(98, 0), mine(99, 1));
    expect(asSeen(state, 0).mines.map((m) => m.id)).toEqual([98]);
    // The match it was given is left as it was: the AI plays in its own copy.
    expect(state.mines.map((m) => m.id)).toEqual([98, 99]);
  });
});

describe('the AI script', () => {
  it('walks its unit to a point a walk away, on every map theme (BACKLOG 5.2)', () => {
    for (const theme of MAP_THEMES) {
      const setup = defaultSetup(false);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { placementTicks, ...turn } = rulesFor(setup, {}).turn;
      const rules = { ...rulesFor(setup, {}), turn };
      const built = buildMap(theme, 5);
      const sim = new Sim(matchConfig(built, setup, rules), 5, built.mask);
      for (let i = 0; i < 3000 && sim.view().turn.phase !== 'action'; i++) sim.step();
      const v = sim.view();
      const u = v.units.find((x) => x.id === v.turn.activeUnitId);
      const x0 = (u?.x ?? 0) >> 8;
      // Towards the middle of the map, 120 px.
      const target = x0 + (x0 < v.terrain.width / 2 ? 120 : -120);
      const plan: AiPlan = {
        unitId: v.turn.activeUnitId,
        move: { kind: 'walk', x: target },
        shot: null,
      };
      const script = new TurnScript(plan, SANDBOX_PACE);
      for (let i = 0; i < 600 && !script.moved; i++) sim.step(script.next(sim.view()));
      const x = (sim.view().units.find((w) => w.id === plan.unitId)?.x ?? 0) >> 8;
      expect(Math.abs(x - target)).toBeLessThanOrEqual(4);
    }
  });
});

describe('the AI controller', () => {
  it('places its units and plays whole turns, house against house, on every map theme', () => {
    for (const theme of MAP_THEMES) {
      const setup = defaultSetup(false);
      const rules = rulesFor(setup, {});
      const built = buildMap(theme, 11);
      const sim = new Sim(matchConfig(built, setup, rules), 11, built.mask);
      const ctrl = new AiController({
        levels: new Map([
          [0, AI_LEVELS.squire],
          [1, AI_LEVELS.squire],
        ]),
        seed: 11,
        planner: planTurn,
        pace: SANDBOX_PACE,
        ticksPerSecond: 0,
      });
      let shots = 0;
      for (let tick = 1; tick < 60 * 60 * 6 && sim.view().turn.number <= 4; tick++) {
        for (const e of sim.step(ctrl.poll(tick, sim.view()))) if (e.e === 'shotFired') shots++;
      }
      expect(sim.view().turn.number).toBeGreaterThan(4);
      expect(shots).toBeGreaterThan(0);
    }
  }, 120_000);
});
