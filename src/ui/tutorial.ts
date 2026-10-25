// The Help button's illustrated tutorial (GDD §9): short pages, one small drawing each, browsed
// with Previous / Next. Texts are i18n keys; drawings are inline SVG in the palette tokens.
import { CLASS_IDS, type ClassId } from '../content/classes.ts';
import { FACTIONS, type FactionDef } from '../content/factions.ts';
import { figureSvg } from '../render/figure-svg.ts';
import type { WeaponId } from '../content/weapons.ts';
import { t } from './i18n.ts';
import { weaponArt } from './weapon-art.ts';
import { button, el } from './overlay.ts';
import { icon, setIcon, withIcons } from './icons.ts';
import { COLORS, css } from './tokens.ts';

const C = {
  ink: css(COLORS.encre),
  gold: css(COLORS.or),
  red: css(COLORS.vermillon),
  blue: css(COLORS.lapis),
  azur: css(COLORS.azur),
  ochre: css(COLORS.ocre),
  earth: css(COLORS.terreOmbre),
  green: css(COLORS.vertDeGris),
  rose: css(COLORS.roseGarance),
  vellum: css(COLORS.velin),
  skin: css(COLORS.carnation),
  grey: css(COLORS.roche),
};

/** The houses the drawings show: the first two of the game, red and blue. */
const RED = FACTIONS[0];
const BLUE = FACTIONS[1];

/**
 * A figure as drawn in the battle (render/figure-svg.ts), feet at (x, y), of class `cls` in the
 * tinctures of house `house`, scaled by `k` (a little larger than in the battle, to be read);
 * `nimbus` for the unit that plays.
 */
function figure(
  x: number,
  y: number,
  house: FactionDef | undefined,
  facing: -1 | 1 = 1,
  nimbus = false,
  cls: ClassId = 'knight',
  k = 1.25,
): string {
  const body = figureSvg(
    cls,
    x,
    y,
    house?.primary ?? COLORS.vermillon,
    house?.secondary ?? COLORS.or,
    facing,
    nimbus,
  );
  return k === 1
    ? body
    : `<g transform="translate(${x} ${y}) scale(${k}) translate(${-x} ${-y})">${body}</g>`;
}

/** The battle's ground at height y: green turf over bands of ochre and madder, as in the game. */
const ground = (y: number): string => {
  const hill = (dy: number): string =>
    `M0 ${y + dy} Q 80 ${y + dy - 14} 160 ${y + dy} T 320 ${y + dy} T 480 ${y + dy}`;
  return `<path d="${hill(0)} V 200 H 0 Z" fill="${C.ochre}"/>
   <path d="${hill(12)} V 200 H 0 Z" fill="${C.rose}"/>
   <path d="${hill(22)} V 200 H 0 Z" fill="${C.ochre}"/>
   <path d="${hill(0)}" fill="none" stroke="${C.ink}" stroke-width="3"/>
   <path d="${hill(-2)}" fill="none" stroke="${C.green}" stroke-width="6"/>`;
};

const aimDots = (x: number, y: number, dx: number, dy: number): string => {
  let s = '';
  for (let i = 0, d = 34; d <= 120; d += 14, i++) {
    s += `<circle cx="${x + dx * d}" cy="${y + dy * d}" r="5" fill="${i % 2 ? C.gold : C.red}"
      stroke="${C.ink}" stroke-width="2"/>`;
  }
  const tx = x + dx * 140;
  const ty = y + dy * 140;
  return `${s}<polygon points="${tx + dx * 12},${ty + dy * 12} ${tx - dy * 11},${ty + dx * 11}
    ${tx + dy * 11},${ty - dx * 11}" fill="${C.red}" stroke="${C.ink}" stroke-width="3"/>`;
};

