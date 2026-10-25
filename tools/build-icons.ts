// Draws the app's icons (favicon, home-screen and install icons) from the title page's
// illuminated initial: a gilt textura M on lapis, in an ink frame with gold and white fillets.
// Rendered by Chromium with the game's own typeface, into public/icons/. Run: pnpm run icons.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { COLORS, css } from '../src/ui/tokens.ts';

const out = new URL('../public/icons/', import.meta.url);
const font = readFileSync(
  new URL(
    '../node_modules/@fontsource/unifrakturmaguntia/files/unifrakturmaguntia-latin-400-normal.woff2',
    import.meta.url,
  ),
).toString('base64');

/** Each icon: its file, its size in px, and whether it is maskable (the M in the safe zone). */
const ICONS = [
  { file: 'favicon-32.png', size: 32, maskable: false },
  { file: 'favicon-48.png', size: 48, maskable: false },
  { file: 'apple-touch-icon.png', size: 180, maskable: true },
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
] as const;

/** The initial on a 512 × 512 page, in its frame; a maskable one sits on lapis (Android crops it). */
function page(maskable: boolean): string {
  // A maskable icon keeps what matters within the central 80 %: the frame goes inside it.
  const inset = maskable ? 60 : 0;
  const fillets = `inset 0 0 0 14px ${css(COLORS.or)}, inset 0 0 0 22px ${css(COLORS.lapis)},
    inset 0 0 0 28px ${css(COLORS.ceruse)}`;
  return `<!doctype html><html><head><style>
    @font-face { font-family: 'Textura'; src: url(data:font/woff2;base64,${font}) format('woff2'); }
    html, body { margin: 0; width: 512px; height: 512px; background: ${css(COLORS.lapis)}; }
    .frame { position: absolute; inset: ${inset}px; box-sizing: border-box;
      background: ${css(COLORS.lapis)}; border: ${maskable ? 12 : 18}px solid ${css(COLORS.encre)};
      box-shadow: ${fillets}; display: flex; align-items: center;
      justify-content: center; }
    .m { font-family: 'Textura'; color: ${css(COLORS.or)}; font-size: ${maskable ? 280 : 380}px;
      line-height: 1; padding-top: ${maskable ? 24 : 34}px;
      text-shadow: 0 0 2px ${css(COLORS.encre)}, 6px 8px 0 ${css(COLORS.encre)}; }
  </style></head><body><div class="frame"><span class="m">M</span></div></body></html>`;
}

mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
for (const icon of ICONS) {
  const ctx = await browser.newContext({
    viewport: { width: 512, height: 512 },
    deviceScaleFactor: icon.size / 512,
  });
  const p = await ctx.newPage();
  await p.setContent(page(icon.maskable));
  await p.evaluate(() => document.fonts.ready);
  writeFileSync(new URL(icon.file, out), await p.screenshot({ type: 'png' }));
  await ctx.close();
  console.log(`wrote public/icons/${icon.file}`);
}
await browser.close();
