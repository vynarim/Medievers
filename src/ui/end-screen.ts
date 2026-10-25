// End-of-match screen: an embroidered frieze in the manner of the Bayeux tapestry, scrolling
// slowly sideways, over the winner's title, a quip and the two end-of-match buttons.
// Pure DOM + one procedural SVG tile shown twice; the only motion is a compositor CSS transform.
import { FONT_CAPS } from './fonts.ts';
import { t } from './i18n.ts';
import { button, el, shield } from './overlay.ts';
import { COLORS, css, cssAlpha } from './tokens.ts';
import { scalableCss } from './ui-scale.ts';

export interface EndScreenOptions {
  /** winning house, or null for a draw */
  readonly winner: {
    readonly nameKey: string;
    /** its name in this match (houses get a new one each match) */
    readonly name: string;
    readonly primary: number;
    readonly secondary: number;
  } | null;
  readonly quip: string;
  /** « Revoir la partie »; absent: no such button */
  readonly onReplay?: () => void;
  /** « Nouvelle partie » */
  readonly onRestart: () => void;
}

/** Tile of the frieze, in SVG user units; shown twice side by side so the scroll loops. */
const W = 2400;
const H = 300;
/** Upper border, main band and lower border (y ranges). */
const TOP = { y0: 6, y1: 50 };
const BOTTOM = { y0: 250, y1: 294 };
/** Ground line of the main band and baseline of the tituli. */
const GROUND = 244;
const CAPTION_Y = 80;
/** Width of a border compartment (a beast or a bird between two slanted bars). */
const CELL = 120;

// Wool colours: the tapestry's dyes (terracotta, ochre, sage, indigo, buff) taken from the tokens.
interface Wools {
  readonly terracotta: string;
  readonly rose: string;
  readonly ochre: string;
  readonly sage: string;
  readonly sageLight: string;
  readonly indigo: string;
  readonly azur: string;
  readonly buff: string;
  readonly flesh: string;
  readonly brown: string;
  readonly grey: string;
  readonly white: string;
  readonly ink: string;
  /** winner's tinctures (grey and buff for a draw) */
  readonly p: string;
  readonly s: string;
}

const STITCH_INK = css(COLORS.encre);

const STYLE = `
.end-screen { position: absolute; inset: 0; pointer-events: auto; display: flex;
  flex-direction: column; align-items: center; justify-content: center; gap: 22px;
  background: ${cssAlpha(COLORS.encre, 0.6)}; animation: end-fade 0.7s ease-out both; }
.end-tap { position: relative; flex: none; width: 100%; height: clamp(150px, 36vh, 330px);
  overflow: hidden; background: ${css(COLORS.velin)};
  box-shadow: 0 10px 28px ${cssAlpha(COLORS.encre, 0.55)};
  -webkit-mask-image: linear-gradient(90deg, transparent, black 5%, black 95%, transparent);
  mask-image: linear-gradient(90deg, transparent, black 5%, black 95%, transparent);
  animation: end-unroll 1.6s cubic-bezier(0.3, 0.7, 0.3, 1) both; }
.end-track { display: flex; height: 100%; width: max-content; will-change: transform;
  animation: end-scroll 90s linear infinite; }
.end-card { pointer-events: auto; position: relative; text-align: center; padding: 16px 40px 22px;
  max-width: calc(100vw - 32px);
  background: radial-gradient(ellipse at 50% 40%, ${css(COLORS.ceruse)} 55%, ${css(COLORS.velin)} 100%);
  border: 3px solid ${css(COLORS.encre)}; border-radius: 3px;
  box-shadow: inset 0 0 0 3px ${css(COLORS.ceruse)}, inset 0 0 0 5px ${css(COLORS.or)},
    0 6px 18px ${cssAlpha(COLORS.encre, 0.45)};
  animation: end-rise 0.8s 0.9s ease-out both; }
.end-kicker { font-family: var(--caps); font-size: 24px; color: ${css(COLORS.terreOmbre)}; }
.end-head { margin-top: 8px; display: flex; align-items: center; justify-content: center; gap: 18px; }
.end-head .shield { width: 52px; height: 62px; }
.end-title { font-family: var(--title); font-size: 60px; white-space: nowrap; line-height: 1.08; color: var(--p);
  text-shadow: 1px 1px 0 ${css(COLORS.encre)}, -1px 1px 0 ${css(COLORS.encre)},
    1px -1px 0 ${css(COLORS.encre)}, -1px -1px 0 ${css(COLORS.encre)},
    0 4px 10px ${cssAlpha(COLORS.encre, 0.25)}; }
.end-quip { font-size: 22px; line-height: 1.35; margin-top: 8px; max-width: 760px;
  margin-left: auto; margin-right: auto; }
.end-actions { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; margin-top: 18px; }
:is(#ui, body) .end-screen button { font-size: 21px; padding: 8px 26px; }
/* On a phone held upright, a long house name wraps rather than runs off the card. */
#ui.phone .end-card { padding: 14px 18px 18px; }
#ui.phone .end-title { white-space: normal; font-size: 46px; }
#ui.phone .end-quip { font-size: 19px; }
@keyframes end-fade { from { opacity: 0; } }
@keyframes end-rise { from { opacity: 0; transform: translateY(24px); } }
@keyframes end-scroll { to { transform: translateX(-50%); } }
@keyframes end-unroll { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
`;

