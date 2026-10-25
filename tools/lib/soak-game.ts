// One match of AI against AI, headless (BACKLOG 5.7): the loop shared by `maps:soak` and the
// balance battery (`tools/battery.ts`). It reports the winner, the length, units stuck, kills by
// weapon, damage dealt and taken by each unit with its class, the AI's planning times, and
// whether the log replays to the same hash.
import { AiController } from '../../src/ai/controller.ts';
import { planTurn } from '../../src/ai/plan.ts';
import { buildMap } from '../../src/app/map-build.ts';
import { defaultSetup, matchConfig, rulesFor, type MatchSetup } from '../../src/app/match-setup.ts';
import { AI_LEVELS, type AiLevelId } from '../../src/content/ai.ts';
import type { ClassId } from '../../src/content/classes.ts';
import { generatedMapId, type MapTheme } from '../../src/content/maps.ts';
import type { GameCommand, TimedCommand } from '../../src/sim/commands.ts';
import { LOG_VERSION, replay, type GameLog } from '../../src/sim/log.ts';
import { Sim } from '../../src/sim/sim.ts';

/** ticks a match may last at most (well beyond any turn limit) */
const MAX_TICKS = 60 * 60 * 90;

/** What one unit did in the match. */
export interface UnitReport {
  readonly id: number;
  readonly team: number;
  readonly cls: ClassId | null;
  /** HP it took from enemies with its own shots, and from its own side */
  readonly dealt: number;
  readonly friendly: number;
  /** enemies it killed (with its shots: the last one to have hurt them before they died) */
  readonly kills: number;
  /** HP it lost, whoever's doing */
  readonly taken: number;
  readonly survived: boolean;
  /** turns it played */
  readonly turns: number;
}

export interface GameReport {
  readonly seed: number;
  readonly mapId: string;
  readonly theme: MapTheme;
  /** team id, -1 draw, null unfinished */
  readonly winner: number | null;
  readonly levels: readonly AiLevelId[];
  readonly turns: number;
  readonly ticks: number;
  readonly error?: string;
  readonly stuck: readonly { unitId: number; x: number; turn: number }[];
  /** deaths by the weapon of the turn, or their cause (drowned, outOfMap, kingFell…) */
  readonly kills: Record<string, number>;
  /** shots taken with each weapon */
  readonly shots: Record<string, number>;
  /** HP taken from enemies by each weapon */
  readonly weaponDamage: Record<string, number>;
  readonly enemyDamage: number;
  readonly friendlyDamage: number;
  readonly units: readonly UnitReport[];
  readonly planMs: readonly number[];
  readonly replayOk?: boolean;
}

export interface GameOptions {
  readonly theme: MapTheme;
  readonly seed: number;
  /** level of each house */
  readonly levels: readonly AiLevelId[];
  readonly maxTurns: number;
  /** classes of each house's units; absent: the default line-up (one of each class) */
  readonly lineups?: readonly (readonly ClassId[])[];
  /** check that the log replays to the same hash */
  readonly checkReplay?: boolean;
}

/** The active unit can get somewhere: a walk, a jump or a rope moves it at least 4 px. */
function canMove(sim: Sim): boolean {
  const v = sim.view();
  const id = v.turn.activeUnitId;
  const x0 = v.units.find((u) => u.id === id)?.x ?? 0;
  const y0 = v.units.find((u) => u.id === id)?.y ?? 0;
  const tries: GameCommand[] = [
    { t: 'move', dir: 1 },
    { t: 'move', dir: -1 },
    { t: 'jump', kind: 'forward', dir: 1 },
    { t: 'jump', kind: 'forward', dir: -1 },
    { t: 'climb', dir: -1 },
    { t: 'climb', dir: 1 },
  ];
  return tries.some((cmd) => {
    const s = Sim.fromState(sim.snapshot());
    s.step([cmd]);
    for (let i = 0; i < 90; i++) s.step();
    const u = s.view().units.find((w) => w.id === id);
    return Math.abs((u?.x ?? x0) - x0) >= 4 * 256 || Math.abs((u?.y ?? y0) - y0) >= 4 * 256;
  });
}

