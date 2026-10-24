// Cosmetic scenery until the painted maps (ASSETS §1.1): a far landscape with a castle, farms,
// an inn, mills, lollipop trees and grazing beasts in parallax, scalloped clouds drifting with
// the wind, and trees and flowers standing on the terrain, which fall away when the ground
// under them is blown up. Everything is painted once into canvas textures.
// Cosmetic randomness only (Math.random), never the sim PRNG.
import Phaser from 'phaser';
import { COLORS, css } from '../ui/tokens.ts';
import { SkyLife } from './sky-life.ts';
import type { MaskView } from './terrain-layer.ts';
import type { MapTheme } from '../content/maps.ts';
import {
  COAST_GROUND,
  HOLY_LAND_GROUND,
  coastProps,
  drawFarCoast,
  drawFarHolyLand,
  holyLandProps,
  type ThemeProps,
} from './scenery-themes.ts';

export const FAR_W = 3200;
/** tall enough for the lower hill to reach below the terrain everywhere */
export const FAR_H = 1000;
/** parallax factor of the far landscape */
const FAR_SCROLL = 0.45;
const CLOUD_SCROLL = 0.6;
/** px per second per wind point */
const CLOUD_DRIFT = 10;
/** distinct cloud shapes, shared by all the clouds in the sky */
const CLOUD_SHAPES = 4;
const CLOUD_H = 120;
/** tint of the clouds while it rains: slate grey */
const STORM_TINT = COLORS.roche;

export type Ctx = CanvasRenderingContext2D;

export const rnd = (a: number, b: number): number => a + Math.random() * (b - a);
export const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)] as T;

export const ink = (ctx: Ctx, w = 2): void => {
  ctx.strokeStyle = css(COLORS.encre);
  ctx.lineWidth = w;
};

/**
 * Fills the path that `trace` draws, hatches inside it if asked, then inks its outline: the
 * one gesture of the manuscript, a flat field in a dark line.
 */
export function shape(
  ctx: Ctx,
  trace: () => void,
  fill: number,
  hatch?: () => void,
  line = 3,
): void {
  ctx.beginPath();
  trace();
  ctx.fillStyle = css(fill);
  ctx.fill();
  if (hatch) {
    ctx.save();
    ctx.clip();
    hatch();
    ctx.restore();
  }
  ctx.beginPath();
  trace();
  ink(ctx, line);
  ctx.stroke();
}

/** Rows of little hanging arcs over a box: roof tiles, thatch, the hatching of the manuscript. */
export function scallops(
  ctx: Ctx,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  r: number,
  step: number,
  color: number,
  alpha: number,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = css(color);
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  let row = 0;
  for (let y = y0; y < y1 + r; y += step, row++) {
    for (let x = x0 - r + (row % 2) * r; x < x1 + 2 * r; x += 2 * r) {
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI);
    }
  }
  ctx.stroke();
  ctx.restore();
}

/** Coursed ashlar: faint beds and staggered joints over a box. */
export function masonry(ctx: Ctx, x: number, top: number, w: number, h: number): void {
  ctx.save();
  ctx.globalAlpha = 0.28;
  ink(ctx, 1);
  ctx.beginPath();
  let row = 0;
  for (let y = top + 9; y < top + h; y += 9, row++) {
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    for (let jx = x + (row % 2) * 8 + 4; jx < x + w; jx += 16) {
      ctx.moveTo(jx, y);
      ctx.lineTo(jx, y - 9);
    }
  }
  ctx.stroke();
  ctx.restore();
}

/** A pointed lancet opening filled with shadow. */
function lancet(ctx: Ctx, cx: number, y: number, hw: number, h: number, fill = COLORS.encre): void {
  ctx.fillStyle = css(fill);
  ctx.beginPath();
  ctx.moveTo(cx - hw, y + h);
  ctx.lineTo(cx - hw, y);
  ctx.quadraticCurveTo(cx - hw, y - hw * 1.1, cx, y - hw * 1.7);
  ctx.quadraticCurveTo(cx + hw, y - hw * 1.1, cx + hw, y);
  ctx.lineTo(cx + hw, y + h);
  ctx.closePath();
  ctx.fill();
}

/** Merlons standing on a wall top. */
export function merlons(
  ctx: Ctx,
  x: number,
  top: number,
  w: number,
  fill: number = COLORS.ceruse,
): void {
  const m = 8;
  const n = Math.max(2, Math.round((w + 6) / 14));
  const gap = (w - m) / (n - 1);
  for (let i = 0; i < n; i++) {
    const mx = x + i * gap;
    shape(ctx, () => ctx.rect(mx, top - 9, m, 9), fill, undefined, 2);
  }
}

/** A pole with a gold knop and a swallow-tailed pennant waving in the wind. */
export function pennant(ctx: Ctx, x: number, y: number, color: number): void {
  const top = y - 22;
  ink(ctx, 2);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, top);
  ctx.stroke();
  const len = rnd(20, 30);
  shape(
    ctx,
    () => {
      ctx.moveTo(x, top);
      ctx.bezierCurveTo(x + len * 0.3, top - 4, x + len * 0.6, top + 5, x + len, top + 1);
      ctx.lineTo(x + len * 0.72, top + 5);
      ctx.lineTo(x + len * 0.95, top + 10);
      ctx.bezierCurveTo(x + len * 0.6, top + 13, x + len * 0.3, top + 4, x, top + 9);
      ctx.closePath();
    },
    color,
    undefined,
    1.5,
  );
  shape(ctx, () => ctx.arc(x, y, 3, 0, Math.PI * 2), COLORS.or, undefined, 1.5);
}

