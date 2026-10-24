// The far landscapes and terrain props of the map themes other than the valley (2026-10-25):
// the Normandy coast (the sea behind, cogs, an abbey on its rock, dunes, salt-meadow sheep) and
// the Holy Land (Jerusalem's walls and domes, a Saracen fortress, palms, tents, camels).
// Drawn once into canvas textures, in ink over flat colours; cosmetic randomness only.
import { COLORS, css } from '../ui/tokens.ts';
import {
  FAR_H,
  FAR_W,
  farm,
  ink,
  layer,
  lollipop,
  masonry,
  merlons,
  pennant,
  pick,
  rnd,
  scallops,
  shape,
  sheep,
  type Ctx,
} from './scenery.ts';

/**
 * The props a theme stands on its terrain: a tall one drawn into a 110 × 120 texture with its foot
 * at (55, 118), and a small one into 40 × 24, its foot along the bottom.
 */
export interface ThemeProps {
  readonly tall: (ctx: Ctx) => void;
  readonly small: (ctx: Ctx) => void;
}

/** A periodic crest (seamless over FAR_W): y of the top at x. */
const crest =
  (y0: number, amp: number, period: number, phase = 0) =>
  (x: number): number => {
    const k = (x / FAR_W) * Math.PI * 2;
    return y0 - amp * Math.sin(k * period + phase) - amp * 0.35 * Math.sin(k * period * 3 + 1);
  };

/** Far-landscape crest of the land the coast's hills stand on (the rainbow stands on it too). */
export const COAST_GROUND = crest(390, 22, 5, 0.7);
/** Far-landscape crest of the Holy Land's back hills (the rainbow stands on it too). */
export const HOLY_LAND_GROUND = crest(300, 36, 3);

/** A filled band under a crest, inked along the crest only (the sides would show as seams). */
function band(l: Ctx, top: (x: number) => number, color: number, alpha: number): void {
  l.globalAlpha = alpha;
  l.fillStyle = css(color);
  l.beginPath();
  l.moveTo(0, FAR_H);
  for (let x = 0; x <= FAR_W; x += 8) l.lineTo(x, top(x));
  l.lineTo(FAR_W, FAR_H);
  l.closePath();
  l.fill();
  ink(l, 3);
  l.beginPath();
  l.moveTo(0, top(0));
  for (let x = 8; x <= FAR_W; x += 8) l.lineTo(x, top(x));
  l.stroke();
  l.globalAlpha = 1;
}

/** The lowest point of a crest over a span, so a building never floats. */
const groundOf = (top: (x: number) => number, x0: number, x1: number): number => {
  let y = 0;
  for (let x = x0; x <= x1; x += 6) y = Math.max(y, top(x));
  return y;
};

// ---------------------------------------------------------------------------------------------
// The Normandy coast
// ---------------------------------------------------------------------------------------------

/** A cog: a round hull with castles fore and aft, one mast, a square sail with a cross. */
function cog(ctx: Ctx, x: number, y: number, s: number, f: number): void {
  const w = 70 * s;
  const sail = pick([COLORS.vermillon, COLORS.ceruse, COLORS.lapis]);
  ink(ctx, 2);
  ctx.beginPath();
  ctx.moveTo(x, y - 12 * s);
  ctx.lineTo(x, y - 78 * s);
  ctx.stroke();
  shape(
    ctx,
    () => {
      ctx.moveTo(x - 24 * s, y - 70 * s);
      ctx.quadraticCurveTo(x + f * 6 * s, y - 74 * s, x + 24 * s, y - 70 * s);
      ctx.quadraticCurveTo(x + 28 * s + f * 6 * s, y - 44 * s, x + 24 * s, y - 22 * s);
      ctx.lineTo(x - 24 * s, y - 22 * s);
      ctx.quadraticCurveTo(x - 20 * s + f * 6 * s, y - 44 * s, x - 24 * s, y - 70 * s);
      ctx.closePath();
    },
    sail,
    () => {
      ctx.fillStyle = css(sail === COLORS.ceruse ? COLORS.vermillon : COLORS.ceruse);
      ctx.fillRect(x - 3 * s, y - 66 * s, 6 * s, 40 * s);
      ctx.fillRect(x - 16 * s, y - 52 * s, 32 * s, 6 * s);
    },
    2,
  );
  shape(
    ctx,
    () => {
      ctx.moveTo(x - w / 2, y - 18 * s);
      ctx.lineTo(x + w / 2, y - 18 * s);
      ctx.quadraticCurveTo(x + w / 2 - 4 * s, y, x + w / 2 - 16 * s, y);
      ctx.lineTo(x - w / 2 + 16 * s, y);
      ctx.quadraticCurveTo(x - w / 2 + 4 * s, y, x - w / 2, y - 18 * s);
      ctx.closePath();
    },
    COLORS.terreOmbre,
    () => scallops(ctx, x - w / 2, y - 14 * s, x + w / 2, y, 4 * s, 6 * s, COLORS.ocre, 0.6),
    2.5,
  );
  for (const side of [-1, 1]) {
    const cx = x + side * (w / 2 - 10 * s);
    shape(ctx, () => ctx.rect(cx - 9 * s, y - 28 * s, 18 * s, 10 * s), COLORS.ocre, undefined, 2);
  }
  pennant(ctx, x, y - 78 * s, pick([COLORS.or, COLORS.vermillon]));
}