/** A drawing on a pale gilt field strewn with lozenges, as behind the battle. */
const svg = (body: string): string =>
  `<svg viewBox="0 0 480 200" role="img" aria-hidden="true">
    <defs><pattern id="tuto-diaper" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M20 0 L40 20 L20 40 L0 20 Z" fill="none" stroke="${C.gold}" stroke-width="1.5"
        opacity="0.45"/><circle cx="20" cy="20" r="2" fill="${C.gold}" opacity="0.6"/>
    </pattern></defs>
    <rect width="480" height="200" fill="${C.vellum}"/>
    <rect width="480" height="200" fill="url(#tuto-diaper)"/>${body}</svg>`;

/** One drawing per page, in page order. */
const DRAWINGS: readonly string[] = [
  // 1. The goal: two houses face each other.
  svg(`${ground(170)}${figure(90, 168, RED, 1, false, 'knight')}${figure(145, 164, RED, 1, false, 'archer')}
    ${figure(335, 164, BLUE, -1, false, 'slinger')}${figure(390, 168, BLUE, -1, false, 'cleric')}`),
  // 2. A turn: the hourglass and the active unit's nimbus.
  svg(`${ground(170)}${figure(160, 164, RED, 1, true, 'knight')}
    <polygon points="150,48 170,48 160,72" fill="${C.gold}" stroke="${C.ink}" stroke-width="3"/>
    <circle cx="370" cy="80" r="44" fill="${C.vellum}" stroke="${C.ink}" stroke-width="3"/>
    <text x="370" y="96" text-anchor="middle" font-size="44" fill="${C.ink}">45</text>`),
  // 3. Moving: walk and jump arcs.
  svg(`${ground(170)}${figure(120, 164, RED, 1, true, 'sapper')}
    <path d="M 140 120 Q 220 30 300 150" fill="none" stroke="${C.red}" stroke-width="4"
      stroke-dasharray="10 8"/>
    <path d="M 100 188 H 200" stroke="${C.ink}" stroke-width="4"/>
    <polygon points="212,188 198,181 198,195" fill="${C.ink}"/>`),
  // 4. Aiming: the red arrowhead and the sweep.
  svg(`${ground(170)}${figure(200, 164, RED, 1, true, 'archer')}${aimDots(202, 120, 0.8, -0.6)}
    <path d="M 330 40 A 150 150 0 0 0 70 50" fill="none" stroke="${C.blue}" stroke-width="3"
      stroke-dasharray="6 8"/>`),
  // 5. Firing: the power arc around the unit.
  svg(`${ground(170)}${figure(200, 164, RED, 1, true, 'slinger')}
    <path d="M 202 60 A 60 60 0 1 1 152 152" fill="none" stroke="${C.gold}" stroke-width="10"/>
    ${aimDots(202, 120, 0.8, -0.6)}`),
  // 6. The battlefield: the wind gauge, a crater revealing the page, a tower.
  svg(`${ground(170)}<circle cx="300" cy="182" r="30" fill="${C.vellum}"/>
    <rect x="70" y="80" width="44" height="86" fill="${C.grey}" stroke="${C.ink}" stroke-width="3"/>
    <path d="M 70 80 v -12 h 10 v 12 m 7 0 v -12 h 10 v 12 m 7 0 v -12 h 10 v 12" fill="none"
      stroke="${C.ink}" stroke-width="3"/>
    <rect x="110" y="30" width="260" height="16" fill="${C.vellum}" stroke="${C.ink}" stroke-width="3"/>
    <rect x="240" y="30" width="90" height="16" fill="${C.azur}"/>
    <line x1="240" y1="24" x2="240" y2="52" stroke="${C.ink}" stroke-width="3"/>`),
  // 7. The classes: six figures, each with its mark.
  svg(
    `${ground(170)}${CLASS_IDS.map((c, i) =>
      figure(52 + i * 75, 166, i % 2 === 0 ? RED : BLUE, 1, false, c),
    ).join('')}`,
  ),
  // 8. Online: two screens, one code between them.
  svg(`<rect x="30" y="40" width="150" height="104" rx="6" fill="${C.vellum}" stroke="${C.ink}"
      stroke-width="3"/>
    <rect x="300" y="40" width="150" height="104" rx="6" fill="${C.vellum}" stroke="${C.ink}"
      stroke-width="3"/>
    ${figure(105, 136, RED, 1, false, 'knight', 0.85)}${figure(375, 136, BLUE, -1, false, 'king', 0.85)}
    <rect x="182" y="78" width="116" height="34" rx="4" fill="${C.blue}" stroke="${C.ink}"
      stroke-width="3"/>
    <text x="240" y="102" text-anchor="middle" font-size="20" fill="${C.gold}"
      font-family="serif">K7M-2QX</text>
    <path d="M 150 170 Q 240 196 330 170" fill="none" stroke="${C.ink}" stroke-width="3"
      stroke-dasharray="8 6"/>`),
  // 9. Camera and menus.
  svg(`<rect x="60" y="30" width="360" height="140" fill="none" stroke="${C.ink}" stroke-width="3"
      stroke-dasharray="10 8"/>${ground(170)}${figure(240, 164, RED, 1, true, 'king')}
    <circle cx="420" cy="30" r="22" fill="${C.vellum}" stroke="${C.ink}" stroke-width="3"/>
    <circle cx="420" cy="30" r="8" fill="none" stroke="${C.ink}" stroke-width="3"/>`),
];

