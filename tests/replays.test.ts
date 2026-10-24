import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatHash, replay, type ReplayFile } from '../src/sim/index.ts';
import { loadMask } from '../tools/lib/maps-node.ts';

const dir = new URL('./replays/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

describe('reference replays', () => {
  it('exist', () => {
    expect(files.length).toBeGreaterThanOrEqual(2);
  });

  for (const name of files) {
    it(`${name} replays to its expected hash`, () => {
      const file = JSON.parse(readFileSync(new URL(name, dir), 'utf8')) as ReplayFile;
      expect(formatHash(replay(file, loadMask(file.mapId)).hash())).toBe(file.expectedHash);
    });
  }

  it('detects a diverging replay', () => {
    const file = JSON.parse(readFileSync(new URL('duel-flat.json', dir), 'utf8')) as ReplayFile;
    const tampered: ReplayFile = { ...file, seed: file.seed + 1 };
    expect(formatHash(replay(tampered, loadMask(file.mapId)).hash())).not.toBe(file.expectedHash);
  });
});
