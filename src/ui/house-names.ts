// Names of the houses for a match (2026-10-25): drawn from the match seed, so both players of an
// online match (and a replay) read the same ones, out of heraldry gone wrong: a beast, its
// attitude or its tincture, « Maison du Hareng Rampant », « Maison des Trois Limaces d'Azur ».
// Cosmetic: never read by the sim.
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

/** One name, drawn with `roll`. */
function draw(roll: () => number): string {
  const n = (prefix: string): number => 1 + Math.floor(roll() * variantCount(prefix));
  const b = beast(n('house.beast'));
  const kind = Math.floor(roll() * 4);
  if (kind === 0)
    return t('house.three', {
      beasts: b.many,
      tincture: t(`house.tincture.${n('house.tincture')}`),
    });
  if (kind === 1)
    return t('house.name', { of: of(b), more: t(`house.tincture.${n('house.tincture')}`) });
  if (kind === 2) {
    const other = beast(n('house.beast'));
    return t('house.name', { of: of(b), more: t('house.and', { of: of(other) }) });
  }
  return t('house.name', { of: of(b), more: pose(n('house.pose'), b) });
}

let names: string[] = [];

/** Draws the houses' names of the match played with `seed`; null: their heraldic names. */
export function nameHouses(seed: number | null): void {
  names = [];
  if (seed === null || variantCount('house.beast') === 0) return;
  const roll = dice(seed ^ 0x9e3779b9);
  for (let team = 0; team < FACTIONS.length; team++) {
    let name = draw(roll);
    for (let k = 0; k < 8 && names.includes(name); k++) name = draw(roll);
    names.push(name);
  }
}

/** The name of house `team` in this match. */
export function houseName(team: number): string {
  const f = FACTIONS[team];
  return names[team] ?? (f ? t(f.nameKey) : '');
}