/** An abbey on its rock in the sea, as the Mont is drawn in the chronicles. */
function abbey(ctx: Ctx, cx: number, sea: number): void {
  shape(
    ctx,
    () => {
      ctx.moveTo(cx - 170, sea + 6);
      ctx.quadraticCurveTo(cx - 120, sea - 60, cx - 50, sea - 110);
      ctx.quadraticCurveTo(cx, sea - 150, cx + 50, sea - 110);
      ctx.quadraticCurveTo(cx + 120, sea - 60, cx + 170, sea + 6);
      ctx.closePath();
    },
    COLORS.roche,
    () => scallops(ctx, cx - 170, sea - 150, cx + 170, sea, 9, 12, COLORS.encre, 0.25),
  );
  // Ramparts at the foot, houses up the slope, the abbey church and its spire on top.
  shape(
    ctx,
    () => ctx.rect(cx - 140, sea - 34, 280, 34),
    COLORS.ceruse,
    () => masonry(ctx, cx - 140, sea - 34, 280, 34),
  );
  merlons(ctx, cx - 140, sea - 34, 280);
  for (const [dx, dy, w] of [
    [-90, -70, 34],
    [-50, -95, 30],
    [40, -92, 32],
    [80, -66, 30],
  ] as const) {
    shape(ctx, () => ctx.rect(cx + dx, sea + dy, w, 26), COLORS.ceruse, undefined, 2);
    shape(
      ctx,
      () => {
        ctx.moveTo(cx + dx - 3, sea + dy);
        ctx.lineTo(cx + dx + w / 2, sea + dy - 16);
        ctx.lineTo(cx + dx + w + 3, sea + dy);
        ctx.closePath();
      },
      COLORS.lapis,
      undefined,
      2,
    );
  }
  shape(
    ctx,
    () => ctx.rect(cx - 45, sea - 160, 90, 44),
    COLORS.ceruse,
    () => masonry(ctx, cx - 45, sea - 160, 90, 44),
  );
  shape(ctx, () => ctx.rect(cx - 12, sea - 205, 24, 46), COLORS.ceruse, undefined, 2.5);
  shape(
    ctx,
    () => {
      ctx.moveTo(cx - 16, sea - 204);
      ctx.lineTo(cx, sea - 262);
      ctx.lineTo(cx + 16, sea - 204);
      ctx.closePath();
    },
    COLORS.lapis,
    undefined,
    2.5,
  );
  shape(ctx, () => ctx.arc(cx, sea - 266, 4, 0, Math.PI * 2), COLORS.or, undefined, 1.5);
}

/** The sea behind the coast: ultramarine bands of curling waves up to the horizon. */
function sea(l: Ctx, horizon: number): void {
  l.fillStyle = css(COLORS.azur);
  l.globalAlpha = 0.75;
  l.fillRect(0, horizon, FAR_W, FAR_H - horizon);
  l.globalAlpha = 1;
  ink(l, 2.5);
  l.beginPath();
  l.moveTo(0, horizon);
  l.lineTo(FAR_W, horizon);
  l.stroke();
  // Rows of wave crests, smaller and closer towards the horizon.
  for (let row = 0, y = horizon + 14; y < FAR_H; row++, y += 16 + row * 5) {
    const r = 5 + row * 1.6;
    l.strokeStyle = css(row % 2 === 0 ? COLORS.lapis : COLORS.ceruse);
    l.lineWidth = 1.5 + row * 0.2;
    l.beginPath();
    for (let x = (row % 2) * r * 2; x < FAR_W; x += r * 4) {
      l.moveTo(x + r, y);
      l.arc(x, y, r, 0, Math.PI, true);
    }
    l.stroke();
  }
}

