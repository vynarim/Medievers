// Who leads a house, drawn beside its choice on the setup screen: you, as the village idiot
// (cross-eyed, one tooth, a tuft of hair), or the AI, as a riveted great helm with lit eyes and
// a crest. Pure SVG strings built from the tokens, like the weapons' art.
import { COLORS, css } from './tokens.ts';

const INK = css(COLORS.encre);

/** Stroke attributes: ink outlines, round joins, as drawn with a quill. */
const s = (w = 2): string =>
  `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

/** The two faces, in a 40 × 40 box. */
const ART = {
  human: `
    <path d="M15 11 Q14 4 18 8 Q19 2 22 8 Q25 3 25 10" fill="none" stroke="${css(COLORS.terreOmbre)}" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="7.5" cy="22" r="3" fill="${css(COLORS.carnation)}" ${s(1.6)}/>
    <circle cx="32.5" cy="22" r="3" fill="${css(COLORS.carnation)}" ${s(1.6)}/>
    <ellipse cx="20" cy="22" rx="12" ry="13" fill="${css(COLORS.carnation)}" ${s()}/>
    <circle cx="13" cy="26" r="2.4" fill="${css(COLORS.roseGarance)}" opacity="0.6"/>
    <circle cx="27" cy="26" r="2.4" fill="${css(COLORS.roseGarance)}" opacity="0.6"/>
    <circle cx="15" cy="18" r="3.4" fill="${css(COLORS.ceruse)}" ${s(1.4)}/>
    <circle cx="25" cy="18" r="3.4" fill="${css(COLORS.ceruse)}" ${s(1.4)}/>
    <circle cx="16.8" cy="18.6" r="1.5" fill="${INK}"/>
    <circle cx="23.2" cy="18.6" r="1.5" fill="${INK}"/>
    <path d="M20 19 Q22 23 19.5 24" fill="none" ${s(1.4)}/>
    <path d="M13 28 Q20 34 27 28" fill="none" ${s(1.8)}/>
    <rect x="18.6" y="29.8" width="3" height="3.4" rx="0.6" fill="${css(COLORS.ceruse)}" ${s(1.1)}/>`,
  ai: `
    <path d="M20 9 Q24 1 31 3 Q26 6 24 9 Z" fill="${css(COLORS.vermillon)}" ${s(1.4)}/>
    <rect x="18.5" y="6" width="3" height="4" fill="${css(COLORS.or)}" ${s(1.2)}/>
    <path d="M9 14 Q9 9 20 9 Q31 9 31 14 L31 33 Q31 36 28 36 L12 36 Q9 36 9 33 Z" fill="${css(COLORS.roche)}" ${s()}/>
    <line x1="20" y1="10" x2="20" y2="35" stroke="${INK}" stroke-width="1.2" opacity="0.5"/>
    <rect x="11" y="17" width="18" height="5" rx="1" fill="${INK}"/>
    <circle cx="15.5" cy="19.5" r="1.7" fill="${css(COLORS.or)}"/>
    <circle cx="24.5" cy="19.5" r="1.7" fill="${css(COLORS.or)}"/>
    <path d="M14 27 L26 27 M14 30 L26 30 M14 33 L26 33" stroke="${INK}" stroke-width="1.3"/>
    <circle cx="11.5" cy="13" r="1" fill="${INK}"/>
    <circle cx="28.5" cy="13" r="1" fill="${INK}"/>
    <circle cx="11.5" cy="33" r="1" fill="${INK}"/>
    <circle cx="28.5" cy="33" r="1" fill="${INK}"/>`,
} as const;

/** The face of who leads a house: you, or the AI (any of its levels). */
export function playerArt(who: 'human' | 'ai', size = 40): string {
  return `<svg viewBox="0 0 40 40" width="${size}" height="${size}" aria-hidden="true">${ART[who]}</svg>`;
}
