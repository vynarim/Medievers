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

/**
 * First names of the units (GDD §3.3): old French names, women's and men's. Each match draws
 * its own from them (2026-10-25: there were 12, always in the same order), see setUnitNames.
 */
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
  'Adalbert',
  'Adèle',
  'Agnès',
  'Aimery',
  'Alix',
  'Amaury',
  'Anseau',
  'Arnaud',
  'Aude',
  'Audouin',
  'Aymon',
  'Baudouin',
  'Béatrix',
  'Bérenger',
  'Berthe',
  'Blanche',
  'Bohémond',
  'Brunehaut',
  'Clémence',
  'Clotilde',
  'Constance',
  'Dreux',
  'Ermessinde',
  'Erard',
  'Eudes',
  'Eustache',
  'Florent',
  'Foulques',
  'Galeran',
  'Garin',
  'Gautier',
  'Geoffroy',
  'Gerberge',
  'Gervais',
  'Gilles',
  'Girard',
  'Gisèle',
  'Grimoald',
  'Guérin',
  'Guibert',
  'Guillemette',
  'Guillaume',
  'Guiot',
  'Hadewige',
  'Hawise',
  'Hélisende',
  'Héloïse',
  'Herbert',
  'Hersende',
  'Hildegarde',
  'Hugues',
  'Hubert',
  'Humbert',
  'Ide',
  'Imbert',
  'Jacquette',
  'Jehan',
  'Jeanne',
  'Josselin',
  'Jourdain',
  'Lambert',
  'Landry',
  'Léger',
  'Letgarde',
  'Liétaud',
  'Mabille',
  'Mathilde',
  'Melisende',
  'Milon',
  'Nicolette',
  'Odon',
  'Oriane',
  'Osmond',
  'Pernelle',
  'Pétronille',
  'Philippa',
  'Pons',
  'Raimbaud',
  'Raymond',
  'Regnault',
  'Richilde',
  'Robert',
  'Roger',
  'Rolande',
  'Rotrou',
  'Sanche',
  'Sibylle',
  'Simon',
  'Tancrède',
  'Thierry',
  'Ursule',
  'Waleran',
  'Wauthier',
  'Yolande',
  'Yseult',
  'Yvain',
  'Ysabel',
  'Zélie',
  'Anseïs',
  'Aiglantine',
  'Barthélemy',
  'Cunégonde',
  'Ganelon',
];

/** The names of this match's units, in unit id order: UNIT_NAMES drawn anew, or as they are. */
let matchNames: readonly string[] = UNIT_NAMES;

/** The units of this match take these names (a draw of UNIT_NAMES); null: back to the list. */
export function setUnitNames(names: readonly string[] | null): void {
  matchNames = names && names.length > 0 ? names : UNIT_NAMES;
}

/** Display name of a unit. */
export const unitName = (unitId: number): string =>
  matchNames[(unitId - 1) % matchNames.length] ?? '';
