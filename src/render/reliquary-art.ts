// The reliquaries of GDD §4.5 and the angels who bring them down, painted once into canvas
// textures: a gilt châsse (a little house-shaped shrine with arcades, gems and a cross on its
// ridge), and an angel with a golden halo, a lapis robe and many-coloured wings, holding the
// shrine's cords, in two frames (wings raised and lowered). Drawn at twice their size
// (RELIC_TEX_SCALE) so they stay crisp under the camera zoom.
import Phaser from 'phaser';
import { CRATE_HEIGHT, CRATE_WIDTH } from '../content/crates.ts';
import { COLORS, css } from '../ui/tokens.ts';

type Ctx = CanvasRenderingContext2D;

export const RELIC_TEX_SCALE = 2;
/** design px of the shrine: the coffer's box, with its roof and cross above */
const SHRINE_W = CRATE_WIDTH + 6;
const SHRINE_H = CRATE_HEIGHT + 14;
/** design px of the angel; the cords end at the bottom edge, CRATE_WIDTH apart */
const ANGEL_W = 110;
const ANGEL_H = 70;
export const SHRINE_TEX = { w: SHRINE_W * RELIC_TEX_SCALE, h: SHRINE_H * RELIC_TEX_SCALE };
export const ANGEL_TEX = { w: ANGEL_W * RELIC_TEX_SCALE, h: ANGEL_H * RELIC_TEX_SCALE };

const INK = css(COLORS.encre);

function shape(ctx: Ctx, path: () => void, fill: string, line = 1.6): void {
  ctx.beginPath();
  path();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = line;
  ctx.stroke();
}

