// Heraldic houses (GDD §3.3). Colours are palette tokens (ASSETS §1.2).

export interface FactionDef {
  readonly id: string;
  /** i18n key of the house name */
  readonly nameKey: string;
  /** 0xRRGGBB, primary tincture */
  readonly primary: number;
  /** 0xRRGGBB, secondary tincture */
  readonly secondary: number;
}

export const FACTIONS: readonly FactionDef[] = [
  { id: 'lion', nameKey: 'factions.lion', primary: 0xb8322a, secondary: 0xd4a93c },
  { id: 'towers', nameKey: 'factions.towers', primary: 0x2c4a8c, secondary: 0xf3ecd9 },
  { id: 'key', nameKey: 'factions.key', primary: 0x4d7a4a, secondary: 0xd4a93c },
  { id: 'crescent', nameKey: 'factions.crescent', primary: 0x6f93c9, secondary: 0xf3ecd9 },
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
