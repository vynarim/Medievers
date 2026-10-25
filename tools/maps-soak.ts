// AI against AI, headless (BACKLOG 5.7, skill map-soak): plays N matches on a map theme and
// reports winners by side, match lengths, units stuck, kills by weapon, friendly fire, the time
// the AI took to plan, and whether the logs of three matches replay to the same hash.
// Usage: pnpm run maps:soak <valley|coast|holyLand|all> [--games N] [--levels a,b] [--seed S]
//        [--turns T] [--quiet]
import { mkdirSync, writeFileSync } from 'node:fs';
import { AI_LEVEL_IDS, type AiLevelId } from '../src/content/ai.ts';
import { MAP_THEMES, type MapTheme } from '../src/content/maps.ts';
import { playGame, type GameReport } from './lib/soak-game.ts';

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

const reports: GameReport[] = [];
for (const theme of themes) {
  for (let g = 0; g < games; g++) {
    const seed = baseSeed + g;
    // Every other match, the houses swap levels: the sides are tested for fairness as well.
    const gameLevels = g % 2 === 0 ? levels : [...levels].reverse();
    const t0 = performance.now();
    const r = playGame({
      theme,
      seed,
      levels: gameLevels,
      maxTurns,
      checkReplay: seed - baseSeed < 3,
    });
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
