// Default camera framing: every living unit (and the flying shot) on screen, clear of the HUD,
// whatever the size of the window (GDD §8: « vue par défaut »).

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Screen px kept free around the framed box: HUD panels on top, action bar at the bottom. */
export interface ScreenMargins {
  readonly top: number;
  readonly bottom: number;
  readonly side: number;
}

export interface Framing {
  /** world px: point to centre the camera on */
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
}

/** World px around each unit's feet: its body and name label above, a little room aside. */
export const UNIT_EXTENT = { above: 170, below: 20, side: 60 } as const;

/**
 * The zoom and centre that fit all points in a view of viewW × viewH screen px, inside the
 * margins, never closer than maxZoom nor wider than minZoom.
 */
export function frame(
  points: readonly Point[],
  viewW: number,
  viewH: number,
  margins: ScreenMargins,
  minZoom: number,
  maxZoom: number,
): Framing | null {
  if (points.length === 0) return null;
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const p of points) {
    x0 = Math.min(x0, p.x - UNIT_EXTENT.side);
    x1 = Math.max(x1, p.x + UNIT_EXTENT.side);
    y0 = Math.min(y0, p.y - UNIT_EXTENT.above);
    y1 = Math.max(y1, p.y + UNIT_EXTENT.below);
  }
  const availW = Math.max(1, viewW - 2 * margins.side);
  const availH = Math.max(1, viewH - margins.top - margins.bottom);
  const fit = Math.min(availW / (x1 - x0), availH / (y1 - y0));
  const zoom = Math.max(minZoom, Math.min(maxZoom, fit));
  // The free area is offset by the unequal top and bottom margins: shift the centre to match.
  const shiftY = (margins.bottom - margins.top) / 2 / zoom;
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 + shiftY, zoom };
}
