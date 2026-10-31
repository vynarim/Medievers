// Placeholder figures of the six classes (GDD §3.2, ASSETS « Visuel »), drawn in the house's
// tinctures until the rigs of M6. Redrawn on 2026-10-25 after the Maciejowski figures (ASSETS
// §1.2 « Figures »): oval faces in three-quarter profile with an almond eye, an arched brow, a
// nose and a small mouth; rounded shoulders, both arms, tubular folds and scalloped hems; hose
// that taper to pointed shoes. The knight in mail, surcoat and barrel helm with his shield; the
// archer in a dagged chaperon; the slinger bare-legged and cross-gartered; the sapper in a cap,
// rolled sleeves and a leather apron; the cleric in alb and chasuble, tonsured; the king bearded,
// long-haired, in a mantle lined with ermine. Their tools are the class marks (class-marks.ts).
import Phaser from 'phaser';
import type { ClassId } from '../content/classes.ts';
import { COLORS } from '../ui/tokens.ts';
import { KNIGHT_PIECES } from './rig/knight-art.ts';
import { drawRigAtRest } from './rig/rest.ts';
import { rigSet } from './rig/rigs.ts';

const KNIGHT = rigSet('knight');

type G = Phaser.GameObjects.Graphics;
type Pt = { x: number; y: number };

const ink = COLORS.encre;
const mail = COLORS.roche;
const hair = COLORS.terreOmbre;
const skin = COLORS.carnation;

/** A colour darkened to `k` (the far limbs, in the shade of the body). */
function shade(c: number, k = 0.78): number {
  const r = Math.round(((c >> 16) & 0xff) * k);
  const gr = Math.round(((c >> 8) & 0xff) * k);
  const b = Math.round((c & 0xff) * k);
  return (r << 16) | (gr << 8) | b;
}

/** Points along a quadratic curve from a to b bent towards c (a excluded). */
function quad(a: Pt, c: Pt, b: Pt, n = 6): Pt[] {
  const out: Pt[] = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push({
      x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
      y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
    });
  }
  return out;
}

/** A figure's frame: local x grows towards where it faces, y up from the feet (negative). */
class Frame {
  readonly g: G;
  readonly x: number;
  readonly y: number;
  readonly f: number;

  constructor(g: G, x: number, y: number, f: number) {
    this.g = g;
    this.x = x;
    this.y = y;
    this.f = f;
  }

  /** World point of local (dx, dy). */
  p(dx: number, dy: number): Pt {
    return { x: this.x + this.f * dx, y: this.y + dy };
  }

  /** A filled shape outlined in ink, from local points. */
  shape(points: readonly Pt[], fill: number, line = 2.5): void {
    const p = points.map((q) => new Phaser.Math.Vector2(this.x + this.f * q.x, this.y + q.y));
    this.g.fillStyle(fill, 1);
    this.g.fillPoints(p, true);
    if (line > 0) {
      this.g.lineStyle(line, ink, 1);
      this.g.strokePoints(p, true);
    }
  }

  /** An ink stroke along local points. */
  stroke(points: readonly Pt[], width: number, colour: number = ink, alpha = 1): void {
    const p = points.map((q) => new Phaser.Math.Vector2(this.x + this.f * q.x, this.y + q.y));
    this.g.lineStyle(width, colour, alpha);
    this.g.strokePoints(p, false);
  }

  circle(dx: number, dy: number, r: number, fill: number, line = 0): void {
    const c = this.p(dx, dy);
    this.g.fillStyle(fill, 1);
    this.g.fillCircle(c.x, c.y, r);
    if (line > 0) {
      this.g.lineStyle(line, ink, 1);
      this.g.strokeCircle(c.x, c.y, r);
    }
  }
}

const P = (x: number, y: number): Pt => ({ x, y });

type Hose = 'mail' | 'bare' | number;

/** Two legs in hose (or mail, or bare and cross-gartered), the far one in shade, pointed shoes. */
function legs(F: Frame, hose: Hose, top = -24): void {
  for (const [dx, far] of [
    [-3, true],
    [3, false],
  ] as const) {
    const base = hose === 'mail' ? mail : hose === 'bare' ? skin : hose;
    const colour = far ? shade(base, 0.85) : base;
    F.shape(
      [
        P(dx - 4, top),
        P(dx + 4, top),
        P(dx + 3.5, -12),
        P(dx + 3, -4),
        P(dx - 3, -4),
        P(dx - 3.5, -12),
      ],
      colour,
      2,
    );
    if (hose === 'mail') {
      for (let ry = top + 3; ry < -5; ry += 4) {
        F.stroke(quad(P(dx - 3, ry), P(dx, ry + 2.5), P(dx + 3, ry), 4), 1, ink, 0.5);
      }
    } else if (hose === 'bare') {
      // Leather bindings crossed up the shin.
      F.stroke([P(dx - 3, -6), P(dx + 3, -11), P(dx - 3, -16), P(dx + 3, -21)], 1.5, hair);
    }
    // A pointed shoe, its toe forward.
    F.shape([P(dx - 3.5, -5), P(dx + 3.5, -5), P(dx + 10, -0.5), P(dx - 3.5, 0)], ink, 0);
  }
}

