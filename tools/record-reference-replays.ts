// Records the reference replays of tests/replays/ from scripted games.
// Usage: node tools/record-reference-replays.ts [--force]
// Existing files are kept unless --force is given: a reference hash only changes after an
// intended rule change, with `regen-hash: <reason>` in the commit message (.claude/rules/tests.md).
import { existsSync, writeFileSync } from 'node:fs';
import { CLASSIC_RULES } from '../src/content/rules.ts';
import { formatHash, type MatchConfig, type ReplayFile } from '../src/sim/index.ts';
import { loadMask } from './lib/maps-node.ts';
import { Recorder } from './lib/recorder.ts';

interface Script {
  readonly name: string;
  readonly description: string;
  readonly mapId: string;
  readonly seed: number;
  readonly config: MatchConfig;
  readonly play: (r: Recorder) => void;
}

const SCRIPTS: readonly Script[] = [
  {
    name: 'duel-flat',
    description: 'Bow duel on flat ground, 60 HP: two hits win in three turns.',
    mapId: 'flat',
    seed: 7,
    config: {
      rules: { ...CLASSIC_RULES, startHp: 60 },
      teams: [{ spawns: [300] }, { spawns: [420] }],
    },
    play: (r) => {
      r.until('action');
      r.step([
        { t: 'aim', angle: 0 },
        { t: 'fire', power: 1024 },
      ]);
      r.until('transition');
      r.until('action');
      r.step([{ t: 'skip' }]);
      r.until('transition');
      r.until('action');
      r.step([
        { t: 'aim', angle: 0 },
        { t: 'fire', power: 1024 },
      ]);
      r.until('gameOver');
    },
  },
  {
    name: 'skirmish-hills',
    description:
      '2 vs 2 on the hills map: walking, jumps, sling and Greek fire for eight turns, with wind.',
    mapId: 'hills',
    seed: 20261024,
    config: {
      rules: CLASSIC_RULES,
      teams: [{ spawns: [150, 420] }, { spawns: [1150, 1420] }],
    },
    play: (r) => {
      for (let turn = 0; turn < 8; turn++) {
        r.until('action');
        const team = r.sim.view().turn.activeTeam;
        const dir = team === 0 ? 1 : -1;
        r.step([{ t: 'move', dir }]);
        r.steps(30 + turn * 7);
        r.step([{ t: 'move', dir: 0 }]);
        if (turn % 3 === 1) {
          r.step([{ t: 'jump', kind: 'forward' }]);
          r.steps(50);
        }
        const pot = turn % 2 === 1;
        r.step([
          { t: 'selectWeapon', id: pot ? 'greekFire' : 'sling' },
          ...(pot ? [{ t: 'setFuse', seconds: ((turn % 3) + 2) as 2 | 3 | 4 } as const] : []),
          { t: 'aim', angle: team === 0 ? 3650 - turn * 9 : 2530 + turn * 9 },
          { t: 'fire', power: 760 + turn * 23 },
        ]);
        r.until('transition');
      }
    },
  },
  {
    name: 'wall-arrows',
    description:
      'Terrain wear (GDD §4.7): no wind, eight arrows at the built stone wall of the hills map, ' +
      'until they dig through it; the other side passes.',
    mapId: 'hills',
    seed: 37,
    config: {
      rules: { ...CLASSIC_RULES, wind: { ...CLASSIC_RULES.wind, max: 0 } },
      teams: [{ spawns: [720] }, { spawns: [1300] }],
    },
    play: (r) => {
      for (let shot = 0; shot < 8; shot++) {
        r.until('action');
        r.step([
          { t: 'aim', angle: 60 },
          { t: 'fire', power: 1024 },
        ]);
        r.until('transition');
        r.until('action');
        r.step([{ t: 'skip' }]);
        r.until('transition');
      }
    },
  },
];

const force = process.argv.includes('--force');
for (const script of SCRIPTS) {
  const path = new URL(`../tests/replays/${script.name}.json`, import.meta.url);
  if (existsSync(path) && !force) {
    console.log(`kept    tests/replays/${script.name}.json (use --force to re-record)`);
    continue;
  }
  const r = new Recorder(script.config, script.seed, script.mapId, loadMask(script.mapId));
  script.play(r);
  const file: ReplayFile = {
    ...r.log(),
    description: script.description,
    expectedHash: formatHash(r.sim.hash()),
  };
  writeFileSync(path, JSON.stringify(file, null, 1) + '\n');
  const v = r.sim.view();
  console.log(
    `wrote   tests/replays/${script.name}.json  ticks=${v.tick} turns=${v.turn.number} ` +
      `winner=${v.winner ?? 'none'} hash=${file.expectedHash}`,
  );
}
