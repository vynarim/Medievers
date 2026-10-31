// The knight's placeholder pieces (BACKLOG 6.1, ASSETS §2.1, lot 7): the figure of figures.ts cut
// along the joints of rig.json, each piece drawn by code in the figure's own frame (facing
// right, feet at the origin, y down). The rig's placeholder textures are these drawings, framed
// on each piece's rectangle; the help's SVG figures put them together at rest. The house's
// pieces are drawn in the tinctures they are given: white for a texture tinted at runtime.
import { COLORS } from '../../ui/tokens.ts';
import type { Frame, PieceDrawer, Pt } from './pen.ts';

const ink = COLORS.encre;
const mail = COLORS.roche;
const skin = COLORS.carnation;

/** A colour darkened to `k` (the far limbs, in the shade of the body). */
export function shade(c: number, k = 0.78): number {
  const r = Math.round(((c >> 16) & 0xff) * k);
  const g = Math.round(((c >> 8) & 0xff) * k);
  const b = Math.round((c & 0xff) * k);
  return (r << 16) | (g << 8) | b;
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

const P = (x: number, y: number): Pt => ({ x, y });

/**
 * A limb from joint a to joint b, rounded at both ends (radius ra at a, rb at b), so that it
 * turns about a without opening a gap.
 */
function limb(F: Frame, a: Pt, b: Pt, ra: number, rb: number, fill: number, line = 2): void {
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const pts: Pt[] = [];
  const n = 6;
  // Round cap at b, from one flank to the other, then round cap at a.
  for (let i = 0; i <= n; i++) {
    const t = ang - Math.PI / 2 + (Math.PI * i) / n;
    pts.push(P(b.x + Math.cos(t) * rb, b.y + Math.sin(t) * rb));
  }
  for (let i = 0; i <= n; i++) {
    const t = ang + Math.PI / 2 + (Math.PI * i) / n;
    pts.push(P(a.x + Math.cos(t) * ra, a.y + Math.sin(t) * ra));
  }
  F.shape(pts, fill, line);
}

/** Rings of mail across a limb from a to b. */
function rings(F: Frame, a: Pt, b: Pt, r: number): void {
  const steps = Math.max(1, Math.floor(Math.hypot(b.x - a.x, b.y - a.y) / 4));
  for (let i = 1; i <= steps; i++) {
    const t = i / (steps + 1);
    const cx = a.x + (b.x - a.x) * t;
    const cy = a.y + (b.y - a.y) * t;
    F.stroke(quad(P(cx - r, cy - 1), P(cx, cy + 1.5), P(cx + r, cy - 1), 4), 1, ink, 0.5);
  }
}

const HIP = 24;
const KNEE = 13;
const ANKLE = 4;

function thigh(F: Frame, dx: number, far: boolean): void {
  const c = far ? shade(mail, 0.85) : mail;
  limb(F, P(dx, -HIP - 1), P(dx, -KNEE), 4.2, 3.8, c);
  rings(F, P(dx, -HIP), P(dx, -KNEE), 3);
}

function shin(F: Frame, dx: number, far: boolean): void {
  const c = far ? shade(mail, 0.85) : mail;
  limb(F, P(dx, -KNEE), P(dx, -ANKLE - 0.5), 3.8, 3.2, c);
  rings(F, P(dx, -KNEE), P(dx, -ANKLE), 2.6);
}

/** A pointed shoe, its toe forward. */
function foot(F: Frame, dx: number): void {
  F.shape([P(dx - 3.5, -5), P(dx + 3.5, -5), P(dx + 10, -0.5), P(dx - 3.5, 0)], ink, 0);
}

const SHOULDER_FAR = P(-8, -57);
const ELBOW_FAR = P(-13, -48);
const WRIST_FAR = P(-13, -40);
const SHOULDER_NEAR = P(7, -57);
const ELBOW_NEAR = P(12, -47);
const WRIST_NEAR = P(19, -37.5);
/** The helm's centre (the face's, on the other figures). */
const HX = 2;
const HY = -66;

/** The bow in the near hand, across the forearm so that it stands upright at full draw. */
function bow(F: Frame): void {
  const ux = 0.593;
  const uy = 0.805;
  const vx = uy;
  const vy = -ux;
  const h = WRIST_NEAR;
  const top = P(h.x + vx * 17, h.y + vy * 17);
  const bottom = P(h.x - vx * 17, h.y - vy * 17);
  const belly = P(h.x + ux * 14, h.y + uy * 14);
  F.stroke([top, bottom], 1, ink, 0.9);
  F.stroke([top, ...quad(top, belly, bottom, 8)], 3.5, ink);
  F.stroke([top, ...quad(top, belly, bottom, 8)], 2, COLORS.terreOmbre);
}

/** The knight's pieces, by piece id of rig.json. */
export const KNIGHT_PIECES: Readonly<Record<string, PieceDrawer>> = {
  thigh_far: (F) => thigh(F, -3, true),
  shin_far: (F) => shin(F, -3, true),
  foot_far: (F) => foot(F, -3),
  thigh_near: (F) => thigh(F, 3, false),
  shin_near: (F) => shin(F, 3, false),
  foot_near: (F) => foot(F, 3),
  arm_far_upper: (F) => limb(F, SHOULDER_FAR, ELBOW_FAR, 3.6, 3.1, shade(mail)),
  arm_far_lower: (F) => limb(F, ELBOW_FAR, WRIST_FAR, 3.1, 2.8, shade(mail)),
  hand_far: (F) => F.circle(-13.5, -39, 2.8, shade(skin, 0.92), 1.5),
  // The heater shield on the far arm: the house's field...
  shield: (F, t) => {
    const top = -58;
    F.shape(
      [
        P(-22, top),
        P(-6, top),
        P(-6, top + 14),
        ...quad(P(-6, top + 14), P(-7, top + 26), P(-14, top + 33)),
        ...quad(P(-14, top + 33), P(-21, top + 26), P(-22, top + 14)),
      ],
      t.primary,
    );
  },
  // ...and a chevron of its second tincture (the blazon's place, BACKLOG 6.2).
  shield_charge: (F, t) => {
    const top = -58;
    F.shape(
      [
        P(-21, top + 22),
        P(-14, top + 12),
        P(-7, top + 22),
        P(-7, top + 27),
        P(-14, top + 17),
        P(-21, top + 27),
      ],
      t.secondary,
      1.5,
    );
  },
  // A long surcoat over the mail, split in front, scalloped at the hem, with tubular folds.
  torso: (F, t) => {
    const hem = -19;
    const w = 16;
    const scallops: Pt[] = [];
    for (let i = 0; i <= 6; i++)
      scallops.push(P(w - (2 * w * i) / 6, hem + (i % 2 === 0 ? 0 : 1.6)));
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
      t.primary,
    );
    for (let i = 0; i < 3; i++) {
      const k = i / 2;
      const top = -7 + 14 * k;
      const bottom = -w + 4 + (2 * w - 8) * k;
      F.stroke(
        quad(P(top, -40), P((top + bottom) / 2 + 1, (hem - 40) / 2), P(bottom, hem - 1)),
        1.5,
        ink,
        0.4,
      );
    }
    F.stroke([P(3, -30), P(3, -19)], 2);
  },
  belt: (F, t) => F.shape([P(-11, -44), P(11, -44), P(11, -40), P(-11, -40)], t.secondary, 1.5),
  buckle: (F) => F.circle(5, -42, 1.6, COLORS.or, 1),
  arm_near_upper: (F) => limb(F, SHOULDER_NEAR, ELBOW_NEAR, 3.8, 3.3, mail),
  arm_near_lower: (F) => limb(F, ELBOW_NEAR, P(18.5, -38.5), 3.3, 2.8, mail),
  hand_near: (F) => F.circle(19.5, -37.5, 3.2, skin, 1.5),
  weapon_bow: (F) => bow(F),
  // A stone, or a pot, about to be thrown.
  weapon_stone: (F) => F.circle(WRIST_NEAR.x + 1, WRIST_NEAR.y - 2, 4.5, COLORS.roche, 2),
  // The mail coif round the neck, under the helm.
  neck: (F) =>
    F.shape(
      [P(HX - 4, HY + 7), P(HX + 3, HY + 7), P(HX + 4, HY + 13), P(HX - 5, HY + 13)],
      mail,
      1.5,
    ),
  // The barrel helm, a gilt cross over the eye slit, breaths on the cheek.
  helm: (F) => {
    const hx = HX;
    const hy = HY;
    F.shape(
      [
        ...quad(P(hx - 10, hy - 6), P(hx - 10, hy - 13.5), P(hx, hy - 13.5)),
        ...quad(P(hx, hy - 13.5), P(hx + 10, hy - 13.5), P(hx + 10, hy - 6)),
        P(hx + 10.5, hy + 10),
        P(hx - 10.5, hy + 10),
      ],
      mail,
    );
    F.shape(
      [P(hx - 4, hy - 4), P(hx + 10, hy - 4), P(hx + 10, hy - 1.5), P(hx - 4, hy - 1.5)],
      ink,
      0,
    );
    F.shape(
      [P(hx + 3, hy - 11), P(hx + 5.5, hy - 11), P(hx + 5.5, hy + 8), P(hx + 3, hy + 8)],
      COLORS.or,
      1,
    );
    F.shape(
      [P(hx - 2, hy + 1), P(hx + 10, hy + 1), P(hx + 10, hy + 3.2), P(hx - 2, hy + 3.2)],
      COLORS.or,
      1,
    );
    for (const [bx, by] of [
      [-5, 5],
      [-2, 6],
      [-5, 8],
      [-2, 9],
    ] as const)
      F.circle(hx + bx, hy + by, 0.9, ink);
    F.stroke([P(hx - 10, hy - 7), P(hx + 10, hy - 7)], 1, ink, 0.5);
  },
};