/**
 * A garment from the shoulders down to `hem`, flaring by `flare`, with rounded shoulders, a
 * scalloped hem and tubular folds.
 */
function robe(F: Frame, colour: number, hem: number, flare: number, folds = 3): void {
  const w = 11 + flare;
  const scallops: Pt[] = [];
  const n = 6;
  for (let i = 0; i <= n; i++) {
    const hx = w - (2 * w * i) / n;
    scallops.push(P(hx, hem + (i % 2 === 0 ? 0 : 1.6)));
  }
  F.shape(
    [
      P(-5, -61),
      P(5, -61),
      ...quad(P(5, -61), P(11, -61), P(11.5, -54)),
      P(10, -42),
      ...scallops,
      P(-10, -42),
      ...quad(P(-11.5, -54), P(-11, -61), P(-5, -61)).slice(0, -1),
      P(-11.5, -54),
    ],
    colour,
  );
  // Tubular folds, fanning down from the waist.
  for (let i = 0; i < folds; i++) {
    const t = folds === 1 ? 0.5 : i / (folds - 1);
    const top = -7 + 14 * t;
    const bottom = -w + 4 + (2 * w - 8) * t;
    F.stroke(
      quad(P(top, -40), P((top + bottom) / 2 + 1, (hem - 40) / 2), P(bottom, hem - 1)),
      1.5,
      ink,
      0.4,
    );
  }
}

/** A belt across the waist, its buckle in front. */
function belt(F: Frame, colour: number): void {
  F.shape([P(-11, -44), P(11, -44), P(11, -40), P(-11, -40)], colour, 1.5);
  F.circle(5, -42, 1.6, COLORS.or, 1);
}

/** The far arm, behind the body: only the sleeve and the hand show past its back. */
function farArm(F: Frame, sleeve: number): void {
  F.shape(
    [P(-6, -59), P(-11, -57), P(-15, -46), P(-15, -41), P(-11, -41), P(-8, -50)],
    shade(sleeve),
    2,
  );
  F.circle(-13.5, -39, 2.8, shade(skin, 0.92), 1.5);
}

/**
 * The near arm, bent forward at the elbow, its hand at about (20, −37), where the class marks hang
 * their tools. `forearm`: the bare forearm of rolled sleeves, if any.
 */
function nearArm(F: Frame, sleeve: number, forearm: number | null = null): void {
  if (forearm !== null) {
    F.shape([P(12, -48), P(15, -47), P(20, -39), P(17, -36), P(11, -44)], forearm, 2);
    F.shape([P(4, -59), P(10, -58), P(16, -47), P(11, -43), P(6, -51)], sleeve, 2);
  } else {
    F.shape(
      [P(4, -59), P(10, -58), P(14, -48), P(20, -40), P(17, -36), P(10, -44), P(6, -51)],
      sleeve,
      2,
    );
  }
  F.circle(19.5, -37.5, 3.2, skin, 1.5);
}

/**
 * An oval face in three-quarter profile, centred at local (hx, hy): an almond eye, an arched brow,
 * a nose and a small mouth, a touch of rose on the cheek.
 */
