import { describe, expect, it } from 'vitest';
import { FixedStep } from '../../src/render/fixed-step.ts';

const TICK_MS = 1000 / 60;
const TEN_MINUTES = 10 * 60 * 1000;

/** Runs frames of the given durations for ten minutes; returns ticks run and time elapsed. */
function run(frame: (i: number) => number): { ticks: number; elapsed: number } {
  const clock = new FixedStep(TICK_MS, 5, 250);
  let ticks = 0;
  let elapsed = 0;
  for (let i = 0; elapsed < TEN_MINUTES; i++) {
    const d = frame(i);
    elapsed += d;
    ticks += clock.advance(d);
  }
  return { ticks, elapsed };
}

describe('FixedStep', () => {
  it.each([
    ['60 Hz', 1000 / 60],
    ['100 Hz', 10],
    ['144 Hz', 1000 / 144],
    ['30 Hz', 1000 / 30],
  ])('does not drift over ten minutes at %s', (_name, frameMs) => {
    const { ticks, elapsed } = run(() => frameMs);
    expect(Math.abs(ticks - (elapsed / 1000) * 60)).toBeLessThan(1 + 1e-6); // at most the tick in progress
  });

  it('does not drift with jittery frames around 60 Hz', () => {
    // Deterministic jitter of ±4 ms.
    let seed = 12345;
    const jitter = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return (seed / 2147483648) * 8 - 4;
    };
    const { ticks, elapsed } = run(() => 1000 / 60 + jitter());
    expect(Math.abs(ticks - (elapsed / 1000) * 60)).toBeLessThan(1 + 1e-6); // at most the tick in progress
  });

  it('drops the lag after a stall instead of fast-forwarding', () => {
    const clock = new FixedStep(TICK_MS, 5, 250);
    expect(clock.advance(2000)).toBe(5);
    expect(clock.advance(TICK_MS)).toBe(1);
  });

  it('gives the interpolation factor between two ticks', () => {
    const clock = new FixedStep(TICK_MS, 5, 250);
    clock.advance(TICK_MS * 1.5);
    expect(clock.alpha).toBeCloseTo(0.5, 6);
  });
});
