import { describe, expect, it } from 'vitest';
import { CLASSIC_RULES, type MatchRules, type TurnRules } from '../../src/content/rules.ts';
import {
  LOG_VERSION,
  Material,
  Sim,
  replay,
  type GameCommand,
  type GameLog,
  type Mask,
  type MatchConfig,
  type SimEvent,
  type TimedCommand,
} from '../../src/sim/index.ts';

/** 1200 × 600 flat map, ground at y = 500. */
function flatMask(): Mask {
  const width = 1200;
  const height = 600;
  const data = new Uint8Array(width * height);
  for (let y = 500; y < height; y++) data.fill(Material.Earth, y * width, (y + 1) * width);
  return { width, height, data };
}

const RULES_60HP: MatchRules = { ...CLASSIC_RULES, startHp: 60 };

/** Two teams facing each other, 120 px apart: a level bow shot always connects. */
const DUEL: MatchConfig = { rules: RULES_60HP, teams: [{ spawns: [300] }, { spawns: [420] }] };

/** Drives a Sim tick by tick and records every command into a replayable log. */
class Driver {
  readonly sim: Sim;
  readonly commands: TimedCommand[] = [];
  readonly events: SimEvent[] = [];
  readonly config: MatchConfig;
  readonly seed: number;

  constructor(config: MatchConfig, seed: number) {
    this.config = config;
    this.seed = seed;
    this.sim = new Sim(config, seed, flatMask());
  }

  step(cmds: GameCommand[] = []): void {
    const tick = this.sim.view().tick + 1;
    for (const c of cmds) this.commands.push([tick, c]);
    this.events.push(...this.sim.step(cmds));
  }

  /** Steps until the phase is reached (or the game ends). */
  until(phase: string, max = 20000): void {
    for (let i = 0; i < max; i++) {
      const p = this.sim.view().turn.phase;
      if (p === phase || p === 'gameOver') return;
      this.step();
    }
    throw new Error(`phase ${phase} never reached`);
  }

  log(): GameLog {
    return {
      version: LOG_VERSION,
      config: this.config,
      seed: this.seed,
      mapId: 'test-flat',
      commands: this.commands,
      endTick: this.sim.view().tick,
    };
  }
}

const unit = (d: Driver, id: number) => {
  const u = d.sim.view().units.find((x) => x.id === id);
  if (!u) throw new Error(`no unit ${id}`);
  return u;
};

describe('turn loop', () => {
  it('plays a scripted 3-turn duel to the end', () => {
    const d = new Driver(DUEL, 7);
    const v = () => d.sim.view();

    // Turn 1: team 0 shoots level at team 1.
    d.until('action');
    expect([v().turn.number, v().turn.activeTeam, v().turn.activeUnitId]).toEqual([1, 0, 1]);
    d.step([
      { t: 'aim', angle: 0 },
      { t: 'fire', power: 1024 },
    ]);
    expect(v().turn.phase).toBe('retreat');
    d.until('resolution');
    d.until('transition');
    expect(unit(d, 2).hp).toBe(60 - 35);

    // Turn 2: team 1 passes.
    d.until('action');
    expect([v().turn.number, v().turn.activeTeam]).toEqual([2, 1]);
    d.step([{ t: 'skip' }]);
    d.until('transition');

    // Turn 3: team 0 finishes the job.
    d.until('action');
    expect(v().turn.number).toBe(3);
    d.step([
      { t: 'aim', angle: 0 },
      { t: 'fire', power: 1024 },
    ]);
    d.until('gameOver');

    expect(v().winner).toBe(0);
    expect(unit(d, 2).alive).toBe(false);
    expect(d.events).toContainEqual({ e: 'unitDied', unitId: 2, cause: 'hp' });
    expect(d.events).toContainEqual({ e: 'gameOver', winner: 0 });
  });

  it('uses the phase durations of the rules', () => {
    const d = new Driver(DUEL, 1);
    d.until('action');
    expect(d.sim.view().tick).toBe(CLASSIC_RULES.turn.transitionTicks);
    d.until('resolution');
    expect(d.sim.view().tick).toBe(
      CLASSIC_RULES.turn.transitionTicks + CLASSIC_RULES.turn.actionTicks,
    );
  });

  it('gives the retreat time after a shot', () => {
    const d = new Driver(DUEL, 1);
    d.until('action');
    d.step([
      { t: 'aim', angle: 3072 },
      { t: 'fire', power: 100 },
    ]);
    const fired = d.sim.view().tick;
    d.until('resolution');
    expect(d.sim.view().tick - fired).toBe(CLASSIC_RULES.turn.retreatTicks);
  });

  it('ignores actions outside the action phase and moves only while allowed', () => {
    const d = new Driver(DUEL, 1);
    d.step([
      { t: 'fire', power: 1024 },
      { t: 'move', dir: 1 },
    ]);
    expect(d.sim.view().shots).toHaveLength(0);
    expect(d.sim.view().turn.walkDir).toBe(0);
    d.until('action');
    const x0 = unit(d, 1).x;
    d.step([{ t: 'move', dir: -1 }]);
    for (let i = 0; i < 9; i++) d.step();
    expect(unit(d, 1).x).toBe(x0 - 10 * 384);
    d.step([{ t: 'move', dir: 0 }]);
    const x1 = unit(d, 1).x;
    d.step();
    expect(unit(d, 1).x).toBe(x1);
  });

  it('rotates through the units of each team', () => {
    const config: MatchConfig = {
      rules: CLASSIC_RULES,
      teams: [{ spawns: [100, 200] }, { spawns: [900, 1000] }],
    };
    const d = new Driver(config, 3);
    const order: number[] = [];
    for (let turn = 0; turn < 5; turn++) {
      d.until('action');
      order.push(d.sim.view().turn.activeUnitId);
      d.step([{ t: 'skip' }]);
      d.until('transition');
    }
    expect(order).toEqual([1, 3, 2, 4, 1]);
  });

  it('draws a wind in [-10, 10] at each turn', () => {
    const d = new Driver(DUEL, 99);
    const winds = new Set<number>();
    for (let turn = 0; turn < 30; turn++) {
      d.until('action');
      winds.add(d.sim.view().turn.wind);
      d.step([{ t: 'skip' }]);
      d.until('transition');
    }
    for (const w of winds) expect(Math.abs(w)).toBeLessThanOrEqual(10);
    expect(winds.size).toBeGreaterThan(5);
  });

  it('hurts teammates: friendly fire is always on', () => {
    const config: MatchConfig = {
      rules: RULES_60HP,
      teams: [{ spawns: [300, 420] }, { spawns: [1000] }],
    };
    // A level arrow into the teammate 120 px away.
    const arrow = new Driver(config, 7);
    arrow.until('action');
    arrow.step([
      { t: 'aim', angle: 0 },
      { t: 'fire', power: 1024 },
    ]);
    arrow.until('transition');
    expect(unit(arrow, 2).hp).toBe(60 - 35);
    // A pot dropped between the two units of team 0 hurts both.
    const pot = new Driver({ ...config, teams: [{ spawns: [300, 330] }, { spawns: [1000] }] }, 7);
    pot.until('action');
    pot.step([
      { t: 'selectWeapon', id: 'greekFire' },
      { t: 'setFuse', seconds: 1 },
      { t: 'aim', angle: 1024 },
      { t: 'fire', power: 0 },
    ]);
    pot.until('transition');
    expect(unit(pot, 1).hp).toBeLessThan(60);
    expect(unit(pot, 2).hp).toBeLessThan(60);
  });

  it('pauses settleTicks at rest before the next turn, deaths called first', () => {
    const d = new Driver(DUEL, 7);
    d.until('action');
    d.step([{ t: 'skip' }]);
    const rested = d.sim.view().tick;
    d.until('transition');
    expect(d.sim.view().tick - rested).toBe(RULES_60HP.turn.settleTicks);
    // Without settleTicks (logs recorded before the rule existed), the turn ends at once.
    const oldTurn: TurnRules = { ...RULES_60HP.turn };
    delete (oldTurn as { settleTicks?: number }).settleTicks;
    const old = new Driver({ ...DUEL, rules: { ...RULES_60HP, turn: oldTurn } }, 7);
    old.until('action');
    old.step([{ t: 'skip' }]);
    const at = old.sim.view().tick;
    old.until('transition');
    expect(old.sim.view().tick - at).toBe(0);
  });

  it('ends the turn at once when the active unit hurts itself', () => {
    const d = new Driver(DUEL, 1);
    d.until('action');
    // A pot dropped at its own feet with a 1 s fuse.
    d.step([
      { t: 'selectWeapon', id: 'greekFire' },
      { t: 'setFuse', seconds: 1 },
      { t: 'aim', angle: 1024 },
      { t: 'fire', power: 0 },
    ]);
    d.until('resolution');
    expect(unit(d, 1).hp).toBeLessThan(60);
    expect(d.events.some((e) => e.e === 'explosion')).toBe(true);
  });
});