/** A slender cone with incurved sides, tiled in scales. Returns its apex. */
function cone(ctx: Ctx, x0: number, x1: number, y: number, h: number, color: number): number {
  const mx = (x0 + x1) / 2;
  const r = Math.max(3, (x1 - x0) / 9);
  shape(
    ctx,
    () => {
      ctx.moveTo(x0, y);
      ctx.quadraticCurveTo(x0 + (mx - x0) * 0.75, y - h * 0.4, mx, y - h);
      ctx.quadraticCurveTo(x1 - (x1 - mx) * 0.75, y - h * 0.4, x1, y);
      ctx.closePath();
    },
    color,
    () => scallops(ctx, x0, y - h, x1, y, r, r * 1.1, COLORS.encre, 0.45),
  );
  return y - h;
}

/**
 * A round-fronted tower: coursed stone, lancets, and either merlons or a corbelled parapet
 * under a scale-tiled spire with a pennant.
 */
function tower(
  ctx: Ctx,
  x: number,
  base: number,
  w: number,
  h: number,
  roof: number | null,
  flag: number | null,
): void {
  const top = base - h;
  shape(
    ctx,
    () => ctx.rect(x, top, w, h),
    COLORS.ceruse,
    () => masonry(ctx, x, top, w, h),
  );
  lancet(ctx, x + w / 2, top + h * 0.28, Math.max(2.5, w * 0.11), w * 0.45);
  if (h > 80) lancet(ctx, x + w / 2, top + h * 0.62, 1.8, 10);
  if (roof === null) {
    merlons(ctx, x - 2, top, w + 4);
    return;
  }
  // Corbelled parapet: a band carried on little arches.
  shape(ctx, () => ctx.rect(x - 4, top - 10, w + 8, 10), COLORS.ceruse, undefined, 2.5);
  ink(ctx, 1.5);
  ctx.beginPath();
  for (let cx = x + 2; cx < x + w; cx += 7) {
    ctx.moveTo(cx + 3.5, top);
    ctx.arc(cx + 3.5, top, 3.5, 0, Math.PI);
  }
  ctx.stroke();
  const apex = cone(ctx, x - 7, x + w + 7, top - 10, (w + 14) * rnd(1.25, 1.6), roof);
  if (flag !== null) pennant(ctx, x + w / 2, apex, flag);
}

/** A castle: a keep and inner towers behind a crenellated curtain wall with a gate. */
function castle(ctx: Ctx, cx: number, base: number): void {
  const roof = (): number => pick([COLORS.vermillon, COLORS.lapis]);
  const flag = (): number => pick([COLORS.vermillon, COLORS.or, COLORS.lapis]);
  const tall = (h: number): number => Math.round(h * rnd(0.88, 1.12));
  // The keep, its turret, and the inner towers stand behind the wall.
  const keepH = tall(160);
  tower(ctx, cx - 38, base, 76, keepH, null, null);
  tower(ctx, cx + 8, base - keepH + 2, 24, tall(38), roof(), flag());
  tower(ctx, cx - 100, base, 30, tall(125), roof(), flag());
  tower(ctx, cx + 70, base, 30, tall(140), roof(), flag());
  // Curtain wall
  const wallTop = base - 62;
  shape(
    ctx,
    () => ctx.rect(cx - 135, wallTop, 270, 66),
    COLORS.ceruse,
    () => masonry(ctx, cx - 135, wallTop, 270, 66),
  );
  merlons(ctx, cx - 135, wallTop, 270);
  // Gate: a pointed arch with a door and the portcullis half raised.
  shape(
    ctx,
    () => {
      ctx.moveTo(cx - 17, base + 4);
      ctx.lineTo(cx - 17, base - 26);
      ctx.quadraticCurveTo(cx - 17, base - 42, cx, base - 48);
      ctx.quadraticCurveTo(cx + 17, base - 42, cx + 17, base - 26);
      ctx.lineTo(cx + 17, base + 4);
      ctx.closePath();
    },
    COLORS.terreOmbre,
    () => {
      ink(ctx, 1.5);
      ctx.beginPath();
      for (let gx = cx - 12; gx <= cx + 12; gx += 6) {
        ctx.moveTo(gx, base - 48);
        ctx.lineTo(gx, base - 18);
      }
      for (let gy = base - 42; gy <= base - 18; gy += 6) {
        ctx.moveTo(cx - 17, gy);
        ctx.lineTo(cx + 17, gy);
      }
      ctx.stroke();
    },
  );
  // Front corner towers, astride the wall.
  tower(ctx, cx - 158, base + 6, 42, tall(105), roof(), flag());
  tower(ctx, cx + 116, base + 6, 42, tall(92), roof(), flag());
}

/** A wall of whitewashed daub held in a frame of dark timbers with braces. */
function timbered(ctx: Ctx, x: number, top: number, w: number, h: number): void {
  shape(
    ctx,
    () => ctx.rect(x, top, w, h),
    COLORS.ceruse,
    () => {
      ctx.strokeStyle = css(COLORS.terreOmbre);
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      const bays = Math.max(2, Math.round(w / 26));
      const bw = w / bays;
      for (let i = 0; i <= bays; i++) {
        ctx.moveTo(x + i * bw, top);
        ctx.lineTo(x + i * bw, top + h);
      }
      ctx.moveTo(x, top + h / 2);
      ctx.lineTo(x + w, top + h / 2);
      for (let i = 0; i < bays; i++) {
        const lx = x + i * bw;
        const up = i % 2 === 0;
        ctx.moveTo(lx, up ? top + h / 2 : top);
        ctx.lineTo(lx + bw, up ? top : top + h / 2);
      }
      ctx.stroke();
    },
  );
}

