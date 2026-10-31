// Balance battery (skill balance-check): many matches of AI against AI played in parallel, in
// worker threads, then summed up: win rate by AI level and by side, how many turns a match
// lasts, kills, shots and damage by weapon, and what each class of unit does (damage dealt and
// taken, kills, survival). Writes docs/reports/balance/<date>-<label>.json and .md.
// Usage: node tools/battery.ts [--games N] [--levels a,b] [--themes all|valley,…]
//        [--lineups default|random] [--turns T] [--workers K] [--seed S] [--label name]
//        node tools/battery.ts --from <report.json>: sums up again the matches of a report (after a
//        change to the summary), without playing them, and rewrites its .json and .md.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { fixLineup } from '../src/app/match-setup.ts';
import { AI_LEVEL_IDS, type AiLevelId } from '../src/content/ai.ts';
import { CLASS_IDS, type ClassId } from '../src/content/classes.ts';
import { MAP_THEMES, type MapTheme } from '../src/content/maps.ts';
import { createPrng, nextRange } from '../src/sim/math/prng.ts';
import { playGame, type GameOptions, type GameReport } from './lib/soak-game.ts';

interface Job extends GameOptions {
  readonly index: number;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const opt = (name: string, def: string): string => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? (args[i + 1] ?? def) : def;
  };
  const from = opt('from', '');
  if (from !== '') {
    const old = JSON.parse(readFileSync(from, 'utf8')) as { summary: Summary; games: GameReport[] };
    const o = old.summary;
    const summary = summarize(old.games, { ...o, seconds: o.seconds });
    const base = from.replace(/\.json$/, '');
    const label = base.replace(/^.*[\\/]\d{4}-\d{2}-\d{2}-/, '');
    writeFileSync(`${base}.json`, JSON.stringify({ summary, games: old.games }, null, 1));
    writeFileSync(`${base}.md`, markdown(summary, label));
    console.log(`report: ${base}.json, ${base}.md`);
    return;
  }
  const games = Number(opt('games', '60'));
  const levels = opt('levels', 'knight,knight').split(',') as AiLevelId[];
  for (const l of levels) if (!AI_LEVEL_IDS.includes(l)) throw new Error(`unknown level ${l}`);
  const themesArg = opt('themes', 'all');
  const themes: MapTheme[] =
    themesArg === 'all'
      ? [...MAP_THEMES]
      : (themesArg.split(',').filter((t) => MAP_THEMES.includes(t as MapTheme)) as MapTheme[]);
  const lineupMode = opt('lineups', 'default');
  const maxTurns = Number(opt('turns', '60'));
  const workers = Math.max(1, Number(opt('workers', String(availableParallelism() - 1))));
  const baseSeed = Number(opt('seed', '1'));
  const label = opt('label', `${levels.join('-')}-${lineupMode}`);

  // The matches: themes in turn, levels swapped every other match so that sides even out.
  const jobs: Job[] = [];
  for (let i = 0; i < games; i++) {
    const seed = baseSeed + i;
    const theme = themes[i % themes.length] ?? 'valley';
    const gameLevels = i % 2 === 0 ? levels : [...levels].reverse();
    jobs.push({
      index: i,
      theme,
      seed,
      levels: gameLevels,
      maxTurns,
      checkReplay: i < 3,
      ...(lineupMode === 'random' ? { lineups: randomLineups(seed, levels.length) } : {}),
    });
  }

  const t0 = performance.now();
  const reports: GameReport[] = new Array(jobs.length);
  let next = 0;
  let done = 0;
  await new Promise<void>((resolve) => {
    const pool = Math.min(workers, jobs.length);
    for (let w = 0; w < pool; w++) {
      const worker = new Worker(new URL(import.meta.url), { workerData: w });
      const feed = (): void => {
        const job = jobs[next++];
        worker.postMessage(job ?? null);
      };
      worker.on('message', (m: { ready?: boolean; index?: number; report?: GameReport }) => {
        if (m.report && m.index !== undefined) {
          reports[m.index] = m.report;
          done++;
          const r = m.report;
          console.log(
            `${String(done).padStart(4)}/${jobs.length}  ${r.mapId.padEnd(20)} ${r.levels.join('/').padEnd(18)} ` +
              `winner ${String(r.winner).padStart(4)}  turns ${String(r.turns).padStart(3)}` +
              `${r.error ? '  ERROR' : ''}${r.replayOk === false ? '  REPLAY MISMATCH' : ''}`,
          );
          if (r.error) console.log(r.error);
          if (done === jobs.length) resolve();
        }
        feed();
      });
      worker.on('error', (e) => {
        console.error(`worker ${w}:`, e);
      });
    }
  });
  const seconds = (performance.now() - t0) / 1000;
  const summary = summarize(reports, { levels, lineupMode, themes, maxTurns, seconds, workers });
  mkdirSync('docs/reports/balance', { recursive: true });
  const day = new Date().toISOString().slice(0, 10);
  const base = `docs/reports/balance/${day}-${label}`;
  writeFileSync(`${base}.json`, JSON.stringify({ summary, games: reports }, null, 1));
  writeFileSync(`${base}.md`, markdown(summary, label));
  console.log(markdown(summary, label));
  console.log(`report: ${base}.json, ${base}.md`);
}

