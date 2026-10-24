import { describe, expect, it } from 'vitest';
import { ReplayInput } from '../../src/input/replay-input.ts';
import { LOG_VERSION, type GameLog } from '../../src/sim/log.ts';
import { CLASSIC_RULES } from '../rules-fixture.ts';

const log: GameLog = {
  version: LOG_VERSION,
  config: { rules: CLASSIC_RULES, teams: [{ spawns: [100] }, { spawns: [200] }] },
  seed: 1,
  mapId: 'flat',
  commands: [
    [3, { t: 'skip' }],
    [5, { t: 'aim', angle: 10 }],
    [5, { t: 'fire', power: 100 }],
  ],
  endTick: 9,
};

describe('ReplayInput', () => {
  it('hands each tick the commands recorded for it, in order', () => {
    const r = new ReplayInput(log);
    const got = Array.from({ length: 9 }, (_, i) => r.poll(i + 1).map((c) => c.t));
    expect(got).toEqual([[], [], ['skip'], [], ['aim', 'fire'], [], [], [], []]);
    expect(r.done(8)).toBe(false);
    expect(r.done(9)).toBe(true);
  });
});