/** A roof seen from the long side: thatch with rounded eaves, or tiles in scales. */
function roof(
  ctx: Ctx,
  x0: number,
  x1: number,
  y: number,
  h: number,
  kind: 'thatch' | 'tiles',
  color: number,
): void {
  const ridge = h * 0.55;
  shape(
    ctx,
    () => {
      ctx.moveTo(x0 - 8, y + 3);
      if (kind === 'thatch') {
        ctx.quadraticCurveTo(x0 - 6, y - h * 0.3, x0 + ridge, y - h);
        ctx.lineTo(x1 - ridge, y - h);
        ctx.quadraticCurveTo(x1 + 6, y - h * 0.3, x1 + 8, y + 3);
      } else {
        ctx.lineTo(x0 + ridge, y - h);
        ctx.lineTo(x1 - ridge, y - h);
        ctx.lineTo(x1 + 8, y + 3);
      }
      ctx.closePath();
    },
    color,
    () =>
      kind === 'thatch'
        ? scallops(ctx, x0 - 8, y - h, x1 + 8, y + 3, 2.5, 6, COLORS.terreOmbre, 0.55)
        : scallops(ctx, x0 - 8, y - h, x1 + 8, y + 3, 5, 5.5, COLORS.encre, 0.45),
  );
}

/** A small window with open shutters. */
function casement(ctx: Ctx, x: number, y: number): void {
  shape(ctx, () => ctx.rect(x - 4, y, 8, 9), COLORS.encre, undefined, 2);
  shape(ctx, () => ctx.rect(x - 9, y, 5, 9), COLORS.vertDeGris, undefined, 1.5);
  shape(ctx, () => ctx.rect(x + 4, y, 5, 9), COLORS.vertDeGris, undefined, 1.5);
}

function door(ctx: Ctx, cx: number, base: number, w: number, h: number): void {
  shape(
    ctx,
    () => {
      ctx.moveTo(cx - w / 2, base);
      ctx.lineTo(cx - w / 2, base - h + w / 2);
      ctx.arc(cx, base - h + w / 2, w / 2, Math.PI, 0);
      ctx.lineTo(cx + w / 2, base);
      ctx.closePath();
    },
    COLORS.terreOmbre,
    undefined,
    2,
  );
}

/** A beehive haystack hatched with straw. */
function haystack(ctx: Ctx, cx: number, base: number, s: number): void {
  shape(
    ctx,
    () => {
      ctx.moveTo(cx - 20 * s, base);
      ctx.bezierCurveTo(cx - 22 * s, base - 30 * s, cx - 6 * s, base - 38 * s, cx, base - 38 * s);
      ctx.bezierCurveTo(cx + 6 * s, base - 38 * s, cx + 22 * s, base - 30 * s, cx + 20 * s, base);
      ctx.closePath();
    },
    COLORS.or,
    () =>
      scallops(ctx, cx - 22 * s, base - 38 * s, cx + 22 * s, base, 3, 7, COLORS.terreOmbre, 0.5),
    2.5,
  );
  ink(ctx, 2);
  ctx.beginPath();
  ctx.moveTo(cx, base - 38 * s);
  ctx.lineTo(cx, base - 46 * s);
  ctx.stroke();
}

/** A wattle fence: stakes woven with a wavy withy. */
function fence(ctx: Ctx, x0: number, x1: number, base: number): void {
  ink(ctx, 2);
  ctx.beginPath();
  for (let x = x0; x <= x1; x += 9) {
    ctx.moveTo(x, base);
    ctx.lineTo(x, base - 13);
  }
  for (const y of [base - 4, base - 9]) {
    ctx.moveTo(x0, y);
    for (let x = x0; x < x1; x += 9)
      ctx.quadraticCurveTo(x + 4.5, y + (x % 18 === 0 ? 3 : -3), x + 9, y);
  }
  ctx.stroke();
}

/** A farm: a half-timbered house under thatch, a tiled barn, a haystack and a wattle fence. */
export function farm(ctx: Ctx, x: number, base: number): void {
  const bx = x + 108;
  shape(
    ctx,
    () => ctx.rect(bx, base - 38, 70, 40),
    COLORS.velin,
    () => {
      ink(ctx, 1);
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      for (let px = bx + 7; px < bx + 70; px += 7) {
        ctx.moveTo(px, base - 38);
        ctx.lineTo(px, base + 2);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    },
  );
  door(ctx, bx + 35, base + 2, 22, 28);
  roof(ctx, bx, bx + 70, base - 38, 30, 'tiles', pick([COLORS.vermillon, COLORS.ocre]));
  timbered(ctx, x, base - 50, 92, 52);
  door(ctx, x + 30, base + 2, 14, 24);
  casement(ctx, x + 66, base - 40);
  casement(ctx, x + 66, base - 20);
  roof(ctx, x, x + 92, base - 50, 44, 'thatch', COLORS.ocre);
  // Chimney with a curl of smoke.
  shape(ctx, () => ctx.rect(x + 62, base - 100, 10, 22), COLORS.ceruse, undefined, 2);
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = css(COLORS.azur);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 67, base - 102);
  ctx.bezierCurveTo(x + 58, base - 114, x + 78, base - 120, x + 70, base - 132);
  ctx.bezierCurveTo(x + 64, base - 140, x + 80, base - 146, x + 76, base - 154);
  ctx.stroke();
  ctx.restore();
  haystack(ctx, x + 200, base + 2, rnd(0.9, 1.1));
  fence(ctx, x - 40, x - 6, base + 4);
}