/** Six units a house, of classes drawn at random (one king at most), from the match seed. */
function randomLineups(seed: number, houses: number): ClassId[][] {
  const prng = createPrng((seed ^ 0x42414c41) >>> 0);
  return Array.from({ length: houses }, () =>
    fixLineup(
      Array.from(
        { length: 6 },
        () => CLASS_IDS[nextRange(prng, 0, CLASS_IDS.length - 1)] ?? 'knight',
      ),
      false,
    ),
  );
}

const pct = (a: number, b: number): number => Math.round((1000 * a) / Math.max(1, b)) / 10;
const quantile = (xs: readonly number[], q: number): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))] ?? 0;
};

interface Summary {
  readonly games: number;
  readonly seconds: number;
  readonly workers: number;
  readonly levels: readonly AiLevelId[];
  readonly lineupMode: string;
  readonly themes: readonly MapTheme[];
  readonly maxTurns: number;
  readonly finished: number;
  readonly draws: number;
  readonly unfinished: number;
  readonly errors: number;
  readonly replayMismatches: number;
  readonly stuckUnits: number;
  readonly byLevel: Record<string, { played: number; won: number; winPct: number }>;
  readonly bySide: { readonly left: number; readonly right: number };
  readonly turns: { avg: number; median: number; p10: number; p90: number; max: number };
  readonly turnsByTheme: Record<string, { games: number; avgTurns: number; leftWinPct: number }>;
  readonly roundsAvg: number;
  readonly weapons: Record<
    string,
    {
      shots: number;
      kills: number;
      /** of its kills, the victims it threw into the water */
      drowned: number;
      damage: number;
      damagePerShot: number;
    }
  >;
  readonly deathCauses: Record<string, number>;
  /** all deaths, and those credited to a weapon (BACKLOG 8.5: none above 30 % of these) */
  readonly deaths: number;
  readonly weaponKills: number;
  /**
   * each weapon's share of the weapon kills and of all deaths, %, with the half-width of its 95 %
   * confidence interval (ratio estimator, clustered by match)
   */
  readonly killShares: Record<
    string,
    { ofWeaponKills: number; ci: number; ofDeaths: number; ciDeaths: number }
  >;
  readonly classes: Record<
    string,
    {
      units: number;
      survivalPct: number;
      dealtPerTurn: number;
      killsPerUnit: number;
      takenPerUnit: number;
      friendlyPerTurn: number;
    }
  >;
  readonly friendlyFirePct: number;
  readonly planMsAvg: number;
  readonly planMsP95: number;
  readonly planMsMax: number;
}

