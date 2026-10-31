// The far landscape and terrain props of the snowy pass (2026-10-25): crags capped with snow in
// the manner of the manuscript's stepped rocks, the hospice of the pass with its bell, firs,
// wayside crosses, a file of pilgrims, mules with their packs and ibex. Drawn once into canvas
// textures, in ink over flat colours; cosmetic randomness only.
import { COLORS, css } from '../ui/tokens.ts';
import {
  FAR_H,
  FAR_W,
  goat,
  ink,
  layer,
  masonry,
  pick,
  rnd,
  scallops,
  shape,
  type Ctx,
  type FarBeast,
  type FarHerd,
} from './scenery.ts';
import { band, crest, groundOf, type ThemeProps } from './scenery-themes.ts';

/** Far-landscape crest of the snowfields in front of the crags (the rainbow stands on it too). */
export const PASS_GROUND = crest(420, 20, 4, 0.4);
/** Crest of the high pastures further back, at the foot of the crags. */
const PASS_PASTURE = crest(330, 26, 3, 1.1);

/** px: the highest a summit may reach in the far texture, its snow and ink included */
const CRAG_TOP = 24;

/** A mule under its pack: long ears, a striped load roped on its back. */
function mule(ctx: Ctx, x: number, feet: number, f: number, s: number): void {
  const coat = COLORS.terreOmbre;
  ink(ctx, 2);
  ctx.fillStyle = css(coat);
  for (const lx of [-12, -7, 8, 13]) {
    ctx.fillRect(x + lx * s * f - 1.5 * s, feet - 18 * s, 3 * s, 18 * s);
    ctx.strokeRect(x + lx * s * f - 1.5 * s, feet - 18 * s, 3 * s, 18 * s);
  }
  shape(
    ctx,
    () => ctx.ellipse(x, feet - 24 * s, 17 * s, 8 * s, 0, 0, Math.PI * 2),
    coat,
    undefined,
    2,
  );
  // Neck and head, low as a mule carries it, and its two long ears.
  shape(
    ctx,
    () => {
      ctx.moveTo(x + 12 * s * f, feet - 28 * s);
      ctx.lineTo(x + 22 * s * f, feet - 36 * s);
      ctx.lineTo(x + 30 * s * f, feet - 30 * s);
      ctx.lineTo(x + 26 * s * f, feet - 25 * s);
      ctx.lineTo(x + 15 * s * f, feet - 22 * s);
      ctx.closePath();
    },
    coat,
    undefined,
    2,
  );
  for (const e of [0, 4]) {
    shape(
      ctx,
      () => {
        ctx.moveTo(x + (20 + e) * s * f, feet - 36 * s);
        ctx.lineTo(x + (17 + e) * s * f, feet - 46 * s);
        ctx.lineTo(x + (23 + e) * s * f, feet - 37 * s);
        ctx.closePath();
      },
      coat,
      undefined,
      1.5,
    );
  }
  // The pack: two bales, one red, one blue, and the rope over them.
  shape(
    ctx,
    () => ctx.rect(x - 11 * s, feet - 40 * s, 10 * s, 10 * s),
    COLORS.vermillon,
    undefined,
    1.5,
  );
  shape(ctx, () => ctx.rect(x - 1 * s, feet - 39 * s, 10 * s, 9 * s), COLORS.lapis, undefined, 1.5);
}

/** The mules of the pass on their pasture, and ibex higher up. */
export function passHerd(): FarHerd {
  return {
    ground: PASS_GROUND,
    alpha: 0.82,
    beasts: (
      [
        [700, 1],
        [742, 1],
        [784, 1],
        [2400, -1],
        [2442, -1],
      ] as const
    )
      .map(([x, f]): FarBeast => ({ draw: mule, x, f, s: rnd(1.15, 1.3), kind: 'mule' }))
      .concat(
        (
          [
            [1300, 1],
            [1330, -1],
            [2900, 1],
          ] as const
        ).map(([x, f]): FarBeast => ({ draw: goat, x, f, s: rnd(1.15, 1.3), kind: 'goat' })),
      ),
  };
}

/**
 * A crag in the manner of the manuscript: a lumpy cone of stepped rock, slate below, its upper
 * part under snow with a ragged edge.
 */
