import { describe, expect, it } from 'vitest';
import { UNIT_EXTENT, frame } from '../../src/render/framing.ts';

const M = { top: 100, bottom: 100, side: 20 };

describe('frame', () => {
  it('fits units spread over the whole map on a small screen', () => {
    const units = [
      { x: 420, y: 900 },
      { x: 3420, y: 1100 },
    ];
    const f = frame(units, 1280, 620, M, 0.1, 0.75);
    expect(f).not.toBeNull();
    if (!f) return;
    const span = 3420 - 420 + 2 * UNIT_EXTENT.side;
    expect(span * f.zoom).toBeLessThanOrEqual(1280 - 2 * M.side + 1e-9);
    // Every unit is inside the visible area.
    const halfW = 1280 / 2 / f.zoom;
    for (const u of units) expect(Math.abs(u.x - f.x)).toBeLessThanOrEqual(halfW);
  });

  it('does not zoom in closer than the limit when units are close together', () => {
    const f = frame([{ x: 500, y: 500 }], 1920, 1080, M, 0.1, 0.75);
    expect(f?.zoom).toBe(0.75);
  });

  it('keeps the box clear of a taller top margin', () => {
    const f = frame([{ x: 0, y: 0 }], 1000, 1000, { top: 300, bottom: 100, side: 0 }, 1, 1);
    // Free area: screen y 300..900, centre 600, i.e. 100 px below the screen centre.
    const box = (0 - UNIT_EXTENT.above + UNIT_EXTENT.below) / 2;
    expect(f?.y).toBe(box - 100);
  });

  it('returns null with nothing to frame', () => {
    expect(frame([], 800, 600, M, 0.1, 1)).toBeNull();
  });
});