/** Dune grass: a fan of thin blades. */
function dunegrass(ctx: Ctx, x: number, base: number, s: number): void {
  ctx.strokeStyle = css(COLORS.vertDeGris);
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = -3; i <= 3; i++) {
    ctx.moveTo(x + i * 2 * s, base);
    ctx.quadraticCurveTo(
      x + i * 3 * s,
      base - 10 * s,
      x + i * 6 * s,
      base - (16 - Math.abs(i)) * s,
    );
  }
  ctx.stroke();
}

/** A boat drawn up on the sand, keel up. */
function beached(ctx: Ctx, x: number, base: number): void {
  shape(
    ctx,
    () => {
      ctx.moveTo(x - 34, base);
      ctx.quadraticCurveTo(x - 30, base - 18, x, base - 20);
      ctx.quadraticCurveTo(x + 30, base - 18, x + 34, base);
      ctx.closePath();
    },
    COLORS.terreOmbre,
    () => scallops(ctx, x - 34, base - 20, x + 34, base, 4, 6, COLORS.ocre, 0.6),
    2.5,
  );
}

export function drawFarCoast(ctx: Ctx): void {
  ctx.clearRect(0, 0, FAR_W, FAR_H);
  const horizon = 250;
  const front = COAST_GROUND;
  layer(ctx, 0.7, (l) => {
    sea(l, horizon);
    abbey(l, 1500, horizon + 70);
    for (const [x, dy, s, f] of [
      [420, 40, 0.8, 1],
      [930, 20, 0.6, -1],
      [2250, 30, 0.75, 1],
      [2800, 55, 0.9, -1],
    ] as const) {
      cog(l, x, horizon + dy, s, f);
    }
  });
  layer(ctx, 0.82, (l) => {
    // Opaque enough to hide the sea behind the dunes.
    band(l, front, COLORS.feuilleOr, 0.95);
    for (let x = 40; x < FAR_W - 40; x += rnd(50, 110)) dunegrass(l, x, front(x) + rnd(8, 30), 1.2);
    farm(l, 600, groundOf(front, 560, 820) + 8);
    farm(l, 2500, groundOf(front, 2460, 2720) + 8);
    beached(l, 1100, front(1100) + 10);
    beached(l, 1900, front(1900) + 10);
    for (const x of [300, 330, 362, 1700, 1735, 2980, 3012]) {
      sheep(l, x, front(x) + 6, pick([-1, 1]), rnd(1.25, 1.4));
    }
  });
}

/** Terrain props of the coast: dune grass, and now and then a wind-bent pine. */
export function coastProps(): ThemeProps {
  return {
    tall: (ctx) => lollipop(ctx, 55, 118, 18, COLORS.vertDeGris),
    small: (ctx) => {
      dunegrass(ctx, 12, 24, 1);
      dunegrass(ctx, 28, 24, 0.8);
    },
  };
}

// ---------------------------------------------------------------------------------------------
// The Holy Land
// ---------------------------------------------------------------------------------------------

/** A dome on a drum, with a crescent or a ball on its finial. */
function dome(ctx: Ctx, cx: number, base: number, r: number, color: number): void {
  shape(ctx, () => ctx.rect(cx - r, base - r * 0.5, 2 * r, r * 0.5), COLORS.ceruse, undefined, 2);
  shape(
    ctx,
    () => {
      ctx.moveTo(cx - r, base - r * 0.5);
      ctx.bezierCurveTo(cx - r, base - r * 1.9, cx + r, base - r * 1.9, cx + r, base - r * 0.5);
      ctx.closePath();
    },
    color,
    undefined,
    2.5,
  );
  ink(ctx, 2);
  ctx.beginPath();
  ctx.moveTo(cx, base - r * 1.55);
  ctx.lineTo(cx, base - r * 1.9);
  ctx.stroke();
  shape(ctx, () => ctx.arc(cx, base - r * 1.95, 3, 0, Math.PI * 2), COLORS.or, undefined, 1.5);
}

/** A square sandstone tower with merlons, as the Saracens and the Franks built them. */
function sandTower(ctx: Ctx, x: number, base: number, w: number, h: number): void {
  shape(
    ctx,
    () => ctx.rect(x, base - h, w, h),
    COLORS.ocre,
    () => masonry(ctx, x, base - h, w, h),
  );
  merlons(ctx, x - 2, base - h, w + 4, COLORS.ocre);
  ctx.fillStyle = css(COLORS.encre);
  ctx.fillRect(x + w / 2 - 2, base - h * 0.7, 4, 12);
}

