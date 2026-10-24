// Placeholder figures of the six classes (GDD §3.2, ASSETS « Visuel »), drawn in the house's
// tinctures until the rigs of M6: the knight in mail, surcoat and great helm with his shield; the
// archer hooded, in a short tunic; the slinger bareheaded, in a shorter one; the sapper in a cap
// and a leather apron; the cleric tonsured, in a long robe; the king bearded, in a mantle lined
// with ermine. Their tools (quiver, sling, pick, crosier, crown) are the class marks.
import Phaser from 'phaser';
import type { ClassId } from '../content/classes.ts';
import { COLORS } from '../ui/tokens.ts';

type G = Phaser.GameObjects.Graphics;
type Pt = { x: number; y: number };

const poly = (points: readonly Pt[]): Phaser.Math.Vector2[] =>
  points.map((p) => new Phaser.Math.Vector2(p.x, p.y));

const ink = COLORS.encre;
const mail = COLORS.roche;
const hair = COLORS.terreOmbre;

function shape(g: G, points: readonly Pt[], fill: number, line = 3): void {
  const p = poly(points);
  g.fillStyle(fill, 1);
  g.fillPoints(p, true);
  g.lineStyle(line, ink, 1);
  g.strokePoints(p, true);
}

/** Legs: grey mail with rows of little arcs, or cloth hose; pointed black shoes. */
function legs(g: G, x: number, y: number, facing: number, kind: 'mail' | number): void {
  for (const lx of [x - 9, x + 2]) {
    g.fillStyle(kind === 'mail' ? mail : kind, 1);
    g.lineStyle(2, ink, 1);
    g.fillRect(lx, y - 22, 7, 20);
    g.strokeRect(lx, y - 22, 7, 20);
    if (kind === 'mail') {
      g.lineStyle(1, ink, 0.55);
      for (let ry = y - 19; ry < y - 3; ry += 4) {
        g.beginPath();
        g.arc(lx + 3.5, ry, 2.5, 0, Math.PI);
        g.strokePath();
      }
    }
    g.fillStyle(ink, 1);
    g.fillTriangle(lx - 1, y - 3, lx + 8 + facing * 4, y, lx - 1, y);
  }
}

/** The heater shield on the back side: the house's field with a chevron. */
function shield(g: G, x: number, y: number, facing: number, primary: number, secondary: number) {
  const sx = x - facing * 14;
  shape(
    g,
    [
      { x: sx - 10, y: y - 56 },
      { x: sx + 10, y: y - 56 },
      { x: sx + 9, y: y - 40 },
      { x: sx, y: y - 26 },
      { x: sx - 9, y: y - 40 },
    ],
    secondary,
  );
  g.fillStyle(primary, 1);
  g.fillPoints(
    poly([
      { x: sx - 9, y: y - 36 },
      { x: sx, y: y - 47 },
      { x: sx + 9, y: y - 36 },
      { x: sx + 7, y: y - 31 },
      { x: sx, y: y - 40 },
      { x: sx - 7, y: y - 31 },
    ]),
    true,
  );
  g.lineStyle(3, ink, 1);
  g.strokePoints(
    poly([
      { x: sx - 10, y: y - 56 },
      { x: sx + 10, y: y - 56 },
      { x: sx + 9, y: y - 40 },
      { x: sx, y: y - 26 },
      { x: sx - 9, y: y - 40 },
    ]),
    true,
  );
}

/** The forward arm: a sleeve reaching out, a bare hand. */
function arm(g: G, x: number, y: number, facing: number, sleeve: number): void {
  const ax = x + facing * 8;
  shape(
    g,
    [
      { x: ax - 4, y: y - 56 },
      { x: ax + 4, y: y - 56 },
      { x: ax + facing * 12 + 3, y: y - 40 },
      { x: ax + facing * 12 - 3, y: y - 36 },
    ],
    sleeve,
    2,
  );
  g.fillStyle(COLORS.carnation, 1);
  g.fillCircle(ax + facing * 12, y - 37, 3);
}

/** A tunic from the shoulders down to `hem`, with tubular folds and a girdle. */
function tunic(g: G, x: number, y: number, hem: number, flare: number, primary: number) {
  shape(
    g,
    [
      { x: x - 10, y: y - 58 },
      { x: x + 10, y: y - 58 },
      { x: x + 10 + flare, y: hem },
      { x: x - 10 - flare, y: hem },
    ],
    primary,
  );
  g.lineStyle(1.5, ink, 0.45);
  for (const fx of [-7, 0, 7]) g.lineBetween(x + fx * 0.6, y - 44, x + fx, hem - 1);
}