function summarize(
  reports: readonly GameReport[],
  o: {
    levels: readonly AiLevelId[];
    lineupMode: string;
    themes: readonly MapTheme[];
    maxTurns: number;
    seconds: number;
    workers: number;
  },
): Summary {
  const byLevel: Summary['byLevel'] = {};
  for (const r of reports) {
    r.levels.forEach((l, team) => {
      const s = (byLevel[l] ??= { played: 0, won: 0, winPct: 0 });
      s.played++;
      if (r.winner === team) s.won++;
    });
  }
  for (const s of Object.values(byLevel)) s.winPct = pct(s.won, s.played);
  const turns = reports.map((r) => r.turns);
  const byTheme: Summary['turnsByTheme'] = {};
  for (const t of o.themes) {
    const rs = reports.filter((r) => r.theme === t);
    byTheme[t] = {
      games: rs.length,
      avgTurns: Math.round(rs.reduce((a, r) => a + r.turns, 0) / Math.max(1, rs.length)),
      leftWinPct: pct(rs.filter((r) => r.winner === 0).length, rs.length),
    };
  }
  const weapons: Summary['weapons'] = {};
  const deathCauses: Record<string, number> = {};
  for (const r of reports) {
    for (const [w, n] of Object.entries(r.shots)) (weapons[w] ??= blank()).shots += n;
    for (const [w, n] of Object.entries(r.weaponDamage)) (weapons[w] ??= blank()).damage += n;
    for (const [w, n] of Object.entries(r.kills)) {
      if (isWeapon(r, w)) (weapons[w] ??= blank()).kills += n;
      deathCauses[w] = (deathCauses[w] ?? 0) + n;
    }
    for (const [w, n] of Object.entries(r.drownedBy ?? {})) (weapons[w] ??= blank()).drowned += n;
  }
  const deathsOf = (r: GameReport): number => Object.values(r.kills).reduce((a, b) => a + b, 0);
  const weaponKillsOf = (r: GameReport): number =>
    Object.entries(r.kills).reduce((a, [w, n]) => a + (isWeapon(r, w) ? n : 0), 0);
  const killShares: Summary['killShares'] = {};
  for (const w of Object.keys(weapons)) {
    const k = (r: GameReport): number => r.kills[w] ?? 0;
    const a = share(reports, k, weaponKillsOf);
    const b = share(reports, k, deathsOf);
    if (a.p > 0) killShares[w] = { ofWeaponKills: a.p, ci: a.ci, ofDeaths: b.p, ciDeaths: b.ci };
  }
  for (const w of Object.values(weapons))
    w.damagePerShot = Math.round((10 * w.damage) / Math.max(1, w.shots)) / 10;
  const classes: Summary['classes'] = {};
  const acc = new Map<
    string,
    {
      units: number;
      alive: number;
      dealt: number;
      turns: number;
      kills: number;
      taken: number;
      friendly: number;
    }
  >();
  for (const r of reports) {
    for (const u of r.units) {
      const k = u.cls ?? 'none';
      const a = acc.get(k) ?? {
        units: 0,
        alive: 0,
        dealt: 0,
        turns: 0,
        kills: 0,
        taken: 0,
        friendly: 0,
      };
      a.units++;
      if (u.survived) a.alive++;
      a.dealt += u.dealt;
      a.turns += u.turns;
      a.kills += u.kills;
      a.taken += u.taken;
      a.friendly += u.friendly;
      acc.set(k, a);
    }
  }
  for (const [k, a] of [...acc].sort((x, y) => x[0].localeCompare(y[0]))) {
    classes[k] = {
      units: a.units,
      survivalPct: pct(a.alive, a.units),
      dealtPerTurn: Math.round((10 * a.dealt) / Math.max(1, a.turns)) / 10,
      killsPerUnit: Math.round((100 * a.kills) / Math.max(1, a.units)) / 100,
      takenPerUnit: Math.round(a.taken / Math.max(1, a.units)),
      friendlyPerTurn: Math.round((10 * a.friendly) / Math.max(1, a.turns)) / 10,
    };
  }
  const ms = reports.flatMap((r) => r.planMs);
  const enemy = reports.reduce((a, r) => a + r.enemyDamage, 0);
  const friendly = reports.reduce((a, r) => a + r.friendlyDamage, 0);
  const houses = o.levels.length;
  return {
    games: reports.length,
    seconds: Math.round(o.seconds),
    workers: o.workers,
    levels: o.levels,
    lineupMode: o.lineupMode,
    themes: o.themes,
    maxTurns: o.maxTurns,
    finished: reports.filter((r) => r.winner !== null && r.winner >= 0).length,
    draws: reports.filter((r) => r.winner === -1).length,
    unfinished: reports.filter((r) => r.winner === null).length,
    errors: reports.filter((r) => r.error).length,
    replayMismatches: reports.filter((r) => r.replayOk === false).length,
    stuckUnits: reports.reduce((a, r) => a + r.stuck.length, 0),
    byLevel,
    bySide: {
      left: pct(reports.filter((r) => r.winner === 0).length, reports.length),
      right: pct(reports.filter((r) => r.winner === 1).length, reports.length),
    },
    turns: {
      avg: Math.round((10 * turns.reduce((a, b) => a + b, 0)) / Math.max(1, turns.length)) / 10,
      median: quantile(turns, 0.5),
      p10: quantile(turns, 0.1),
      p90: quantile(turns, 0.9),
      max: Math.max(0, ...turns),
    },
    turnsByTheme: byTheme,
    roundsAvg:
      Math.round((10 * turns.reduce((a, b) => a + b, 0)) / Math.max(1, turns.length) / houses) / 10,
    weapons,
    deathCauses,
    deaths: reports.reduce((a, r) => a + deathsOf(r), 0),
    weaponKills: reports.reduce((a, r) => a + weaponKillsOf(r), 0),
    killShares,
    classes,
    friendlyFirePct: pct(friendly, friendly + enemy),
    planMsAvg: Math.round(ms.reduce((a, b) => a + b, 0) / Math.max(1, ms.length)),
    planMsP95: Math.round(quantile(ms, 0.95)),
    planMsMax: Math.round(Math.max(0, ...ms)),
  };
}

