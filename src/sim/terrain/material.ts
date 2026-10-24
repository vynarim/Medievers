// Material ids stored in the collision mask, one byte per pixel (TECH_SPEC §4.2).

export const Material = {
  Air: 0,
  Earth: 1,
  Rock: 2,
  BuiltStone: 3,
  Wood: 4,
  Ladder: 5,
  /** masonry seen behind the play (a tower's body): drawn, not an obstacle (2026-10-25) */
  Backdrop: 6,
  /** timber seen behind the play (a wooden tower's body): drawn, not an obstacle (2026-10-25) */
  Timber: 7,
} as const;

export type MaterialId = (typeof Material)[keyof typeof Material];

export const MATERIAL_COUNT = 8;

/** Colour of a material in the source mask PNG. */
export interface MaskColor {
  readonly material: MaterialId;
  /** 0..255 */
  readonly r: number;
  /** 0..255 */
  readonly g: number;
  /** 0..255 */
  readonly b: number;
}