export function playGame(o: GameOptions): GameReport {
  const base = defaultSetup(false);
  const setup: MatchSetup = o.lineups ? { ...base, lineups: o.lineups } : base;
  const rules = rulesFor(setup, {});
  const built = buildMap(o.theme, o.seed);
  const config = matchConfig(built, setup, rules);
  const sim = new Sim(config, o.seed, built.mask);
  const planMs: number[] = [];
  const ctrl = new AiController({
    levels: new Map(o.levels.map((l, team) => [team, AI_LEVELS[l]])),
    seed: o.seed,
    planner: (input) => {
      const t0 = performance.now();
      const r = planTurn(input);
      planMs.push(performance.now() - t0);
      return r;
    },
    pace: { aimPerTick: 24, afterShot: 30, settle: 6 },
    ticksPerSecond: 0,
  });
  const commands: TimedCommand[] = [];
  const kills: Record<string, number> = {};
  const shots: Record<string, number> = {};
  const weaponDamage: Record<string, number> = {};
  let enemyDamage = 0;
  let friendlyDamage = 0;
  let weapon = '';
  let shooter = -1;
  /** the unit playing the current turn, credited with it when the next one starts */
  let playing = -1;
  // Damage counts as the active unit's doing between its shot and the end of its turn.
  let shooting = false;
  const per = new Map<
    number,
    { dealt: number; friendly: number; kills: number; taken: number; turns: number }
  >();
  const stat = (id: number) => {
    let s = per.get(id);
    if (!s) per.set(id, (s = { dealt: 0, friendly: 0, kills: 0, taken: 0, turns: 0 }));
    return s;
  };
  /** the unit whose shot last hurt each unit, to credit its death */
  const lastHurtBy = new Map<number, number>();
  const blocked = new Map<number, number>();
  let probed = -1;
  const stuck: { unitId: number; x: number; turn: number }[] = [];
  let error: string | undefined;
  try {
    for (let tick = 1; tick <= MAX_TICKS; tick++) {
      const v = sim.view();
      if (v.turn.phase === 'gameOver' || v.turn.number > o.maxTurns) break;
      const active = v.turn.activeUnitId;
      const team = v.turn.activeTeam;
      const turn = v.turn.number;
      if (v.turn.phase === 'action' && probed !== turn) {
        probed = turn;
        const n = canMove(sim) ? 0 : (blocked.get(active) ?? 0) + 1;
        blocked.set(active, n);
        const u = v.units.find((x) => x.id === active);
        if (n === 3 && u) stuck.push({ unitId: active, x: u.x >> 8, turn });
      }
      if (v.turn.phase === 'action' || v.turn.phase === 'retreat') playing = active;
      const cmds = ctrl.poll(tick, v);
      for (const c of cmds) commands.push([tick, c]);
      const events = sim.step(cmds);
      const now = sim.view();
      // The end of a turn (fire, water, the dragon…) is nobody's shot.
      const turnEnd = events.some((x) => x.e === 'turnStarted' || x.e === 'gameOver');
      for (const e of events) {
        if (e.e === 'turnStarted') {
          // The turn that ends was played by the unit active at its end (a house may switch).
          if (playing >= 0) stat(playing).turns++;
          weapon = '';
          shooting = false;
          shooter = e.unitId;
        }
        if (e.e === 'shotFired') {
          weapon = e.weapon;
          shooting = true;
          shooter = now.turn.activeUnitId;
          shots[e.weapon] = (shots[e.weapon] ?? 0) + 1;
        }
        if (e.e === 'unitDamaged') {
          stat(e.unitId).taken += e.damage;
          if (shooting && !turnEnd) {
            const victim = now.units.find((u) => u.id === e.unitId);
            lastHurtBy.set(e.unitId, shooter);
            if (victim?.team === team) {
              friendlyDamage += e.damage;
              stat(shooter).friendly += e.damage;
            } else {
              enemyDamage += e.damage;
              stat(shooter).dealt += e.damage;
              weaponDamage[weapon] = (weaponDamage[weapon] ?? 0) + e.damage;
            }
          }
        }
        if (e.e === 'unitDied') {
          const key = e.cause === 'hp' ? weapon || 'other' : e.cause;
          kills[key] = (kills[key] ?? 0) + 1;
          const by = lastHurtBy.get(e.unitId);
          const victim = now.units.find((u) => u.id === e.unitId);
          const killer = by !== undefined ? now.units.find((u) => u.id === by) : undefined;
          if (killer && victim && killer.team !== victim.team) stat(killer.id).kills++;
        }
      }
    }
  } catch (e) {
    error = e instanceof Error ? (e.stack ?? e.message) : String(e);
  }
  const v = sim.view();
  const log: GameLog = {
    version: LOG_VERSION,
    config,
    seed: o.seed,
    mapId: generatedMapId(o.theme, o.seed),
    commands,
    endTick: v.tick,
  };
  const units: UnitReport[] = v.teams.flatMap((t) =>
    t.unitIds.map((id, rank) => {
      const u = v.units.find((x) => x.id === id);
      const s = stat(id);
      return {
        id,
        team: t.id,
        cls: t.classes?.[rank] ?? null,
        dealt: s.dealt,
        friendly: s.friendly,
        kills: s.kills,
        taken: s.taken,
        survived: u?.alive === true,
        turns: s.turns,
      };
    }),
  );
  return {
    seed: o.seed,
    mapId: log.mapId,
    theme: o.theme,
    winner: v.winner,
    levels: o.levels,
    turns: v.turn.number,
    ticks: v.tick,
    ...(error ? { error } : {}),
    stuck,
    kills,
    shots,
    weaponDamage,
    enemyDamage,
    friendlyDamage,
    units,
    planMs,
    ...(o.checkReplay && !error ? { replayOk: replay(log, built.mask).hash() === sim.hash() } : {}),
  };
}
