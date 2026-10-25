// Names of the houses for a match (2026-10-25): drawn from the match seed, so both players of an
// online match (and a replay) read the same ones, out of heraldry gone wrong: a beast, its
// tincture and its attitude, « Maison du Hareng d'Or Rampant ».
// Each has a short form for the HUD and the unit card, without « Maison de » (2026-10-25):
// « Hareng d'Or Rampant ». Cosmetic: never read by the sim.
import { FACTIONS } from '../content/factions.ts';
import { t, variantCount } from './i18n.ts';

/** A beast of the word lists: gender, elided article (« de l' »), singular, plural. */
interface Beast {
  readonly feminine: boolean;
  readonly elided: boolean;
  readonly one: string;
  readonly many: string;
}

function beast(i: number): Beast {
  const [g = 'm', one = '', many = one] = t(`house.beast.${i}`).split('|');
  return { feminine: g.startsWith('f'), elided: g.endsWith("'"), one, many };
}

/** « du Hareng », « de la Limace », « de l'Oie ». */
function of(b: Beast): string {
  return b.elided ? `de l'${b.one}` : b.feminine ? `de la ${b.one}` : `du ${b.one}`;
}

/** An attitude agreeing with the beast: « Rampant », « Rampante ». */
function pose(i: number, b: Beast): string {
  const [m = '', f = m] = t(`house.pose.${i}`).split('|');
  return b.feminine ? f : m;
}

/** A small seeded generator (mulberry32): the same seed, the same names. */
function dice(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let r = Math.imul(a ^ (a >>> 15), 1 | a);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** A house's name in full (« Maison du Hareng Rampant ») and short (« Hareng Rampant »). */
interface Name {
  readonly full: string;
  readonly short: string;
}

/**
 * One name, drawn with `roll`: a beast, a tincture and an attitude (decided 2026-10-25: never two
 * beasts in one name), « Maison du Hareng d'Or Enrhumé », short « Hareng d'Or Enrhumé ».
 */
function draw(roll: () => number): Name & { readonly beast: string } {
  const n = (prefix: string): number => 1 + Math.floor(roll() * variantCount(prefix));
  const b = beast(n('house.beast'));
  const more = t('house.trait', {
    tincture: t(`house.tincture.${n('house.tincture')}`),
    pose: pose(n('house.pose'), b),
  });
  return {
    full: t('house.name', { of: of(b), more }),
    short: t('house.short.name', { beast: b.one, more }),
    beast: b.one,
  };
}

let names: Name[] = [];

/** Draws the houses' names of the match played with `seed`; null: their heraldic names. */
export function nameHouses(seed: number | null): void {
  names = [];
  if (seed === null || variantCount('house.beast') === 0) return;
  const roll = dice(seed ^ 0x9e3779b9);
  const taken = new Set<string>();
  for (let team = 0; team < FACTIONS.length; team++) {
    let name = draw(roll);
    // Each house its own beast.
    for (let k = 0; k < 16 && taken.has(name.beast); k++) name = draw(roll);
    taken.add(name.beast);
    names.push(name);
  }
}

/** The name of house `team` in this match, in full: for sentences (« la Maison du Hareng »). */
export function houseName(team: number): string {
  const f = FACTIONS[team];
  return names[team]?.full ?? (f ? t(f.nameKey) : '');
}

/** Its short name, without « Maison de »: for the HUD and the unit card. */
export function houseShortName(team: number): string {
  const f = FACTIONS[team];
  return names[team]?.short ?? (f ? t(`factions.short.${f.id}`) : '');
}
