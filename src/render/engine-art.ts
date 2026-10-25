// The siege engines (GDD §4.8), drawn in timber and iron over flat colours, as in the margins of
// the manuscript: a ballista, a scorpion, a catapult, a trebuchet and a ram, standing on the
// ground at (x, y), `w` by `h` px.
import type Phaser from 'phaser';
import type { EngineType } from '../content/engines.ts';
import { COLORS } from '../ui/tokens.ts';

type G = Phaser.GameObjects.Graphics;

const INK = COLORS.encre;
const WOOD = COLORS.terreOmbre;
const LIGHT = COLORS.ocre;

/** A wooden beam from (x0, y0) to (x1, y1), inked. */
function beam(g: G, x0: number, y0: number, x1: number, y1: number, w = 6): void {
  g.lineStyle(w + 3, INK, 1);
  g.lineBetween(x0, y0, x1, y1);
  g.lineStyle(w, WOOD, 1);
  g.lineBetween(x0, y0, x1, y1);
}

/** A wheel at (x, y). */
function wheel(g: G, x: number, y: number, r: number): void {
  g.fillStyle(WOOD, 1);
  g.lineStyle(3, INK, 1);
  g.fillCircle(x, y, r);
  g.strokeCircle(x, y, r);
  g.lineStyle(2, LIGHT, 1);
  g.lineBetween(x - r + 2, y, x + r - 2, y);
  g.lineBetween(x, y - r + 2, x, y + r - 2);
}

export function drawEngine(
  g: G,
  type: EngineType,
  x: number,
  y: number,
  w: number,
  h: number,
  time: number,
): void {
  const hw = w / 2;
  switch (type) {
    case 'ballista':
    case 'scorpion': {
      // A great crossbow on a trestle.
      beam(g, x - hw * 0.6, y, x, y - h * 0.55);
      beam(g, x + hw * 0.6, y, x, y - h * 0.55);
      beam(g, x - hw, y - h * 0.62, x + hw, y - h * 0.62, 8);
      g.lineStyle(5, INK, 1);
      g.beginPath();
      g.arc(x, y - h * 0.62 + hw * 0.9, hw * 1.05, -Math.PI * 0.8, -Math.PI * 0.2);
      g.strokePath();
      g.lineStyle(2, COLORS.ceruse, 1);
      g.lineBetween(x - hw * 0.85, y - h * 0.82, x + hw * 0.85, y - h * 0.82);
      if (type === 'scorpion') {
        g.fillStyle(COLORS.roche, 1);
        for (const k of [-6, 0, 6])
          g.fillTriangle(
            x + hw,
            y - h * 0.62 + k,
            x + hw - 8,
            y - h * 0.62 + k - 3,
            x + hw - 8,
            y - h * 0.62 + k + 3,
          );
      }
      break;
    }
    case 'catapult': {
      beam(g, x - hw, y - 10, x + hw, y - 10, 8);
      wheel(g, x - hw * 0.65, y - 7, 8);
      wheel(g, x + hw * 0.65, y - 7, 8);
      beam(g, x - hw * 0.35, y - 12, x, y - h * 0.65);
      beam(g, x + hw * 0.35, y - 12, x, y - h * 0.65);
      const sway = Math.sin(time / 600) * 0.05;
      beam(g, x - hw * 0.5, y - 16, x + hw * (0.55 + sway), y - h, 7);
      g.fillStyle(COLORS.roche, 1);
      g.lineStyle(2, INK, 1);
      g.fillCircle(x + hw * (0.55 + sway), y - h - 4, 7);
      g.strokeCircle(x + hw * (0.55 + sway), y - h - 4, 7);
      break;
    }
    case 'trebuchet': {
      beam(g, x - hw * 0.7, y, x, y - h * 0.7, 8);
      beam(g, x + hw * 0.7, y, x, y - h * 0.7, 8);
      beam(g, x - hw, y - 2, x + hw, y - 2, 8);
      beam(g, x - hw * 0.8, y - h * 0.45, x + hw * 0.9, y - h, 7);
      g.fillStyle(COLORS.roche, 1);
      g.lineStyle(3, INK, 1);
      g.fillRect(x - hw * 0.8 - 12, y - h * 0.45, 24, 22);
      g.strokeRect(x - hw * 0.8 - 12, y - h * 0.45, 24, 22);
      g.fillStyle(COLORS.or, 1);
      g.fillCircle(x, y - h * 0.7, 4);
      break;
    }
    case 'ram': {
      // A roofed shed on wheels, a great beam with an iron head inside.
      wheel(g, x - hw * 0.6, y - 9, 9);
      wheel(g, x + hw * 0.6, y - 9, 9);
      beam(g, x - hw * 0.8, y - 14, x - hw * 0.8, y - h * 0.75);
      beam(g, x + hw * 0.8, y - 14, x + hw * 0.8, y - h * 0.75);
      const eave = y - h * 0.72;
      g.fillStyle(COLORS.vermillon, 1);
      g.lineStyle(3, INK, 1);
      g.fillTriangle(x - hw, eave, x, y - h, x + hw, eave);
      g.strokeTriangle(x - hw, eave, x, y - h, x + hw, eave);
      beam(g, x - hw - 6, y - h * 0.45, x + hw + 8, y - h * 0.45, 9);
      g.fillStyle(COLORS.roche, 1);
      g.fillCircle(x + hw + 10, y - h * 0.45, 7);
      g.strokeCircle(x + hw + 10, y - h * 0.45, 7);
      break;
    }
  }
}