describe('determinism', () => {
  function scriptedGame(seed: number): Driver {
    const config: MatchConfig = {
      rules: CLASSIC_RULES,
      teams: [{ spawns: [150, 350] }, { spawns: [800, 1000] }],
    };
    const d = new Driver(config, seed);
    for (let turn = 0; turn < 6; turn++) {
      d.until('action');
      const team = d.sim.view().turn.activeTeam;
      d.step([{ t: 'move', dir: team === 0 ? 1 : -1 }]);
      for (let i = 0; i < 40; i++) d.step();
      d.step([
        { t: 'move', dir: 0 },
        { t: 'selectWeapon', id: turn % 2 ? 'greekFire' : 'sling' },
        { t: 'aim', angle: team === 0 ? 3700 : 2450 },
        { t: 'fire', power: 700 + turn * 40 },
      ]);
      d.until('transition');
    }
    return d;
  }

  it('gives the same hash for the same seed and commands', () => {
    expect(scriptedGame(5).sim.hash()).toBe(scriptedGame(5).sim.hash());
  });

  it('gives a different hash for another seed', () => {
    expect(scriptedGame(5).sim.hash()).not.toBe(scriptedGame(6).sim.hash());
  });

  it('replays a recorded log to the same hash', () => {
    const d = scriptedGame(11);
    expect(replay(d.log(), flatMask()).hash()).toBe(d.sim.hash());
  });

  it('snapshot, N steps, restore, N steps gives the same hash', () => {
    const d = scriptedGame(13);
    const snap = d.sim.snapshot();
    const cmds: GameCommand[][] = [[{ t: 'skip' }], [], [{ t: 'move', dir: 1 }]];
    const run = (): number => {
      for (let i = 0; i < 600; i++) d.sim.step(cmds[i % 3] ?? []);
      return d.sim.hash();
    };
    const first = run();
    d.sim.restore(snap);
    expect(run()).toBe(first);
  });

  it('keeps snapshots independent from the live state', () => {
    const d = scriptedGame(17);
    const snap = d.sim.snapshot();
    const h = d.sim.hash();
    for (let i = 0; i < 200; i++) d.sim.step();
    d.sim.restore(snap);
    expect(d.sim.hash()).toBe(h);
  });

  it('changes the hash when any part of the state changes', () => {
    const d = scriptedGame(19);
    const before = d.sim.hash();
    d.sim.step();
    expect(d.sim.hash()).not.toBe(before);
  });
});
