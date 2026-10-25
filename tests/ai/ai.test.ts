import { describe, expect, it } from 'vitest';
import { AiController } from '../../src/ai/controller.ts';
import { asSeen, planTurn, throwAtDragon } from '../../src/ai/plan.ts';
import { Sandbox } from '../../src/ai/sandbox.ts';
import { SANDBOX_PACE, TurnScript, type AiPlan } from '../../src/ai/script.ts';
import { buildMap } from '../../src/app/map-build.ts';
import { defaultSetup, matchConfig, rulesFor } from '../../src/app/match-setup.ts';
import { AI_LEVELS, type AiLevel } from '../../src/content/ai.ts';
import { DRAGON_RULES } from '../../src/content/dragon.ts';
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

  it('finds a throw through the dragon crossing the sky (GDD §4.11)', () => {
    const rules: MatchRules = { ...RULES, dragon: { ...DRAGON_RULES, spawnPermille: 0 } };
    const config: MatchConfig = { rules, teams: [{ spawns: [300] }, { spawns: [1900] }] };
    const sim = new Sim(config, 3, flatMask());
    for (let i = 0; i < 1000 && sim.view().turn.phase !== 'action'; i++) sim.step();
    const snap = sim.snapshot();
    snap.dragon = {
      id: 900,
      x: 200 * 256,
      y: 380 * 256,
      dir: 1,
      prey: 0,
      fed: false,
      born: snap.tick,
    };
    sim.restore(snap);
    const v = sim.view();
    const u = v.units[0];
    const bow = v.rules.weapons.find((w) => w.id === 'bow');
    const shot = u && bow ? throwAtDragon(v, u, bow, STILL) : null;
    expect(shot).not.toBeNull();
    const events: string[] = [];
    const script = new TurnScript({ unitId: 1, move: { kind: 'stay' }, shot }, SANDBOX_PACE);
    for (let i = 0; i < 400; i++) {
      for (const e of sim.step(script.next(sim.view()))) events.push(e.e);
    }
    expect(events).toContain('dragonEnraged');
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

describe('the AI rope', () => {
  it('climbs out of a pit too deep to jump out of (« Grimper »)', () => {
    // A shaft 32 px wide and 180 px deep in the flat ground, the unit at its bottom.
    const mask = flatMask();
    for (let y = 600; y < 780; y++) mask.data.fill(Material.Air, y * 2000 + 384, y * 2000 + 416);
    const config: MatchConfig = { rules: RULES, teams: [{ spawns: [400] }, { spawns: [1400] }] };
    const sim = new Sim(config, 3, mask);
    for (let i = 0; i < 1000 && sim.view().turn.phase !== 'action'; i++) sim.step();
    expect((sim.view().units[0]?.y ?? 0) >> 8).toBe(780);
    const plan: AiPlan = { unitId: 1, move: { kind: 'rope', dir: -1, face: 1 }, shot: null };
    playOut(sim, plan);
    expect((sim.view().units[0]?.y ?? 0) >> 8).toBe(600);
  });

  it('plays the arsenal of lot 6: a shield charge, a ladder, a banner, a miracle', () => {
    const px = (sim: Sim, id: number, k: 'x' | 'y') =>
      (sim.view().units.find((u) => u.id === id)?.[k] ?? 0) >> 8;
    // Charge: the enemy 80 px to the right is thrown over.
    const charge = duel(400, 480);
    playOut(charge, {
      unitId: 1,
      move: { kind: 'stay' },
      shot: { weapon: 'shieldCharge', angle: 0, power: 1024 },
    });
    expect(charge.view().units.find((u) => u.id === 2)?.hp).toBe(80);

    // Ladder: up a rock cliff 140 px high, without a rope to throw.
    const mask = flatMask();
    for (let y = 460; y < 600; y++) mask.data.fill(Material.Rock, y * 2000 + 460, y * 2000 + 900);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { wallClimb, ...unitNoRope } = RULES.unit;
    const noRope: MatchRules = { ...RULES, unit: unitNoRope };
    const config: MatchConfig = { rules: noRope, teams: [{ spawns: [420] }, { spawns: [1400] }] };
    const ladder = new Sim(config, 3, mask);
    for (let i = 0; i < 1000 && ladder.view().turn.phase !== 'action'; i++) ladder.step();
    playOut(ladder, { unitId: 1, move: { kind: 'ladder', face: 1 }, shot: null });
    expect(px(ladder, 1, 'y')).toBe(460);

    // Banner: a jump off the cliff's edge, unhurt.
    const cliff = new Sim(
      { rules: RULES, teams: [{ spawns: [880] }, { spawns: [1400] }] },
      3,
      mask,
    );
    for (let i = 0; i < 1000 && cliff.view().turn.phase !== 'action'; i++) cliff.step();
    playOut(cliff, {
      unitId: 1,
      move: { kind: 'jump', jump: 'forward', dir: 1, banner: true },
      shot: null,
    });
    expect(px(cliff, 1, 'y')).toBe(600);
    expect(cliff.view().units.find((u) => u.id === 1)?.hp).toBe(100);

    // Flaming pig: let loose and set off by the enemy.
    const pig = duel(400, 800);
    const { plan } = planTurn({
      state: pig.snapshot(),
      team: 0,
      level: { ...STILL, weapons: ['flamingPig'] },
      seed: 1,
    });
    expect(plan.shot?.weapon).toBe('flamingPig');
    expect(plan.shot?.detonate).toBeGreaterThan(0);
    playOut(pig, plan);
    expect(pig.view().units.find((u) => u.id === 2)?.hp ?? 100).toBeLessThan(50);

    // Beehive and falcon, each alone in the level's arsenal: both hurt the enemy.
    for (const weapon of ['beehive', 'falcon'] as const) {
      const sim = duel(400, 900);
      const res = planTurn({
        state: sim.snapshot(),
        team: 0,
        level: { ...STILL, weapons: [weapon] },
        seed: 1,
      });
      expect(res.plan.shot?.weapon).toBe(weapon);
      playOut(sim, res.plan);
      expect(sim.view().units.find((u) => u.id === 2)?.hp ?? 100).toBeLessThan(100);
    }

    // Grapple: out of a shaft 300 px deep, hoisted at its lip.
    const shaft = flatMask();
    const deep: Mask = { width: 2000, height: 1000, data: new Uint8Array(2000 * 1000) };
    deep.data.set(shaft.data);
    for (let y = 800; y < 1000; y++) deep.data.fill(Material.Earth, y * 2000, (y + 1) * 2000);
    for (let y = 600; y < 900; y++) deep.data.fill(Material.Air, y * 2000 + 380, y * 2000 + 420);
    const pit = new Sim({ rules: RULES, teams: [{ spawns: [400] }, { spawns: [1400] }] }, 3, deep);
    for (let i = 0; i < 1000 && pit.view().turn.phase !== 'action'; i++) pit.step();
    expect(px(pit, 1, 'y')).toBe(900);
    // With the bow only: the falcon would fly up out of the pit and strike first.
    const out = planTurn({
      state: pit.snapshot(),
      team: 0,
      level: { ...STILL, weapons: ['bow'] },
      seed: 1,
    });
    expect(out.plan.move.kind).toBe('grapple');
    playOut(pit, out.plan);
    expect(px(pit, 1, 'y')).toBe(600);

    // Siege engines: it walks to the catapult a little way off and shoots with it.
    const engines = new Sim(
      {
        rules: RULES,
        teams: [{ spawns: [400] }, { spawns: [1300] }],
        engines: [{ id: 200, type: 'catapult', x: 560 }],
      },
      3,
      flatMask(),
    );
    for (let i = 0; i < 1000 && engines.view().turn.phase !== 'action'; i++) engines.step();
    const siege = planTurn({
      state: engines.snapshot(),
      team: 0,
      level: { ...STILL, weapons: ['catapult'] },
      seed: 1,
    });
    expect(siege.plan.move.kind).toBe('walk');
    expect(siege.plan.shot?.weapon).toBe('catapult');
    playOut(engines, siege.plan);
    expect(engines.view().units.find((u) => u.id === 2)?.hp ?? 100).toBeLessThan(100);

    // Miracle: up onto the cliff, from the plain.
    const miracle = duel(300, 1400);
    playOut(miracle, { unitId: 1, move: { kind: 'miracle', x: 1000, y: 400 }, shot: null });
    expect(px(miracle, 1, 'x')).toBe(1000);
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
