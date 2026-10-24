import { beforeEach, describe, expect, it } from 'vitest';
import { AutoSaver, clearSave, loadSave } from '../../src/app/autosave.ts';
import { CLASSIC_RULES } from '../rules-fixture.ts';
import { Material, Sim, replay, type GameCommand, type Mask } from '../../src/sim/index.ts';

/** In-memory stand-in for the browser's localStorage. */
class MemoryStorage {
  private readonly items = new Map<string, string>();
  getItem(k: string): string | null {
    return this.items.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.items.set(k, v);
  }
  removeItem(k: string): void {
    this.items.delete(k);
  }
}

function flatMask(): Mask {
  const width = 1200;
  const height = 600;
  const data = new Uint8Array(width * height);
  for (let y = 500; y < height; y++) data.fill(Material.Earth, y * width, (y + 1) * width);
  return { width, height, data };
}

describe('autosave', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
  });

  it('resumes a match at the exact same state after a « refresh »', () => {
    const config = { rules: CLASSIC_RULES, teams: [{ spawns: [300] }, { spawns: [900] }] };
    const live = new Sim(config, 42, flatMask());
    const saver = new AutoSaver(config, 42, 'test-flat');
    const script = new Map<number, GameCommand[]>([
      [130, [{ t: 'move', dir: 1 }]],
      [
        170,
        [
          { t: 'move', dir: 0 },
          { t: 'aim', angle: 3500 },
        ],
      ],
      [180, [{ t: 'fire', power: 700 }]],
    ]);
    let now = 0;
    for (let tick = 1; tick <= 900; tick++) {
      const cmds = script.get(tick) ?? [];
      saver.record(tick, cmds, now);
      live.step(cmds);
      now += 1000 / 60;
      saver.flush(tick, now);
    }
    saver.flush(900, now + 5000);

    const save = loadSave();
    if (!save) throw new Error('nothing saved');
    expect(save.endTick).toBe(900);
    const resumed = replay(save, flatMask());
    expect(resumed.hash()).toBe(live.hash());
  });

  it('forgets the save once cleared', () => {
    const saver = new AutoSaver({ rules: CLASSIC_RULES, teams: [] }, 1, 'm');
    saver.flush(10, 0);
    expect(loadSave()).not.toBeNull();
    clearSave();
    expect(loadSave()).toBeNull();
  });
});