function girdle(g: G, x: number, y: number, colour: number): void {
  g.fillStyle(colour, 1);
  g.fillRect(x - 12, y - 42, 24, 4);
  g.lineStyle(1.5, ink, 1);
  g.strokeRect(x - 12, y - 42, 24, 4);
}

/** A bare face, its eye towards `facing`. */
function face(g: G, hx: number, hy: number, facing: number): void {
  g.fillStyle(COLORS.carnation, 1);
  g.fillCircle(hx, hy, 10);
  g.lineStyle(3, ink, 1);
  g.strokeCircle(hx, hy, 10);
  g.fillStyle(ink, 1);
  g.fillCircle(hx + facing * 5, hy - 1, 1.8);
}

/** The knight's mail coif and flat-topped great helm, a gilt cross over the eye slit. */
function greatHelm(g: G, hx: number, hy: number, facing: number): void {
  const top = hy - 13;
  g.fillStyle(mail, 1);
  g.fillRoundedRect(hx - 10, top, 20, 25, { tl: 3, tr: 3, bl: 6, br: 6 });
  g.lineStyle(3, ink, 1);
  g.strokeRoundedRect(hx - 10, top, 20, 25, { tl: 3, tr: 3, bl: 6, br: 6 });
  g.fillStyle(ink, 1);
  g.fillRect(hx - 8 + facing * 3, hy - 3, 14, 3);
  g.fillStyle(COLORS.or, 1);
  g.fillRect(hx + facing * 3 - 1, hy - 9, 3, 18);
  g.fillRect(hx + facing * 3 - 6, hy - 3, 13, 2);
  g.lineStyle(1, ink, 0.6);
  for (let k = -1; k <= 1; k++) g.strokeCircle(hx - facing * 5, hy + 5 + k * 3, 1);
}

/**
 * A figure of class `cls` (the knight when null) in the house's tinctures, feet at (x, y); a
 * pulsing gilt nimbus behind the one whose turn it is.
 */