/** Jerusalem: walls and towers, the golden dome, white domes and a minaret. */
function city(ctx: Ctx, cx: number, base: number): void {
  dome(ctx, cx - 10, base - 66, 46, COLORS.or);
  dome(ctx, cx + 110, base - 60, 22, COLORS.ceruse);
  dome(ctx, cx - 120, base - 60, 26, COLORS.ceruse);
  shape(ctx, () => ctx.rect(cx + 60, base - 170, 14, 110), COLORS.ceruse, undefined, 2);
  dome(ctx, cx + 67, base - 170, 9, COLORS.lapis);
  shape(
    ctx,
    () => ctx.rect(cx - 210, base - 64, 420, 64),
    COLORS.ocre,
    () => masonry(ctx, cx - 210, base - 64, 420, 64),
  );
  merlons(ctx, cx - 210, base - 64, 420, COLORS.ocre);
  for (const dx of [-236, -60, 120, 196]) sandTower(ctx, cx + dx, base + 4, 40, 96);
  shape(
    ctx,
    () => {
      ctx.moveTo(cx - 16, base);
      ctx.lineTo(cx - 16, base - 26);
      ctx.quadraticCurveTo(cx, base - 48, cx + 16, base - 26);
      ctx.lineTo(cx + 16, base);
      ctx.closePath();
    },
    COLORS.terreOmbre,
  );
}

/** A Saracen fortress on a spur: a keep, two towers and a curtain wall. */
function fortress(ctx: Ctx, cx: number, base: number): void {
  sandTower(ctx, cx - 30, base, 60, 130);
  shape(
    ctx,
    () => ctx.rect(cx - 120, base - 60, 240, 60),
    COLORS.ocre,
    () => masonry(ctx, cx - 120, base - 60, 240, 60),
  );
  merlons(ctx, cx - 120, base - 60, 240, COLORS.ocre);
  sandTower(ctx, cx - 150, base + 4, 44, 92);
  sandTower(ctx, cx + 106, base + 4, 44, 92);
  pennant(ctx, cx, base - 139, COLORS.vertDeGris);
}

