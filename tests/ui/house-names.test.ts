import { describe, expect, it } from 'vitest';
import { houseName, houseShortName, nameHouses } from '../../src/ui/house-names.ts';

describe('house names', () => {
  it('are drawn from the seed: the same for the same match, different from one to the next', () => {
    nameHouses(42);
    const a = [0, 1, 2, 3].map(houseName);
    nameHouses(42);
    expect([0, 1, 2, 3].map(houseName)).toEqual(a);
    expect(new Set(a).size).toBe(4);
    for (const n of a) expect(n).toMatch(/^Maison (du |de la |de l'|des Trois )/);
    for (const n of [0, 1, 2, 3].map(houseShortName)) expect(n).not.toMatch(/^(Maison|du |de |des )/);
    nameHouses(43);
    expect([0, 1, 2, 3].map(houseName)).not.toEqual(a);
  });

  it('fall back on the heraldic names outside a match', () => {
    nameHouses(null);
    expect(houseName(0)).toBe("Maison du Lion d'Or");
    expect(houseShortName(0)).toBe("Lion d'Or");
  });
});
