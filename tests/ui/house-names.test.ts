import { describe, expect, it } from 'vitest';
import { houseName, houseShortName, nameHouses } from '../../src/ui/house-names.ts';
import { UNIT_NAMES, unitName } from '../../src/content/factions.ts';
import { t, variantCount } from '../../src/ui/i18n.ts';

describe('house names', () => {
  it('are drawn from the seed: the same for the same match, different from one to the next', () => {
    nameHouses(42);
    const a = [0, 1, 2, 3].map(houseName);
    nameHouses(42);
    expect([0, 1, 2, 3].map(houseName)).toEqual(a);
    expect(new Set(a).size).toBe(4);
    for (const n of a) expect(n).toMatch(/^Maison (du |de la |de l'|des Trois )/);
    for (const n of [0, 1, 2, 3].map(houseShortName))
      expect(n).not.toMatch(/^(Maison|du |de |des )/);
    // No two houses share a beast, a tincture or an attitude.
    const shorts = [0, 1, 2, 3].map(houseShortName);
    const has = (name: string, w: string): boolean =>
      name === w || name.startsWith(`${w} `) || name.endsWith(` ${w}`) || name.includes(` ${w} `);
    for (const prefix of ['house.beast', 'house.tincture', 'house.pose']) {
      for (let i = 1; i <= variantCount(prefix); i++) {
        const raw = t(`${prefix}.${i}`).split('|');
        const forms = prefix === 'house.beast' ? raw.slice(1, 2) : raw;
        expect(shorts.filter((n) => forms.some((w) => has(n, w))).length).toBeLessThanOrEqual(1);
      }
    }
    nameHouses(43);
    expect([0, 1, 2, 3].map(houseName)).not.toEqual(a);
  });

  it('fall back on the heraldic names outside a match', () => {
    nameHouses(null);
    expect(houseName(0)).toBe("Maison du Lion d'Or");
    expect(houseShortName(0)).toBe("Lion d'Or");
  });

  it('give the units first names drawn anew for each match, never twice in one (2026-10-25)', () => {
    const ids = Array.from({ length: 24 }, (_, i) => i + 1);
    nameHouses(42);
    const a = ids.map(unitName);
    expect(new Set(a).size).toBe(24);
    for (const n of a) expect(UNIT_NAMES).toContain(n);
    nameHouses(42);
    expect(ids.map(unitName)).toEqual(a);
    nameHouses(43);
    expect(ids.map(unitName)).not.toEqual(a);
    nameHouses(null);
    expect(unitName(1)).toBe('Godefroy');
  });
});