function crag(ctx: Ctx, cx: number, base: number, w: number, h: number, rock: number): void {
  const steps = 4;
  const trace = (): void => {
    ctx.moveTo(cx - w / 2, base);
    // Up the left side in bulging steps, to a rounded summit, down the right side likewise.
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const px = cx - (w / 2) * (1 - t) - w * 0.04;
      const py = base - h * t;
      ctx.quadraticCurveTo(px - w * 0.09, py + h / steps / 2, px, py);
    }
    ctx.quadraticCurveTo(cx, base - h - h * 0.08, cx + w * 0.04, base - h);
    for (let i = steps - 1; i >= 0; i--) {
      const t = i / steps;
      const px = cx + (w / 2) * (1 - t);
      const py = base - h * t;
      ctx.quadraticCurveTo(px + w * 0.09, py - h / steps / 2, px, py);
    }
    ctx.closePath();
  };
  shape(ctx, trace, rock, () => {
    // The snow: everything above a ragged line two fifths of the way down.
    const line = base - h * 0.6;
    ctx.fillStyle = css(COLORS.ceruse);
    ctx.beginPath();
    ctx.moveTo(cx - w, base - h * 1.2);
    ctx.lineTo(cx + w, base - h * 1.2);
    ctx.lineTo(cx + w, line);
    for (let x = cx + w; x > cx - w; x -= 14) {
      ctx.lineTo(x - 7, line + (Math.floor(x / 14) % 2 === 0 ? 16 : 2) + rnd(-3, 3));
    }
    ctx.closePath();
    ctx.fill();
    ink(ctx, 1.5);
    ctx.stroke();
    // Faint strokes down the rock, as the illuminators shaded their hills.
    scallops(ctx, cx - w / 2, line + 24, cx + w / 2, base, 10, 22, COLORS.encre, 0.18);
  });
}

/** A crag drawn twice when it straddles an edge of the tile, so the repeat has no seam. */
function cragWrapped(ctx: Ctx, cx: number, base: number, w: number, h: number, rock: number): void {
  for (const dx of [0, -FAR_W, FAR_W]) {
    if (cx + dx + w / 2 > 0 && cx + dx - w / 2 < FAR_W) crag(ctx, cx + dx, base, w, h, rock);
  }
}

/** A fir laden with snow: stacked green tiers, each with a white rim. */
function fir(ctx: Ctx, x: number, base: number, h: number): void {
  ctx.fillStyle = css(COLORS.terreOmbre);
  ctx.fillRect(x - 3, base - h * 0.18, 6, h * 0.18);
  const tiers = 4;
  for (let i = 0; i < tiers; i++) {
    const y = base - h * 0.15 - (i * h * 0.8) / tiers;
    const hw = (h * 0.34 * (tiers - i)) / tiers;
    shape(
      ctx,
      () => {
        ctx.moveTo(x - hw, y);
        ctx.lineTo(x, y - h * 0.32);
        ctx.lineTo(x + hw, y);
        ctx.closePath();
      },
      COLORS.vertDeGris,
      () => {
        ctx.fillStyle = css(COLORS.ceruse);
        ctx.fillRect(x - hw, y - 5, 2 * hw, 5);
      },
      2,
    );
  }
}

/** A wooden wayside cross, a cap of snow on its arms. */
function wayCross(ctx: Ctx, x: number, base: number, h: number): void {
  shape(ctx, () => ctx.rect(x - 3, base - h, 6, h), COLORS.terreOmbre, undefined, 2);
  shape(
    ctx,
    () => ctx.rect(x - h * 0.3, base - h * 0.78, h * 0.6, 6),
    COLORS.terreOmbre,
    undefined,
    2,
  );
  ctx.fillStyle = css(COLORS.ceruse);
  ctx.fillRect(x - h * 0.3, base - h * 0.78 - 3, h * 0.6, 3);
  ctx.fillRect(x - 3, base - h - 3, 6, 3);
}

/**
 * The hospice of the pass: a long stone house under a red roof, a bell gable with its bell, a
 * porch where the canons take in the travellers.
 */
function hospice(ctx: Ctx, cx: number, base: number): void {
  const w = 180;
  const h = 56;
  shape(
    ctx,
    () => ctx.rect(cx - w / 2, base - h, w, h),
    COLORS.ceruse,
    () => masonry(ctx, cx - w / 2, base - h, w, h),
  );
  shape(
    ctx,
    () => {
      ctx.moveTo(cx - w / 2 - 10, base - h);
      ctx.lineTo(cx - w / 2 + 26, base - h - 34);
      ctx.lineTo(cx + w / 2 - 26, base - h - 34);
      ctx.lineTo(cx + w / 2 + 10, base - h);
      ctx.closePath();
    },
    COLORS.vermillon,
    () => scallops(ctx, cx - w / 2, base - h - 34, cx + w / 2, base - h, 7, 8, COLORS.encre, 0.3),
  );
  // Snow along the ridge.
  ctx.fillStyle = css(COLORS.ceruse);
  ctx.fillRect(cx - w / 2 + 26, base - h - 38, w - 52, 5);
  // The bell gable, pierced, its bell hanging in the opening.
  const gx = cx + w / 2 - 40;
  shape(
    ctx,
    () => {
      ctx.moveTo(gx - 16, base - h - 30);
      ctx.lineTo(gx - 16, base - h - 70);
      ctx.lineTo(gx, base - h - 84);
      ctx.lineTo(gx + 16, base - h - 70);
      ctx.lineTo(gx + 16, base - h - 30);
      ctx.closePath();
    },
    COLORS.ceruse,
  );
  ctx.fillStyle = css(COLORS.encre);
  ctx.fillRect(gx - 8, base - h - 68, 16, 22);
  shape(
    ctx,
    () => {
      ctx.moveTo(gx - 6, base - h - 50);
      ctx.quadraticCurveTo(gx - 6, base - h - 64, gx, base - h - 64);
      ctx.quadraticCurveTo(gx + 6, base - h - 64, gx + 6, base - h - 50);
      ctx.closePath();
    },
    COLORS.or,
    undefined,
    1.5,
  );
  // Windows and the porch.
  ctx.fillStyle = css(COLORS.encre);
  for (const dx of [-60, -30, 30]) ctx.fillRect(cx + dx - 4, base - h + 14, 8, 14);
  shape(
    ctx,
    () => {
      ctx.moveTo(cx - 14, base);
      ctx.lineTo(cx - 14, base - 26);
      ctx.quadraticCurveTo(cx, base - 40, cx + 14, base - 26);
      ctx.lineTo(cx + 14, base);
      ctx.closePath();
    },
    COLORS.terreOmbre,
  );
}