/** A date palm: a ringed, leaning trunk and a crown of drooping fronds. */
export function palm(ctx: Ctx, x: number, base: number, h: number, lean: number): void {
  const tx = x + lean * h * 0.25;
  const ty = base - h;
  ctx.strokeStyle = css(COLORS.encre);
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(x, base);
  ctx.quadraticCurveTo(x + lean * h * 0.05, base - h * 0.5, tx, ty);
  ctx.stroke();
  ctx.strokeStyle = css(COLORS.terreOmbre);
  ctx.lineWidth = 5.5;
  ctx.stroke();
  ctx.strokeStyle = css(COLORS.ocre);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let k = 0.1; k < 0.95; k += 0.12) {
    const px = x + (tx - x) * k * k;
    const py = base - h * k;
    ctx.moveTo(px - 4, py);
    ctx.lineTo(px + 4, py - 2);
  }
  ctx.stroke();
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (1.05 + (i / 6) * 0.9);
    const len = h * rnd(0.32, 0.42);
    const ex = tx + Math.cos(a) * len;
    const ey = ty + Math.sin(a) * len * 0.5 + len * 0.35;
    shape(
      ctx,
      () => {
        ctx.moveTo(tx, ty);
        ctx.quadraticCurveTo((tx + ex) / 2, ty - len * 0.35, ex, ey);
        ctx.quadraticCurveTo((tx + ex) / 2, ty - len * 0.15, tx, ty + 3);
        ctx.closePath();
      },
      i % 2 === 0 ? COLORS.vertDeGris : COLORS.vertTendre,
      undefined,
      1.8,
    );
  }
  ctx.fillStyle = css(COLORS.ocre);
  for (const dx of [-4, 0, 4]) {
    ctx.beginPath();
    ctx.arc(tx + dx, ty + 6, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A dromedary: one hump, a long neck, knobbly legs. */
function camel(ctx: Ctx, x: number, feet: number, f: number, s: number): void {
  const body = COLORS.ocre;
  ink(ctx, 2);
  ctx.fillStyle = css(body);
  for (const lx of [-14, -8, 9, 15]) {
    ctx.fillRect(x + lx * s - 1.5 * s, feet - 26 * s, 3 * s, 26 * s);
    ctx.strokeRect(x + lx * s - 1.5 * s, feet - 26 * s, 3 * s, 26 * s);
  }
  shape(
    ctx,
    () => {
      ctx.moveTo(x - 20 * s * f, feet - 26 * s);
      ctx.quadraticCurveTo(x - 22 * s * f, feet - 40 * s, x - 6 * s * f, feet - 44 * s);
      ctx.quadraticCurveTo(x + 2 * s * f, feet - 58 * s, x + 10 * s * f, feet - 42 * s);
      ctx.quadraticCurveTo(x + 20 * s * f, feet - 40 * s, x + 20 * s * f, feet - 30 * s);
      ctx.lineTo(x + 30 * s * f, feet - 52 * s);
      ctx.lineTo(x + 38 * s * f, feet - 52 * s);
      ctx.lineTo(x + 38 * s * f, feet - 46 * s);
      ctx.lineTo(x + 30 * s * f, feet - 44 * s);
      ctx.quadraticCurveTo(x + 22 * s * f, feet - 22 * s, x + 14 * s * f, feet - 24 * s);
      ctx.closePath();
    },
    body,
    undefined,
    2,
  );
  // A saddle cloth in a bright stripe.
  shape(
    ctx,
    () => ctx.rect(x - 8 * s, feet - 46 * s, 14 * s, 6 * s),
    COLORS.vermillon,
    undefined,
    1.5,
  );
}

/** A tent of striped cloth. */
function tent(ctx: Ctx, x: number, base: number, w: number, color: number): void {
  const h = w * 0.6;
  shape(
    ctx,
    () => {
      ctx.moveTo(x - w / 2, base);
      ctx.quadraticCurveTo(x - w / 4, base - h * 0.6, x, base - h);
      ctx.quadraticCurveTo(x + w / 4, base - h * 0.6, x + w / 2, base);
      ctx.closePath();
    },
    COLORS.ceruse,
    () => {
      ctx.strokeStyle = css(color);
      ctx.lineWidth = 6;
      ctx.beginPath();
      for (let dx = -w / 2; dx < w / 2; dx += 14) {
        ctx.moveTo(x + dx, base);
        ctx.lineTo(x, base - h);
      }
      ctx.stroke();
    },
  );
  ctx.fillStyle = css(COLORS.encre);
  ctx.beginPath();
  ctx.moveTo(x - 6, base);
  ctx.lineTo(x, base - 18);
  ctx.lineTo(x + 6, base);
  ctx.fill();
}

export function drawFarHolyLand(ctx: Ctx): void {
  ctx.clearRect(0, 0, FAR_W, FAR_H);
  const back = HOLY_LAND_GROUND;
  const front = crest(385, 30, 7, 1.3);
  layer(ctx, 0.62, (l) => {
    band(l, back, COLORS.or, 0.5 / 0.62);
    city(l, 1150, groundOf(back, 900, 1400) + 8);
    fortress(l, 2550, groundOf(back, 2380, 2720) + 8);
    for (const [x, h] of [
      [300, 70],
      [340, 56],
      [1700, 64],
      [1745, 78],
      [3000, 60],
    ] as const) {
      palm(l, x, back(x) + 14, h, pick([-1, 1]));
    }
  });
  layer(ctx, 0.8, (l) => {
    band(l, front, COLORS.ocre, 0.32 / 0.8);
    tent(l, 600, front(600) + 8, 70, COLORS.vermillon);
    tent(l, 680, front(680) + 8, 54, COLORS.lapis);
    tent(l, 2200, front(2200) + 8, 64, COLORS.vertDeGris);
    for (const [x, f] of [
      [900, 1],
      [960, 1],
      [1020, 1],
      [2650, -1],
      [2900, -1],
    ] as const) {
      camel(l, x, front(x) + 6, f, rnd(1.1, 1.25));
    }
    for (const x of [450, 1400, 1460, 2420, 3100])
      palm(l, x, front(x) + 12, rnd(70, 95), pick([-1, 1]));
  });
}

/** Terrain props of the Holy Land: date palms, and dry shrubs. */
export function holyLandProps(): ThemeProps {
  return {
    tall: (ctx) => palm(ctx, 55, 118, 92, pick([-1, 1])),
    small: (ctx) => {
      ctx.strokeStyle = css(COLORS.terreOmbre);
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = -3; i <= 3; i++) {
        ctx.moveTo(20, 24);
        ctx.lineTo(20 + i * 5, 24 - 14 + Math.abs(i) * 2);
      }
      ctx.stroke();
      ctx.fillStyle = css(COLORS.vertDeGris);
      for (const dx of [-12, -4, 6, 13]) {
        ctx.beginPath();
        ctx.arc(20 + dx, 12 + Math.abs(dx) * 0.4, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  };
}
