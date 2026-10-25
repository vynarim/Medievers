// Names of the houses for a match (2026-10-25): drawn from the match seed, so both players of an
// online match (and a replay) read the same ones, out of heraldry gone wrong: a beast, its
// tincture and its attitude, « Maison du Hareng d'Or Rampant ».
// Each has a short form for the HUD and the unit card, without « Maison de » (2026-10-25):
// « Hareng d'Or Rampant ». Cosmetic: never read by the sim.
import { FACTIONS, UNIT_NAMES, setUnitNames } from '../content/factions.ts';
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

/** Words already given to a house of this match, by list: no two houses share one. */
type Taken = Record<'house.beast' | 'house.tincture' | 'house.pose', Set<number>>;

/** A variant of `prefix` not taken yet (any, once all are), drawn with `roll`; now taken. */
function pick(roll: () => number, prefix: keyof Taken, taken: Taken): number {
  const all = variantCount(prefix);
  const free: number[] = [];
  for (let i = 1; i <= all; i++) if (!taken[prefix].has(i)) free.push(i);
  const from = free.length > 0 ? free : Array.from({ length: all }, (_, i) => i + 1);
  const n = from[Math.floor(roll() * from.length)] ?? 1;
  taken[prefix].add(n);
  return n;
}

/**
 * One name, drawn with `roll`: a beast, a tincture and an attitude (decided 2026-10-25: never two
 * beasts in one name, and no two houses with the same beast, tincture or attitude),
 * « Maison du Hareng d'Or Enrhumé », short « Hareng d'Or Enrhumé ».
 */
function draw(roll: () => number, taken: Taken): Name {
  const b = beast(pick(roll, 'house.beast', taken));
  const more = t('house.trait', {
    tincture: t(`house.tincture.${pick(roll, 'house.tincture', taken)}`),
    pose: pose(pick(roll, 'house.pose', taken), b),
  });
  return {
    full: t('house.name', { of: of(b), more }),
    short: t('house.short.name', { beast: b.one, more }),
  };
}

let names: Name[] = [];

/** Draws the houses' names of the match played with `seed`; null: their heraldic names. */
export function nameHouses(seed: number | null): void {
  names = [];
  nameUnits(seed);
  if (seed === null || variantCount('house.beast') === 0) return;
  const roll = dice(seed ^ 0x9e3779b9);
  const taken: Taken = {
    'house.beast': new Set(),
    'house.tincture': new Set(),
    'house.pose': new Set(),
  };
  for (let team = 0; team < FACTIONS.length; team++) names.push(draw(roll, taken));
}

/**
 * The units' first names for the match played with `seed`: the list shuffled (Fisher-Yates)
 * with a draw of their own, so no two units of a match share one; null: the list as it is.
 */
function nameUnits(seed: number | null): void {
  if (seed === null) {
    setUnitNames(null);
    return;
  }
  const roll = dice(seed ^ 0x6e616d65);
  const order = [...UNIT_NAMES];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(roll() * (i + 1));
    [order[i], order[j]] = [order[j] ?? '', order[i] ?? ''];
  }
  setUnitNames(order);
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
