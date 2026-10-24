// Spawn columns for any number of units per house (GDD §2.1: 3 to 6), spread evenly over each
// house's share of the map and nudged onto wide, solid ground. Pure: same mask, same columns.
import { MATERIAL_RULES } from '../content/materials.ts';
import type { Mask } from '../sim/terrain/mask.ts';

/** share of the map width kept clear at each end */
const EDGE_PCT = 8;
/** share of the map width kept clear on each side of the border between two houses */
const BORDER_PCT = 4;
/** px searched on each side of the ideal column for good ground */
const NUDGE = 80;
/** px: the ground must be solid this far left and right of the column, at about the same level */
const FOOTING = 24;

function surface(mask: Mask, x: number): number | null {
  for (let y = 0; y < mask.height; y++) {
    if (MATERIAL_RULES.solid[mask.data[y * mask.width + x] ?? 0]) return y;
  }
  return null;
}

/** Wide ground with open sky above: not a pillar top, not under an overhang. */
function goodColumn(mask: Mask, x: number): boolean {
  if (x < FOOTING || x >= mask.width - FOOTING) return false;
  const y = surface(mask, x);
  if (y === null || y >= mask.height - 40) return false;
  for (let dx = -FOOTING; dx <= FOOTING; dx += 4) {
    const g = surface(mask, x + dx);
    if (g === null || Math.abs(g - y) > 16) return false;
  }
  return true;
}

/** Spawn columns (px) of each house, in play order. */
export function spawnColumns(mask: Mask, teams: number, perTeam: number): number[][] {
  const w = mask.width;
  const edge = Math.round((w * EDGE_PCT) / 100);
  const border = Math.round((w * BORDER_PCT) / 100);
  const share = (w - 2 * edge) / teams;
  const out: number[][] = [];
  for (let k = 0; k < teams; k++) {
    const lo = edge + k * share + (k > 0 ? border : 0);
    const hi = edge + (k + 1) * share - (k < teams - 1 ? border : 0);
    const step = (hi - lo) / perTeam;
    const cols: number[] = [];
    for (let i = 0; i < perTeam; i++) {
      const ideal = Math.round(lo + (i + 0.5) * step);
      let x = ideal;
      for (let d = 0; d <= NUDGE; d += 4) {
        if (goodColumn(mask, ideal + d)) {
          x = ideal + d;
          break;
        }
        if (goodColumn(mask, ideal - d)) {
          x = ideal - d;
          break;
        }
      }
      cols.push(x);
    }
    // The right-hand house starts from its far end, so the two front lines play last.
    out.push(k % 2 === 1 ? cols.reverse() : cols);
  }
  return out;
}
