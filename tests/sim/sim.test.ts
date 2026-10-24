import { describe, expect, it } from 'vitest';
import { CLASSIC_RULES, type MatchRules, type TurnRules } from '../rules-fixture.ts';
import {
  LOG_VERSION,
  Material,
  Sim,
  canSwitchUnit,
  nextTeammate,
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

// No field kitchen in the scripted duels: it would stand between the two units.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { kitchen, crates, beasts, barrels, ...NO_KITCHEN } = CLASSIC_RULES;
const RULES_60HP: MatchRules = { ...NO_KITCHEN, startHp: 60 };

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

  it('keeps the time left after a shot; « Fin du tour » ends it; no moves left ends it', () => {
    const d = new Driver(DUEL, 1);
    d.until('action');
    const left = d.sim.view().turn.phaseTicks;
    d.step([
      { t: 'aim', angle: 3072 },
      { t: 'fire', power: 100 },
    ]);
    expect(d.sim.view().turn.phase).toBe('retreat');
    // The walk not used yet is still there after the shot, and the time to use it.
    expect(d.sim.view().turn.phaseTicks).toBeGreaterThanOrEqual(left - 2);
    d.step([{ t: 'skip' }]);
    expect(d.sim.view().turn.phase).toBe('resolution');

    // Walk the whole budget, fire: the turn ends once the shot is over.
    const w = new Driver({ ...DUEL, teams: [{ spawns: [300] }, { spawns: [1000] }] }, 1);
    w.until('action');
    w.step([{ t: 'move', dir: -1 }]);
    while (w.sim.view().turn.moveLeft > 0) w.step();
    w.step([
      { t: 'move', dir: 0 },
      { t: 'aim', angle: 3072 },
      { t: 'fire', power: 100 },
    ]);
    for (let i = 0; i < 600 && w.sim.view().turn.phase === 'retreat'; i++) w.step();
    expect(w.sim.view().turn.phase).not.toBe('retreat');
  });

  it('caps the time after the shot with retreatMaxTicks, when a scheme sets it', () => {
    const turn: TurnRules = { ...RULES_60HP.turn, retreatMaxTicks: 300 };
    const d = new Driver({ ...DUEL, rules: { ...RULES_60HP, turn } }, 1);
    d.until('action');
    d.step([
      { t: 'aim', angle: 3072 },
      { t: 'fire', power: 100 },
    ]);
    expect(d.sim.view().turn.phaseTicks).toBe(300);
  });

  it('turns round on the spot for free: no walk spent, the jump stays', () => {
    const d = new Driver(DUEL, 1);
    d.until('action');
    const u0 = unit(d, 1);
    const x0 = u0.x;
    expect(u0.facing).toBe(1);
    // A short tap on ← : the unit faces left without moving.
    d.step([{ t: 'move', dir: -1 }]);
    for (let i = 0; i < 5; i++) d.step();
    d.step([{ t: 'move', dir: 0 }]);
    expect(unit(d, 1).facing).toBe(-1);
    expect(unit(d, 1).x).toBe(x0);
    expect(d.sim.view().turn.moveLeft).toBe((CLASSIC_RULES.unit.moveBudget ?? 0) * 256);
    d.step([{ t: 'jump', kind: 'forward' }]);
    expect(unit(d, 1).vx).toBeLessThan(0);
  });

  it('gives a fixed retreat time to logs recorded before moveAfterShot', () => {
    const turn: TurnRules = { ...RULES_60HP.turn };
    delete (turn as { moveAfterShot?: boolean }).moveAfterShot;
    const d = new Driver({ ...DUEL, rules: { ...RULES_60HP, turn } }, 1);
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
    // Facing right: it first turns round on the spot, then walks.
    const turn = CLASSIC_RULES.unit.turnTicks ?? 0;
    for (let i = 0; i < turn + 9; i++) d.step();
    expect(unit(d, 1).x).toBe(x0 - 10 * 384);
    d.step([{ t: 'move', dir: 0 }]);
    const x1 = unit(d, 1).x;
    d.step();
    expect(unit(d, 1).x).toBe(x1);
  });

  it('lets the team choose its unit before it acts, but not the one that played last', () => {
    const config: MatchConfig = {
      rules: CLASSIC_RULES,
      teams: [{ spawns: [100, 200] }, { spawns: [900, 1000] }],
    };
    const d = new Driver(config, 3);
    d.until('action');
    expect(d.sim.view().turn.activeUnitId).toBe(1);
    d.step([{ t: 'selectUnit', unitId: 2 }]);
    expect(d.sim.view().turn.activeUnitId).toBe(2);
    d.step([{ t: 'selectUnit', unitId: 3 }]); // not its team
    expect(d.sim.view().turn.activeUnitId).toBe(2);
    d.step([{ t: 'move', dir: 1 }]);
    d.step([
      { t: 'move', dir: 0 },
      { t: 'selectUnit', unitId: 1 },
    ]); // already moved
    expect(d.sim.view().turn.activeUnitId).toBe(2);
    d.step([{ t: 'skip' }]);
    d.until('action'); // team 1
    d.step([{ t: 'skip' }]);
    d.until('action'); // team 0 again: unit 2 played last, it rests
    expect(d.sim.view().turn.restingUnitId).toBe(2);
    expect(d.sim.view().turn.activeUnitId).toBe(1);
    d.step([{ t: 'selectUnit', unitId: 2 }]);
    expect(d.sim.view().turn.activeUnitId).toBe(1);
  });

  it('gives each unit back, at its next turn, the weapon it last chose', () => {
    const config: MatchConfig = {
      rules: CLASSIC_RULES,
      teams: [{ spawns: [100, 200, 300] }, { spawns: [900, 1000, 1100] }],
    };
    const d = new Driver(config, 3);
    d.until('action');
    expect(d.sim.view().turn.activeUnitId).toBe(1);
    expect(d.sim.view().turn.weapon).toBe('bow');
    d.step([{ t: 'selectWeapon', id: 'sling' }]);
    // Handing the turn to another unit hands it that unit's own weapon, and back.
    d.step([{ t: 'selectUnit', unitId: 2 }]);
    expect(d.sim.view().turn.weapon).toBe('bow');
    d.step([{ t: 'selectWeapon', id: 'greekFire' }]);
    d.step([{ t: 'selectUnit', unitId: 1 }]);
    expect(d.sim.view().turn.weapon).toBe('sling');
    d.step([{ t: 'skip' }]);
    d.until('action'); // house 1
    expect(d.sim.view().turn.weapon).toBe('bow');
    d.step([{ t: 'skip' }]);
    d.until('action'); // house 0: unit 1 rests, unit 2 plays with its Greek fire
    expect(d.sim.view().turn.activeUnitId).toBe(2);
    expect(d.sim.view().turn.weapon).toBe('greekFire');
    // Out of Greek fire: the bow again.
    const snap = d.sim.snapshot();
    const team = snap.teams[0];
    const gi = snap.rules.weapons.findIndex((w) => w.id === 'greekFire');
    if (team) team.ammo[gi] = 0;
    d.sim.restore(snap);
    d.step([{ t: 'selectUnit', unitId: 3 }]);
    d.step([{ t: 'selectUnit', unitId: 2 }]);
    expect(d.sim.view().turn.weapon).toBe('bow');
  });

  it('starts every turn with the bow in logs recorded before rememberWeapon', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { rememberWeapon, ...turn }: TurnRules = CLASSIC_RULES.turn;
    const config: MatchConfig = {
      rules: { ...CLASSIC_RULES, turn },
      teams: [{ spawns: [100] }, { spawns: [900] }],
    };
    const d = new Driver(config, 3);
    d.until('action');
    d.step([{ t: 'selectWeapon', id: 'sling' }, { t: 'skip' }]);
    d.until('transition');
    d.until('action');
    d.step([{ t: 'skip' }]);
    d.until('transition');
    d.until('action');
    expect(d.sim.view().turn.weapon).toBe('bow');
    expect(d.sim.view().units[0]?.weapon).toBeUndefined();
  });

  it('lets the last unit standing play every turn', () => {
    const config: MatchConfig = {
      rules: CLASSIC_RULES,
      teams: [{ spawns: [100] }, { spawns: [900] }],
    };
    const d = new Driver(config, 3);
    for (let i = 0; i < 3; i++) {
      d.until('action');
      expect(d.sim.view().turn.restingUnitId).toBe(-1);
      d.step([{ t: 'skip' }]);
      d.until('transition');
    }
  });

  it('lets the same unit play again in logs recorded before noRepeat', () => {
    const turn: TurnRules = { ...CLASSIC_RULES.turn };
    delete (turn as { noRepeat?: boolean }).noRepeat;
    const config: MatchConfig = {
      rules: { ...CLASSIC_RULES, turn },
      teams: [{ spawns: [100, 200] }, { spawns: [900] }],
    };
    const d = new Driver(config, 3);
    d.until('action');
    d.step([{ t: 'selectUnit', unitId: 2 }]);
    d.step([{ t: 'skip' }]);
    d.until('transition');
    d.until('action');
    d.step([{ t: 'skip' }]);
    d.until('transition');
    d.until('action');
    d.step([{ t: 'selectUnit', unitId: 2 }]);
    expect(d.sim.view().turn.activeUnitId).toBe(2);
  });

  it('tells when the turn can still change hands, and to whom', () => {
    const config: MatchConfig = {
      rules: CLASSIC_RULES,
      teams: [{ spawns: [100, 200, 300] }, { spawns: [900] }],
    };
    const d = new Driver(config, 3);
    d.until('action');
    expect(canSwitchUnit(d.sim.view())).toBe(true);
    expect(nextTeammate(d.sim.view())).toBe(2);
    d.step([{ t: 'selectUnit', unitId: 3 }]);
    expect(nextTeammate(d.sim.view())).toBe(1); // wraps round the team
    d.step([{ t: 'aim', angle: 3500 }]);
    expect(canSwitchUnit(d.sim.view())).toBe(true); // aiming is not acting
    d.step([{ t: 'move', dir: 1 }]);
    expect(canSwitchUnit(d.sim.view())).toBe(false);
  });

  it('jumps towards the side asked, turning round and mirroring the aim', () => {
    const d = new Driver(DUEL, 1);
    d.until('action');
    const before = unit(d, 1);
    expect(before.facing).toBe(1);
    const aim = d.sim.view().turn.aim;
    d.step([{ t: 'jump', kind: 'forward', dir: -1 }]);
    const u = unit(d, 1);
    expect(u.facing).toBe(-1);
    expect(u.vx).toBeLessThan(0);
    expect(d.sim.view().turn.aim).toBe((2048 - aim) & 4095);
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

  it('stops walking when the move budget is spent; a turn has a walk or one jump', () => {
    const rules: MatchRules = {
      ...RULES_60HP,
      unit: { ...RULES_60HP.unit, moveBudget: 100 },
    };
    const d = new Driver({ ...DUEL, rules, teams: [{ spawns: [300] }, { spawns: [1000] }] }, 1);
    d.until('action');
    const x0 = unit(d, 1).x;
    d.step([{ t: 'move', dir: 1 }]);
    for (let i = 0; i < 200; i++) d.step();
    const walked = unit(d, 1).x - x0;
    expect(walked).toBeGreaterThanOrEqual(100 * 256);
    expect(walked).toBeLessThanOrEqual(100 * 256 + rules.unit.walkSpeed);
    expect(d.sim.view().turn.moveLeft).toBe(0);
    // Out of breath: no more jumps either.
    d.step([
      { t: 'move', dir: 0 },
      { t: 'jump', kind: 'forward' },
    ]);
    expect(unit(d, 1).grounded).toBe(true);

    const j = new Driver({ ...DUEL, rules, teams: [{ spawns: [300] }, { spawns: [1000] }] }, 1);
    j.until('action');
    j.step([{ t: 'jump', kind: 'forward' }]);
    expect(j.sim.view().turn.moveLeft).toBe(0);
    expect(unit(j, 1).grounded).toBe(false);
    // Landed: no walking after a jump.
    for (let i = 0; i < 200; i++) j.step();
    const xl = unit(j, 1).x;
    j.step([{ t: 'move', dir: 1 }]);
    for (let i = 0; i < 30; i++) j.step();
    expect(unit(j, 1).x).toBe(xl);
    // A unit that walked a little cannot jump any more.
    const w = new Driver({ ...DUEL, rules, teams: [{ spawns: [300] }, { spawns: [1000] }] }, 1);
    w.until('action');
    w.step([{ t: 'move', dir: 1 }]);
    w.step([{ t: 'move', dir: 0 }]);
    w.step([{ t: 'jump', kind: 'forward' }]);
    expect(unit(w, 1).grounded).toBe(true);
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