export function drawFigure(
  g: G,
  x: number,
  y: number,
  facing: number,
  primary: number,
  secondary: number,
  cls: ClassId | null,
  active: boolean,
  time: number,
): void {
  const hx = x + facing * 2;
  const hy = y - 66;
  if (active) {
    // Gilt nimbus, as on the saints of the manuscript.
    const pulse = 1 + Math.sin(time / 250) * 0.06;
    g.fillStyle(COLORS.or, 1);
    g.fillCircle(hx, hy, 21 * pulse);
    g.lineStyle(3, ink, 1);
    g.strokeCircle(hx, hy, 21 * pulse);
    g.lineStyle(2, COLORS.ocre, 1);
    g.strokeCircle(hx, hy, 16 * pulse);
  }
  switch (cls ?? 'knight') {
    case 'knight':
      legs(g, x, y, facing, 'mail');
      shield(g, x, y, facing, primary, secondary);
      arm(g, x, y, facing, mail);
      tunic(g, x, y, y - 20, 6, primary);
      g.lineStyle(2, ink, 1);
      g.lineBetween(x + facing * 2, y - 30, x + facing * 2, y - 20);
      girdle(g, x, y, secondary);
      greatHelm(g, hx, hy, facing);
      break;
    case 'king': {
      // A mantle behind, lined with ermine, then mail, surcoat and a bearded face.
      shape(
        g,
        [
          { x: x - 11, y: y - 60 },
          { x: x + 11, y: y - 60 },
          { x: x - facing * 4 + 16, y: y - 6 },
          { x: x - facing * 4 - 16, y: y - 6 },
        ],
        primary,
      );
      legs(g, x, y, facing, 'mail');
      shield(g, x, y, facing, primary, secondary);
      arm(g, x, y, facing, primary);
      tunic(g, x, y, y - 18, 7, secondary);
      girdle(g, x, y, primary);
      // Ermine collar: white with black tails.
      g.fillStyle(COLORS.ceruse, 1);
      g.fillRoundedRect(x - 13, y - 62, 26, 8, 3);
      g.lineStyle(2, ink, 1);
      g.strokeRoundedRect(x - 13, y - 62, 26, 8, 3);
      g.fillStyle(ink, 1);
      for (const dx of [-7, 0, 7])
        g.fillTriangle(x + dx - 1.5, y - 60, x + dx + 1.5, y - 60, x + dx, y - 56);
      face(g, hx, hy, facing);
      // Hair and a full beard.
      g.fillStyle(hair, 1);
      g.lineStyle(2, ink, 1);
      g.beginPath();
      g.arc(hx, hy + 2, 10, 0.15 * Math.PI, 0.85 * Math.PI);
      g.closePath();
      g.fillPath();
      g.strokePath();
      g.fillRect(hx - 10, hy - 10, 20, 5);
      break;
    }
    case 'archer':
      legs(g, x, y, facing, hair);
      arm(g, x, y, facing, primary);
      tunic(g, x, y, y - 24, 4, primary);
      girdle(g, x, y, hair);
      // Chaperon: a hood round the face and over the shoulders, its liripipe hanging behind.
      g.fillStyle(secondary, 1);
      g.lineStyle(3, ink, 1);
      g.fillCircle(hx - facing, hy - 1, 13);
      g.strokeCircle(hx - facing, hy - 1, 13);
      shape(
        g,
        [
          { x: hx - facing * 8, y: hy - 8 },
          { x: hx - facing * 24, y: hy + 4 },
          { x: hx - facing * 22, y: hy + 8 },
          { x: hx - facing * 6, y: hy - 2 },
        ],
        secondary,
        2,
      );
      face(g, hx + facing * 2, hy + 1, facing);
      shape(
        g,
        [
          { x: x - 14, y: y - 60 },
          { x: x + 14, y: y - 60 },
          { x: x + 12, y: y - 52 },
          { x: x - 12, y: y - 52 },
        ],
        secondary,
        2,
      );
      break;
    case 'slinger':
      legs(g, x, y, facing, COLORS.carnation);
      arm(g, x, y, facing, COLORS.carnation);
      tunic(g, x, y, y - 28, 3, primary);
      girdle(g, x, y, hair);
      face(g, hx, hy, facing);
      // Shock of unruly hair.
      g.fillStyle(hair, 1);
      g.lineStyle(2, ink, 1);
      g.beginPath();
      g.arc(hx - facing * 1, hy - 2, 10.5, Math.PI * 1.05, Math.PI * 1.95);
      g.closePath();
      g.fillPath();
      g.strokePath();
      for (const dx of [-7, -2, 3, 8])
        g.fillTriangle(hx + dx - 3, hy - 9, hx + dx + 3, hy - 9, hx + dx, hy - 15);
      break;
    case 'sapper':
      legs(g, x, y, facing, hair);
      arm(g, x, y, facing, primary);
      tunic(g, x, y, y - 24, 4, primary);
      // Leather apron in front.
      shape(
        g,
        [
          { x: x + facing * 1 - 8, y: y - 44 },
          { x: x + facing * 1 + 8, y: y - 44 },
          { x: x + facing * 1 + 10, y: y - 20 },
          { x: x + facing * 1 - 10, y: y - 20 },
        ],
        COLORS.ocre,
        2,
      );
      girdle(g, x, y, hair);
      face(g, hx, hy, facing);
      // Round felt cap with a rolled brim.
      g.fillStyle(secondary, 1);
      g.lineStyle(2.5, ink, 1);
      g.beginPath();
      g.arc(hx, hy - 4, 11, Math.PI, Math.PI * 2);
      g.closePath();
      g.fillPath();
      g.strokePath();
      g.fillStyle(hair, 1);
      g.fillRoundedRect(hx - 12, hy - 6, 24, 5, 2);
      g.strokeRoundedRect(hx - 12, hy - 6, 24, 5, 2);
      break;
    case 'cleric':
      // A long robe to the feet, a white scapular, a cord.
      shape(
        g,
        [
          { x: x - 10, y: y - 58 },
          { x: x + 10, y: y - 58 },
          { x: x + 16, y: y - 1 },
          { x: x - 16, y: y - 1 },
        ],
        primary,
      );
      g.fillStyle(COLORS.ceruse, 1);
      g.lineStyle(1.5, ink, 1);
      g.fillRect(x - 4, y - 58, 8, 54);
      g.strokeRect(x - 4, y - 58, 8, 54);
      g.lineStyle(2, ink, 1);
      g.lineBetween(x - 12, y - 40, x + 12, y - 40);
      g.lineBetween(x + facing * 6, y - 40, x + facing * 8, y - 24);
      arm(g, x, y, facing, primary);
      face(g, hx, hy, facing);
      // Tonsure: a ring of hair round a bare crown.
      g.lineStyle(4, hair, 1);
      g.beginPath();
      g.arc(hx, hy - 1, 9, Math.PI * 1.05, Math.PI * 1.95);
      g.strokePath();
      break;
  }
}
