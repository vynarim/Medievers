// Class marks (GDD §3.2), drawn over each class's placeholder figure (figures.ts) until the rigs
// of M6: the king's crown, the archer's quiver, the slinger's sling, the sapper's pick, the
// cleric's crosier. The knight has his helm and shield.
import type Phaser from 'phaser';
import type { ClassId } from '../content/classes.ts';
import { COLORS } from '../ui/tokens.ts';

/** Draws the mark of class `cls` on a figure standing at (x, y), facing `facing`. */
export function drawClassMark(
  g: Phaser.GameObjects.Graphics,
  cls: ClassId | null,
  x: number,
  y: number,
  facing: number,
): void {
  const ink = COLORS.encre;
  const hx = x + facing * 2;
  const top = y - 79;
  switch (cls) {
    case 'king': {
      // Open gold crown with three fleurons on the helm.
      g.fillStyle(COLORS.or, 1);
      g.lineStyle(2, ink, 1);
      g.fillRect(hx - 11, top - 2, 22, 6);
      g.strokeRect(hx - 11, top - 2, 22, 6);
      for (const dx of [-9, 0, 9]) {
        g.fillTriangle(hx + dx - 4, top - 2, hx + dx + 4, top - 2, hx + dx, top - 11);
        g.strokeTriangle(hx + dx - 4, top - 2, hx + dx + 4, top - 2, hx + dx, top - 11);
      }
      g.fillStyle(COLORS.vermillon, 1);
      g.fillCircle(hx, top + 1, 2);
      break;
    }
    case 'archer': {
      // Quiver slung on the back, fletchings showing.
      const qx = x - facing * 9;
      g.fillStyle(COLORS.terreOmbre, 1);
      g.lineStyle(2, ink, 1);
      g.fillRect(qx - 4, y - 64, 8, 26);
      g.strokeRect(qx - 4, y - 64, 8, 26);
      for (const dx of [-3, 0, 3]) {
        g.lineStyle(2, ink, 1);
        g.lineBetween(qx + dx, y - 64, qx + dx - facing * 3, y - 74);
        g.fillStyle(COLORS.vermillon, 1);
        g.fillTriangle(qx + dx - facing * 3, y - 74, qx + dx - facing * 6, y - 69, qx + dx, y - 69);
      }
      break;
    }
    case 'slinger': {
      // The sling hanging from the forward hand, its pouch with a stone.
      const hand = x + facing * 20;
      g.lineStyle(2, COLORS.terreOmbre, 1);
      g.lineBetween(hand, y - 37, hand + facing * 4, y - 20);
      g.lineBetween(hand, y - 37, hand - facing * 3, y - 20);
      g.fillStyle(COLORS.terreOmbre, 1);
      g.fillEllipse(hand, y - 19, 10, 6);
      g.fillStyle(COLORS.roche, 1);
      g.fillCircle(hand, y - 21, 3);
      break;
    }
    case 'sapper': {
      // Pick over the shoulder.
      const sx = x - facing * 6;
      g.lineStyle(3, COLORS.terreOmbre, 1);
      g.lineBetween(sx, y - 40, sx - facing * 16, y - 76);
      g.lineStyle(3, COLORS.roche, 1);
      g.lineBetween(sx - facing * 24, y - 70, sx - facing * 8, y - 82);
      g.lineStyle(1.5, ink, 1);
      g.strokeCircle(sx - facing * 16, y - 76, 2);
      break;
    }
    case 'cleric': {
      // Crosier: a staff ending in a gilt crook.
      const cx = x + facing * 22;
      g.lineStyle(3, COLORS.terreOmbre, 1);
      g.lineBetween(cx, y, cx, y - 82);
      g.lineStyle(3, COLORS.or, 1);
      g.beginPath();
      g.arc(cx + facing * 6, y - 84, 6, Math.PI, Math.PI * 2.4, facing < 0);
      g.strokePath();
      break;
    }
    default:
      break;
  }
}
