// The unicorn of the margins (GDD §4.12), painted once into two canvas textures, `unicorn_0`
// and `unicorn_1`, its legs gathered and stretched in the gallop. As the bestiaries draw it: a
// slender white beast with cloven hooves, a goat's beard, a long twisted horn of gold, a curling
// mane and a lion's tufted tail. Facing right, hooves on the bottom edge; drawn at twice its
// size (UNICORN_TEX_SCALE) so it stays crisp under the camera zoom.
import Phaser from 'phaser';
import { COLORS, css } from '../ui/tokens.ts';

type Ctx = CanvasRenderingContext2D;

/** design px of the drawing; the texture is UNICORN_TEX_SCALE times as large */
const W = 130;
const H = 104;
export const UNICORN_TEX_SCALE = 2;
export const UNICORN_TEX_W = W * UNICORN_TEX_SCALE;
export const UNICORN_TEX_H = H * UNICORN_TEX_SCALE;

const INK = css(COLORS.encre);
const COAT = css(COLORS.ceruse);
const SHADE = css(COLORS.velin);
const GOLD = css(COLORS.or);
const GOLD_DARK = css(COLORS.poincon);

/** A path filled and inked. */
function shape(ctx: Ctx, path: () => void, fill: string, line = 2.2): void {
  ctx.beginPath();
  path();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = line;
  ctx.stroke();
}

/**
 * A leg from the body down to a cloven hoof: thigh, knee and cannon as a tapered quad, a tuft
 * of hair at the fetlock, a split gilt hoof.
 */
function leg(
  ctx: Ctx,
  hip: readonly [number, number],
  knee: readonly [number, number],
  hoof: readonly [number, number],
  far: boolean,
): void {
  const fill = far ? SHADE : COAT;
  const [hx, hy] = hip;
  const [kx, ky] = knee;
  const [fx, fy] = hoof;
  shape(
    ctx,
    () => {
      ctx.moveTo(hx - 6, hy);
      ctx.quadraticCurveTo(kx - 5, (hy + ky) / 2, kx - 3, ky);
      ctx.lineTo(fx - 2.2, fy - 5);
      ctx.lineTo(fx + 2.2, fy - 5);
      ctx.lineTo(kx + 3, ky);
      ctx.quadraticCurveTo(kx + 6, (hy + ky) / 2, hx + 6, hy);
      ctx.closePath();
    },
    fill,
    1.8,
  );
  // Fetlock tuft.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(fx - 3, fy - 7);
  ctx.quadraticCurveTo(fx - 6, fy - 6, fx - 5, fy - 3);
  ctx.stroke();
  // Cloven hoof.
  shape(
    ctx,
    () => {
      ctx.moveTo(fx - 3.5, fy - 5);
      ctx.lineTo(fx + 3.5, fy - 5);
      ctx.lineTo(fx + 4.5, fy);
      ctx.lineTo(fx - 4.5, fy);
      ctx.closePath();
    },
    GOLD,
    1.4,
  );
  ctx.beginPath();
  ctx.moveTo(fx, fy - 5);
  ctx.lineTo(fx, fy);
  ctx.stroke();
}

