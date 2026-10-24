// Records the reference replays of tests/replays/ from scripted games.
// Usage: node tools/record-reference-replays.ts [--force]
// Existing files are kept unless --force is given: a reference hash only changes after an
// intended rule change, with `regen-hash: <reason>` in the commit message (.claude/rules/tests.md).
import { existsSync, writeFileSync } from 'node:fs';
import { BEAST_RULES } from '../src/content/beasts.ts';
import { CRATE_RULES } from '../src/content/crates.ts';
import { KITCHEN_RULES } from '../src/content/kitchen.ts';
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
  {
    name: 'field-kitchen',
    description:
      'Field kitchen (GDD §4.9), lit at every chance: a pot thrown aside, then team 0 shoots ' +
      'the kitchen whenever there is one, and it comes back on the fair turns.',
    mapId: 'flat',
    seed: 11,
    config: {
      rules: {
        ...CLASSIC_RULES,
        wind: { ...CLASSIC_RULES.wind, max: 0 },
        kitchen: { ...KITCHEN_RULES, chanceStartPermille: 1000, chanceDecayPct: 100 },
      },
      teams: [{ spawns: [300] }, { spawns: [900] }],
    },
    play: (r) => {
      // Team 0 throws a pot aside, team 1 passes, then team 0 shoots every kitchen it sees.
      r.until('action');
      r.step([
        { t: 'selectWeapon', id: 'greekFire' },
        { t: 'setFuse', seconds: 1 },
        { t: 'aim', angle: 2300 },
        { t: 'fire', power: 160 },
      ]);
      r.until('transition');
      for (let turn = 0; turn < 7; turn++) {
        r.until('action');
        if (r.sim.view().turn.activeTeam === 0 && r.sim.view().kitchen) {
          r.step([
            { t: 'aim', angle: 0 },
            { t: 'fire', power: 1024 },
          ]);
        } else {
          r.step([{ t: 'skip' }]);
        }
        r.until('transition');
      }
    },
  },
  {
    name: 'powder-and-fire',
    description:
      'Every 2026-10-24 rule at once on the hills map: powder barrels, the burning parchment ' +
      '(from round 1), the field kitchen, no unit twice in a row; slings and pots for 12 turns.',
    mapId: 'hills',
    seed: 1066,
    config: {
      rules: { ...CLASSIC_RULES, burn: { startRound: 1, advancePx: 160, damage: 20 } },
      teams: [{ spawns: [150, 420, 640] }, { spawns: [1450, 1150, 960] }],
    },
    play: (r) => {
      for (let turn = 0; turn < 12; turn++) {
        r.until('action');
        const team = r.sim.view().turn.activeTeam;
        const pot = turn % 3 === 2;
        r.step([
          { t: 'selectWeapon', id: pot ? 'greekFire' : 'sling' },
          { t: 'aim', angle: team === 0 ? 3700 - turn * 11 : 2490 + turn * 11 },
          { t: 'fire', power: 700 + turn * 19 },
        ]);
        r.until('transition');
      }
    },
  },
  {
    name: 'crossbow',
    description: 'Crossbow (GDD §4.1): two bolts at fixed power across the flat map, with wind.',
    mapId: 'flat',
    seed: 1214,
    config: { rules: CLASSIC_RULES, teams: [{ spawns: [250, 350] }, { spawns: [850, 950] }] },
    play: (r) => {
      for (let turn = 0; turn < 4; turn++) {
        r.until('action');
        const team = r.sim.view().turn.activeTeam;
        r.step([
          { t: 'selectWeapon', id: 'crossbow' },
          { t: 'aim', angle: team === 0 ? 4060 : 2084 },
          { t: 'fire', power: 1 },
        ]);
        r.until('transition');
      }
    },
  },
  {
    name: 'pitch-pot',
    description: 'Pot de poix (GDD §4.1): a cluster pot bursting into five burning drops.',
    mapId: 'flat',
    seed: 1415,
    config: { rules: CLASSIC_RULES, teams: [{ spawns: [250, 350] }, { spawns: [850, 950] }] },
    play: (r) => {
      for (let turn = 0; turn < 2; turn++) {
        r.until('action');
        const team = r.sim.view().turn.activeTeam;
        r.step([
          { t: 'selectWeapon', id: 'pitchPot' },
          { t: 'setFuse', seconds: 3 },
          { t: 'aim', angle: team === 0 ? 3600 : 2544 },
          { t: 'fire', power: 760 },
        ]);
        r.until('transition');
      }
    },
  },
  {
    name: 'mace',
    description: 'Mace (GDD §4.3): units walk up to each other and club the enemy along the aim.',
    mapId: 'flat',
    seed: 1302,
    config: { rules: CLASSIC_RULES, teams: [{ spawns: [500] }, { spawns: [620] }] },
    play: (r) => {
      for (let turn = 0; turn < 4; turn++) {
        r.until('action');
        const team = r.sim.view().turn.activeTeam;
        const dir = team === 0 ? 1 : -1;
        r.step([{ t: 'move', dir }]);
        r.steps(40);
        r.step([
          { t: 'move', dir: 0 },
          { t: 'selectWeapon', id: 'mace' },
          { t: 'aim', angle: team === 0 ? 3900 : 2240 },
          { t: 'fire', power: 0 },
        ]);
        r.until('transition');
      }
    },
  },
  {
    name: 'reliquaries',
    description:
      'Reliquaries (GDD §4.5), one at every chance: they come down with the wind, units walk ' +
      'into them, slings burst them.',
    mapId: 'hills',
    seed: 1099,
    config: {
      rules: { ...CLASSIC_RULES, crates: { ...CRATE_RULES, chancePermille: 1000 } },
      teams: [{ spawns: [300, 600] }, { spawns: [1000, 1300] }],
    },
    play: (r) => {
      for (let turn = 0; turn < 8; turn++) {
        r.until('action');
        const team = r.sim.view().turn.activeTeam;
        const dir = team === 0 ? 1 : -1;
        r.step([{ t: 'move', dir }]);
        r.steps(90);
        r.step([
          { t: 'move', dir: 0 },
          { t: 'selectWeapon', id: 'sling' },
          { t: 'aim', angle: team === 0 ? 3800 - turn * 20 : 2340 + turn * 20 },
          { t: 'fire', power: 640 + turn * 30 },
        ]);
        r.until('transition');
      }
    },
  },
  {
    name: 'margins',
    description:
      'Beasts of the margins (GDD §4.10), one out at every chance: they hunt the nearest unit ' +
      'between turns and play their tricks; everybody passes for 16 turns.',
    mapId: 'hills',
    seed: 1250,
    config: {
      rules: { ...CLASSIC_RULES, beasts: { ...BEAST_RULES, spawnPermille: 1000 } },
      teams: [{ spawns: [300, 600] }, { spawns: [1000, 1300] }],
    },
    play: (r) => {
      for (let turn = 0; turn < 16; turn++) {
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