function face(F: Frame, hx: number, hy: number): void {
  // Neck.
  F.shape(
    [P(hx - 3.5, hy + 7), P(hx + 2.5, hy + 7), P(hx + 2.5, hy + 12), P(hx - 3.5, hy + 12)],
    skin,
    1.5,
  );
  const outline: Pt[] = [];
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    outline.push(P(hx + Math.cos(a) * 9, hy + Math.sin(a) * 10.5));
  }
  F.shape(outline, skin, 2.5);
  // Nose, past the profile.
  F.shape([P(hx + 8, hy - 3), P(hx + 11.5, hy + 2.5), P(hx + 8, hy + 3.5)], skin, 0);
  F.stroke([P(hx + 8.5, hy - 3), P(hx + 11.5, hy + 2.5), P(hx + 8.5, hy + 3.5)], 1.6);
  // Almond eye and arched brow.
  F.shape(
    [P(hx + 2.5, hy - 1), P(hx + 4.5, hy - 2.4), P(hx + 6.8, hy - 1), P(hx + 4.5, hy + 0.2)],
    ink,
    0,
  );
  F.stroke(quad(P(hx + 1.5, hy - 4), P(hx + 4.5, hy - 6.5), P(hx + 7.5, hy - 4.5), 4), 1.4);
  // Small mouth, and the cheek.
  F.stroke([P(hx + 5, hy + 6), P(hx + 7.5, hy + 5.6)], 1.4);
  F.g.fillStyle(COLORS.roseGarance, 0.45);
  const cheek = F.p(hx + 2.5, hy + 3);
  F.g.fillCircle(cheek.x, cheek.y, 2.2);
}

/** Hair over the crown and down the back of the head; `long` falls to the shoulders. */
function hairCap(F: Frame, hx: number, hy: number, colour: number, long = false): void {
  const back = long ? hy + 12 : hy + 5;
  F.shape(
    [
      P(hx + 7, hy - 6),
      ...quad(P(hx + 7, hy - 6), P(hx + 3, hy - 13.5), P(hx - 4, hy - 11)),
      ...quad(P(hx - 4, hy - 11), P(hx - 11.5, hy - 8), P(hx - 10, back)),
      P(hx - 5, back),
      P(hx - 4, hy - 1),
      P(hx + 1, hy - 6),
    ],
    colour,
    2,
  );
  // Locks drawn in, as the illuminators did.
  F.stroke(quad(P(hx - 6, hy - 8), P(hx - 9, hy - 2), P(hx - 7.5, back - 2), 4), 1, ink, 0.5);
}