/** An inn: two timbered storeys, the upper one jettied, a tiled roof and a hanging sign. */
function inn(ctx: Ctx, x: number, base: number): void {
  timbered(ctx, x, base - 42, 104, 44);
  door(ctx, x + 70, base + 2, 16, 28);
  casement(ctx, x + 32, base - 30);
  timbered(ctx, x - 8, base - 80, 120, 38);
  casement(ctx, x + 22, base - 70);
  casement(ctx, x + 80, base - 70);
  const tiles = pick([COLORS.vermillon, COLORS.lapis]);
  // Chimney behind the roof's ridge.
  shape(
    ctx,
    () => ctx.rect(x + 82, base - 142, 12, 34),
    COLORS.ceruse,
    () => masonry(ctx, x + 82, base - 142, 12, 34),
  );
  roof(ctx, x - 8, x + 112, base - 80, 50, 'tiles', tiles);
  // The sign hangs from an iron bracket on the corner post.
  const sx = x - 8;
  const sy = base - 46;
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(sx - 30, sy);
  ctx.moveTo(sx, sy + 10);
  ctx.lineTo(sx - 14, sy);
  ctx.moveTo(sx - 26, sy);
  ctx.lineTo(sx - 26, sy + 6);
  ctx.moveTo(sx - 10, sy);
  ctx.lineTo(sx - 10, sy + 6);
  ctx.stroke();
  shape(ctx, () => ctx.rect(sx - 30, sy + 6, 24, 18), COLORS.vermillon, undefined, 2);
  // A golden pot on the board.
  shape(
    ctx,
    () => {
      ctx.moveTo(sx - 22, sy + 10);
      ctx.lineTo(sx - 14, sy + 10);
      ctx.quadraticCurveTo(sx - 11, sy + 17, sx - 15, sy + 21);
      ctx.lineTo(sx - 21, sy + 21);
      ctx.quadraticCurveTo(sx - 25, sy + 17, sx - 22, sy + 10);
      ctx.closePath();
    },
    COLORS.or,
    undefined,
    1.2,
  );
  // An ale-stake bush over the door.
  ink(ctx, 2);
  ctx.beginPath();
  ctx.moveTo(x + 104, base - 46);
  ctx.lineTo(x + 124, base - 54);
  ctx.stroke();
  shape(ctx, () => ctx.arc(x + 126, base - 50, 7, 0, Math.PI * 2), COLORS.vertDeGris, undefined, 2);
  fence(ctx, x + 132, x + 168, base + 4);
}

/** A tower mill: a tapering stone body, a tiled cap, and four latticed sails. */
function windmill(ctx: Ctx, x: number, base: number): void {
  const h = 96;
  const top = base - h;
  const body = (): void => {
    ctx.moveTo(x - 22, base + 4);
    ctx.lineTo(x - 14, top);
    ctx.lineTo(x + 14, top);
    ctx.lineTo(x + 22, base + 4);
    ctx.closePath();
  };
  shape(ctx, body, COLORS.ceruse, () => masonry(ctx, x - 22, top, 44, h + 4));
  door(ctx, x, base + 4, 12, 22);
  lancet(ctx, x, top + 30, 3, 9);
  // Cap
  shape(
    ctx,
    () => {
      ctx.moveTo(x - 18, top + 2);
      ctx.quadraticCurveTo(x - 18, top - 24, x, top - 28);
      ctx.quadraticCurveTo(x + 18, top - 24, x + 18, top + 2);
      ctx.closePath();
    },
    pick([COLORS.vermillon, COLORS.lapis]),
    () => scallops(ctx, x - 18, top - 28, x + 18, top + 2, 4, 4.5, COLORS.encre, 0.45),
  );
  pennant(ctx, x, top - 28, pick([COLORS.or, COLORS.vermillon]));
  // Sails: a stock with a lattice on its trailing side, some clothed.
  const hubY = top - 6;
  const turn = rnd(0, Math.PI / 2);
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.translate(x, hubY);
    ctx.rotate(turn + (i * Math.PI) / 2);
    const len = 66;
    shape(
      ctx,
      () => ctx.rect(10, 0, len - 10, 13),
      i % 2 === 0 ? COLORS.velin : COLORS.ceruse,
      () => {
        ink(ctx, 1.2);
        ctx.beginPath();
        ctx.moveTo(10, 6.5);
        ctx.lineTo(len, 6.5);
        for (let sx = 17; sx < len; sx += 7) {
          ctx.moveTo(sx, 0);
          ctx.lineTo(sx, 13);
        }
        ctx.stroke();
      },
      2,
    );
    ctx.strokeStyle = css(COLORS.terreOmbre);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(len + 4, 0);
    ctx.stroke();
    ctx.restore();
  }
  shape(ctx, () => ctx.arc(x, hubY, 5, 0, Math.PI * 2), COLORS.terreOmbre, undefined, 2);
}