/**
 * Topics of the advanced help, after the basic pages (tuto.adv.N.*): each with the illumination
 * of a weapon of the arsenal, on its card in the contents and beside its text.
 */
const TOPIC_ART: readonly WeaponId[] = [
  'banner',
  'bow',
  'greekFire',
  'falcon',
  'sword',
  'grapple',
  'catapult',
  'stoneWall',
  'arrowRain',
  'miracle',
  'shieldCharge',
  'sling',
];
const ADVANCED_TOPICS = TOPIC_ART.length;

/** Under each topic, a red and a blue fighter of the classes it speaks of most, facing off. */
const TOPIC_PAIRS: readonly (readonly [ClassId, ClassId])[] = [
  ['knight', 'archer'],
  ['archer', 'slinger'],
  ['sapper', 'slinger'],
  ['archer', 'king'],
  ['knight', 'knight'],
  ['sapper', 'cleric'],
  ['knight', 'sapper'],
  ['sapper', 'knight'],
  ['cleric', 'king'],
  ['cleric', 'archer'],
  ['king', 'king'],
  ['knight', 'slinger'],
];

/** The strip at the foot of a topic: the two fighters on the battle's ground. */
function topicStrip(n: number): string {
  const [a, b] = TOPIC_PAIRS[n - 1] ?? ['knight', 'knight'];
  return svg(
    `${ground(170)}${figure(150, 166, RED, 1, false, a)}${figure(330, 166, BLUE, -1, false, b)}`,
  );
}

/** The page shown: a basic one, the advanced help's contents, or one of its topics. */
type Page =
  | { readonly kind: 'basic'; readonly n: number }
  | { readonly kind: 'index' }
  | { readonly kind: 'topic'; readonly n: number };

/**
 * The text of an i18n key, one paragraph per line, icons drawn in; `art` floats beside it.
 * Lines that start with « - » make a list, their words before « : » set as a heading.
 */
function paragraphs(key: string, art = ''): HTMLElement {
  const body = el('div', 'tuto-body');
  if (art) {
    const pic = el('div', 'tuto-art');
    pic.innerHTML = art;
    body.append(pic);
  }
  let list: HTMLElement | null = null;
  for (const line of t(key).split('\n')) {
    if (!line.startsWith('- ')) {
      list = null;
      const p = el('p');
      p.append(...withIcons(line));
      body.append(p);
      continue;
    }
    if (!list) {
      list = el('ul', 'tuto-list');
      body.append(list);
    }
    const item = el('li');
    const text = line.slice(2);
    const cut = text.indexOf(' : ');
    if (cut > 0) item.append(el('b', '', text.slice(0, cut)), ...withIcons(text.slice(cut)));
    else item.append(...withIcons(text));
    list.append(item);
  }
  return body;
}

/** A drawing below a topic's text, kept low so the text has the room. */
function stripOf(markup: string): HTMLElement {
  const strip = el('div', 'tuto-pic tuto-strip');
  strip.innerHTML = markup;
  return strip;
}

