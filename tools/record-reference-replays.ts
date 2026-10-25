// Records the reference replays of tests/replays/ from scripted games.
// Usage: node tools/record-reference-replays.ts [--force]
// Existing files are kept unless --force is given: a reference hash only changes after an
// intended rule change, with `regen-hash: <reason>` in the commit message (.claude/rules/tests.md).
import { existsSync, writeFileSync } from 'node:fs';
import { BEAST_RULES } from '../src/content/beasts.ts';
import { CRATE_RULES } from '../src/content/crates.ts';
import { DELUGE_RULES } from '../src/content/deluge.ts';
import { DRAGON_RULES } from '../src/content/dragon.ts';
import { STRUCTURE_RULES } from '../src/content/structures.ts';
import { TOWER_STRUCTURES } from '../tests/fixtures/maps/test-maps.ts';
import { KITCHEN_RULES } from '../src/content/kitchen.ts';
import { CLASSIC_RULES, type MatchRules } from '../src/content/rules.ts';
import { formatHash, type MatchConfig, type ReplayFile } from '../src/sim/index.ts';
import { loadMask } from './lib/maps-node.ts';
import { Recorder } from './lib/recorder.ts';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { placementTicks, ...TURN_NOW } = CLASSIC_RULES.turn;
/** Classique, starting on the spawn columns without the placement phase. */
const NO_PLACEMENT: MatchRules = { ...CLASSIC_RULES, turn: TURN_NOW };

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
  {
    name: 'pot-fuse-turns',
    description:
      'Greek fire with a fuse in turns (BACKLOG 4.10): pots of 1, 2 and 3 turns, the resting ' +
      'ones counting down and going off at turn starts, one thrown about by a blast.',
    mapId: 'hills',
    seed: 451,
    config: { rules: CLASSIC_RULES, teams: [{ spawns: [300, 600] }, { spawns: [1000, 1300] }] },
    play: (r) => {
      for (let turn = 0; turn < 6; turn++) {
        r.until('action');
        const team = r.sim.view().turn.activeTeam;
        r.step([
          { t: 'selectWeapon', id: 'greekFire' },
          { t: 'setFuse', seconds: ((turn % 3) + 1) as 1 | 2 | 3 },
          { t: 'aim', angle: team === 0 ? 3650 : 2490 },
          { t: 'fire', power: 520 + turn * 15 },
        ]);
        r.until('transition');
      }
    },
  },
  {
    name: 'placement',
    description:
      'Placement (GDD §2.1): the houses put their units down one at a time, one refused ' +
      'column, one unit left to the clock, then two turns of sling.',
    mapId: 'hills',
    seed: 1347,
    config: { rules: CLASSIC_RULES, teams: [{ spawns: [200, 500] }, { spawns: [1100, 1400] }] },
    play: (r) => {
      r.step([{ t: 'place', x: 320 }]);
      r.step([{ t: 'place', x: 1250 }]);
      r.step([{ t: 'place', x: 330 }]); // too close: refused
      r.step([{ t: 'place', x: 640 }]);
      r.until('action'); // the last unit is placed by the clock
      for (let turn = 0; turn < 2; turn++) {
        r.until('action');
        const team = r.sim.view().turn.activeTeam;
        r.step([
          { t: 'selectWeapon', id: 'sling' },
          { t: 'aim', angle: team === 0 ? 3700 : 2440 },
          { t: 'fire', power: 800 },
        ]);
        r.until('transition');
      }
    },
  },
  {
    name: 'classes-regicide',
    description:
      'Classes and Régicide (GDD §2.3, §3.2) on the hills map: knights, archers, slingers, ' +
      'clerics and kings trade arrows, sling stones and pots until a king falls.',
    mapId: 'hills',
    seed: 1214,
    config: {
      rules: { ...NO_PLACEMENT, regicide: true, startHp: 60 },
      teams: [
        { spawns: [250, 420, 560], classes: ['king', 'cleric', 'slinger'] },
        { spawns: [1050, 1200, 1380], classes: ['knight', 'archer', 'king'] },
      ],
    },
    play: (r) => {
      for (let turn = 0; turn < 12 && r.sim.view().turn.phase !== 'gameOver'; turn++) {
        r.until('action');
        const team = r.sim.view().turn.activeTeam;
        const weapon = (['bow', 'sling', 'greekFire'] as const)[turn % 3] ?? 'bow';
        r.step([
          { t: 'selectWeapon', id: weapon },
          { t: 'aim', angle: team === 0 ? 3720 - turn * 13 : 2420 + turn * 13 },
          { t: 'fire', power: 780 + turn * 17 },
        ]);
        r.until('transition');
      }
    },
  },
  {
    name: 'deluge',
    description:
      'Le Déluge (GDD §2.4) from turn 2, rising fast: slings while the water climbs the hills ' +
      'and drowns the low ground, until a house is gone.',
    mapId: 'hills',
    seed: 1421,
    config: {
      rules: {
        ...NO_PLACEMENT,
        deluge: { ...DELUGE_RULES, startTurn: 2, risePx: 60, damage: 5 },
      },
      teams: [{ spawns: [200, 560] }, { spawns: [1000, 1400] }],
    },
    play: (r) => {
      for (let turn = 0; turn < 20 && r.sim.view().turn.phase !== 'gameOver'; turn++) {
        r.until('action');
        const team = r.sim.view().turn.activeTeam;
        r.step([
          { t: 'selectWeapon', id: 'sling' },
          { t: 'aim', angle: team === 0 ? 3700 : 2440 },
          { t: 'fire', power: 700 + turn * 11 },
        ]);
        r.until('transition');
      }
    },
  },
  {
    name: 'ladder',
    description:
      'Climbing (GDD §4.4) the ladder of the hills map: up while held, clinging, down again, ' +
      'then letting go by walking off it.',
    mapId: 'hills',
    seed: 1190,
    config: { rules: NO_PLACEMENT, teams: [{ spawns: [1166] }, { spawns: [300] }] },
    play: (r) => {
      r.until('action');
      r.step([{ t: 'climb', dir: -1 }]);
      r.steps(150);
      r.step([{ t: 'climb', dir: 0 }]);
      r.steps(30);
      r.step([{ t: 'climb', dir: 1 }]);
      r.steps(40);
      r.step([{ t: 'climb', dir: 0 }]);
      r.step([{ t: 'move', dir: -1 }]);
      r.steps(30);
      r.step([{ t: 'move', dir: 0 }]);
      r.until('transition');
    },
  },
  {
    name: 'ladder-whole',
    description:
      'A ladder that ends the turn (GDD §4.4, rules.unit.ladderEndsTurn): one press of ↑ takes ' +
      'the unit all the way up, other orders ignored on the way, and the turn ends at the top.',
    mapId: 'hills',
    seed: 1191,
    config: { rules: NO_PLACEMENT, teams: [{ spawns: [1166] }, { spawns: [300] }] },
    play: (r) => {
      r.until('action');
      r.step([{ t: 'climb', dir: -1 }]);
      r.step([{ t: 'climb', dir: 0 }]);
      r.step([{ t: 'move', dir: -1 }]);
      r.steps(20);
      r.step([{ t: 'move', dir: 0 }]);
      r.until('transition');
    },
  },
  {
    name: 'weapon-memory',
    description:
      'Each unit keeps its weapon (rules.turn.rememberWeapon): two units per house choose the ' +
      'sling and the crossbow, hand the turn back and forth, and take them up again turns later.',
    mapId: 'hills',
    seed: 1192,
    config: { rules: NO_PLACEMENT, teams: [{ spawns: [300, 520] }, { spawns: [1500, 1700] }] },
    play: (r) => {
      for (let turn = 0; turn < 8; turn++) {
        r.until('action');
        const v = r.sim.view();
        const team = v.turn.activeTeam;
        if (turn < 2) {
          r.step([{ t: 'selectWeapon', id: 'sling' }]);
          const mate = v.teams[team]?.unitIds.find((id) => id !== v.turn.activeUnitId);
          if (mate !== undefined) r.step([{ t: 'selectUnit', unitId: mate }]);
          r.step([{ t: 'selectWeapon', id: 'crossbow' }]);
        }
        r.step([
          { t: 'aim', angle: team === 0 ? 3800 : 2340 },
          { t: 'fire', power: 900 },
        ]);
        r.until('transition');
      }
    },
  },
  {
    name: 'greek-flames',
    description:
      'Greek fire flames (GDD §4.1, §4.6): pots set for this turn leave burning patches that ' +
      'scorch whoever stands in them, 10 HP a turn at most, and go out after three turns.',
    mapId: 'flat',
    seed: 1453,
    config: { rules: NO_PLACEMENT, teams: [{ spawns: [300, 450] }, { spawns: [750, 900] }] },
    play: (r) => {
      for (let turn = 0; turn < 8; turn++) {
        r.until('action');
        const team = r.sim.view().turn.activeTeam;
        if (turn < 4) {
          r.step([
            { t: 'selectWeapon', id: 'greekFire' },
            { t: 'setFuse', seconds: 1 },
            { t: 'aim', angle: team === 0 ? 3700 : 2444 },
            { t: 'fire', power: 640 + turn * 20 },
          ]);
        } else r.step([{ t: 'skip' }]);
        r.until('transition');
      }
    },
  },
  {
    name: 'tower-collapse',
    description:
      'Structures (GDD §4.7) on the tower map: Greek fire and arrows at the tower until it ' +
      'cracks, falls to ruin and collapses, toppling onto the unit beside it.',
    mapId: 'tower',
    seed: 1291,
    config: {
      rules: {
        ...NO_PLACEMENT,
        wind: { ...NO_PLACEMENT.wind, max: 0 },
        structures: {
          ...STRUCTURE_RULES,
          defs: { ...STRUCTURE_RULES.defs, tower: { ...STRUCTURE_RULES.defs.tower, hp: 100 } },
        },
      },
      teams: [{ spawns: [380] }, { spawns: [680, 1000] }],
      structures: TOWER_STRUCTURES,
    },
    play: (r) => {
      for (let turn = 0; turn < 10 && r.sim.view().structures[0]?.state !== 3; turn++) {
        r.until('action');
        if (r.sim.view().turn.activeTeam === 0) {
          const pot = turn === 0;
          r.step([
            { t: 'selectWeapon', id: pot ? 'greekFire' : 'bow' },
            ...(pot ? [{ t: 'setFuse', seconds: 1 } as const] : []),
            { t: 'aim', angle: pot ? 3800 : 4000 },
            { t: 'fire', power: pot ? 450 : 1024 },
          ]);
        } else r.step([{ t: 'skip' }]);
        r.until('transition');
      }
      r.until('transition');
    },
  },
  {
    name: 'pick-sap',
    description:
      'Digging tools (GDD §4.4): a sapper picks a shaft down, then saps a level tunnel from its ' +
      'bottom; the knight across picks his own shaft, half as deep.',
    mapId: 'flat',
    seed: 404,
    config: {
      rules: { ...NO_PLACEMENT, wind: { ...NO_PLACEMENT.wind, max: 0 } },
      teams: [
        { spawns: [300], classes: ['sapper'] },
        { spawns: [900], classes: ['knight'] },
      ],
    },
    play: (r) => {
      const digs: [string, number][] = [
        ['pick', 0],
        ['pick', 0],
        ['sap', 0],
        ['skip', 0],
      ];
      for (const [weapon, angle] of digs) {
        r.until('action');
        if (weapon === 'skip') r.step([{ t: 'skip' }]);
        else {
          r.step([
            { t: 'selectWeapon', id: weapon as 'pick' | 'sap' },
            { t: 'aim', angle },
            { t: 'fire', power: 0 },
          ]);
        }
        r.until('transition');
      }
    },
  },
  {
    name: 'caltrop',
    description:
      'Chausse-trape (GDD §4.4): one left ahead of a unit, which steps back; the enemy walks ' +
      'across the field onto it two turns later.',
    mapId: 'flat',
    seed: 512,
    config: {
      rules: { ...NO_PLACEMENT, wind: { ...NO_PLACEMENT.wind, max: 0 } },
      teams: [{ spawns: [300] }, { spawns: [560] }],
    },
    play: (r) => {
      r.until('action');
      r.step([
        { t: 'selectWeapon', id: 'caltrop' },
        { t: 'aim', angle: 0 },
        { t: 'fire', power: 0 },
      ]);
      r.step([{ t: 'move', dir: -1 }]);
      r.steps(60);
      r.step([{ t: 'move', dir: 0 }]);
      r.until('transition');
      r.until('action');
      r.step([{ t: 'move', dir: -1 }]);
      r.steps(240);
      r.step([{ t: 'move', dir: 0 }]);
      r.until('transition');
    },
  },
  {
    name: 'dragon',
    description:
      'Dragon (GDD §4.11), across the sky at every turn: an archer waits for it overhead and ' +
      'shoots it; it swoops on an enemy, swallows it and flies away.',
    mapId: 'flat',
    seed: 2026,
    config: {
      rules: {
        ...NO_PLACEMENT,
        wind: { ...NO_PLACEMENT.wind, max: 0 },
        dragon: { ...DRAGON_RULES, spawnPermille: 1000 },
      },
      teams: [{ spawns: [600] }, { spawns: [300, 1000] }],
    },
    play: (r) => {
      r.until('action');
      const archer = r.sim.view().units[0];
      for (let i = 0; i < 3000; i++) {
        const d = r.sim.view().dragon;
        if (!d || !archer || Math.abs(d.x - archer.x) < 20 * 256) break;
        r.step([]);
      }
      r.step([
        { t: 'aim', angle: 3072 },
        { t: 'fire', power: 1024 },
      ]);
      r.until('transition');
      r.until('action');
      r.step([{ t: 'skip' }]);
      r.until('transition');
    },
  },
  {
    name: 'stone-wall',
    description:
      'Mur de pierres (GDD §4.4): a long wall set upright between the two houses, then an ' +
      'arrow that stops in it, and a short slanted one refused on a unit.',
    mapId: 'flat',
    seed: 77,
    config: {
      rules: { ...NO_PLACEMENT, wind: { ...NO_PLACEMENT.wind, max: 0 } },
      teams: [{ spawns: [300] }, { spawns: [700] }],
    },
    play: (r) => {
      r.until('action');
      const ground = (r.sim.view().units[0]?.y ?? 0) >> 8;
      r.step([
        { t: 'selectWeapon', id: 'stoneWall' },
        { t: 'setFuse', seconds: 3 },
        { t: 'aim', angle: 1024 },
        { t: 'fireAt', x: 700, y: ground - 60 },
        { t: 'fireAt', x: 450, y: ground - 60 },
      ]);
      r.until('transition');
      r.until('action');
      r.step([
        { t: 'aim', angle: 2048 },
        { t: 'fire', power: 1024 },
      ]);
      r.until('transition');
    },
  },
  {
    name: 'fire-arrow',
    description:
      'Fire arrows (2026-10-25): one sets the wooden tower alight, one leaves a flame by the ' +
      'enemy, one strikes him for 40 HP; the tower burns down over the turns.',
    mapId: 'flat',
    seed: 1066,
    config: {
      rules: {
        ...NO_PLACEMENT,
        wind: { ...NO_PLACEMENT.wind, max: 0 },
        structures: { ...STRUCTURE_RULES },
        weapons: NO_PLACEMENT.weapons.map((w) => (w.id === 'fireArrow' ? { ...w, ammo: 6 } : w)),
      },
      teams: [{ spawns: [300] }, { spawns: [1000] }],
      structures: [{ id: 1, type: 'woodTower', build: { x: 600, width: 100, ladder: -1 } }],
    },
    play: (r) => {
      const shots = [
        [3520, 600],
        [3600, 600],
        [3840, 800],
      ] as const;
      for (let turn = 0; turn < 8; turn++) {
        r.until('action');
        const shot = shots[turn >> 1];
        if (r.sim.view().turn.activeTeam === 0 && shot) {
          r.step([
            { t: 'selectWeapon', id: 'fireArrow' },
            { t: 'aim', angle: shot[0] },
            { t: 'fire', power: shot[1] },
          ]);
        } else r.step([{ t: 'skip' }]);
        r.until('transition');
      }
    },
  },
  {
    name: 'trebuchet',
    description:
      'Volée de trébuchet (GDD §4.2): five stones called down on the enemy, thrown from the ' +
      'west; then one with the gauge, from the east.',
    mapId: 'flat',
    seed: 1250,
    config: {
      rules: {
        ...NO_PLACEMENT,
        wind: { ...NO_PLACEMENT.wind, max: 0 },
        weapons: NO_PLACEMENT.weapons.map((w) => (w.id === 'trebuchet' ? { ...w, ammo: 2 } : w)),
      },
      teams: [{ spawns: [300] }, { spawns: [900, 1000] }],
    },
    play: (r) => {
      r.until('action');
      r.step([
        { t: 'selectWeapon', id: 'trebuchet' },
        { t: 'aim', angle: 0 },
        { t: 'fireAt', x: 900, y: 0 },
      ]);
      r.until('transition');
      r.until('action');
      r.step([{ t: 'skip' }]);
      r.until('transition');
      r.until('action');
      r.step([
        { t: 'selectWeapon', id: 'trebuchet' },
        { t: 'aim', angle: 0 },
        { t: 'fire', power: 460 },
      ]);
      r.until('transition');
    },
  },
  {
    name: 'sword-charge',
    description:
      'Épée et charge à l’écu (GDD §4.3): a level sword blow at the enemy in front, then a ' +
      'shield charge that throws two enemies over.',
    mapId: 'flat',
    seed: 1214,
    config: {
      rules: { ...NO_PLACEMENT, wind: { ...NO_PLACEMENT.wind, max: 0 } },
      teams: [{ spawns: [300, 500] }, { spawns: [340, 560, 600] }],
    },
    play: (r) => {
      r.until('action');
      r.step([
        { t: 'selectWeapon', id: 'sword' },
        { t: 'aim', angle: 3400 },
        { t: 'fire', power: 0 },
      ]);
      r.until('transition');
      r.until('action');
      r.step([{ t: 'skip' }]);
      r.until('transition');
      r.until('action');
      r.step([
        { t: 'selectUnit', unitId: 2 },
        { t: 'selectWeapon', id: 'shieldCharge' },
        { t: 'aim', angle: 0 },
        { t: 'fire', power: 0 },
      ]);
      r.until('transition');
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