/** A pilgrim on the road: hooded, a staff, a scallop shell on the hat. */
function pilgrim(ctx: Ctx, x: number, feet: number, cloak: number): void {
  shape(
    ctx,
    () => {
      ctx.moveTo(x - 6, feet);
      ctx.lineTo(x - 4, feet - 18);
      ctx.quadraticCurveTo(x, feet - 24, x + 4, feet - 18);
      ctx.lineTo(x + 6, feet);
      ctx.closePath();
    },
    cloak,
    undefined,
    1.5,
  );
  shape(ctx, () => ctx.arc(x, feet - 24, 4, 0, Math.PI * 2), COLORS.carnation, undefined, 1.5);
  shape(
    ctx,
    () => ctx.ellipse(x, feet - 27, 7, 2.5, 0, 0, Math.PI * 2),
    COLORS.terreOmbre,
    undefined,
    1.2,
  );
  ink(ctx, 1.5);
  ctx.beginPath();
  ctx.moveTo(x + 8, feet);
  ctx.lineTo(x + 8, feet - 30);
  ctx.stroke();
}

export function drawFarPass(ctx: Ctx): void {
  ctx.clearRect(0, 0, FAR_W, FAR_H);
  // The high range, pale with distance: no summit above CRAG_TOP, or the texture would cut it.
  layer(ctx, 0.5, (l) => {
    for (const [x, w, h] of [
      [150, 420, 300],
      [520, 360, 250],
      [900, 480, 340],
      [1350, 380, 270],
      [1780, 520, 350],
      [2250, 400, 285],
      [2650, 460, 320],
      [3050, 380, 260],
    ] as const) {
      cragWrapped(l, x, 380, w, Math.min(h, Math.floor((380 - CRAG_TOP) / 1.08)), COLORS.azur);
    }
  });
  // The nearer crags and the high pastures at their feet.
  layer(ctx, 0.66, (l) => {
    for (const [x, w, h] of [
      [350, 300, 230],
      [1100, 340, 260],
      [2000, 300, 220],
      [2850, 320, 250],
    ] as const) {
      cragWrapped(l, x, 400, w, h, COLORS.roche);
    }
    band(l, PASS_PASTURE, COLORS.ceruse, 0.9 / 0.66);
    for (const x of [500, 560, 1500, 1560, 1610, 2500, 3150])
      fir(l, x, PASS_PASTURE(x) + 10, rnd(46, 66));
  });
  // The snowfields of the pass: the hospice, crosses along the road, a file of pilgrims.
  layer(ctx, 0.82, (l) => {
    band(l, PASS_GROUND, COLORS.ceruse, 1 / 0.82);
    hospice(l, 1700, groundOf(PASS_GROUND, 1600, 1800) + 6);
    for (const x of [1180, 2080, 2700]) wayCross(l, x, PASS_GROUND(x) + 6, rnd(34, 44));
    for (const [x, cloak] of [
      [1880, COLORS.terreOmbre],
      [1906, COLORS.lapis],
      [1930, COLORS.vertDeGris],
    ] as const) {
      pilgrim(l, x, PASS_GROUND(x) + 4, cloak);
    }
    // Its mules and ibex are sprites of their own (passHerd).
    for (const x of [300, 380, 1000, 2300, 3000, 3070]) fir(l, x, PASS_GROUND(x) + 10, rnd(60, 86));
  });
}

/** Terrain props of the pass: firs under snow, and rocks poking out of a drift. */
export function passProps(): ThemeProps {
  return {
    tall: (ctx) => fir(ctx, 55, 118, rnd(90, 112)),
    small: (ctx) => {
      shape(
        ctx,
        () => {
          ctx.moveTo(6, 24);
          ctx.quadraticCurveTo(12, 8, 22, 10);
          ctx.quadraticCurveTo(30, 6, 34, 24);
          ctx.closePath();
        },
        COLORS.roche,
        undefined,
        2,
      );
      ctx.fillStyle = css(COLORS.ceruse);
      ctx.beginPath();
      ctx.ellipse(20, 12, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      if (pick([true, false])) wayCross(ctx, 36, 24, 20);
    },
  };
}