function drawUnicorn(ctx: Ctx, frame: 0 | 1): void {
  ctx.scale(UNICORN_TEX_SCALE, UNICORN_TEX_SCALE);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const ground = H - 1;
  // Legs: [hip, knee, hoof]; far ones first, in the vellum shade.
  const gathered = frame === 0;
  const farLegs: readonly (readonly [[number, number], [number, number], [number, number]])[] =
    gathered
      ? [
          [
            [44, 62],
            [54, 78],
            [46, ground - 6],
          ],
          [
            [86, 62],
            [80, 80],
            [90, ground - 8],
          ],
        ]
      : [
          [
            [44, 62],
            [30, 74],
            [18, ground - 12],
          ],
          [
            [86, 62],
            [102, 72],
            [114, ground - 18],
          ],
        ];
  for (const [hip, knee, hoof] of farLegs) leg(ctx, hip, knee, hoof, true);

  // The tail: a slender switch ending in a lion's tuft, streaming back.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(36, 52);
  ctx.bezierCurveTo(24, 46, 18, gathered ? 58 : 48, 10, gathered ? 60 : 44);
  ctx.stroke();
  ctx.strokeStyle = COAT;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  const tx = 10;
  const ty = gathered ? 60 : 44;
  shape(
    ctx,
    () => {
      ctx.moveTo(tx + 3, ty - 2);
      ctx.quadraticCurveTo(tx - 6, ty - 8, tx - 9, ty + 2);
      ctx.quadraticCurveTo(tx - 4, ty + 1, tx - 7, ty + 8);
      ctx.quadraticCurveTo(tx, ty + 4, tx + 3, ty - 2);
    },
    GOLD,
    1.6,
  );

  // Body: a deep chest, a tucked belly, round haunches.
  shape(
    ctx,
    () => {
      ctx.moveTo(38, 50);
      ctx.bezierCurveTo(40, 38, 62, 38, 78, 40);
      ctx.bezierCurveTo(90, 40, 98, 44, 98, 54);
      ctx.bezierCurveTo(98, 66, 90, 70, 80, 68);
      ctx.bezierCurveTo(70, 66, 58, 68, 50, 68);
      ctx.bezierCurveTo(38, 68, 34, 60, 38, 50);
      ctx.closePath();
    },
    COAT,
  );
  // A soft shade under the belly.
  ctx.strokeStyle = SHADE;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(52, 65);
  ctx.quadraticCurveTo(68, 63, 84, 65);
  ctx.stroke();

  // Neck, arched, and the head with its long muzzle.
  shape(
    ctx,
    () => {
      ctx.moveTo(84, 44);
      ctx.bezierCurveTo(88, 30, 96, 20, 104, 16);
      ctx.lineTo(118, 22);
      ctx.quadraticCurveTo(124, 26, 122, 31);
      ctx.quadraticCurveTo(116, 33, 110, 31);
      ctx.bezierCurveTo(106, 38, 102, 48, 98, 56);
      ctx.closePath();
    },
    COAT,
  );
  // Goat's beard under the jaw.
  shape(
    ctx,
    () => {
      ctx.moveTo(114, 31);
      ctx.quadraticCurveTo(113, 38, 109, 41);
      ctx.quadraticCurveTo(110, 35, 108, 31);
    },
    COAT,
    1.4,
  );
  // Ear.
  shape(
    ctx,
    () => {
      ctx.moveTo(102, 17);
      ctx.lineTo(100, 8);
      ctx.lineTo(106, 15);
    },
    COAT,
    1.5,
  );
  // The horn: long, twisted, gold leaf with its spiral inked.
  const base: readonly [number, number] = [108, 17];
  const tip: readonly [number, number] = [128, 0];
  shape(
    ctx,
    () => {
      ctx.moveTo(base[0] - 3, base[1]);
      ctx.lineTo(tip[0], tip[1]);
      ctx.lineTo(base[0] + 3, base[1] + 2);
      ctx.closePath();
    },
    GOLD,
    1.5,
  );
  ctx.strokeStyle = GOLD_DARK;
  ctx.lineWidth = 1.2;
  for (let k = 0.15; k < 0.95; k += 0.14) {
    const x = base[0] + (tip[0] - base[0]) * k;
    const y = base[1] + (tip[1] - base[1]) * k;
    const r = 3 * (1 - k);
    ctx.beginPath();
    ctx.moveTo(x - r, y - r * 0.4);
    ctx.lineTo(x + r, y + r * 0.9);
    ctx.stroke();
  }
  // Eye and nostril.
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(111, 22, 1.8, 1.3, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(120, 28, 0.9, 0, Math.PI * 2);
  ctx.fill();
  // Mane: gilt curls along the crest of the neck.
  for (let i = 0; i < 6; i++) {
    const k = i / 5;
    const x = 101 - k * 16;
    const y = 17 + k * 26;
    shape(
      ctx,
      () => {
        ctx.moveTo(x + 2, y - 2);
        ctx.quadraticCurveTo(x - 8, y - 2, x - 7, y + 5);
        ctx.quadraticCurveTo(x - 4, y + 2, x - 1, y + 4);
        ctx.closePath();
      },
      GOLD,
      1.3,
    );
  }

  // Near legs, in front.
  const nearLegs: readonly (readonly [[number, number], [number, number], [number, number]])[] =
    gathered
      ? [
          [
            [48, 62],
            [60, 80],
            [54, ground],
          ],
          [
            [90, 60],
            [88, 80],
            [98, ground - 2],
          ],
        ]
      : [
          [
            [48, 62],
            [38, 80],
            [26, ground - 2],
          ],
          [
            [90, 60],
            [108, 66],
            [122, ground - 10],
          ],
        ];
  for (const [hip, knee, hoof] of nearLegs) leg(ctx, hip, knee, hoof, false);
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
