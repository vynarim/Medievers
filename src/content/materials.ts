// Mask PNG colours and gameplay properties of each terrain material (TECH_SPEC §4.2).
import { Material, type MaskColor, type MaterialId } from '../sim/terrain/material.ts';

/** Exact colours of the mask PNG. Air is any fully transparent pixel. */
export const MASK_PALETTE: readonly MaskColor[] = [
  { material: Material.Earth, r: 139, g: 94, b: 52 }, // #8b5e34
  { material: Material.Rock, r: 96, g: 96, b: 104 }, // #606068
  { material: Material.BuiltStone, r: 200, g: 196, b: 184 }, // #c8c4b8
  { material: Material.Wood, r: 176, g: 112, b: 48 }, // #b07030
  { material: Material.Ladder, r: 255, g: 0, b: 255 }, // #ff00ff
];

export interface MaterialDef {
  readonly id: MaterialId;
  /** Blocks units and projectiles. */
  readonly solid: boolean;
  /** Walkable by units without being solid (ladders). */
  readonly climbable: boolean;
  /** Can be carved by explosions and digging. */
  readonly destructible: boolean;
  /** Carve resistance in percent: 100 = earth; a radius is divided by resistance / 100. */
  readonly resistancePct: number;
}

export const MATERIALS: readonly MaterialDef[] = [
  { id: Material.Air, solid: false, climbable: false, destructible: false, resistancePct: 0 },
  { id: Material.Earth, solid: true, climbable: false, destructible: true, resistancePct: 100 },
  { id: Material.Rock, solid: true, climbable: false, destructible: false, resistancePct: 0 },
  {
    id: Material.BuiltStone,
    solid: true,
    climbable: false,
    destructible: true,
    resistancePct: 150,
  },
  { id: Material.Wood, solid: true, climbable: false, destructible: true, resistancePct: 100 },
  { id: Material.Ladder, solid: false, climbable: true, destructible: true, resistancePct: 100 },
];

/** MATERIALS reshaped for the terrain, indexed by material id. */
export const MATERIAL_RULES = {
  solid: MATERIALS.map((m) => m.solid),
  destructible: MATERIALS.map((m) => m.destructible),
  resistancePct: MATERIALS.map((m) => m.resistancePct),
};
