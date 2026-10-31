// Sizing of the DOM overlay: the stylesheet is written for the 1920×1080 reference screen and
// shrinks on smaller windows, so the HUD leaves room for the battlefield.

/** Smallest scale: below it the caps text stops being legible. */
export const UI_SCALE_MIN = 0.6;
/** Window size (CSS px) under which the overlay starts shrinking. */
const REF_W = 1600;
const REF_H = 1000;
/** Same, on a touch screen held sideways: a 1280×800 tablet keeps the full size. */
const TOUCH_REF_W = 1280;
const TOUCH_REF_H = 780;
/** Widest window (CSS px) still taken for a phone when held upright. */
const PHONE_MAX_W = 760;
/** Width (CSS px) under which the overlay of a phone held upright starts shrinking. */
const PHONE_REF_W = 520;
/** Lengths up to this many px (borders, fillets) keep their size so the ink lines stay crisp. */
const HAIRLINE_PX = 3;

/** A phone held upright: the overlay is laid out in one column (class `phone` on #ui). */
export function isPhonePortrait(w: number, h: number): boolean {
  return w <= PHONE_MAX_W && h > w;
}

/** Tallest window (CSS px) still taken for a short landscape screen: a tablet, a small laptop. */
const SHORT_MAX_H = 820;

/**
 * A screen held sideways but short (a tablet in landscape): the flavour text folds behind a « ? »
 * as on a phone, so that the menus fit without scrolling (class `short` on #ui).
 */
export function isShortLandscape(w: number, h: number): boolean {
  return !isPhonePortrait(w, h) && h < SHORT_MAX_H;
}

/**
 * Overlay scale for a window of w × h CSS pixels, in [UI_SCALE_MIN, 1]. A touch screen (a tablet)
 * is read from further away than a monitor of the same size: it shrinks only below a smaller one.
 */
export function uiScale(w: number, h: number, touch = false): number {
  const refW = touch ? TOUCH_REF_W : REF_W;
  const refH = touch ? TOUCH_REF_H : REF_H;
  const s = isPhonePortrait(w, h)
    ? Math.min(w / PHONE_REF_W, 1)
    : Math.min(w / refW, h / refH, 1);
  return Math.round(Math.max(UI_SCALE_MIN, s) * 100) / 100;
}

/** Rewrites every px length of a stylesheet, hairlines excepted, as a multiple of var(--u). */
export function scalableCss(css: string): string {
  return css.replace(/(\d+(?:\.\d+)?)px\b/g, (m, n: string) =>
    Number(n) <= HAIRLINE_PX ? m : `calc(${n} * var(--u))`,
  );
}
