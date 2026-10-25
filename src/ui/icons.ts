// The interface's icons, drawn in ink rather than taken from Unicode: the same on every device
// (no emoji ▶️ on iOS, no missing glyph on Android), and in the hand of the weapons' art.
// 24 × 24, in the button's colour (currentColor), round joins as with a quill.
import { el } from './overlay.ts';

/** A long jump: an arc taking off on the right and landing on the left (mirrored for the right). */
const JUMP = `<line x1="3" y1="20.5" x2="21" y2="20.5"/>
  <circle cx="19" cy="17.6" r="1.9" fill="currentColor" stroke="none"/>
  <path d="M18 15 C16.5 5 8.5 5 6 15.5" fill="none"/>
  <path d="M3.2 12.6 L6 16.2 L9.6 13.6" fill="none"/>`;

/** A wall, a hook over its top and the rope down its face, with an arrow for the way it goes. */
const ROPE = `<path d="M4.5 21 V7.5" fill="none" stroke-width="3.2"/>
  <path d="M3 7.5 H10" fill="none"/>
  <path d="M10 7.5 q-2 3 0 6 q2 3 0 6 V21" fill="none" stroke-width="1.8"/>`;

/** Eight teeth around the gear, computed once. */
const GEAR_TEETH = Array.from({ length: 8 }, (_, k) => {
  const a = (k * Math.PI) / 4;
  const p = (r: number): string =>
    `${(12 + r * Math.cos(a)).toFixed(2)} ${(12 + r * Math.sin(a)).toFixed(2)}`;
  return `M${p(6.6)} L${p(9.6)}`;
}).join(' ');