export function lollipop(ctx: Ctx, x: number, y: number, r: number, leaf: number, alpha = 1): void {
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 3;
  ctx.strokeStyle = css(COLORS.encre);
  ctx.fillStyle = css(COLORS.terreOmbre);
  ctx.fillRect(x - 3, y - r * 1.6, 6, r * 1.6);
  ctx.strokeRect(x - 3, y - r * 1.6, 6, r * 1.6);
  ctx.fillStyle = css(leaf);
  ctx.beginPath();
  ctx.arc(x, y - r * 1.6 - r * 0.8, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Leaves as little arcs, the way the manuscript hatches its foliage.
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * r * 0.5, y - r * 2.4 + Math.sin(a) * r * 0.5, r * 0.28, 0, Math.PI);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** A sheep: a fleece of scallops, black head and legs; head down when grazing. */
export function sheep(ctx: Ctx, x: number, feet: number, f: number, s: number): void {
  const rx = 15 * s;
  const ry = 9.5 * s;
  const cy = feet - 8 * s - ry;
  ink(ctx, 2);
  ctx.fillStyle = css(COLORS.encre);
  for (const lx of [-0.6, -0.3, 0.3, 0.6])
    ctx.fillRect(x + lx * rx - 1.3 * s, cy, 2.6 * s, feet - cy);
  const curl = 4.6 * s;
  const fleece = (g: number): void => {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const px = x + Math.cos(a) * rx * 0.85;
      const py = cy + Math.sin(a) * ry * 0.75;
      ctx.moveTo(px + curl + g, py);
      ctx.arc(px, py, curl + g, 0, Math.PI * 2);
    }
    ctx.moveTo(x + rx * 0.85, cy);
    ctx.ellipse(x, cy, rx * 0.85, ry * 0.75, 0, 0, Math.PI * 2);
  };
  // Outline the whole fleece, then cover the inner strokes.
  ctx.fillStyle = css(COLORS.ceruse);
  ctx.beginPath();
  fleece(0);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  fleece(-1.2);
  ctx.fill();
  ctx.save();
  ctx.globalAlpha = 0.45;
  ink(ctx, 1);
  ctx.beginPath();
  for (const [dx, dy] of [
    [-0.45, -0.1],
    [0, -0.3],
    [0.4, 0],
    [-0.15, 0.35],
  ] as const) {
    ctx.moveTo(x + dx * rx + 2.6 * s, cy + dy * ry);
    ctx.arc(x + dx * rx, cy + dy * ry, 2.6 * s, 0, Math.PI);
  }
  ctx.stroke();
  ctx.restore();
  const grazing = Math.random() < 0.4;
  const hx = x + f * rx * (grazing ? 1.05 : 1.15);
  const hy = grazing ? cy + ry * 0.9 : cy - ry * 0.45;
  ctx.fillStyle = css(COLORS.encre);
  ctx.beginPath();
  ctx.ellipse(hx, hy, 5.8 * s, 3.8 * s, f * (grazing ? 1.1 : 0.45), 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(hx - f * 3 * s, hy - 2.5 * s, 3 * s, 1.4 * s, -f * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css(COLORS.ceruse);
  ctx.beginPath();
  ctx.arc(hx + f * 1.5 * s, hy - 1.2 * s, 0.9 * s, 0, Math.PI * 2);
  ctx.fill();
}

/** A pied cow: patches, horns, a tufted tail, a pink muzzle. */
function cow(ctx: Ctx, x: number, feet: number, f: number, s: number): void {
  const bw = 42 * s;
  const bh = 20 * s;
  const bx = x - bw / 2;
  const by = feet - 13 * s - bh;
  const patch = pick([COLORS.terreOmbre, COLORS.encre]);
  // Tail
  const tx = x - (f * bw) / 2;
  ink(ctx, 2);
  ctx.beginPath();
  ctx.moveTo(tx, by + 3 * s);
  ctx.quadraticCurveTo(tx - f * 7 * s, by + 8 * s, tx - f * 5 * s, by + bh + 4 * s);
  ctx.stroke();
  ctx.fillStyle = css(patch);
  ctx.beginPath();
  ctx.ellipse(tx - f * 5 * s, by + bh + 6 * s, 2 * s, 3.5 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Legs with dark hooves
  for (const lx of [0.1, 0.24, 0.72, 0.86]) {
    const legX = bx + lx * bw - 2.4 * s;
    shape(
      ctx,
      () => ctx.rect(legX, by + bh - 4, 4.8 * s, feet - by - bh + 4),
      COLORS.ceruse,
      undefined,
      2,
    );
    ctx.fillStyle = css(COLORS.encre);
    ctx.fillRect(legX, feet - 3 * s, 4.8 * s, 3 * s);
  }
  // Udder
  shape(
    ctx,
    () => ctx.ellipse(x - f * bw * 0.2, by + bh, 5 * s, 3.5 * s, 0, 0, Math.PI),
    COLORS.roseGarance,
    undefined,
    1.5,
  );
  const body = (): void => {
    ctx.roundRect(bx, by, bw, bh, 9 * s);
  };
  shape(ctx, body, COLORS.ceruse, () => {
    ctx.fillStyle = css(patch);
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const px = bx + rnd(0.15, 0.85) * bw;
      const py = by + rnd(0.1, 0.7) * bh;
      ctx.moveTo(px + 8 * s, py);
      ctx.ellipse(px, py, rnd(5, 9) * s, rnd(4, 7) * s, rnd(0, Math.PI), 0, Math.PI * 2);
    }
    ctx.fill();
  });
  // Head on a neck, lowered when grazing.
  const grazing = Math.random() < 0.4;
  const head = beastHead(
    ctx,
    x + f * bw * 0.32,
    by + 1 * s,
    x + f * bw * 0.46,
    by + bh * 0.8,
    x + f * (bw / 2 + 6 * s),
    grazing ? feet - 9 * s : by + 2 * s,
    f,
    s,
    grazing ? 1.15 : 0.35,
    7,
    5.2,
    Math.random() < 0.5 ? patch : COLORS.ceruse,
  );
  shape(
    ctx,
    () => ctx.ellipse(head.mx, head.my, 3.4 * s, 2.8 * s, 0, 0, Math.PI * 2),
    COLORS.carnation,
    undefined,
    1.5,
  );
  // Horns curving out from the poll.
  ctx.strokeStyle = css(COLORS.encre);
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(head.px, head.py);
  ctx.quadraticCurveTo(head.px + f * 5 * s, head.py, head.px + f * 5 * s, head.py - 5 * s);
  ctx.moveTo(head.px, head.py);
  ctx.quadraticCurveTo(head.px - f * 4 * s, head.py, head.px - f * 4 * s, head.py - 5 * s);
  ctx.stroke();
  ctx.strokeStyle = css(COLORS.ceruse);
  ctx.lineWidth = 1.6;
  ctx.stroke();
}

/**
 * A neck from the withers and chest up to a long head, an ear and an eye. Returns the muzzle
 * and the poll, where horns or a mane attach.
 */
function beastHead(
  ctx: Ctx,
  wx: number,
  wy: number,
  cx: number,
  cy: number,
  hx: number,
  hy: number,
  f: number,
  s: number,
  tilt: number,
  rx: number,
  ry: number,
  coat: number,
): { mx: number; my: number; px: number; py: number } {
  const px = hx - f * 2 * s;
  const py = hy - ry * 0.6 * s;
  shape(
    ctx,
    () => {
      ctx.moveTo(wx, wy);
      ctx.lineTo(px, py);
      ctx.lineTo(hx + f * 2 * s, hy + ry * 0.7 * s);
      ctx.lineTo(cx, cy);
      ctx.closePath();
    },
    coat,
    undefined,
    2,
  );
  // The head's long axis points forward and down by `tilt`.
  const ax = Math.cos(tilt) * rx * 0.6 * s;
  const ay = Math.sin(tilt) * rx * 0.6 * s;
  const ex = hx + f * ax;
  const ey = hy + ay;
  shape(
    ctx,
    () => ctx.ellipse(ex, ey, rx * s, ry * s, f * tilt, 0, Math.PI * 2),
    coat,
    undefined,
    2,
  );
  shape(
    ctx,
    () => {
      ctx.moveTo(px - f * 1 * s, py + 1 * s);
      ctx.lineTo(px - f * 5 * s, py - 3 * s);
      ctx.lineTo(px + f * 1.5 * s, py - 1 * s);
      ctx.closePath();
    },
    coat,
    undefined,
    1.5,
  );
  ctx.fillStyle = css(coat === COLORS.encre ? COLORS.ceruse : COLORS.encre);
  ctx.beginPath();
  ctx.arc(hx + f * ax * 0.2, hy + ay * 0.2 - ry * 0.25 * s, 1.1 * s, 0, Math.PI * 2);
  ctx.fill();
  return { mx: ex + f * ax * 1.1, my: ey + ay * 1.1, px, py };
}

/** A horse: long legs, a raised neck, an ink mane and tail. */
function horse(ctx: Ctx, x: number, feet: number, f: number, s: number): void {
  const bw = 40 * s;
  const bh = 17 * s;
  const bx = x - bw / 2;
  const by = feet - 20 * s - bh;
  const coat = pick([COLORS.terreOmbre, COLORS.ceruse, COLORS.ocre]);
  const tx = x - (f * bw) / 2;
  shape(
    ctx,
    () => {
      ctx.moveTo(tx, by + 2 * s);
      ctx.quadraticCurveTo(tx - f * 12 * s, by + 4 * s, tx - f * 9 * s, by + bh + 12 * s);
      ctx.quadraticCurveTo(tx - f * 4 * s, by + 10 * s, tx, by + 6 * s);
      ctx.closePath();
    },
    COLORS.encre,
    undefined,
    1.5,
  );
  for (const lx of [0.12, 0.26, 0.72, 0.86]) {
    const legX = bx + lx * bw - 2.2 * s;
    shape(ctx, () => ctx.rect(legX, by + bh - 4, 4.4 * s, feet - by - bh + 4), coat, undefined, 2);
    ctx.fillStyle = css(COLORS.encre);
    ctx.fillRect(legX, feet - 3 * s, 4.4 * s, 3 * s);
  }
  const grazing = Math.random() < 0.3;
  const hx = x + f * (bw / 2 + 4 * s);
  const head = beastHead(
    ctx,
    x + f * bw * 0.22,
    by + 1 * s,
    x + f * bw * 0.5,
    by + bh * 0.7,
    hx,
    grazing ? feet - 10 * s : by - 14 * s,
    f,
    s,
    grazing ? 1.2 : 0.7,
    8,
    4,
    coat,
  );
  shape(ctx, () => ctx.roundRect(bx, by, bw, bh, 8 * s), coat);
  // The mane runs from the poll down to the withers.
  ink(ctx, 3.5);
  ctx.beginPath();
  ctx.moveTo(head.px - f * 1 * s, head.py);
  ctx.lineTo(x + f * bw * 0.2, by + 1 * s);
  ctx.stroke();
}

type Beast = (ctx: Ctx, x: number, feet: number, f: number, s: number) => void;

/**
 * Paints `draw` on a scratch canvas, then lays it down at `alpha`: the whole group fades as one
 * flat sheet, so no line inside it shows through another.
 */
export function layer(ctx: Ctx, alpha: number, draw: (l: Ctx) => void): void {
  const canvas = document.createElement('canvas');
  canvas.width = ctx.canvas.width;
  canvas.height = ctx.canvas.height;
  const l = canvas.getContext('2d');
  if (!l) throw new Error('cannot create a 2d context');
  l.lineJoin = 'round';
  l.lineCap = 'round';
  draw(l);
  ctx.globalAlpha = alpha;
  ctx.drawImage(canvas, 0, 0);
  ctx.globalAlpha = 1;
}

// Periodic in FAR_W so the tile repeats without a seam.
const farCrest =
  (y0: number, amp: number, period: number) =>
  (x: number): number => {
    const k = (x / FAR_W) * Math.PI * 2;
    return y0 - amp * Math.sin(k * period) - amp * 0.4 * Math.sin(k * period * 3 + 1);
  };
/** Far-landscape crest of the valley's back hill (the rainbow stands on it too). */
const VALLEY_GROUND = farCrest(300, 40, 4);

/**
 * The far landscape: soft hills, a castle, farms, an inn, mills, trees and grazing beasts;
 * muted so the play stays readable. FAR_W is one repeat of the tile.
 */
function drawFar(ctx: Ctx): void {
  ctx.clearRect(0, 0, FAR_W, FAR_H);
  const hill = (l: Ctx, top: (x: number) => number, color: number, alpha: number): void => {
    l.globalAlpha = alpha;
    l.fillStyle = css(color);
    ink(l, 3);
    l.beginPath();
    l.moveTo(0, FAR_H);
    for (let x = 0; x <= FAR_W; x += 8) l.lineTo(x, top(x));
    l.lineTo(FAR_W, FAR_H);
    l.closePath();
    l.fill();
    // Ink only along the crest: the sides and the bottom would show as seams.
    l.beginPath();
    l.moveTo(0, top(0));
    for (let x = 8; x <= FAR_W; x += 8) l.lineTo(x, top(x));
    l.stroke();
    // Tufts of grass as little upturned arcs below the crest.
    l.globalAlpha = alpha * 0.5;
    ink(l, 1.5);
    l.beginPath();
    for (let x = 30; x < FAR_W - 30; x += rnd(40, 90)) {
      const y = top(x) + rnd(14, 60);
      for (const dx of [-5, 0, 5]) {
        l.moveTo(x + dx + 3, y);
        l.arc(x + dx, y, 3, 0, Math.PI, true);
      }
    }
    l.stroke();
    l.globalAlpha = 1;
  };
  /** the lowest crest over a span, so a building never floats */
  const ground = (top: (x: number) => number, x0: number, x1: number): number => {
    let y = 0;
    for (let x = x0; x <= x1; x += 6) y = Math.max(y, top(x));
    return y;
  };
  const back = VALLEY_GROUND;
  const front = farCrest(380, 26, 6);
  // The back hill and everything on it fade together.
  const backAlpha = 0.62;
  layer(ctx, backAlpha, (l) => {
    hill(l, back, COLORS.vertTendre, 0.45 / backAlpha);
    castle(l, 1050, ground(back, 892, 1208) + 8);
    farm(l, 330, ground(back, 290, 550) + 8);
    farm(l, 2240, ground(back, 2200, 2460) + 8);
    inn(l, 1480, ground(back, 1440, 1650) + 8);
    windmill(l, 1820, ground(back, 1800, 1840) + 8);
    windmill(l, 2900, ground(back, 2880, 2920) + 8);
    for (const [x, r] of [
      [120, 22],
      [200, 16],
      [640, 20],
      [770, 26],
      [1300, 18],
      [1400, 24],
      [1720, 18],
      [1990, 20],
      [2090, 16],
      [2600, 24],
      [2720, 16],
      [3080, 22],
    ] as const) {
      lollipop(l, x, back(x) + 30, r, pick([COLORS.vertDeGris, COLORS.vertTendre]), 0.8);
    }
  });
  const frontAlpha = 0.8;
  layer(ctx, frontAlpha, (l) => {
    hill(l, front, COLORS.ocre, 0.35 / frontAlpha);
    // Grazing beasts on the near fields.
    const herd: readonly (readonly [Beast, number, number])[] = [
      [sheep, 290, 1],
      [sheep, 324, -1],
      [sheep, 350, 1],
      [sheep, 378, 1],
      [cow, 860, -1],
      [horse, 1240, 1],
      [sheep, 1580, -1],
      [sheep, 1612, 1],
      [cow, 2040, 1],
      [cow, 2110, -1],
      [horse, 2480, -1],
      [sheep, 2810, 1],
      [sheep, 2842, 1],
      [sheep, 2868, -1],
    ];
    for (const [kind, x, f] of herd) kind(l, x, front(x) + 6, f, rnd(1.3, 1.45));
  });
}

/**
 * An illuminated cloud: a bank of scalloped lobes over a nebuly underside, inked, with an azure
 * rim around a lighter inner band, and the scallops echoed inside.
 */
function drawCloud(ctx: Ctx, w: number, h: number): void {
  ctx.clearRect(0, 0, w, h);
  ctx.lineJoin = 'round';
  const line = 2.5;
  const baseY = h * 0.74;
  const rMax = h * 0.36;
  const pad = rMax + line + 2;
  // Lobes overlap well, so the bank reads as one billow and never shows a flat shelf.
  const n = Math.max(3, Math.round((w - 2 * pad) / (rMax * 0.6)) + 1);
  const lobes: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const mid = 1 - Math.abs(t - 0.5) * 2;
    const r = rMax * (0.55 + 0.45 * mid) * rnd(0.8, 1);
    lobes.push({ x: pad + t * (w - 2 * pad), y: baseY - r * 0.95, r });
  }
  const x0 = lobes[0]?.x ?? pad;
  const x1 = lobes[n - 1]?.x ?? w - pad;
  const shelf = Math.max(...lobes.map((b) => b.y));
  const sr = h * 0.075;
  const steps = Math.max(1, Math.round((x1 - x0) / (sr * 1.7)));
  const trace = (g: number): void => {
    for (const b of lobes) {
      ctx.moveTo(b.x + b.r + g, b.y);
      ctx.arc(b.x, b.y, b.r + g, 0, Math.PI * 2);
    }
    // The nebuly underside: a row of small scallops, left to the rim.
    if (sr + g > 3) {
      for (let i = 0; i <= steps; i++) {
        const x = x0 + ((x1 - x0) * i) / steps;
        ctx.moveTo(x + sr + g, baseY);
        ctx.arc(x, baseY, sr + g, 0, Math.PI * 2);
      }
    }
    ctx.rect(x0, shelf, x1 - x0, baseY - shelf + Math.min(0, g));
  };
  // Ink outline around the whole bank, then cover the inner strokes, then the light band.
  ctx.fillStyle = css(COLORS.azur);
  ctx.beginPath();
  trace(0);
  ctx.fill();
  ink(ctx, line);
  ctx.stroke();
  ctx.beginPath();
  trace(-1.2);
  ctx.fill();
  ctx.fillStyle = css(COLORS.ceruse);
  ctx.beginPath();
  trace(-7);
  ctx.fill();
  // Inner scallops echoing each lobe, and a lower band edged with small billows.
  ctx.strokeStyle = css(COLORS.azur);
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const b of lobes) {
    const r = b.r - 13;
    if (r < 6) continue;
    ctx.moveTo(b.x + r * Math.cos(Math.PI * 1.2), b.y + 5 + r * Math.sin(Math.PI * 1.2));
    ctx.arc(b.x, b.y + 5, r, Math.PI * 1.2, Math.PI * 1.8);
  }
  const by = baseY - h * 0.1;
  const arcs = Math.max(2, Math.round((x1 - x0) / (h * 0.2)));
  const q = (x1 - x0) / (arcs * 2);
  ctx.moveTo(x0, by);
  for (let i = 0; i < arcs; i++) ctx.arc(x0 + q * (2 * i + 1), by, q, Math.PI, 0);
  ctx.stroke();
}

