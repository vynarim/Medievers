import { describe, expect, it } from 'vitest';
import { houseName, nameHouses } from '../../src/ui/house-names.ts';

describe('house names', () => {
  it('are drawn from the seed: the same for the same match, different from one to the next', () => {
    nameHouses(42);
    const a = [0, 1, 2, 3].map(houseName);
    nameHouses(42);
    expect([0, 1, 2, 3].map(houseName)).toEqual(a);
    expect(new Set(a).size).toBe(4);
    for (const n of a) expect(n).toMatch(/^Maison (du |de la |de l'|des Trois )/);
    nameHouses(43);
    expect([0, 1, 2, 3].map(houseName)).not.toEqual(a);
  });

  it('fall back on the heraldic names outside a match', () => {
    nameHouses(null);
    expect(houseName(0)).toBe("Maison du Lion d'Or");
  });
});
