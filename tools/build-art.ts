// Rasterises the rigs' drawn pieces (ASSETS §3.5, §9): assets/units/<rig>/<rig>.svg holds the
// whole figure at rest in the rig's frame, one group `piece-<id>` per piece of rig.json. Each
// piece is framed on its rectangle at rest and rendered by Chromium at ×2, transparent, into
// public/assets/units/<rig>/<key>.png; src/content/art.json lists every key a file now serves
// (the scene loads them, and a key left out keeps its placeholder).
// Sprites (the dragon, the unicorn, the beasts, the scenery): assets/sprites/<name>.svg, one group
// `sprite-<key>` per texture, framed by its `data-box="x y w h"` and rendered at its size (×1,
// `data-scale` to change it), so that it stands in for the texture the code would paint under
// that key. A `{v}` in a key is filled by each of the root's `data-variants` (JSON: id and CSS
// variables), for the colourings of one drawing. Run: pnpm run art.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { parseRig } from '../src/render/rig/format.ts';
import { restCorners } from '../src/render/rig/rest.ts';

/** Texture px per world px (ASSETS §2: produced at ×2). */
const SCALE = 2;

const root = new URL('../', import.meta.url);
const rigsDir = new URL('src/content/rigs/', root);
const manifest: Record<string, string> = {};

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: SCALE });
for (const id of readdirSync(rigsDir)) {
  const src = new URL(`assets/units/${id}/${id}.svg`, root);
  if (!existsSync(src)) continue;
  const rigPath = new URL(`${id}/rig.json`, rigsDir);
  const rig = parseRig(JSON.parse(readFileSync(rigPath, 'utf8')) as unknown, rigPath.pathname);
  const corners = restCorners(rig);
  const outDir = new URL(`public/assets/units/${id}/`, root);
  mkdirSync(outDir, { recursive: true });
  const svg = readFileSync(src, 'utf8').replace(/<\?xml[^>]*>/, '');
  await page.setContent(`<!doctype html><html><body style="margin:0">${svg}</body></html>`);
  for (const pc of rig.pieces) {
    const at = corners.get(pc.id);
    if (!at) continue;
    const found = await page.evaluate(
      ({ piece, x, y, w, h, scale }) => {
        const el = document.querySelector('svg');
        if (!el || !document.getElementById(`piece-${piece}`)) return false;
        // This piece alone, on its rectangle.
        for (const g of el.querySelectorAll<SVGGElement>('g[id^="piece-"]')) {
          g.style.display = g.id === `piece-${piece}` ? '' : 'none';
        }
        el.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
        el.setAttribute('width', String(w));
        el.setAttribute('height', String(h));
        el.style.display = 'block';
        return scale > 0;
      },
      { piece: pc.id, x: at.x, y: at.y, w: pc.size[0], h: pc.size[1], scale: SCALE },
    );
    if (!found) {
      console.log(`--   ${id}/${pc.id}: not drawn here (another rig may draw ${pc.key})`);
      continue;
    }
    const file = `${pc.key}.png`;
    const png = await page.locator('svg').first().screenshot({ omitBackground: true });
    writeFileSync(new URL(file, outDir), png);
    manifest[pc.key] = `assets/units/${id}/${file}`;
    console.log(`OK   ${id}/${pc.id} -> ${file}`);
  }
}

// The sprites.
const spritesDir = new URL('assets/sprites/', root);
const spriteOut = new URL('public/assets/sprites/', root);
mkdirSync(spriteOut, { recursive: true });
interface Variant {
  readonly id: string;
  readonly vars: Readonly<Record<string, string>>;
}
for (const file of existsSync(spritesDir) ? readdirSync(spritesDir) : []) {
  if (!file.endsWith('.svg')) continue;
  const svg = readFileSync(new URL(file, spritesDir), 'utf8').replace(/<\?xml[^>]*>/, '');
  await page.setContent(`<!doctype html><html><body style="margin:0">${svg}</body></html>`);
  const info = await page.evaluate(() => {
    const el = document.querySelector('svg');
    const groups = [...(el?.querySelectorAll<SVGGElement>('g[id^="sprite-"]') ?? [])];
    return {
      variants: el?.getAttribute('data-variants') ?? null,
      sprites: groups.map((g) => ({
        id: g.id.slice('sprite-'.length),
        box: g.getAttribute('data-box') ?? '',
        scale: Number(g.getAttribute('data-scale') ?? '1'),
      })),
    };
  });
  const variants: readonly Variant[] = info.variants
    ? (JSON.parse(info.variants) as Variant[])
    : [{ id: '', vars: {} }];
  for (const v of variants) {
    for (const sp of info.sprites) {
      if (!sp.id.includes('{v}') && v !== variants[0]) continue;
      const [x = 0, y = 0, w = 0, h = 0] = sp.box.split(/\s+/).map(Number);
      if (w <= 0 || h <= 0) throw new Error(`${file}: sprite ${sp.id} has no data-box`);
      const key = sp.id.replace('{v}', v.id);
      await page.evaluate(
        ({ id, x, y, w, h, scale, vars }) => {
          const el = document.querySelector('svg');
          if (!el) return;
          for (const g of el.querySelectorAll<SVGGElement>('g[id^="sprite-"]')) {
            g.style.display = g.id === `sprite-${id}` ? '' : 'none';
          }
          for (const [k, val] of Object.entries(vars)) el.style.setProperty(k, val);
          el.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
          el.setAttribute('width', String(w * scale));
          el.setAttribute('height', String(h * scale));
          el.style.display = 'block';
        },
        { id: sp.id, x, y, w, h, scale: sp.scale / SCALE, vars: v.vars },
      );
      const png = await page.locator('svg').first().screenshot({ omitBackground: true });
      writeFileSync(new URL(`${key}.png`, spriteOut), png);
      manifest[key] = `assets/sprites/${key}.png`;
      console.log(`OK   ${file} -> ${key}.png`);
    }
  }
}
await browser.close();
const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(new URL('src/content/art.json', root), `${JSON.stringify(sorted, null, 2)}\n`);
console.log(`${Object.keys(sorted).length} pieces -> src/content/art.json`);
