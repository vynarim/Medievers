// Heraldic houses (GDD §3.3). Colours are palette tokens (ASSETS §1.2).

export interface FactionDef {
  readonly id: string;
  /** i18n key of the house name */
  readonly nameKey: string;
  /** 0xRRGGBB, primary tincture */
  readonly primary: number;
  /** 0xRRGGBB, secondary tincture */
  readonly secondary: number;
  /**
   * 0xRRGGBB: the house's name and its units' names are written in this, readable on vellum and
   * on gold; the primary tincture unless it is too light for that (ochre)
   */
  readonly ink: number;
}

export const FACTIONS: readonly FactionDef[] = [
  { id: 'lion', nameKey: 'factions.lion', primary: 0xb8322a, secondary: 0xd4a93c, ink: 0xb8322a },
  {
    id: 'towers',
    nameKey: 'factions.towers',
    primary: 0x2c4a8c,
    secondary: 0xf3ecd9,
    ink: 0x2c4a8c,
  },
  { id: 'key', nameKey: 'factions.key', primary: 0x4d7a4a, secondary: 0xd4a93c, ink: 0x4d7a4a },
  // Ochre on vellum or gold cannot be read: its names are written in umber.
  {
    id: 'crescent',
    nameKey: 'factions.crescent',
    primary: 0xc99a3e,
    secondary: 0xf3ecd9,
    ink: 0x6b4a2e,
  },
];

/** First names drawn for units (GDD §3.3). */
export const UNIT_NAMES: readonly string[] = [
  'Godefroy',
  'Aubri',
  'Ermengarde',
  'Bertrand',
  'Isabeau',
  'Thibaut',
  'Mahaut',
  'Enguerrand',
  'Aliénor',
  'Gauvain',
  'Perrine',
  'Raoul',
];

/** Display name of a unit. */
export const unitName = (unitId: number): string =>
  UNIT_NAMES[(unitId - 1) % UNIT_NAMES.length] ?? '';