interface Prop {
  readonly image: Phaser.GameObjects.Image;
  readonly x: number;
  readonly y: number;
  readonly tree: boolean;
}

export class Scenery {
  /** every game object of the scenery, so a HUD camera can ignore them */
  readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly clouds: Phaser.GameObjects.Image[] = [];
  private props: Prop[] = [];
  private readonly width: number;
  private readonly sky: SkyLife;
  private storm = false;

  constructor(scene: Phaser.Scene, mask: MaskView, theme: MapTheme = 'valley') {
    this.width = mask.width;
    const tex = (key: string, w: number, h: number, draw: (ctx: Ctx) => void): string => {
      if (scene.textures.exists(key)) return key;
      const t = scene.textures.createCanvas(key, w, h);
      if (!t) throw new Error(`cannot create texture ${key}`);
      draw(t.getContext());
      t.refresh();
      return key;
    };
    const farX = -mask.width;
    const farY = mask.height * 0.32;
    const far = scene.add
      // Three map widths, starting one to the left, so the parallax never shows an edge.
      .tileSprite(
        farX,
        farY,
        mask.width * 3,
        FAR_H,
        tex(
          `far_${theme}`,
          FAR_W,
          FAR_H,
          theme === 'coast' ? drawFarCoast : theme === 'holyLand' ? drawFarHolyLand : drawFar,
        ),
      )
      .setOrigin(0, 0)
      .setScrollFactor(FAR_SCROLL, 0.8)
      .setDepth(1);
    const farCrestOf =
      theme === 'coast' ? COAST_GROUND : theme === 'holyLand' ? HOLY_LAND_GROUND : VALLEY_GROUND;
    this.objects.push(far);

    const cloudKeys: string[] = [];
    for (let i = 0; i < CLOUD_SHAPES; i++) {
      const w = Math.round(rnd(230, 400));
      cloudKeys.push(tex(`cloud${i}`, w, CLOUD_H, (ctx) => drawCloud(ctx, w, CLOUD_H)));
    }
    for (let i = 0; i < 7; i++) {
      const c = scene.add
        .image(
          Math.random() * mask.width,
          60 + Math.random() * mask.height * 0.25,
          cloudKeys[i % CLOUD_SHAPES] ?? 'cloud0',
        )
        .setScrollFactor(CLOUD_SCROLL, 0.7)
        .setScale(rnd(0.8, 1.3))
        .setFlipX(Math.random() < 0.5)
        .setAlpha(0.8)
        .setDepth(2);
      this.clouds.push(c);
      this.objects.push(c);
    }

    // Trees and flowers on the terrain surface (palms and shrubs, pines and dune grass).
    const themed: ThemeProps | null =
      theme === 'coast' ? coastProps() : theme === 'holyLand' ? holyLandProps() : null;
    const treeKey = themed
      ? tex(`tree_${theme}`, 110, 120, themed.tall)
      : tex('tree', 70, 110, (ctx) => lollipop(ctx, 35, 108, 22, COLORS.vertDeGris));
    const flowerKey = themed
      ? tex(`flowers_${theme}`, 40, 24, themed.small)
      : tex('flowers', 40, 24, (ctx) => {
          for (const [x, color] of [
            [8, COLORS.vermillon],
            [20, COLORS.lapis],
            [32, COLORS.or],
          ] as const) {
            ctx.strokeStyle = css(COLORS.vertDeGris);
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x, 24);
            ctx.lineTo(x, 10);
            ctx.stroke();
            ctx.fillStyle = css(color);
            ctx.beginPath();
            ctx.arc(x, 8, 5, 0, Math.PI * 2);
            ctx.fill();
          }
        });
    const solid = (x: number, y: number): boolean =>
      x >= 0 &&
      y >= 0 &&
      x < mask.width &&
      y < mask.height &&
      (mask.data[y * mask.width + x] ?? 0) !== 0;
    for (let x = 60; x < mask.width - 60; x += 70 + Math.floor(Math.random() * 160)) {
      let y = 0;
      while (y < mask.height && !solid(x, y)) y++;
      // Only on wide, fairly flat ground, not on thin platforms.
      if (y >= mask.height - 40 || !solid(x - 20, y + 4) || !solid(x + 20, y + 4)) continue;
      if (!solid(x, y + 30)) continue;
      const isTree = Math.random() < 0.35;
      const image = scene.add
        .image(x, y + 3, isTree ? treeKey : flowerKey)
        .setOrigin(0.5, 1)
        .setDepth(isTree ? 3 : 5);
      this.props.push({ image, x, y, tree: isTree });
      this.objects.push(image);
    }

