// Bootstrap: loads the greybox map mask, then starts the battle scene (hotseat, 2 houses).
import Phaser from 'phaser';
import { GREYBOX_MAPS } from '../content/maps.ts';
import { BattleScene, type BattleData } from '../render/battle-scene.ts';
import type { GameLog } from '../sim/log.ts';
import { showSetupScreen } from '../ui/setup-screen.ts';
import { loadSetup, rulesFor, saveSetup, type MatchSetup } from './match-setup.ts';
import { loadSave } from './autosave.ts';
import { loadFonts } from '../ui/fonts.ts';
import { loadOverrides } from '../ui/game-ui.ts';
import { decodeMaskPng } from './loaders/mask-png.ts';

async function boot(): Promise<void> {
  const map = GREYBOX_MAPS[0];
  if (!map) throw new Error('no greybox map');
  const res = await fetch(map.maskUrl);
  if (!res.ok) throw new Error(`cannot load ${map.maskUrl}: ${res.status}`);
  const mask = decodeMaskPng(new Uint8Array(await res.arrayBuffer()));
  // Phaser rasterises texts once: the faces must be ready before the first scene.
  await loadFonts();
  // The match seed is the only non-deterministic input; everything after it replays exactly.
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
  const start = (chosen: MatchSetup, resume?: GameLog, replay?: GameLog): void => {
    const data: BattleData = {
      map,
      mask,
      seed,
      rules: rulesFor(chosen, overrides),
      setup: chosen,
      ...(resume ? { resume } : {}),
      ...(replay ? { replay } : {}),
    };
    game.scene.add('battle', BattleScene, true, data);
  };
  // A match left in progress (refresh, crash, reboot) resumes where it was; otherwise the houses
  // are chosen first, on the setup screen.
  const save = loadSave();
  if (save && save.mapId === map.id) start(setup, save);
  else {
    showSetupScreen(
      setup,
      (chosen) => {
        saveSetup(chosen);
        start(chosen);
      },
      undefined,
      (log) => start(setup, undefined, log),
    );
  }
  // Dev builds expose the game for browser-driven checks (Playwright); stripped from production.
  if (import.meta.env.DEV) (window as unknown as { medievers: Phaser.Game }).medievers = game;
}

void boot();
