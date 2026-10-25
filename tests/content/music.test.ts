// The ambient ritornello (BACKLOG 7.8): a score that holds together, so its loop has no seam.
import { describe, expect, it } from 'vitest';
import { EIGHTHS_PER_BAR, RITORNELLO } from '../../src/content/music.ts';

/** D Dorian: D E F G A B C. */
const DORIAN = new Set([2, 4, 5, 7, 9, 11, 0]);

describe('ritornello', () => {
  it('fills every bar with exactly six eighths, and has a chord for each', () => {
    for (const phrase of RITORNELLO) {
      expect(phrase.bars).toHaveLength(4);
      expect(phrase.chords).toHaveLength(4);
      for (const bar of phrase.bars) {
        expect(bar.reduce((sum, [, len]) => sum + len, 0)).toBe(EIGHTHS_PER_BAR);
      }
    }
  });

  it('keeps to D Dorian, starts on the tonic chord and comes home to D', () => {
    for (const phrase of RITORNELLO) {
      for (const bar of phrase.bars) {
        for (const [pitch] of bar) if (pitch > 0) expect(DORIAN.has(pitch % 12)).toBe(true);
      }
    }
    expect((RITORNELLO[0]?.chords[0]?.root ?? 0) % 12).toBe(2);
    const last = RITORNELLO.at(-1)?.bars.at(-1) ?? [];
    expect(last.find(([p]) => p > 0)?.[0]).toBe(62);
  });
});
