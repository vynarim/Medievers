// AI against AI, headless (BACKLOG 5.7, skill map-soak): plays N matches on a map theme and
// reports winners by side, match lengths, units stuck, kills by weapon, friendly fire, the time
// the AI took to plan, and whether the logs of three matches replay to the same hash.
// Usage: pnpm run maps:soak <valley|coast|holyLand|all> [--games N] [--levels a,b] [--seed S]
//        [--turns T] [--quiet]
import { mkdirSync, writeFileSync } from 'node:fs';
import { AiController } from '../src/ai/controller.ts';
import { planTurn } from '../src/ai/plan.ts';
import { buildMap } from '../src/app/map-build.ts';
import { defaultSetup, matchConfig, rulesFor } from '../src/app/match-setup.ts';
import { AI_LEVELS, AI_LEVEL_IDS, type AiLevelId } from '../src/content/ai.ts';
import { MAP_THEMES, generatedMapId, type MapTheme } from '../src/content/maps.ts';
import type { TimedCommand } from '../src/sim/commands.ts';
import { LOG_VERSION, replay, type GameLog } from '../src/sim/log.ts';
import { Sim } from '../src/sim/sim.ts';

const args = process.argv.slice(2);
const opt = (name: string, def: string): string => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? (args[i + 1] ?? def) : def;
};
const which = args[0] && !args[0].startsWith('--') ? args[0] : 'all';
const games = Number(opt('games', '30'));
const levels = opt('levels', 'knight,knight').split(',') as AiLevelId[];
const baseSeed = Number(opt('seed', '1'));
const maxTurns = Number(opt('turns', '60'));
const quiet = args.includes('--quiet');
for (const l of levels) {
  if (!AI_LEVEL_IDS.includes(l)) throw new Error(`unknown level ${l}`);
}
const themes: MapTheme[] =
  which === 'all' ? [...MAP_THEMES] : MAP_THEMES.filter((t) => t === which);
if (themes.length === 0) throw new Error(`unknown map theme ${which}`);

/** ticks a match may last at most (well beyond any turn limit) */
const MAX_TICKS = 60 * 60 * 90;

interface GameReport {
  readonly seed: number;
  readonly mapId: string;
  /** team id, -1 draw, null unfinished */
  readonly winner: number | null;
  readonly levels: readonly AiLevelId[];
  readonly turns: number;
  readonly ticks: number;
  readonly error?: string;
  readonly stuck: readonly { unitId: number; x: number; turn: number }[];
  readonly kills: Record<string, number>;
  readonly enemyDamage: number;
  readonly friendlyDamage: number;
  readonly planMs: readonly number[];
  readonly replayOk?: boolean;
}