/**
 * Fills `panel` with the help: the basic tutorial, page 1 first, then the advanced help, reached
 * from any basic page and from the last one.
 */
export function renderTutorial(panel: HTMLElement, close: () => void): void {
  const count = DRAWINGS.length;
  const go = (page: Page): void => {
    const closeBtn = setIcon(button('', 'close'), 'close');
    closeBtn.addEventListener('click', close);
    const nav = el('div', 'tuto-nav');
    const step = (label: string, ico: 'prev' | 'next', to: Page | null): HTMLButtonElement => {
      const b = button('');
      if (ico === 'prev') setIcon(b, 'prev', label);
      else b.append(el('span', 'label', label), icon('next'));
      b.classList.add('has-icon');
      b.disabled = to === null;
      if (to) b.addEventListener('click', () => go(to));
      return b;
    };
    const more = (): HTMLButtonElement => {
      const b = button(t('tuto.more'), 'tuto-more');
      b.addEventListener('click', () => go({ kind: 'index' }));
      return b;
    };
    if (page.kind === 'basic') {
      const n = page.n;
      const pic = el('div', 'tuto-pic');
      pic.innerHTML = DRAWINGS[n - 1] ?? '';
      const prev = step(t('tuto.prev'), 'prev', n > 1 ? { kind: 'basic', n: n - 1 } : null);
      let next: HTMLButtonElement;
      if (n === count) {
        next = button(t('tuto.done'));
        next.addEventListener('click', close);
      } else {
        next = step(t('tuto.next'), 'next', { kind: 'basic', n: n + 1 });
      }
      const middle = el('div', 'tuto-mid');
      middle.append(el('span', 'tuto-count', t('tuto.count', { n, count })), more());
      nav.append(prev, middle, next);
      panel.replaceChildren(
        closeBtn,
        el('h2', '', t(`tuto.${n}.title`)),
        pic,
        paragraphs(`tuto.${n}.body`),
        nav,
      );
      return;
    }
    if (page.kind === 'index') {
      const list = el('div', 'tuto-topics');
      for (let k = 1; k <= ADVANCED_TOPICS; k++) {
        const b = button('');
        const art = el('span', 'art');
        art.innerHTML = weaponArt(TOPIC_ART[k - 1] ?? 'bow', 40);
        b.append(art, el('span', '', t(`tuto.adv.${k}.title`)));
        b.addEventListener('click', () => go({ kind: 'topic', n: k }));
        list.append(b);
      }
      const body = el('div', 'tuto-body plain');
      body.append(el('p', '', t('tuto.adv.intro')), list);
      nav.append(step(t('tuto.adv.back'), 'prev', { kind: 'basic', n: 1 }));
      panel.replaceChildren(closeBtn, el('h2', '', t('tuto.adv.title')), body, nav);
      return;
    }
    const n = page.n;
    const prev = step(
      n > 1 ? t('tuto.prev') : t('tuto.adv.index'),
      'prev',
      n > 1 ? { kind: 'topic', n: n - 1 } : { kind: 'index' },
    );
    const next =
      n < ADVANCED_TOPICS
        ? step(t('tuto.next'), 'next', { kind: 'topic', n: n + 1 })
        : step(t('tuto.adv.index'), 'next', { kind: 'index' });
    const middle = el('div', 'tuto-mid');
    const index = button(t('tuto.adv.index'), 'tuto-more');
    index.addEventListener('click', () => go({ kind: 'index' }));
    middle.append(el('span', 'tuto-count', t('tuto.count', { n, count: ADVANCED_TOPICS })), index);
    nav.append(prev, middle, next);
    panel.replaceChildren(
      closeBtn,
      el('h2', '', t(`tuto.adv.${n}.title`)),
      paragraphs(`tuto.adv.${n}.body`, weaponArt(TOPIC_ART[n - 1] ?? 'bow', 96)),
      stripOf(topicStrip(n)),
      nav,
    );
  };
  go({ kind: 'basic', n: 1 });
}
