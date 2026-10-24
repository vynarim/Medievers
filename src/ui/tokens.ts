// UI colour tokens, aligned on the Maciejowski palette (ASSETS §1.2). No hex elsewhere.

export const COLORS = {
  lapis: 0x2c4a8c,
  azur: 0x6f93c9,
  vermillon: 0xb8322a,
  vertDeGris: 0x4d7a4a,
  ocre: 0xc99a3e,
  terreOmbre: 0x6b4a2e,
  or: 0xd4a93c,
  ceruse: 0xf3ecd9,
  velin: 0xe9dcc0,
  encre: 0x2a1d14,
  carnation: 0xf0cfb0,
  roseGarance: 0xc96a6e,
  vertTendre: 0x8fae6a,
  ciel: 0xcfd8d0,
  /** greybox rock, until the painted maps exist */
  roche: 0x77737a,
} as const;

/** CSS form of a token. */
export const css = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;