function playGame(theme: MapTheme, seed: number, gameLevels: readonly AiLevelId[]): GameReport {
  const setup = defaultSetup(false);
  const rules = rulesFor(setup, {});
  const built = buildMap(theme, seed);
  const config = matchConfig(built, setup, rules);
  const sim = new Sim(config, seed, built.mask);
  const planMs: number[] = [];
  const ctrl = new AiController({
    levels: new Map(gameLevels.map((l, team) => [team, AI_LEVELS[l]])),
    seed,
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
  let enemyDamage = 0;
  let friendlyDamage = 0;
  let weapon = '';
  // Damage counts as the AI's own doing between its shot and the end of its turn.
  let shooting = false;
  // Each unit's x at the end of its last turns, to find the ones that never move.
  const moves = new Map<number, number[]>();
  const stuck: { unitId: number; x: number; turn: number }[] = [];
  let error: string | undefined;
  try {
    for (let tick = 1; tick <= MAX_TICKS; tick++) {
      const v = sim.view();
      if (v.turn.phase === 'gameOver' || v.turn.number > maxTurns) break;
      const active = v.turn.activeUnitId;
      const team = v.turn.activeTeam;
      const turn = v.turn.number;
      const cmds = ctrl.poll(tick, v);
      for (const c of cmds) commands.push([tick, c]);
      const events = sim.step(cmds);
      for (const e of events) {
        if (e.e === 'shotFired') {
          weapon = e.weapon;
          shooting = true;
        }
        if (e.e === 'unitDamaged' && shooting && !events.some((x) => x.e === 'turnStarted')) {
          const victim = sim.view().units.find((u) => u.id === e.unitId);
          if (victim?.team === team) friendlyDamage += e.damage;
          else enemyDamage += e.damage;
        }
        if (e.e === 'unitDied') {
          const key = e.cause === 'hp' ? weapon || 'other' : e.cause;
          kills[key] = (kills[key] ?? 0) + 1;
        }
        if (e.e === 'turnStarted') {
          weapon = '';
          shooting = false;
          const u = sim.view().units.find((x) => x.id === active);
          if (u?.alive) {
            const xs = moves.get(active) ?? [];
            xs.push(u.x);
            moves.set(active, xs);
            const last = xs.slice(-4);
            if (last.length === 4 && last.every((x) => Math.abs(x - (last[0] ?? 0)) < 2 * 256)) {
              stuck.push({ unitId: active, x: u.x >> 8, turn });
              moves.set(active, []);
            }
          }
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
    seed,
    mapId: generatedMapId(theme, seed),
    commands,
    endTick: v.tick,
  };
  return {
    seed,
    mapId: log.mapId,
    winner: v.winner,
    levels: gameLevels,
    turns: v.turn.number,
    ticks: v.tick,
    ...(error ? { error } : {}),
    stuck,
    kills,
    enemyDamage,
    friendlyDamage,
    planMs,
    ...(seed - baseSeed < 3 && !error
      ? { replayOk: replay(log, built.mask).hash() === sim.hash() }
      : {}),
  };
}

const reports: GameReport[] = [];
for (const theme of themes) {
  for (let g = 0; g < games; g++) {
    const seed = baseSeed + g;
    // Every other match, the houses swap levels: the sides are tested for fairness as well.
    const gameLevels = g % 2 === 0 ? levels : [...levels].reverse();
    const t0 = performance.now();
    const r = playGame(theme, seed, gameLevels);
    reports.push(r);
    if (!quiet) {
      const avg = r.planMs.reduce((a, b) => a + b, 0) / Math.max(1, r.planMs.length);
      console.log(
        `${r.mapId.padEnd(18)} ${gameLevels.join('/').padEnd(18)} winner ${String(r.winner).padStart(4)}  turns ${String(r.turns).padStart(3)}  plan ${avg.toFixed(0)} ms (max ${Math.max(0, ...r.planMs).toFixed(0)})  ${((performance.now() - t0) / 1000).toFixed(1)} s${r.error ? '  ERROR' : ''}${r.stuck.length ? `  stuck ${r.stuck.length}` : ''}${r.replayOk === false ? '  REPLAY MISMATCH' : ''}`,
      );
      if (r.error) console.log(r.error);
    }
  }
}

// Summary against the criteria of the map-soak skill.
const finished = reports.filter((r) => r.winner !== null);
const leftWins = reports.filter((r) => r.winner === 0).length;
const rightWins = reports.filter((r) => r.winner === 1).length;
const byLevel: Record<string, { played: number; won: number }> = {};
for (const r of reports) {
  r.levels.forEach((l, team) => {
    const s = (byLevel[l] ??= { played: 0, won: 0 });
    s.played++;
    if (r.winner === team) s.won++;
  });
}
const kills: Record<string, number> = {};
for (const r of reports)
  for (const [k, n] of Object.entries(r.kills)) kills[k] = (kills[k] ?? 0) + n;
const allMs = reports.flatMap((r) => r.planMs);
const summary = {
  date: new Date().toISOString(),
  themes,
  games: reports.length,
  levels,
  finished: finished.length,
  overTurnLimit: reports.filter((r) => r.winner === null).length,
  leftWinPct: Math.round((100 * leftWins) / Math.max(1, reports.length)),
  rightWinPct: Math.round((100 * rightWins) / Math.max(1, reports.length)),
  byLevel,
  avgTurns: Math.round(reports.reduce((a, r) => a + r.turns, 0) / Math.max(1, reports.length)),
  stuckUnits: reports.reduce((a, r) => a + r.stuck.length, 0),
  errors: reports.filter((r) => r.error).length,
  replayMismatches: reports.filter((r) => r.replayOk === false).length,
  kills,
  friendlyFirePct: Math.round(
    (100 * reports.reduce((a, r) => a + r.friendlyDamage, 0)) /
      Math.max(
        1,
        reports.reduce((a, r) => a + r.friendlyDamage + r.enemyDamage, 0),
      ),
  ),
  planMsAvg: Math.round(allMs.reduce((a, b) => a + b, 0) / Math.max(1, allMs.length)),
  planMsMax: Math.round(Math.max(0, ...allMs)),
};
console.log(JSON.stringify(summary, null, 2));
mkdirSync('docs/reports/soak', { recursive: true });
const day = summary.date.slice(0, 10);
const path = `docs/reports/soak/${day}-${which}-${levels.join('-')}.json`;
writeFileSync(path, JSON.stringify({ summary, games: reports }, null, 2));
console.log(`report: ${path}`);
