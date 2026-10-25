// Small illuminations of the weapons for the arsenal: each one drawn in ink over flat colours of
// the Maciejowski palette, on a vellum roundel, like the objects in the margins of the manuscript.
// Pure SVG strings built from the tokens; no image files.
import type { WeaponId } from '../content/weapons.ts';
import { COLORS, css } from './tokens.ts';

const INK = css(COLORS.encre);
const C = {
  ink: INK,
  wood: css(COLORS.terreOmbre),
  ochre: css(COLORS.ocre),
  gold: css(COLORS.or),
  red: css(COLORS.vermillon),
  blue: css(COLORS.lapis),
  sky: css(COLORS.azur),
  green: css(COLORS.vertDeGris),
  leaf: css(COLORS.vertTendre),
  white: css(COLORS.ceruse),
  vellum: css(COLORS.velin),
  stone: css(COLORS.roche),
  rose: css(COLORS.roseGarance),
  flesh: css(COLORS.carnation),
};

/** Stroke attributes: ink outlines, round joins, as drawn with a quill. */
const s = (w = 2.5): string =>
  `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

/** The drawing of each weapon, in a 64 × 64 box. */
const ART: Record<WeaponId, string> = {
  bow: `
    <path d="M22 8 Q50 32 22 56" fill="none" ${s(4)}/>
    <path d="M22 8 Q50 32 22 56" fill="none" stroke="${C.wood}" stroke-width="2"/>
    <line x1="22" y1="8" x2="22" y2="56" ${s(1.2)}/>
    <line x1="14" y1="32" x2="56" y2="32" ${s(2.5)}/>
    <path d="M56 32 L48 27 L48 37 Z" fill="${C.stone}" ${s(1.5)}/>
    <path d="M14 32 L9 27 M14 32 L9 37 M18 32 L13 27 M18 32 L13 37" fill="none" stroke="${C.red}" stroke-width="2.5"/>`,
  fireArrow: `
    <path d="M22 8 Q50 32 22 56" fill="none" ${s(4)}/>
    <path d="M22 8 Q50 32 22 56" fill="none" stroke="${C.wood}" stroke-width="2"/>
    <line x1="22" y1="8" x2="22" y2="56" ${s(1.2)}/>
    <line x1="14" y1="32" x2="50" y2="32" ${s(2.5)}/>
    <path d="M14 32 L9 27 M14 32 L9 37 M18 32 L13 27 M18 32 L13 37" fill="none" stroke="${C.red}" stroke-width="2.5"/>
    <path d="M58 32 Q54 22 48 24 Q52 28 46 32 Q52 36 48 40 Q54 42 58 32 Z" fill="${C.red}" ${s(1.5)}/>
    <path d="M55 32 Q52 27 49 28 Q51 31 49 32 Q51 33 49 36 Q52 37 55 32 Z" fill="${C.gold}"/>`,
  sling: `
    <path d="M10 14 Q24 40 34 44" fill="none" ${s(2)}/>
    <path d="M10 22 Q22 46 34 44" fill="none" ${s(2)}/>
    <ellipse cx="38" cy="45" rx="7" ry="5" fill="${C.wood}" ${s(2)}/>
    <circle cx="50" cy="26" r="7" fill="${C.stone}" ${s(2)}/>
    <path d="M42 33 L46 30 M40 28 L43 27" ${s(1.5)}/>`,
  greekFire: `
    <path d="M20 26 Q18 52 32 54 Q46 52 44 26 Z" fill="${C.wood}" ${s()}/>
    <rect x="24" y="20" width="16" height="7" rx="2" fill="${C.ochre}" ${s(2)}/>
    <path d="M25 38 Q32 34 39 38" fill="none" stroke="${C.gold}" stroke-width="2"/>
    <path d="M32 20 Q28 12 34 8 Q32 14 38 14 Q36 18 32 20 Z" fill="${C.red}" ${s(1.5)}/>
    <path d="M33 18 Q31 14 34 12 Q34 15 36 16 Z" fill="${C.gold}"/>`,
  crossbow: `
    <path d="M10 22 Q32 10 54 22" fill="none" ${s(4)}/>
    <path d="M10 22 Q32 10 54 22" fill="none" stroke="${C.stone}" stroke-width="2"/>
    <line x1="10" y1="22" x2="54" y2="22" ${s(1.2)}/>
    <rect x="28" y="14" width="8" height="42" rx="2" fill="${C.wood}" ${s(2)}/>
    <line x1="32" y1="8" x2="32" y2="30" ${s(2)}/>
    <path d="M32 6 L28 12 L36 12 Z" fill="${C.stone}" ${s(1.5)}/>
    <rect x="27" y="40" width="10" height="4" fill="${C.gold}" ${s(1.2)}/>`,
  pitchPot: `
    <path d="M18 28 Q16 54 32 54 Q48 54 46 28 Z" fill="${INK}" ${s()}/>
    <path d="M20 30 Q32 25 44 30" fill="none" stroke="${C.wood}" stroke-width="3"/>
    <circle cx="14" cy="18" r="4" fill="${C.red}" ${s(1.5)}/>
    <circle cx="30" cy="10" r="4" fill="${C.gold}" ${s(1.5)}/>
    <circle cx="48" cy="14" r="4" fill="${C.red}" ${s(1.5)}/>
    <circle cx="54" cy="28" r="3" fill="${C.gold}" ${s(1.5)}/>
    <path d="M26 26 Q32 18 38 26" fill="${C.red}" ${s(1.5)}/>`,
  mace: `
    <line x1="14" y1="54" x2="38" y2="24" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>
    <line x1="14" y1="54" x2="38" y2="24" stroke="${C.wood}" stroke-width="3.5" stroke-linecap="round"/>
    <circle cx="42" cy="20" r="11" fill="${C.stone}" ${s()}/>
    <path d="M42 5 L45 11 L39 11 Z M57 20 L51 23 L51 17 Z M42 35 L39 29 L45 29 Z M27 20 L33 17 L33 23 Z
             M53 9 L51 15 L47 11 Z M53 31 L47 29 L51 25 Z" fill="${C.stone}" ${s(1.5)}/>
    <circle cx="42" cy="20" r="3" fill="${C.gold}" ${s(1)}/>`,
  sword: `
    <path d="M30 6 L34 6 L35 42 L29 42 Z" fill="${C.white}" ${s(2)}/>
    <line x1="32" y1="9" x2="32" y2="38" stroke="${C.stone}" stroke-width="1.5"/>
    <rect x="18" y="42" width="28" height="5" rx="2" fill="${C.gold}" ${s(2)}/>
    <rect x="29" y="47" width="6" height="10" fill="${C.wood}" ${s(1.5)}/>
    <circle cx="32" cy="59" r="3.5" fill="${C.gold}" ${s(1.5)}/>`,
  shieldCharge: `
    <path d="M14 10 L50 10 L50 30 Q50 50 32 58 Q14 50 14 30 Z" fill="${C.red}" ${s()}/>
    <path d="M32 10 L32 58 M14 28 L50 28" stroke="${C.gold}" stroke-width="4"/>
    <path d="M14 10 L50 10 L50 30 Q50 50 32 58 Q14 50 14 30 Z" fill="none" ${s()}/>
    <path d="M56 20 L62 20 M54 32 L62 32 M56 44 L62 44 M4 26 L9 26 M2 38 L9 38" ${s(2)}/>`,
  pick: `
    <line x1="20" y1="56" x2="38" y2="16" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>
    <line x1="20" y1="56" x2="38" y2="16" stroke="${C.wood}" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M12 16 Q36 4 56 22 Q36 12 14 20 Z" fill="${C.stone}" ${s(2)}/>
    <path d="M8 58 L22 50 M30 60 L40 54" stroke="${C.ochre}" stroke-width="3" stroke-linecap="round"/>`,
  sap: `
    <path d="M4 40 L60 40 L60 60 L4 60 Z" fill="${C.ochre}" ${s(2)}/>
    <path d="M4 40 Q32 30 60 40" fill="${C.green}" ${s(2)}/>
    <path d="M10 56 L10 48 Q10 44 18 44 L44 44 Q52 44 52 50 L52 56 Z" fill="${C.ink}"/>
    <rect x="16" y="45" width="3" height="11" fill="${C.wood}"/>
    <rect x="34" y="45" width="3" height="11" fill="${C.wood}"/>
    <rect x="14" y="44" width="26" height="3" fill="${C.wood}"/>
    <line x1="40" y1="30" x2="54" y2="8" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>
    <line x1="40" y1="30" x2="54" y2="8" stroke="${C.wood}" stroke-width="3" stroke-linecap="round"/>
    <path d="M44 6 L60 10 L58 16 Z" fill="${C.stone}" ${s(1.5)}/>`,
  caltrop: `
    <path d="M32 34 L12 48 M32 34 L52 48 M32 34 L32 10 M32 34 L22 54" ${s(5)} fill="none"/>
    <path d="M32 34 L12 48 M32 34 L52 48 M32 34 L32 10 M32 34 L22 54" stroke="${C.stone}" stroke-width="2.5" stroke-linecap="round" fill="none"/>
    <circle cx="32" cy="34" r="5" fill="${C.stone}" ${s(2)}/>
    <path d="M6 58 L58 58" stroke="${C.green}" stroke-width="3"/>`,
  stoneWall: `
    <rect x="8" y="22" width="48" height="34" fill="${C.white}" ${s()}/>
    <path d="M8 33 L56 33 M8 44 L56 44 M24 22 L24 33 M42 22 L42 33 M16 33 L16 44 M34 33 L34 44
             M50 33 L50 44 M24 44 L24 56 M42 44 L42 56" ${s(1.5)}/>
    <rect x="8" y="12" width="10" height="10" fill="${C.white}" ${s(2)}/>
    <rect x="27" y="12" width="10" height="10" fill="${C.white}" ${s(2)}/>
    <rect x="46" y="12" width="10" height="10" fill="${C.white}" ${s(2)}/>
    <path d="M8 58 L56 58" stroke="${C.green}" stroke-width="3"/>`,
  trebuchet: `
    <path d="M14 56 L30 22 L46 56" fill="none" ${s(4)}/>
    <path d="M14 56 L30 22 L46 56" fill="none" stroke="${C.wood}" stroke-width="2"/>
    <line x1="8" y1="56" x2="54" y2="56" ${s(3)}/>
    <line x1="16" y1="40" x2="54" y2="12" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>
    <line x1="16" y1="40" x2="54" y2="12" stroke="${C.wood}" stroke-width="3" stroke-linecap="round"/>
    <rect x="10" y="38" width="12" height="12" fill="${C.stone}" ${s(2)}/>
    <circle cx="30" cy="22" r="2.5" fill="${C.gold}" ${s(1)}/>
    <circle cx="58" cy="6" r="4.5" fill="${C.stone}" ${s(1.5)}/>
    <path d="M54 12 Q58 10 58 6" fill="none" ${s(1)}/>`,
};

/** The illumination of a weapon: an SVG roundel, `size` CSS px wide. */
export function weaponArt(id: WeaponId, size = 64): string {
  return (
    `<svg class="weapon-art" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">` +
    `<circle cx="32" cy="32" r="31" fill="${C.vellum}" stroke="${C.gold}" stroke-width="2"/>` +
    `<g>${ART[id]}</g></svg>`
  );
}