function blank(): Summary['weapons'][string] {
  return { shots: 0, kills: 0, drowned: 0, damage: 0, damagePerShot: 0 };
}

/** A kill key is a weapon's when the match shot or hurt with it (else it is a cause of death). */
function isWeapon(r: GameReport, key: string): boolean {
  return key in r.shots || key in r.weaponDamage;
}

/**
 * %: sum of num over sum of den across the matches, with the half-width of its 95 % confidence
 * interval, kills within a match being correlated (ratio estimator, clustered by match).
 */
function share(
  reports: readonly GameReport[],
  num: (r: GameReport) => number,
  den: (r: GameReport) => number,
): { p: number; ci: number } {
  const g = reports.length;
  const n = reports.reduce((a, r) => a + den(r), 0);
  if (g < 2 || n === 0) return { p: 0, ci: 0 };
  const p = reports.reduce((a, r) => a + num(r), 0) / n;
  const mean = n / g;
  const ss = reports.reduce((a, r) => a + (num(r) - p * den(r)) ** 2, 0);
  const se = Math.sqrt(ss / (g * (g - 1))) / mean;
  return { p: Math.round(1000 * p) / 10, ci: Math.round(1960 * se) / 10 };
}

/** The causes of death that are not a weapon's, in the order the report lists them. */
const ENVIRONMENT = [
  'burn',
  'drowned',
  'dragon',
  'flames',
  'beast',
  'lightning',
  'fall',
  'outOfMap',
  'kingFell',
  'other',
] as const;

