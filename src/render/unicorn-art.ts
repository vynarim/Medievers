// The unicorn of the margins (GDD §4.12), painted once into two canvas textures, `unicorn_0`
// and `unicorn_1`, its legs gathered and stretched in the gallop. Facing right, hooves on the
// bottom edge; white coat, gilt horn, mane and tail, inked as in the manuscript.
import Phaser from 'phaser';
import { COLORS, css } from '../ui/tokens.ts';

type Ctx = CanvasRenderingContext2D;

export const UNICORN_TEX_W = 120;
export const UNICORN_TEX_H = 100;

function drawUnicorn(ctx: Ctx, frame: 0 | 1): void {
  const ink = css(COLORS.encre);
  const coat = css(COLORS.ceruse);
  const gold = css(COLORS.or);
  const feet = UNICORN_TEX_H - 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // Legs: gathered under the body, or stretched fore and aft.
  const legs: readonly (readonly [number, number, number, number])[] =
    frame === 0
      ? [
          [42, 66, 50, feet],
          [50, 66, 40, feet - 6],
          [80, 66, 74, feet],
          [86, 66, 92, feet - 8],
        ]
      : [
          [42, 66, 22, feet - 10],
          [50, 66, 32, feet],
          [80, 66, 100, feet - 4],
          [86, 66, 108, feet - 14],
        ];
  for (const [x0, y0, x1, y1] of legs) {
    ctx.strokeStyle = ink;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.strokeStyle = coat;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fillStyle = gold;
    ctx.beginPath();
    ctx.arc(x1, y1 - 2, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // The tail: a gilt plume streaming back.
  ctx.strokeStyle = gold;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(34, 50);
  ctx.quadraticCurveTo(14, 44, 8, frame === 0 ? 62 : 54);
  ctx.stroke();
  // Body.
  ctx.fillStyle = coat;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(64, 56, 32, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Neck and head, raised.
  ctx.beginPath();
  ctx.moveTo(84, 50);
  ctx.quadraticCurveTo(92, 30, 98, 22);
  ctx.lineTo(112, 30);
  ctx.quadraticCurveTo(114, 36, 108, 36);
  ctx.lineTo(100, 34);
  ctx.quadraticCurveTo(98, 50, 92, 60);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // The horn, twisted gold.
  ctx.fillStyle = gold;
  ctx.beginPath();
  ctx.moveTo(100, 22);
  ctx.lineTo(118, 2);
  ctx.lineTo(105, 25);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 1.5;
  for (const k of [0.3, 0.55, 0.8]) {
    ctx.beginPath();
    ctx.moveTo(100 + 18 * k - 2, 22 - 20 * k);
    ctx.lineTo(105 + 13 * k, 25 - 23 * k);
    ctx.stroke();
  }
  // Mane along the neck, eye.
  ctx.strokeStyle = gold;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(96, 24);
  ctx.quadraticCurveTo(86, 32, 82, 46);
  ctx.stroke();
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.arc(104, 28, 1.8, 0, Math.PI * 2);
  ctx.fill();
}

/** Paints the two gallop frames once. */
export function unicornTextures(scene: Phaser.Scene): void {
  for (const f of [0, 1] as const) {
    const key = `unicorn_${f}`;
    if (scene.textures.exists(key)) continue;
    const t = scene.textures.createCanvas(key, UNICORN_TEX_W, UNICORN_TEX_H);
    if (!t) throw new Error(`cannot create texture ${key}`);
    drawUnicorn(t.getContext(), f);
    t.refresh();
  }
}