const ICONS = {
  walkLeft: `<path d="M15.5 4.5 L7 12 L15.5 19.5 Z" fill="currentColor"/>`,
  walkRight: `<path d="M8.5 4.5 L17 12 L8.5 19.5 Z" fill="currentColor"/>`,
  jumpLeft: JUMP,
  jumpRight: `<g transform="translate(24 0) scale(-1 1)">${JUMP}</g>`,
  jumpUp: `<line x1="5" y1="20.5" x2="19" y2="20.5"/><line x1="12" y1="17" x2="12" y2="4"/>
    <path d="M7 9 L12 4 L17 9" fill="none"/>`,
  climbDown: `<line x1="5" y1="20.5" x2="19" y2="20.5"/><line x1="12" y1="3" x2="12" y2="16"/>
    <path d="M7 11 L12 16 L17 11" fill="none"/>`,
  ropeUp: `${ROPE}<path d="M18 19 V6 M14.5 9.5 L18 6 L21.5 9.5" fill="none"/>`,
  ropeDown: `${ROPE}<path d="M18 6 V19 M14.5 15.5 L18 19 L21.5 15.5" fill="none"/>`,
  spin: `<path d="M19.5 12 A7.5 7.5 0 1 1 17.3 6.7" fill="none"/>
    <path d="M18 2.8 V7 H13.8" fill="none"/>
    <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/>`,
  switchUnit: `<path d="M4 8 H18 M14.5 4.5 L18 8 L14.5 11.5" fill="none"/>
    <path d="M20 16 H6 M9.5 12.5 L6 16 L9.5 19.5" fill="none"/>`,
  hourglass: `<path d="M6.5 3 H17.5 M6.5 21 H17.5" fill="none"/>
    <path d="M8 3 Q8 9 12 12 Q8 15 8 21 M16 3 Q16 9 12 12 Q16 15 16 21" fill="none"/>
    <path d="M9.6 19.5 Q12 15.5 14.4 19.5 Z" fill="currentColor" stroke="none"/>`,
  resetView: `<path d="M4 9 V4 H9 M15 4 H20 V9 M20 15 V20 H15 M9 20 H4 V15" fill="none"/>
    <circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none"/>`,
  fullscreen: `<path d="M4 9 V4 H9 M4 4 L9.5 9.5 M20 9 V4 H15 M20 4 L14.5 9.5 M4 15 V20 H9 M4 20 L9.5 14.5 M20 15 V20 H15 M20 20 L14.5 14.5" fill="none"/>`,
  help: `<circle cx="12" cy="12" r="9" fill="none"/>
    <path d="M9.4 9.4 A2.7 2.7 0 1 1 13.2 11.8 C12.3 12.3 12 12.9 12 13.8" fill="none"/>
    <circle cx="12" cy="17" r="1.2" fill="currentColor" stroke="none"/>`,
  settings: `<circle cx="12" cy="12" r="6.6" fill="none"/><circle cx="12" cy="12" r="2.6" fill="none"/>
    <path d="${GEAR_TEETH}" fill="none" stroke-width="3"/>`,
  menu: `<path d="M4 6.5 H20 M4 12 H20 M4 17.5 H20" fill="none"/>`,
  play: `<path d="M7.5 4.5 L19 12 L7.5 19.5 Z" fill="currentColor"/>`,
  pause: `<rect x="6.5" y="5" width="3.6" height="14" fill="currentColor" stroke="none"/>
    <rect x="13.9" y="5" width="3.6" height="14" fill="currentColor" stroke="none"/>`,
  restart: `<path d="M5 12 A7 7 0 1 0 7.1 7" fill="none"/><path d="M6.2 2.8 V7.2 H10.6" fill="none"/>`,
  close: `<path d="M6 6 L18 18 M18 6 L6 18" fill="none"/>`,
  prev: `<path d="M15 5 L8 12 L15 19" fill="none"/>`,
  next: `<path d="M9 5 L16 12 L9 19" fill="none"/>`,
  home: `<path d="M3.5 11.5 L12 4 L20.5 11.5 M6 9.5 V20 H18 V9.5" fill="none"/>
    <path d="M10 20 V14.5 H14 V20" fill="none"/>`,
  newMatch: `<path d="M12 5 V19 M5 12 H19" fill="none"/>`,
  /** a pot of fire, its fuse lit: the fuse of the throwables */
  fuse: `<circle cx="10" cy="15.5" r="5.8" fill="currentColor" stroke="none"/>
    <rect x="8" y="8" width="4" height="2.4" rx="0.6" fill="currentColor" stroke="none"/>
    <path d="M10.5 8 Q12 4.5 15.5 5" fill="none" stroke-width="1.6"/>
    <path d="M18.2 2.5 Q20.6 5 18.2 7.4 Q15.8 5 18.2 2.5 Z" fill="currentColor" stroke="none"/>`,
  /** a stretch between two arrows: the length of a stone wall */
  length: `<path d="M3 12 H21 M6.5 8.5 L3 12 L6.5 15.5 M17.5 8.5 L21 12 L17.5 15.5" fill="none"/>`,
} as const;

export type IconName = keyof typeof ICONS;

export function isIconName(name: string): name is IconName {
  return name in ICONS;
}

/** The SVG markup of an icon. */
export function iconSvg(name: IconName): string {
  return `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" stroke="currentColor"
    stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
}

/** An icon as an element. */
export function icon(name: IconName): HTMLElement {
  const span = el('span', 'ico-wrap');
  span.innerHTML = iconSvg(name);
  return span;
}

/**
 * Gives a button its icon, and a label beside it (hidden on a phone held upright in the action
 * bars, overlay.ts): what it says stays in its title, read by a long press on a touch screen.
 */
export function setIcon(b: HTMLButtonElement, name: IconName, label = ''): HTMLButtonElement {
  b.replaceChildren(icon(name));
  if (label) b.append(el('span', 'label', label));
  b.classList.add('has-icon');
  return b;
}

/** A text where {i:name} stands for an icon drawn inline (tutorial, hints). */
export function withIcons(text: string): (string | Node)[] {
  return text.split(/(\{i:\w+\})/).map((part) => {
    const name = /^\{i:(\w+)\}$/.exec(part)?.[1];
    return name && isIconName(name) ? icon(name) : part;
  });
}