function markdown(s: Summary, label: string): string {
  const lines: string[] = [];
  lines.push(`# Batterie d'équilibrage : ${label}`, '');
  lines.push(
    `${s.games} parties IA contre IA (${s.levels.join(' contre ')}, combattants : ${s.lineupMode}), ` +
      `cartes : ${s.themes.join(', ')}, ${s.maxTurns} tours au plus ; ${s.seconds} s sur ${s.workers} cœurs.`,
    '',
  );
  lines.push(
    `- Terminées : ${s.finished} · égalités : ${s.draws} · sans vainqueur au bout de ${s.maxTurns} tours : ${s.unfinished}`,
    `- Erreurs : ${s.errors} · replays divergents : ${s.replayMismatches} · combattants coincés : ${s.stuckUnits}`,
    `- Tir ami : ${s.friendlyFirePct} % des dégâts infligés · réflexion de l'IA : ${s.planMsAvg} ms en moyenne, ${s.planMsP95} ms au 95ᵉ centile, ${s.planMsMax} ms au plus`,
    '',
  );
  lines.push('## Victoires', '', '| Niveau | Parties | Victoires | % |', '|---|---|---|---|');
  for (const [l, v] of Object.entries(s.byLevel))
    lines.push(`| ${l} | ${v.played} | ${v.won} | ${v.winPct} |`);
  lines.push('', `Côté gauche : ${s.bySide.left} % · côté droit : ${s.bySide.right} %`, '');
  lines.push(
    '## Durée',
    '',
    `Tours par partie : moyenne ${s.turns.avg}, médiane ${s.turns.median}, 10ᵉ centile ${s.turns.p10}, 90ᵉ centile ${s.turns.p90}, au plus ${s.turns.max} ; soit ${s.roundsAvg} tours de table en moyenne.`,
    '',
    '| Carte | Parties | Tours en moyenne | Victoires à gauche % |',
    '|---|---|---|---|',
  );
  for (const [t, v] of Object.entries(s.turnsByTheme))
    lines.push(`| ${t} | ${v.games} | ${v.avgTurns} | ${v.leftWinPct} |`);
  lines.push(
    '',
    '## Armes',
    '',
    '| Arme | Tirs | Dégâts | Dégâts par tir | Morts | dont noyés |',
    '|---|---|---|---|---|---|',
  );
  for (const [w, v] of Object.entries(s.weapons).sort((a, b) => b[1].shots - a[1].shots)) {
    lines.push(
      `| ${w} | ${v.shots} | ${v.damage} | ${v.damagePerShot} | ${v.kills} | ${v.drowned} |`,
    );
  }
  lines.push(
    '',
    `## Part des morts (BACKLOG 8.5 : aucune arme au-dessus de 30 % des morts par les armes)`,
    '',
    `${s.deaths} morts, dont ${s.weaponKills} par les armes (${pct(s.weaponKills, s.deaths)} %). ` +
      'Une arme compte les morts de son tir : ses coups, et la noyade de ceux qu’elle jette à l’eau ; ' +
      'les morsures du dragon, l’eau qui monte au Déluge et la fin du tour n’en sont pas. ' +
      'Intervalle de confiance à 95 %, regroupé par partie.',
    '',
    '| Arme | % des morts par les armes | % de toutes les morts |',
    '|---|---|---|',
  );
  for (const [w, v] of Object.entries(s.killShares).sort(
    (a, b) => b[1].ofWeaponKills - a[1].ofWeaponKills,
  )) {
    lines.push(`| ${w} | ${v.ofWeaponKills} ± ${v.ci} | ${v.ofDeaths} ± ${v.ciDeaths} |`);
  }
  lines.push(
    '',
    'Causes de mort : ' +
      Object.entries(s.deathCauses)
        .sort((a, b) => b[1] - a[1])
        .map(([k, n]) => `${k} ${n}`)
        .join(', '),
    '',
    'Hors des armes : `burn` le parchemin qui brûle, `drowned` l’eau sans tir (le Déluge qui monte), ' +
      '`dragon` ses morsures, `flames` les flammes au sol hors du tir qui les a posées, `beast` les bêtes, ' +
      '`lightning` la foudre, `fall` et `outOfMap` les chutes hors tir, `other` le reste.',
    '',
    '| Cause | Morts | % |',
    '|---|---|---|',
    ...[
      ['Armes', s.weaponKills],
      ...ENVIRONMENT.map((k): [string, number] => [k, s.deathCauses[k] ?? 0]),
    ].map(([k, n]) => `| ${k} | ${n} | ${pct(Number(n), s.deaths)} |`),
    '',
  );
  lines.push(
    '## Classes',
    '',
    '| Classe | Combattants | Survie % | Dégâts par tour joué | Morts infligées par combattant | Dégâts subis par combattant | Tir ami par tour |',
    '|---|---|---|---|---|---|---|',
  );
  for (const [c, v] of Object.entries(s.classes)) {
    lines.push(
      `| ${c} | ${v.units} | ${v.survivalPct} | ${v.dealtPerTurn} | ${v.killsPerUnit} | ${v.takenPerUnit} | ${v.friendlyPerTurn} |`,
    );
  }
  return lines.join('\n') + '\n';
}

// Last, once every helper above is defined: a worker plays, the main thread leads.
if (!isMainThread) {
  // A worker: plays the matches it is sent, one at a time, and posts each report back.
  parentPort?.on('message', (job: Job | null) => {
    if (job === null) {
      process.exit(0);
    }
    const r = playGame(job);
    parentPort?.postMessage({ index: job.index, report: r });
  });
  parentPort?.postMessage({ ready: true, worker: workerData as number });
} else {
  await main();
}