/** Not scaled: SVG user units, touch targets (rules/render.md) and the reduced-motion switch. */
const FIXED_STYLE = `
.end-track svg { flex: none; display: block; height: 100%; width: auto; aspect-ratio: ${W} / ${H}; }
.end-defs { position: absolute; width: 0; height: 0; overflow: hidden; }
.end-tap .st { stroke: ${STITCH_INK}; stroke-width: 2; stroke-dasharray: 5 1.6;
  stroke-linejoin: round; stroke-linecap: round; }
.end-tap .ln { fill: none; stroke-linecap: round; stroke-linejoin: round; }
.end-tap .cap { font-family: ${FONT_CAPS}; font-size: 20px; letter-spacing: 3px;
  fill: ${css(COLORS.lapis)}; stroke: ${css(COLORS.lapis)}; stroke-width: 0.6;
  stroke-dasharray: 2 1; }
:is(#ui, body) .end-screen button { min-width: 48px; min-height: max(48px, calc(58 * var(--u))); }
@media (prefers-reduced-motion: reduce) {
  .end-screen, .end-tap, .end-track, .end-card { animation: none; }
}
`;

let styled = false;
let instance = 0;

function injectStyle(): void {
  if (styled) return;
  styled = true;
  const style = document.createElement('style');
  style.textContent = scalableCss(STYLE) + FIXED_STYLE;
  document.head.appendChild(style);
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Translation of an optional key, or null when fr.json does not define it. */
function tOpt(key: string, params: Record<string, string> = {}): string | null {
  const s = t(key, params);
  return s === `[${key}]` ? null : s;
}

// ---------------------------------------------------------------------------------------------
// Embroidery primitives. Every function returns SVG markup in local coordinates: the figure
// stands on y = 0 and faces right (x > 0); `place` moves, scales and mirrors it.

type Fill = (colour: string) => string;

function place(x: number, y: number, inner: string, flip = false, s = 1): string {
  return `<g transform="translate(${x} ${y}) scale(${flip ? -s : s} ${s})">${inner}</g>`;
}

/** A limb or a pole: a coloured thread over a wider stitched ink outline. */
function thread(points: string, colour: string, w = 6): string {
  return (
    `<polyline class="ln" points="${points}" stroke="${STITCH_INK}" stroke-width="${w + 3}"/>` +
    `<polyline class="ln" points="${points}" stroke="${colour}" stroke-width="${w}"/>`
  );
}

type Pose = 'up' | 'down' | 'fwd' | 'out' | 'shrug' | 'mouth';

/** Elbow and hand of the front arm (shoulder at 7,-70); the back arm mirrors them. */
const ARM: Record<Pose, readonly [number, number, number, number]> = {
  up: [12, -92, 15, -114],
  down: [11, -54, 13, -40],
  fwd: [19, -62, 31, -66],
  out: [19, -82, 30, -100],
  shrug: [21, -58, 27, -75],
  mouth: [19, -66, 11, -82],
};

interface Person {
  readonly tunic: string;
  readonly hose: string;
  readonly head?: 'helm' | 'bare' | 'tonsure';
  readonly robe?: boolean;
  readonly front?: Pose;
  readonly back?: Pose;
  /** drawn at the front hand / back hand */
  readonly frontItem?: (x: number, y: number) => string;
  readonly backItem?: (x: number, y: number) => string;
}

function person(f: Fill, w: Wools, p: Person): string {
  const front = ARM[p.front ?? 'down'];
  const back = ARM[p.back ?? 'down'];
  const arm = (a: readonly [number, number, number, number], side: 1 | -1): string =>
    thread(`${7 * side},-70 ${a[0] * side},${a[1]} ${a[2] * side},${a[3]}`, p.tunic, 6);
  let s = arm(back, -1);
  if (p.backItem) s += p.backItem(-back[2], back[3]);
  if (p.robe) {
    s += `<path class="st" fill="${f(p.tunic)}" d="M-9,-76 L9,-76 L19,-1 L-19,-1 Z"/>`;
  } else {
    s +=
      `<path class="st" fill="${f(p.hose)}" d="M-9,-36 L-3,-36 L-6,-3 L-13,-3 Z"/>` +
      `<path class="st" fill="${f(p.hose)}" d="M3,-36 L9,-36 L14,-3 L7,-3 Z"/>` +
      `<path class="ln" d="M-15,-1 H-5 M6,-1 H18" stroke="${w.ink}" stroke-width="4"/>` +
      `<path class="st" fill="${f(p.tunic)}" d="M-9,-76 L9,-76 L17,-32 Q0,-26 -17,-32 Z"/>`;
  }
  s += `<path class="ln" d="M-11,-52 H12" stroke="${w.ink}" stroke-width="2" stroke-dasharray="3 2"/>`;
  s += `<circle class="st" cx="1" cy="-85" r="9" fill="${w.flesh}"/>`;
  s += `<circle cx="6" cy="-87" r="1.4" fill="${w.ink}"/>`;
  switch (p.head ?? 'bare') {
    case 'helm':
      s +=
        `<path class="st" fill="${f(w.indigo)}" d="M-10,-86 Q-8,-100 1,-105 Q10,-100 11,-86 Z"/>` +
        `<path class="ln" d="M8,-88 V-79" stroke="${w.ink}" stroke-width="2.5"/>`;
      break;
    case 'tonsure':
      s += `<path class="ln" d="M-9,-83 Q-10,-95 1,-96 Q11,-95 10,-85" stroke="${w.brown}" stroke-width="4"/>`;
      break;
    case 'bare':
      s += `<path class="st" fill="${w.brown}" d="M-10,-84 Q-8,-97 3,-95 Q10,-94 10,-89 L-1,-90 Q-5,-88 -6,-82 Z"/>`;
      break;
  }
  s += arm(front, 1);
  if (p.frontItem) s += p.frontItem(front[2], front[3]);
  return s;
}

/** Kite shield in two tinctures, as carried by the tapestry's footmen. */
function kite(f: Fill, x: number, y: number, p: string, s: string, rot = 0, k = 1): string {
  return (
    `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${k})">` +
    `<path class="st" fill="${f(p)}" d="M0,-17 Q14,-17 14,-6 L0,25 L-14,-6 Q-14,-17 0,-17 Z"/>` +
    `<path class="ln" d="M0,-15 V21 M-12,-6 H12" stroke="${s}" stroke-width="3.5"/>` +
    `<circle cx="0" cy="-6" r="3" fill="${s}" stroke="${STITCH_INK}" stroke-width="1"/></g>`
  );
}

/** Lance with a swallow-tailed pennon, held at (x, y). */
function pennon(f: Fill, w: Wools, x: number, y: number, len = 46): string {
  const tx = x + 6;
  const ty = y - len;
  return (
    thread(`${x - 3},${y + 28} ${tx},${ty}`, w.brown, 3) +
    `<path class="st" fill="${f(w.p)}" d="M${tx},${ty} L${tx + 36},${ty + 5} L${tx + 24},${ty + 10} ` +
    `L${tx + 36},${ty + 15} L${tx + 1},${ty + 18} Z"/>` +
    `<path class="ln" d="M${tx + 2},${ty + 9} L${tx + 24},${ty + 10}" stroke="${w.s}" stroke-width="3"/>`
  );
}

/** Heater shield with a chief, the same blazon as overlay's shield(). */
function blazon(f: Fill, w: Wools, x: number, y: number, k = 1): string {
  return (
    `<g transform="translate(${x} ${y}) scale(${k})">` +
    `<path class="st" fill="${f(w.p)}" d="M-30,-36 H30 V2 Q30,26 0,40 Q-30,26 -30,2 Z"/>` +
    `<path class="st" fill="${f(w.s)}" d="M-30,-36 H30 V-12 H-30 Z"/>` +
    `<path class="ln" d="M-24,-30 H24 M-24,-18 H24" stroke="${STITCH_INK}" stroke-width="0.8" stroke-opacity="0.35"/></g>`
  );
}

function cup(f: Fill, w: Wools, x: number, y: number): string {
  return `<path class="st" fill="${f(w.ochre)}" d="M${x - 6},${y - 12} H${x + 6} L${x + 3},${y - 2} H${x - 3} Z M${x - 1},${y - 2} V${y + 3}"/>`;
}

function horn(f: Fill, w: Wools, x: number, y: number): string {
  return `<path class="st" fill="${f(w.ochre)}" d="M${x},${y - 2} Q${x + 22},${y - 4} ${x + 34},${y - 22} L${x + 42},${y - 16} Q${x + 28},${y + 6} ${x},${y + 3} Z"/>`;
}

/** The tapestry's horse: far legs in another wool, a stiff tail, an optional rider. */
function horse(f: Fill, w: Wools, body: string, legs: string, rider: string): string {
  const leg = (pts: string, c: string): string => thread(pts, c, 7);
  return (
    leg('30,-52 37,-27 41,-3', legs) +
    leg('-26,-52 -34,-27 -28,-3', legs) +
    thread('-38,-74 -58,-66 -52,-34', body, 7) +
    `<path class="st" fill="${f(body)}" d="M-40,-72 Q-38,-88 -14,-86 L22,-86 Q36,-86 40,-76 L42,-60 Q34,-50 10,-52 L-26,-50 Q-42,-54 -40,-72 Z"/>` +
    `<path class="st" fill="${f(body)}" d="M24,-82 Q36,-104 50,-116 L56,-121 L60,-114 Q70,-104 75,-92 L68,-87 Q60,-94 54,-98 Q46,-84 42,-64 Z"/>` +
    `<path class="ln" d="M30,-92 Q40,-108 52,-118" stroke="${w.ink}" stroke-width="3" stroke-dasharray="2 3"/>` +
    `<circle cx="60" cy="-109" r="1.8" fill="${w.ink}"/>` +
    leg('34,-54 43,-28 47,-3', body) +
    leg('-22,-52 -17,-27 -23,-3', body) +
    `<path class="st" fill="${f(w.p)}" d="M-16,-88 Q0,-94 16,-88 L14,-78 Q0,-82 -14,-78 Z"/>` +
    rider
  );
}

/** A mounted knight: body on the saddle, leg down the flank, lance and pennon raised. */
function rider(f: Fill, w: Wools, tunic: string): string {
  return (
    thread('2,-96 12,-70 8,-58', w.indigo, 6) +
    `<path class="st" fill="${f(tunic)}" d="M-9,-132 L8,-132 L14,-92 Q0,-86 -14,-92 Z"/>` +
    kite(f, -12, -104, w.p, w.s, -8, 0.9) +
    `<circle class="st" cx="1" cy="-141" r="9" fill="${w.flesh}"/>` +
    `<circle cx="6" cy="-143" r="1.4" fill="${w.ink}"/>` +
    `<path class="st" fill="${f(w.indigo)}" d="M-10,-142 Q-8,-156 1,-161 Q10,-156 11,-142 Z"/>` +
    thread('6,-126 18,-130 24,-140', tunic, 6) +
    pennon(f, w, 24, -140, 34)
  );
}

/** A tapestry tree: a trunk with interlaced curling branches ending in leaf fans. */
function tree(f: Fill, w: Wools, bare = false): string {
  const fan = (x: number, y: number, c: string): string =>
    bare
      ? ''
      : `<path class="st" fill="${f(c)}" d="M${x},${y} q-12,-6 -10,-18 q6,4 10,10 q0,-12 8,-18 q2,12 -4,20 q10,-4 16,2 q-10,8 -20,4 Z"/>`;
  const half = (side: 1 | -1): string =>
    thread(
      `0,-50 ${-18 * side},-64 ${-30 * side},-86 ${-18 * side},-104 ${-6 * side},-96 ${-14 * side},-88`,
      bare ? w.grey : w.terracotta,
      4,
    ) +
    thread(
      `0,-90 ${16 * side},-112 ${8 * side},-130 ${-4 * side},-126`,
      bare ? w.grey : w.sage,
      4,
    ) +
    fan(-14 * side, -88, w.sage) +
    fan(-4 * side, -126, w.sageLight);
  return (
    `<path class="st" fill="${f(bare ? w.grey : w.brown)}" d="M-6,-2 Q-3,-60 -2,-140 L2,-140 Q4,-60 8,-2 Z"/>` +
    half(1) +
    half(-1) +
    (bare ? '' : fan(0, -138, w.terracotta))
  );
}

/** Estimated advance of one titulus capital (font size 20 + letter spacing 3), in user units. */
const CAPTION_EM = 16.6;

/**
 * Tituli laid along the band, each starting at its scene. A titulus too long for the room
 * before the next one is squeezed (textLength), as embroiderers crammed their letters.
 */
function captions(list: readonly (readonly [number, string])[]): string {
  return list
    .map(([x, text], i) => {
      const room = (list[i + 1]?.[0] ?? W - 10) - 36 - x;
      const label = text.toUpperCase();
      const fit =
        label.length * CAPTION_EM > room
          ? ` textLength="${room}" lengthAdjust="spacingAndGlyphs"`
          : '';
      return `<text class="cap" x="${x}" y="${CAPTION_Y}"${fit}>${esc(label)}</text>`;
    })
    .join('');
}

// ---------------------------------------------------------------------------------------------
// Borders: slanted bars dividing compartments, each holding a beast or a bird.

function beast(f: Fill, c: string, w: Wools): string {
  return (
    thread('-12,-10 -14,-1', c, 3) +
    thread('-4,-10 -2,-1', c, 3) +
    thread('12,-10 10,-1', c, 3) +
    thread('18,-10 20,-1', c, 3) +
    thread('-22,-16 -34,-28 -26,-34 -22,-28', c, 3) +
    `<path class="st" fill="${f(c)}" d="M-24,-16 Q-20,-27 0,-24 Q16,-26 22,-20 L24,-12 Q10,-7 -20,-9 Z"/>` +
    `<path class="st" fill="${f(c)}" d="M18,-20 Q22,-32 30,-31 L34,-25 L30,-21 Z"/>` +
    `<circle cx="28" cy="-27" r="1.3" fill="${w.ink}"/>`
  );
}

function bird(f: Fill, c: string, wing: string, w: Wools): string {
  return (
    thread('-2,-10 -4,-1', w.ink, 1.5) +
    thread('4,-10 6,-1', w.ink, 1.5) +
    `<path class="st" fill="${f(c)}" d="M-30,-18 L-12,-16 Q0,-8 12,-14 Q16,-22 18,-26 Q20,-32 26,-30 L32,-28 L26,-26 Q20,-14 6,-10 Q-6,-8 -14,-12 Z"/>` +
    `<path class="st" fill="${f(wing)}" d="M-6,-14 Q-10,-32 -22,-36 Q-6,-34 6,-16 Z"/>` +
    `<circle cx="24" cy="-28" r="1.2" fill="${w.ink}"/>`
  );
}

function border(
  f: Fill,
  w: Wools,
  y0: number,
  y1: number,
  birdsFirst: boolean,
  colours: readonly string[],
): string {
  let s = '';
  for (let i = 0; i < W / CELL; i++) {
    const x = i * CELL;
    const c = colours[i % colours.length] ?? w.ochre;
    const bar = colours[(i + 2) % colours.length] ?? w.sage;
    s += thread(`${x + 4},${y0 + 4} ${x + 26},${y1 - 4}`, bar, 4);
    s += thread(`${x + 14},${y0 + 4} ${x + 36},${y1 - 4}`, c, 3);
    const isBird = (i % 2 === 0) === birdsFirst;
    // Pairs face each other across their bar, as on the tapestry.
    const flip = i % 4 >= 2;
    const inner = isBird ? bird(f, c, bar, w) : beast(f, c, w);
    s += place(x + 78, y1 - 4, inner, flip, 0.95);
  }
  const rule = (y: number): string =>
    `<path class="ln" d="M0,${y} H${W}" stroke="${w.indigo}" stroke-width="3" stroke-dasharray="7 2"/>` +
    `<path class="ln" d="M0,${y + 4} H${W}" stroke="${w.terracotta}" stroke-width="2" stroke-dasharray="5 2"/>`;
  return s + rule(y0 - 2) + rule(y1);
}

// ---------------------------------------------------------------------------------------------
// The two scenes, laid along a tile of width W. Nothing crosses x = 0 or x = W.

function victoryScene(f: Fill, w: Wools, house: string): string {
  const g = GROUND;
  const footman = (x: number, flip: boolean, tunic: string, hose: string): string =>
    place(
      x,
      g,
      person(f, w, {
        tunic,
        hose,
        head: 'helm',
        front: 'up',
        back: 'out',
        frontItem: (hx, hy) => kite(f, hx, hy - 10, w.p, w.s, 8),
        backItem: (hx, hy) => thread(`${hx},${hy} ${hx - 4},${hy - 22}`, w.grey, 3),
      }),
      flip,
    );
  const diner = (x: number, tunic: string, front: Pose, item: 'cup' | 'horn' | 'none'): string =>
    place(
      x,
      g,
      person(f, w, {
        tunic,
        hose: w.indigo,
        front,
        back: 'fwd',
        ...(item === 'cup' ? { frontItem: (hx: number, hy: number) => cup(f, w, hx, hy) } : {}),
        ...(item === 'horn' ? { frontItem: (hx: number, hy: number) => horn(f, w, hx, hy) } : {}),
      }),
    );
  const cheer = (x: number, k: number, tunic: string, flip: boolean, flag: boolean): string =>
    place(
      x,
      g,
      person(f, w, {
        tunic,
        hose: w.brown,
        front: 'up',
        back: flag ? 'out' : 'up',
        ...(flag ? { frontItem: (hx: number, hy: number) => pennon(f, w, hx, hy, 30) } : {}),
      }),
      flip,
      k,
    );
  let s = '';
  // Horsemen parading with lances.
  s += place(70, g, tree(f, w));
  s += place(200, g, horse(f, w, w.ochre, w.indigo, rider(f, w, w.terracotta)), false, 0.84);
  s += place(370, g, horse(f, w, w.rose, w.sage, rider(f, w, w.sage)), false, 0.84);
  // The house blazon carried high between two bearers.
  s += place(
    530,
    g,
    person(f, w, { tunic: w.sage, hose: w.terracotta, head: 'helm', front: 'up', back: 'up' }),
  );
  s += place(
    650,
    g,
    person(f, w, { tunic: w.terracotta, hose: w.sage, head: 'helm', front: 'up', back: 'up' }),
    true,
  );
  s += thread(`543,${g - 114} 637,${g - 114}`, w.brown, 4);
  s += blazon(f, w, 590, g - 116, 0.95);
  // Footmen brandishing shields.
  s += footman(760, false, w.indigo, w.ochre);
  s += footman(830, true, w.ochre, w.indigo);
  s += footman(900, false, w.sage, w.rose);
  s += place(985, g, tree(f, w));
  // The feast, at a curved table.
  s += diner(1090, w.terracotta, 'up', 'cup');
  s += diner(1150, w.ochre, 'mouth', 'horn');
  s += diner(1210, w.indigo, 'out', 'cup');
  s += diner(1270, w.sage, 'mouth', 'cup');
  s += diner(1330, w.rose, 'up', 'cup');
  s +=
    `<path class="st" fill="${f(w.white)}" d="M1060,${g - 46} Q1210,${g - 66} 1360,${g - 46} L1356,${g - 12} ` +
    `Q1340,${g - 4} 1326,${g - 12} Q1310,${g - 4} 1294,${g - 12} Q1278,${g - 4} 1262,${g - 12} Q1246,${g - 4} 1230,${g - 12} ` +
    `Q1214,${g - 4} 1198,${g - 12} Q1182,${g - 4} 1166,${g - 12} Q1150,${g - 4} 1134,${g - 12} Q1118,${g - 4} 1102,${g - 12} ` +
    `Q1086,${g - 4} 1064,${g - 12} Z"/>` +
    `<path class="ln" d="M1100,${g - 46} V${g - 14} M1160,${g - 50} V${g - 14} M1220,${g - 52} V${g - 14} ` +
    `M1280,${g - 50} V${g - 14} M1330,${g - 47} V${g - 14}" stroke="${w.azur}" stroke-width="2" stroke-dasharray="4 3"/>` +
    `<path class="st" fill="${f(w.azur)}" d="M1180,${g - 60} q16,-10 34,0 l10,-7 v14 l-10,-7 q-18,10 -34,0 Z"/>` +
    `<path class="st" fill="${f(w.ochre)}" d="M1110,${g - 54} a10,8 0 0 1 20,0 Z M1250,${g - 58} a10,8 0 0 1 20,0 Z"/>` +
    `<path class="st" fill="${f(w.p)}" d="M1300,${g - 56} h14 l-3,-10 h-8 Z"/>`;
  s += place(1430, g, tree(f, w));
  // Musicians and a juggler, all out of tune.
  s += place(
    1520,
    g,
    person(f, w, {
      tunic: w.sage,
      hose: w.ochre,
      front: 'mouth',
      back: 'fwd',
      frontItem: (hx, hy) => horn(f, w, hx, hy),
    }),
  );
  s += place(
    1600,
    g,
    person(f, w, {
      tunic: w.ochre,
      hose: w.terracotta,
      front: 'up',
      back: 'fwd',
      frontItem: (hx, hy) => thread(`${hx},${hy} ${hx + 8},${hy + 14}`, w.brown, 3),
    }) + `<ellipse class="st" cx="8" cy="-54" rx="14" ry="10" fill="${f(w.p)}"/>`,
  );
  s += place(
    1690,
    g,
    person(f, w, { tunic: w.indigo, hose: w.sage, front: 'up', back: 'up' }) +
      `<circle class="st" cx="-26" cy="-132" r="5" fill="${w.p}"/><circle class="st" cx="0" cy="-146" r="5" fill="${w.s}"/>` +
      `<circle class="st" cx="26" cy="-132" r="5" fill="${w.ochre}"/>`,
  );
  s += place(
    1770,
    g,
    person(f, w, { tunic: w.rose, hose: w.indigo, front: 'out', back: 'out' }),
    true,
  );
  s += place(1860, g, tree(f, w));
  // The cheering crowd.
  const tunics = [w.terracotta, w.ochre, w.sage, w.indigo, w.rose, w.sageLight];
  for (let i = 0; i < 10; i++) {
    const x = 1950 + i * 40;
    const k = i % 2 === 0 ? 0.92 : 0.82;
    s += cheer(x, k, tunics[i % tunics.length] ?? w.ochre, i % 3 === 1, i % 3 === 0);
  }
  s += blazon(f, w, 2350 - 8, g - 40, 0.6);
  // Tituli.
  s += captions([
    [130, t('end.caption.win.1', { house })],
    [1080, t('end.caption.win.2')],
    [1580, t('end.caption.win.3')],
    [1960, t('end.caption.win.4')],
  ]);
  return s;
}

function drawScene(f: Fill, w: Wools): string {
  const g = GROUND;
  const lance = (x: number, lean: number, len: number): string =>
    thread(`${x},${g - 2} ${x + lean},${g - len}`, w.brown, 3) +
    thread(`${x + lean},${g - len} ${x + lean + 8},${g - len + 6}`, w.brown, 3);
  const smoke = (x: number, y: number, k: number): string =>
    place(
      x,
      y,
      `<path class="ln" d="M0,0 q-14,-12 0,-24 q14,-12 0,-26 q-12,-12 4,-24 q14,-10 6,-24" stroke="${w.grey}" stroke-width="6" stroke-opacity="0.75"/>` +
        `<path class="ln" d="M0,0 q-14,-12 0,-24 q14,-12 0,-26 q-12,-12 4,-24 q14,-10 6,-24" stroke="${w.ink}" stroke-width="1.5" stroke-dasharray="3 3"/>`,
      false,
      k,
    );
  const monk = (x: number, flip: boolean, tunic: string): string =>
    place(
      x,
      g,
      person(f, w, {
        tunic,
        hose: tunic,
        head: 'tonsure',
        robe: true,
        front: 'shrug',
        back: 'shrug',
      }),
      flip,
    );
  const tuft = (x: number): string =>
    `<path class="ln" d="M${x - 6},${g} l3,-10 M${x},${g} v-14 M${x + 6},${g} l-3,-10" stroke="${w.sage}" stroke-width="2.5"/>`;
  let s = '';
  s += `<path class="ln" d="M0,${g} H${W}" stroke="${w.brown}" stroke-width="3" stroke-dasharray="9 4"/>`;
  s += place(70, g, tree(f, w, true));
  // Broken lances, dropped shields, a crow.
  s += lance(160, 16, 110) + lance(210, -20, 80) + lance(330, 10, 120) + lance(380, -6, 60);
  s += kite(f, 250, g - 8, w.grey, w.buff, 78) + kite(f, 300, g - 12, w.p, w.s, -70);
  s += place(
    346,
    g - 116,
    `<path class="st" fill="${f(w.ink)}" d="M-16,-8 L-4,-8 Q4,-14 10,-14 L16,-12 L10,-10 Q8,-2 0,0 Q-8,2 -16,-8 Z"/>`,
  );
  // Burnt ground and smoke.
  s += `<path class="st" fill="${f(w.ink)}" d="M470,${g} q30,-14 60,-4 q30,-12 70,0 q30,-10 60,4 Z"/>`;
  s += smoke(500, g - 8, 1) + smoke(560, g - 10, 1.2) + smoke(630, g - 6, 0.9);
  // The flood: water, a floating helmet and bubbles.
  s +=
    `<path class="st" fill="${f(w.indigo)}" d="M730,${g} q20,-30 60,-30 h140 q40,0 60,30 Z"/>` +
    `<path class="ln" d="M770,${g - 18} q10,-6 20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0" stroke="${w.azur}" stroke-width="3"/>` +
    `<path class="st" fill="${f(w.grey)}" d="M840,${g - 28} Q842,${g - 44} 852,${g - 50} Q862,${g - 44} 864,${g - 28} Z"/>` +
    `<circle class="st" cx="900" cy="${g - 44}" r="4" fill="${w.white}"/><circle class="st" cx="908" cy="${g - 58}" r="3" fill="${w.white}"/>` +
    `<circle class="st" cx="902" cy="${g - 70}" r="2" fill="${w.white}"/>`;
  s += place(1060, g, tree(f, w, true));
  // The lone sheep, sole survivor, on a hillock.
  s += `<path class="st" fill="${f(w.sage)}" d="M1160,${g} q80,-34 180,0 Z"/>`;
  s += place(
    1250,
    g - 16,
    thread('-16,-14 -18,0', w.ink, 3) +
      thread('-6,-14 -6,0', w.ink, 3) +
      thread('12,-14 14,0', w.ink, 3) +
      thread('20,-14 22,0', w.ink, 3) +
      `<path class="st" fill="${f(w.white)}" d="M-26,-20 q-6,-12 6,-16 q4,-12 16,-8 q8,-10 18,-2 q12,-6 16,6 q10,6 2,16 q2,10 -10,10 q-6,6 -16,2 q-10,6 -18,0 q-14,2 -14,-8 Z"/>` +
      `<path class="st" fill="${f(w.ink)}" d="M26,-30 q10,-6 16,2 q2,8 -6,12 q-10,0 -12,-6 Z"/>` +
      `<circle cx="36" cy="-26" r="1.6" fill="${w.white}"/>`,
    false,
    1.3,
  );
  // Monks who shrug.
  s += monk(1600, false, w.brown);
  s += monk(1690, true, w.grey);
  s += monk(1780, false, w.brown);
  s += place(1890, g, tree(f, w, true));
  // A fallen banner, then nothing at all.
  s +=
    thread(`1960,${g - 4} 2070,${g - 22}`, w.brown, 3) +
    `<path class="st" fill="${f(w.p)}" d="M2040,${g - 18} l28,-4 l4,24 l-10,-6 l-14,8 Z"/>`;
  s += smoke(2120, g - 2, 0.7);
  for (const x of [2190, 2250, 2310, 2360]) s += tuft(x);
  s += captions([
    [120, t('end.caption.draw.1')],
    [450, t('end.caption.draw.2')],
    [790, t('end.caption.draw.3')],
    [1150, t('end.caption.draw.4')],
    [1620, t('end.caption.draw.5')],
    [2040, t('end.caption.draw.6')],
  ]);
  return s;
}

// ---------------------------------------------------------------------------------------------

/** Shared <defs>: linen weave and one laid-and-couched wool fill per colour. */
function defs(prefix: string, colours: readonly string[]): string {
  const linen =
    `<pattern id="${prefix}-linen" width="5" height="5" patternUnits="userSpaceOnUse">` +
    `<rect width="5" height="5" fill="${css(COLORS.ceruse)}"/>` +
    `<path d="M0,1.5 H5 M1.5,0 V5" stroke="${css(COLORS.velin)}" stroke-width="1.1"/>` +
    `<path d="M0,4 H5" stroke="${cssAlpha(COLORS.terreOmbre, 0.06)}" stroke-width="0.8"/></pattern>`;
  const wool = colours
    .map(
      (c, i) =>
        `<pattern id="${prefix}-w${i}" width="12" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(-24)">` +
        `<rect width="12" height="4" fill="${c}"/>` +
        `<path d="M0,0.6 H12" stroke="${cssAlpha(COLORS.encre, 0.16)}" stroke-width="1"/>` +
        `<path d="M3,0 V4" stroke="${cssAlpha(COLORS.ceruse, 0.22)}" stroke-width="1.2"/></pattern>`,
    )
    .join('');
  return `<defs>${linen}${wool}</defs>`;
}

function wools(winner: EndScreenOptions['winner']): Wools {
  const draw = winner === null;
  return {
    // A draw is embroidered in faded wools: the dyes ran out with the houses.
    terracotta: css(draw ? COLORS.roseGarance : COLORS.vermillon),
    rose: css(COLORS.roseGarance),
    ochre: css(COLORS.ocre),
    sage: css(COLORS.vertDeGris),
    sageLight: css(COLORS.vertTendre),
    indigo: css(COLORS.lapis),
    azur: css(COLORS.azur),
    buff: css(COLORS.carnation),
    flesh: css(COLORS.velin),
    brown: css(COLORS.terreOmbre),
    grey: css(COLORS.roche),
    white: css(COLORS.ceruse),
    ink: STITCH_INK,
    p: css(winner?.primary ?? COLORS.roche),
    s: css(winner?.secondary ?? COLORS.velin),
  };
}

/** Latin name of a house for the titulus, when it bears its heraldic name; else its name. */
function latinHouse(w: { readonly nameKey: string; readonly name: string }): string {
  return w.name === t(w.nameKey) ? (tOpt(`end.latin.${w.nameKey}`) ?? w.name) : w.name;
}

function tapestry(opts: EndScreenOptions): HTMLElement {
  const prefix = `end${++instance}`;
  const w = wools(opts.winner);
  const palette = [...new Set(Object.values(w))];
  const fill: Fill = (c) => {
    const i = palette.indexOf(c);
    return i < 0 ? c : `url(#${prefix}-w${i})`;
  };
  const scene = opts.winner ? victoryScene(fill, w, latinHouse(opts.winner)) : drawScene(fill, w);
  const topColours = opts.winner
    ? [w.terracotta, w.ochre, w.sage, w.indigo, w.rose]
    : [w.grey, w.brown, w.sage, w.rose];
  const bottomColours = opts.winner
    ? [w.sage, w.indigo, w.ochre, w.terracotta, w.p]
    : [w.brown, w.grey, w.rose, w.sage];
  const body =
    `<rect width="${W}" height="${H}" fill="url(#${prefix}-linen)"/>` +
    border(fill, w, TOP.y0, TOP.y1, true, topColours) +
    border(fill, w, BOTTOM.y0, BOTTOM.y1, false, bottomColours) +
    `<g opacity="0.94">${scene}</g>`;
  const tile = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMinYMid meet" aria-hidden="true">${body}</svg>`;

  const tap = el('div', 'end-tap');
  tap.setAttribute('role', 'img');
  tap.setAttribute('aria-label', t(opts.winner ? 'end.tapestry.win' : 'end.tapestry.draw'));
  tap.innerHTML =
    `<svg class="end-defs" aria-hidden="true" focusable="false">${defs(prefix, palette)}</svg>` +
    `<div class="end-track">${tile}${tile}</div>`;
  return tap;
}

/**
 * Shows the end-of-match screen in `root` (the overlay root from uiRoot()).
 * Returns a function that removes it; calling it twice is harmless.
 */
export function showEndScreen(root: HTMLElement, opts: EndScreenOptions): () => void {
  injectStyle();
  const screen = el('div', 'end-screen');
  screen.setAttribute('role', 'dialog');
  screen.setAttribute('aria-modal', 'true');

  const card = el('div', 'end-card');
  const winner = opts.winner;
  card.style.setProperty('--p', css(winner?.primary ?? COLORS.encre));
  card.appendChild(el('div', 'end-kicker', t(winner ? 'end.kicker.win' : 'end.kicker.draw')));
  const head = el('div', 'end-head');
  if (winner) head.appendChild(shield(winner.primary, winner.secondary));
  const title = el('div', 'end-title', winner ? winner.name : t('end.title.draw'));
  screen.setAttribute('aria-label', title.textContent);
  head.appendChild(title);
  if (winner) head.appendChild(shield(winner.primary, winner.secondary));
  card.appendChild(head);
  if (opts.quip) card.appendChild(el('div', 'end-quip', opts.quip));

  const actions = el('div', 'end-actions');
  const onReplay = opts.onReplay;
  if (onReplay) {
    const replay = button(t('end.replay'));
    replay.addEventListener('click', () => onReplay());
    actions.append(replay);
  }
  // Closes the tapestry to look at the battlefield as the battle left it.
  const look = button(t('end.look'));
  look.addEventListener('click', () => screen.remove());
  const restart = button(t('end.restart'), 'fire');
  restart.addEventListener('click', () => opts.onRestart());
  actions.append(look, restart);
  card.appendChild(actions);

  screen.append(tapestry(opts), card);
  root.appendChild(screen);
  return () => screen.remove();
}
