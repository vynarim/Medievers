// Builds the player's manual: docs/manual/manuel.md -> HTML -> PDF (Chromium via Playwright).
// Numbers that exist in src/content are injected here so the manual cannot drift from the game.
// Usage: pnpm run manual
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { marked } from 'marked';
import { chromium } from 'playwright';
import { MASK_PALETTE, MATERIALS } from '../src/content/materials.ts';
import { CLASSIC_RULES } from '../src/content/rules.ts';
import { UNIT_RULES } from '../src/content/units.ts';
import { Material, type MaterialId } from '../src/sim/terrain/material.ts';
import { fallDamage } from '../src/sim/units/unit.ts';

const dir = new URL('../docs/manual/', import.meta.url);
const OUTPUT = 'Medieverse-Manuel-du-joueur.pdf';

const STATUS: Record<string, string> = {
  jeu: '<span class="st st-jeu">En jeu</span>',
  moteur: '<span class="st st-moteur">Moteur prêt</span>',
  prevu: '<span class="st st-prevu">Prévu</span>',
};

const MATERIAL_NAMES: Record<MaterialId, [string, string]> = {
  [Material.Air]: ['Air', 'Le vide : on y tombe.'],
  [Material.Earth]: ['Terre', 'Le sol ordinaire.'],
  [Material.Rock]: ['Roche', 'La roche peinte et les piliers du cadre.'],
  [Material.BuiltStone]: ['Pierre bâtie', 'Les murs posés et les remparts.'],
  [Material.Wood]: ['Bois', 'Planches, coques et échafaudages.'],
  [Material.Ladder]: ['Échelle', 'On y grimpe ; les projectiles la traversent.'],
  [Material.Backdrop]: [
    'Maçonnerie de fond',
    'Le corps des tours : on passe devant, les tirs aussi ; seul le chemin de ronde arrête.',
  ],
  [Material.Timber]: [
    'Charpente de fond',
    'Le corps des tours de bois : on passe devant, comme pour la maçonnerie de fond.',
  ],
  [Material.Ice]: [
    'Glace',
    "La croûte d'un lac gelé : on y marche, mais une explosion y ouvre un trou bien plus large que dans la terre, et l'eau est dessous.",
  ],
};

function materialsTable(): string {
  const rows = MATERIALS.filter((m) => m.id !== Material.Air).map((m) => {
    const [name, note] = MATERIAL_NAMES[m.id];
    const c = MASK_PALETTE.find((p) => p.material === m.id);
    const swatch = c
      ? `<span class="swatch" style="background:rgb(${c.r},${c.g},${c.b})"></span>`
      : '';
    const solidity = m.solid ? 'bloque tout' : m.climbable ? 'praticable' : 'traversable';
    const strength = !m.destructible
      ? '<strong>indestructible</strong>'
      : m.resistancePct > 100
        ? `résiste ${m.resistancePct / 100}× mieux aux explosions`
        : 'se creuse normalement';
    return `| ${swatch} **${name}** | ${solidity} | ${strength} | ${note} |`;
  });
  return [
    '| Matière | Passage | Explosions | Où on la trouve |',
    '|---|---|---|---|',
    ...rows,
  ].join('\n');
}

const frNumber = (n: number): string => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });

/** {{unit:<key>}} values, read from src/content/units.ts. */
const UNIT_VALUES: Record<string, string> = {
  startHp: frNumber(CLASSIC_RULES.startHp),
  walkSpeedPx: frNumber(UNIT_RULES.walkSpeed / 256),
  maxStep: frNumber(UNIT_RULES.maxStep),
  fallSafeHeight: frNumber(UNIT_RULES.fallSafeHeight),
  fallPxPerHp: frNumber(UNIT_RULES.fallPxPerHp),
  fallMaxDamage: frNumber(UNIT_RULES.fallMaxDamage),
  fall200: frNumber(fallDamage(200, UNIT_RULES)),
  moveBudget: frNumber(UNIT_RULES.moveBudget ?? 0),
};

const seconds = (ticks: number): string => `${frNumber(ticks / 60)} s`;

/** {{rules:<key>}} values, read from the Classique scheme in src/content/rules.ts. */
const RULE_VALUES: Record<string, string> = {
  transition: seconds(CLASSIC_RULES.turn.transitionTicks),
  action: seconds(CLASSIC_RULES.turn.actionTicks),
  retreat: seconds(CLASSIC_RULES.turn.retreatTicks),
  settle: seconds(CLASSIC_RULES.turn.settleTicks ?? 0),
  chipBow: `${CLASSIC_RULES.weapons.find((w) => w.id === 'bow')?.chipRadius ?? 0}`,
  chipSling: `${CLASSIC_RULES.weapons.find((w) => w.id === 'sling')?.chipRadius ?? 0}`,
};

function edition(): string {
  const date = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  let rev: string;
  try {
    rev = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    rev = 'hors git';
  }
  return `<p class="edition">Édition du ${date} · version ${rev}</p>`;
}

const source = readFileSync(new URL('manuel.md', dir), 'utf8')
  .replaceAll('{{edition}}', edition())
  .replaceAll('{{materials}}', materialsTable())
  .replace(/\{\{unit:(\w+)\}\}/g, (_, key: string) => {
    const value = UNIT_VALUES[key];
    if (value === undefined) throw new Error(`unknown unit value {{unit:${key}}}`);
    return value;
  })
  .replace(/\{\{rules:(\w+)\}\}/g, (_, key: string) => {
    const value = RULE_VALUES[key];
    if (value === undefined) throw new Error(`unknown rules value {{rules:${key}}}`);
    return value;
  })
  .replace(/\{\{st:(\w+)\}\}/g, (_, key: string) => {
    const badge = STATUS[key];
    if (!badge) throw new Error(`unknown status tag {{st:${key}}}`);
    return badge;
  });
const leftover = source.match(/\{\{[^}]+\}\}/);
if (leftover) throw new Error(`unknown placeholder ${leftover[0]}`);

const body = await marked.parse(source);
const css = readFileSync(new URL('manual.css', dir), 'utf8');
const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Medieverse — Manuel du joueur</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,600;1,400&family=UnifrakturMaguntia&display=swap" rel="stylesheet">
<style>${css}</style></head><body>${body}</body></html>`;

// MANUAL_HTML=<path> also writes the HTML, to preview the layout.
if (process.env.MANUAL_HTML) writeFileSync(process.env.MANUAL_HTML, html);

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '18mm', bottom: '18mm', left: '16mm', right: '16mm' },
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate:
      '<div style="width:100%;text-align:center;font-size:8pt;color:#6b4a2e;font-family:Georgia,serif">Medieverse — Manuel du joueur · <span class="pageNumber"></span> / <span class="totalPages"></span></div>',
  });
  writeFileSync(new URL(OUTPUT, dir), pdf);
  console.log(`wrote docs/manual/${OUTPUT}`);
} finally {
  await browser.close();
}