    this.sky = new SkyLife(scene, mask.height * 0.4, () => this.props.filter((p) => p.tree), {
      scroll: [FAR_SCROLL, 0.8],
      // The tile repeats every FAR_W from its left edge.
      groundAt: (x) => farY + farCrestOf((((x - farX) % FAR_W) + FAR_W) % FAR_W),
    });
    this.objects.push(...this.sky.objects);
  }

  /** Rain clouds go grey while it rains (GDD §5 bis). */
  setStorm(on: boolean): void {
    if (on === this.storm) return;
    this.storm = on;
    for (const c of this.clouds) {
      if (on) c.setTint(STORM_TINT);
      else c.clearTint();
    }
  }

  /** Drifts the clouds and the sky life; drops props whose ground was blown away. */
  update(delta: number, wind: number, mask: MaskView): void {
    this.sky.update(delta, wind);
    for (const c of this.clouds) {
      // With the wind: its way, at its strength; still when it is calm.
      c.x += (wind * CLOUD_DRIFT * delta) / 1000;
      if (c.x > this.width + 200) c.x = -200;
      if (c.x < -200) c.x = this.width + 200;
    }
    this.props = this.props.filter((p) => {
      const under = p.y * mask.width + p.x;
      if ((mask.data[under] ?? 0) !== 0 || (mask.data[under + mask.width] ?? 0) !== 0) return true;
      p.image.destroy();
      return false;
    });
  }
}
