// Bootstrap: the fonts, then the setup screen (or the match left in progress), then the battle
// scene on the chosen map, drawn anew for each match (hotseat, 2 to 4 houses).
import Phaser from 'phaser';
import { GREYBOX_MAPS } from '../content/maps.ts';
import { BattleScene, battleMap, onlineBattle, type BattleData } from '../render/battle-scene.ts';
import type { GameLog } from '../sim/log.ts';
import { showSetupScreen } from '../ui/setup-screen.ts';
import { t } from '../ui/i18n.ts';
import { loadSetup, rulesFor, saveSetup, type MatchSetup } from './match-setup.ts';
import { loadSave } from './autosave.ts';
import { loadFonts } from '../ui/fonts.ts';
import { loadOverrides } from '../ui/game-ui.ts';
import { decodeMaskPng } from './loaders/mask-png.ts';
import { buildMap, legacyMap, mapForLog, type BuiltMap } from './map-build.ts';
import { loadOnlineCode, type OnlineMatch } from './online.ts';
import { hostFlow, joinFlow, rejoinFlow } from './online-flow.ts';

/** The map a log was played on: drawn again, or for the old greybox logs, loaded. */
async function mapOfLog(log: GameLog): Promise<BuiltMap | null> {
  const built = mapForLog(log.mapId);
  if (built) return built;
  const def = GREYBOX_MAPS.find((m) => m.id === log.mapId);
  if (!def?.maskUrl) return null;
  const res = await fetch(def.maskUrl);
  if (!res.ok) return null;
  return legacyMap(def.id, decodeMaskPng(new Uint8Array(await res.arrayBuffer())));
}

async function boot(): Promise<void> {
  // Phaser rasterises texts once: the faces must be ready before the first scene.
  await loadFonts();
  // The match seed is the only non-deterministic input; everything after it replays exactly,
  // the map included.
  const seed = crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;

  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: 'game',
    backgroundColor: '#1a1410',
    // The canvas fills the window, whatever its shape; the camera zoom adapts (battle-scene).
    scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
    input: { activePointers: 3 },
    render: { antialiasGL: false },
    scene: [],
  });
  const overrides = loadOverrides();
  const setup = loadSetup(Object.keys(overrides).length > 0);
  const start = (chosen: MatchSetup, map: BuiltMap, logs: Partial<BattleData> = {}): void => {
    const data: BattleData = {
      ...battleMap(map),
      seed,
      rules: rulesFor(chosen, overrides),
      setup: chosen,
      ...logs,
    };
    game.scene.add('battle', BattleScene, true, data);
  };
  const play = (m: OnlineMatch): void => {
    game.scene.add('battle', BattleScene, true, onlineBattle(m));
  };
  const choose = (): void => {
    showSetupScreen(
      setup,
      (chosen) => {
        saveSetup(chosen);
        start(chosen, buildMap(chosen.map, seed));
      },
      undefined,
      (log) => {
        void mapOfLog(log).then((map) => {
          if (map) start(setup, map, { replay: log });
          else {
            window.alert(t('setup.importMap'));
            choose();
          }
        });
      },
      {
        host: (chosen) => {
          saveSetup(chosen);
          hostFlow(chosen, rulesFor(chosen, overrides), seed, play, choose);
        },
        join: () => joinFlow(play, choose),
      },
    );
  };
  // A match left in progress (refresh, crash, reboot) resumes where it was; otherwise the houses
  // are chosen first, on the setup screen.
  // An online match in progress takes its seat again by its code.
  const code = loadOnlineCode();
  const save = loadSave();
  const saved = save ? await mapOfLog(save) : null;
  if (code) rejoinFlow(code, play, choose);
  else if (save && saved) start(setup, saved, { resume: save });
  else choose();
  // Dev builds expose the game for browser-driven checks (Playwright); stripped from production.
  if (import.meta.env.DEV) (window as unknown as { medieverse: Phaser.Game }).medieverse = game;
}

void boot();