/** The gilt nimbus behind the head of the unit that plays, as on the saints of the manuscript. */
export function drawNimbus(g: G, cx: number, cy: number, time: number): void {
  const pulse = 1 + Math.sin(time / 250) * 0.06;
  g.fillStyle(COLORS.or, 1);
  g.fillCircle(cx, cy, 21 * pulse);
  g.lineStyle(3, ink, 1);
  g.strokeCircle(cx, cy, 21 * pulse);
  g.lineStyle(2, COLORS.ocre, 1);
  g.strokeCircle(cx, cy, 16 * pulse);
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
  const F = new Frame(g, x, y, facing);
  // The head's centre, in local coordinates.
  const hx = 2;
  const hy = -66;
  if (active) {
    const c = F.p(hx, hy);
    drawNimbus(g, c.x, c.y, time);
  }
  switch (cls ?? 'knight') {
    case 'knight':
      // The rig's pieces at rest (render/rig, BACKLOG 6.1): the battle animates them.
      drawRigAtRest(g, KNIGHT.rig, KNIGHT_PIECES, x, y, facing, {
        primary,
        secondary,
      });
      break;
    case 'king':
      // The mantle behind, its ermine lining showing at the edge.
      F.shape([P(-12, -61), P(12, -61), P(15, -3), P(-24, -3)], primary);
      F.shape([P(-12, -59), P(-8, -59), P(-19, -4), P(-24, -3)], COLORS.ceruse, 1.5);
      for (const ty of [-50, -38, -26, -14]) F.circle(-10.5 + (ty + 59) * -0.2, ty, 1, ink);
      legs(F, 'mail');
      farArm(F, secondary);
      robe(F, secondary, -10, 6, 4);
      belt(F, primary);
      nearArm(F, secondary);
      // Ermine collar over the shoulders.
      F.shape([P(-11, -62), P(11, -62), P(12, -56), P(-12, -56)], COLORS.ceruse, 2);
      for (const dx of [-6, 0, 6])
        F.shape([P(dx - 1.2, -60), P(dx + 1.2, -60), P(dx, -56.5)], ink, 0);
      face(F, hx, hy);
      hairCap(F, hx, hy, hair, true);
      // A pointed beard and moustache.
      F.shape(
        [
          P(hx + 7.5, hy + 3),
          P(hx + 6, hy + 11),
          P(hx + 1, hy + 15),
          P(hx - 2, hy + 9),
          P(hx - 3, hy + 3),
        ],
        hair,
        2,
      );
      F.stroke([P(hx + 4, hy + 4.5), P(hx + 8.5, hy + 4)], 1.6, hair);
      break;
    case 'archer':
      legs(F, shade(primary, 0.6));
      farArm(F, primary);
      robe(F, primary, -24, 3);
      belt(F, hair);
      nearArm(F, primary);
      face(F, hx, hy);
      // Chaperon: a hood framing the face, a dagged shoulder cape, the liripipe hanging behind.
      F.shape(
        [
          P(hx + 7, hy - 7),
          ...quad(P(hx + 7, hy - 7), P(hx + 2, hy - 15), P(hx - 6, hy - 12)),
          ...quad(P(hx - 6, hy - 12), P(hx - 13, hy - 6), P(hx - 10, hy + 6)),
          P(hx - 20, hy + 13),
          P(hx - 19, hy + 16),
          P(hx - 6, hy + 10),
          P(hx - 4, hy + 2),
          P(hx - 1, hy - 5),
        ],
        secondary,
        2,
      );
      F.shape(
        [
          P(-13, -61),
          P(12, -61),
          P(14, -53),
          P(10, -50),
          P(7, -53),
          P(3, -50),
          P(-1, -53),
          P(-5, -50),
          P(-9, -53),
          P(-13, -50),
        ],
        secondary,
        2,
      );
      break;
    case 'slinger':
      legs(F, 'bare', -30);
      farArm(F, skin);
      robe(F, primary, -28, 2, 2);
      belt(F, hair);
      nearArm(F, skin);
      face(F, hx, hy);
      // A shock of unruly curls.
      F.shape(
        [
          P(hx + 8, hy - 5),
          P(hx + 7, hy - 11),
          P(hx + 3, hy - 9),
          P(hx + 1, hy - 15),
          P(hx - 3, hy - 11),
          P(hx - 7, hy - 15),
          P(hx - 8, hy - 9),
          P(hx - 13, hy - 9),
          P(hx - 10, hy - 3),
          P(hx - 12, hy + 3),
          P(hx - 7, hy + 5),
          P(hx - 4, hy - 1),
          P(hx + 1, hy - 6),
        ],
        hair,
        2,
      );
      break;
    case 'sapper':
      legs(F, hair);
      farArm(F, primary);
      robe(F, primary, -24, 3, 2);
      // Leather apron in front, on a strap round the neck.
      F.stroke([P(-2, -60), P(3, -50)], 1.5, hair);
      F.shape([P(-1, -50), P(9, -50), P(12, -21), P(-4, -21)], COLORS.ocre, 2);
      F.stroke([P(3, -46), P(4, -24)], 1, ink, 0.4);
      belt(F, hair);
      nearArm(F, primary, skin);
      face(F, hx, hy);
      hairCap(F, hx, hy, hair);
      // Round felt cap with a rolled brim.
      F.shape([...quad(P(hx - 10, hy - 6), P(hx, hy - 19), P(hx + 10, hy - 6), 8)], secondary, 2.5);
      F.shape(
        [P(hx - 11.5, hy - 8), P(hx + 11, hy - 8), P(hx + 11, hy - 4.5), P(hx - 11.5, hy - 4.5)],
        shade(secondary, 0.75),
        2,
      );
      break;
    case 'cleric':
      // A white alb to the feet, a bell-shaped chasuble over it, wide sleeves.
      robe(F, COLORS.ceruse, -1, 5, 2);
      farArm(F, primary);
      F.shape(
        [
          P(-5, -61),
          P(5, -61),
          ...quad(P(5, -61), P(12, -60), P(15, -48)),
          ...quad(P(15, -48), P(16, -30), P(10, -20)),
          P(0, -17),
          P(-10, -20),
          ...quad(P(-10, -20), P(-16, -30), P(-15, -48)),
          ...quad(P(-15, -48), P(-12, -60), P(-5, -61)),
        ],
        primary,
      );
      // The orphrey: a gilt band down the front.
      F.shape([P(1, -60), P(5, -60), P(5, -18), P(1, -18)], COLORS.or, 1.5);
      F.shape([P(4, -59), P(11, -58), P(18, -44), P(20, -38), P(13, -36), P(7, -50)], primary, 2);
      F.circle(19.5, -37.5, 3.2, skin, 1.5);
      face(F, hx, hy);
      // Tonsure: a ring of hair round a bare crown.
      F.shape(
        [
          P(hx + 7, hy - 6),
          P(hx + 8, hy - 3),
          P(hx + 4, hy - 6),
          P(hx - 3, hy - 7),
          P(hx - 7, hy - 3),
          P(hx - 6, hy + 4),
          P(hx - 10, hy + 3),
          P(hx - 10, hy - 6),
          P(hx - 4, hy - 10),
          P(hx + 3, hy - 10),
        ],
        hair,
        2,
      );
      break;
  }
}
