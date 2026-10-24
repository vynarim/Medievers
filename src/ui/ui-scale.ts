// Sizing of the DOM overlay: the stylesheet is written for the 1920×1080 reference screen and
// shrinks on smaller windows, so the HUD leaves room for the battlefield.

/** Smallest scale: below it the caps text stops being legible. */
export const UI_SCALE_MIN = 0.6;
/** Window size (CSS px) under which the overlay starts shrinking. */
const REF_W = 1600;
const REF_H = 1000;
/** Lengths up to this many px (borders, fillets) keep their size so the ink lines stay crisp. */
const HAIRLINE_PX = 3;

/** Overlay scale for a window of w × h CSS pixels, in [UI_SCALE_MIN, 1]. */
export function uiScale(w: number, h: number): number {
  const s = Math.min(w / REF_W, h / REF_H, 1);
  return Math.round(Math.max(UI_SCALE_MIN, s) * 100) / 100;
}

/** Rewrites every px length of a stylesheet, hairlines excepted, as a multiple of var(--u). */
export function scalableCss(css: string): string {
  return css.replace(/(\d+(?:\.\d+)?)px\b/g, (m, n: string) =>
    Number(n) <= HAIRLINE_PX ? m : `calc(${n} * var(--u))`,
  );
}
