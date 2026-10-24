// Bootstrap: loads the greybox map mask, then starts the battle scene (hotseat, 2 houses).
import Phaser from 'phaser';
import { GREYBOX_MAPS } from '../content/maps.ts';
import { CLASSIC_RULES } from '../content/rules.ts';
import { BattleScene } from '../render/battle-scene.ts';
import { loadOverrides } from '../ui/game-ui.ts';
import { applyOverrides } from '../ui/tuning-model.ts';
import { decodeMaskPng } from './loaders/mask-png.ts';

async function boot(): Promise<void> {
  const map = GREYBOX_MAPS[0];
  if (!map) throw new Error('no greybox map');
  const res = await fetch(map.maskUrl);
  if (!res.ok) throw new Error(`cannot load ${map.maskUrl}: ${res.status}`);
  const mask = decodeMaskPng(new Uint8Array(await res.arrayBuffer()));
  // The match seed is the only non-deterministic input; everything after it replays exactly.
  const seed = crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;

  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: 'game',
    width: 1920,
    height: 1080,
    backgroundColor: '#cfd8d0',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 3 },
    render: { antialiasGL: false },
    scene: [],
  });
  const rules = applyOverrides(CLASSIC_RULES, loadOverrides());
  game.scene.add('battle', BattleScene, true, { map, mask, seed, rules });
  // Dev builds expose the game for browser-driven checks (Playwright); stripped from production.
  if (import.meta.env.DEV) (window as unknown as { medievers: Phaser.Game }).medievers = game;
}

void boot();