/** The châsse, its feet on the bottom edge, centred. */
function drawShrine(ctx: Ctx): void {
  ctx.scale(RELIC_TEX_SCALE, RELIC_TEX_SCALE);
  ctx.lineJoin = 'round';
  const w = CRATE_WIDTH;
  const h = CRATE_HEIGHT;
  const x0 = (SHRINE_W - w) / 2;
  const base = SHRINE_H - 0.5;
  const top = base - h + 6;
  // Body, with a plinth.
  shape(ctx, () => ctx.rect(x0 - 1.5, base - 3, w + 3, 3), css(COLORS.poincon), 1.2);
  shape(ctx, () => ctx.rect(x0, top, w, base - 3 - top), css(COLORS.or));
  // Three arcades with a saint's lapis ground.
  const arch = (w - 6) / 3;
  for (let i = 0; i < 3; i++) {
    const ax = x0 + 3 + i * arch;
    shape(
      ctx,
      () => {
        ctx.moveTo(ax + 1, base - 4);
        ctx.lineTo(ax + 1, top + 6);
        ctx.arc(ax + arch / 2, top + 6, arch / 2 - 1, Math.PI, 0);
        ctx.lineTo(ax + arch - 1, base - 4);
        ctx.closePath();
      },
      css(COLORS.lapis),
      1,
    );
    ctx.fillStyle = css(COLORS.ceruse);
    ctx.beginPath();
    ctx.arc(ax + arch / 2, top + 7, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  // Roof, gilt, with a vermilion band of gems along its eaves.
  const peak = top - 9;
  shape(
    ctx,
    () => {
      ctx.moveTo(x0 - 2, top);
      ctx.lineTo(x0 + 3, peak);
      ctx.lineTo(x0 + w - 3, peak);
      ctx.lineTo(x0 + w + 2, top);
      ctx.closePath();
    },
    css(COLORS.or),
  );
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i % 2 ? css(COLORS.azur) : css(COLORS.vermillon);
    ctx.beginPath();
    ctx.arc(x0 + 4 + i * ((w - 8) / 3), top - 3, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
  // Cresting and a cross on the ridge.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  for (let x = x0 + 5; x < x0 + w - 3; x += 4) {
    ctx.beginPath();
    ctx.moveTo(x, peak);
    ctx.lineTo(x + 1, peak - 2);
    ctx.stroke();
  }
  shape(
    ctx,
    () => {
      const cx = SHRINE_W / 2;
      ctx.rect(cx - 1, peak - 6, 2, 6);
      ctx.rect(cx - 3, peak - 4.5, 6, 2);
    },
    css(COLORS.or),
    0.8,
  );
}

/** One feathered wing from the shoulder (sx, sy), on side `side`, raised (frame 0) or lowered. */
function wing(ctx: Ctx, sx: number, sy: number, side: -1 | 1, frame: 0 | 1): void {
  const lift = frame === 0 ? -22 : 10;
  const tipX = sx + side * 46;
  const tipY = sy + lift;
  // Rows of feathers, longest first: azure, vermilion, then gold coverts near the shoulder.
  const rows: readonly (readonly [number, string])[] = [
    [1, css(COLORS.azur)],
    [0.78, css(COLORS.vermillon)],
    [0.52, css(COLORS.or)],
  ];
  for (const [k, fill] of rows) {
    const ex = sx + (tipX - sx) * k;
    const ey = sy + (tipY - sy) * k;
    shape(
      ctx,
      () => {
        ctx.moveTo(sx, sy - 3);
        ctx.quadraticCurveTo((sx + ex) / 2, Math.min(sy, ey) - 8, ex, ey);
        // Scalloped trailing edge, feather by feather, back to the shoulder.
        const n = Math.max(3, Math.round(6 * k));
        for (let i = 1; i <= n; i++) {
          const t = i / n;
          const fx = ex + (sx - ex) * t;
          const fy = ey + (sy + 8 - ey) * t + 9 * k;
          const mx = ex + (sx - ex) * (t - 0.5 / n);
          const my = ey + (sy + 8 - ey) * (t - 0.5 / n) + 14 * k;
          ctx.quadraticCurveTo(mx, my, fx, fy);
        }
        ctx.closePath();
      },
      fill,
      1.3,
    );
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.8;
  for (let i = 1; i < 6; i++) {
    const t = i / 6;
    ctx.beginPath();
    ctx.moveTo(sx + (tipX - sx) * t * 0.9, sy + (tipY - sy) * t * 0.9);
    ctx.lineTo(sx + (tipX - sx) * t * 0.9 - side * 3, sy + (tipY - sy) * t * 0.9 + 9);
    ctx.stroke();
  }
}

function drawAngel(ctx: Ctx, frame: 0 | 1): void {
  ctx.scale(RELIC_TEX_SCALE, RELIC_TEX_SCALE);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const cx = ANGEL_W / 2;
  const sy = 30;
  wing(ctx, cx - 4, sy, -1, frame);
  wing(ctx, cx + 4, sy, 1, frame);
  // Cords from the hands down to the shrine's corners.
  ctx.strokeStyle = css(COLORS.terreOmbre);
  ctx.lineWidth = 1;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + side * 9, 44);
    ctx.lineTo(cx + (side * CRATE_WIDTH) / 2, ANGEL_H);
    ctx.stroke();
  }
  // Robe: lapis, with a white tunic beneath and gold hem.
  shape(
    ctx,
    () => {
      ctx.moveTo(cx - 7, 26);
      ctx.lineTo(cx + 7, 26);
      ctx.lineTo(cx + 12, 54);
      ctx.quadraticCurveTo(cx, 58, cx - 12, 54);
      ctx.closePath();
    },
    css(COLORS.ceruse),
  );
  shape(
    ctx,
    () => {
      ctx.moveTo(cx - 7, 26);
      ctx.lineTo(cx + 7, 26);
      ctx.lineTo(cx + 10, 46);
      ctx.quadraticCurveTo(cx, 50, cx - 10, 46);
      ctx.closePath();
    },
    css(COLORS.lapis),
  );
  ctx.strokeStyle = css(COLORS.or);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(cx - 11, 53);
  ctx.quadraticCurveTo(cx, 57, cx + 11, 53);
  ctx.stroke();
  // Arms holding the cords.
  for (const side of [-1, 1]) {
    shape(
      ctx,
      () => {
        ctx.moveTo(cx + side * 5, 29);
        ctx.quadraticCurveTo(cx + side * 12, 34, cx + side * 9, 44);
      },
      'transparent',
      3.4,
    );
    ctx.fillStyle = css(COLORS.carnation);
    ctx.beginPath();
    ctx.arc(cx + side * 9, 44, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // Halo, gilt and tooled, behind the head.
  shape(ctx, () => ctx.arc(cx, 17, 10, 0, Math.PI * 2), css(COLORS.or), 1.4);
  ctx.strokeStyle = css(COLORS.poincon);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(cx, 17, 7.5, 0, Math.PI * 2);
  ctx.stroke();
  // Head: carnation, golden curls, a calm face.
  shape(ctx, () => ctx.arc(cx, 19, 6, 0, Math.PI * 2), css(COLORS.carnation), 1.4);
  shape(
    ctx,
    () => {
      ctx.moveTo(cx - 6.5, 19);
      ctx.quadraticCurveTo(cx - 7, 11, cx, 12);
      ctx.quadraticCurveTo(cx + 7, 11, cx + 6.5, 19);
      ctx.quadraticCurveTo(cx + 3, 15, cx, 15.5);
      ctx.quadraticCurveTo(cx - 3, 15, cx - 6.5, 19);
    },
    css(COLORS.ocre),
    1.1,
  );
  ctx.fillStyle = INK;
  for (const ex of [-2.2, 2.2]) {
    ctx.beginPath();
    ctx.arc(cx + ex, 19.5, 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = css(COLORS.vermillon);
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(cx - 1.4, 22.5);
  ctx.quadraticCurveTo(cx, 23.4, cx + 1.4, 22.5);
  ctx.stroke();
}

function texture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: Ctx) => void) {
  if (scene.textures.exists(key)) return;
  const t = scene.textures.createCanvas(key, w, h);
  if (!t) throw new Error(`cannot create texture ${key}`);
  draw(t.getContext());
  t.refresh();
}

/** Paints the shrine and the angel's two frames once. */
export function reliquaryTextures(scene: Phaser.Scene): void {
  texture(scene, 'shrine', SHRINE_TEX.w, SHRINE_TEX.h, drawShrine);
  for (const f of [0, 1] as const) {
    texture(scene, `angel_${f}`, ANGEL_TEX.w, ANGEL_TEX.h, (c) => drawAngel(c, f));
  }
}
