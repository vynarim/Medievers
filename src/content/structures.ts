// Structures with hit points (GDD §4.7, TECH_SPEC §5.4): towers, walls, bridges, scaffolds. Each
// map declares its structures (map.json `structures`); their HP and how hard each weapon hits
// them live here. Percentages apply to the weapon's damage (100 = as on a unit).
import type { WeaponId } from './weapons.ts';

export type StructureType = 'tower' | 'woodTower' | 'wall' | 'bridge' | 'scaffold';

export interface StructureDef {
  readonly hp: number;
  /** percent of a weapon's damage this structure takes; absent weapons: defaultPct */
  readonly weaponPct: Partial<Readonly<Record<WeaponId, number>>>;
  /** percent for any other blast (barrels, reliquaries) */
  readonly defaultPct: number;
}

/** Stone: arrows barely scratch it, fire licks it; wood: fire eats it twice as fast. */
const STONE: Omit<StructureDef, 'hp'> = {
  weaponPct: { bow: 25, crossbow: 25, sling: 40, mace: 50, greekFire: 100, pitchPot: 80 },
  defaultPct: 100,
};
const WOOD: Omit<StructureDef, 'hp'> = {
  weaponPct: { bow: 50, crossbow: 60, sling: 50, mace: 100, greekFire: 200, pitchPot: 200 },
  defaultPct: 100,
};

export interface StructureRules {
  readonly defs: Readonly<Record<StructureType, StructureDef>>;
  /** percent of its HP at or under which a structure shows cracks (GDD §4.7: 66) */
  readonly crackedPct: number;
  /** percent of its HP at or under which it is a ruin (GDD §4.7: 33) */
  readonly ruinPct: number;
  /** px: largest side of the blocks a collapsing structure breaks into (TECH_SPEC §5.4: 32) */
  readonly blockSize: number;
  /** percent of a block's height left as rubble where it lands; the rest goes up in dust */
  readonly rubblePct: number;
  /** px a block must have fallen for each HP it takes from a unit it lands on */
  readonly crushPxPerHp: number;
  /** HP: least and most a falling block takes from a unit */
  readonly crushMin: number;
  readonly crushMax: number;
  /**
   * px: height of the towers the match builds on the map (placements with `build`), above the
   * ground at their middle (2026-10-25)
   */
  readonly towerHeight: number;
  /**
   * percent of a tower's or a wall's columns that must still stand on the ground: under it, the
   * structure is undermined and collapses, toppling towards its void (2026-10-25). Absent from
   * older logs: nothing collapses for want of ground.
   */
  readonly supportPct?: number;
  /**
   * px: height of the wooden towers the match builds (a timber keep on its motte, 2026-10-25),
   * above the top of their motte. Absent: towerHeight.
   */
  readonly woodTowerHeight?: number;
  /**
   * turns a wooden tower burns once a fire weapon (`flames`, the Greek fire) reaches it: it burns
   * down from the top a little at each turn's end and is gone after this many; whoever is still
   * on it then dies (2026-10-25). Absent: wooden towers do not catch fire.
   */
  readonly burnTurns?: number;
}

export const STRUCTURE_RULES: StructureRules = {
  defs: {
    tower: { hp: 240, ...STONE },
    woodTower: { hp: 140, ...WOOD },
    wall: { hp: 160, ...STONE },
    bridge: { hp: 90, ...WOOD },
    scaffold: { hp: 60, ...WOOD },
  },
  crackedPct: 66,
  ruinPct: 33,
  blockSize: 32,
  rubblePct: 40,
  crushPxPerHp: 4,
  crushMin: 10,
  crushMax: 40,
  towerHeight: 320,
  supportPct: 50,
  woodTowerHeight: 220,
  burnTurns: 4,
};

/**
 * A structure as a map declares it: either a px rectangle [x, y, w, h] over its pixels in the
 * mask, or a tower the match builds on the ground (`build`), as high as rules.towerHeight.
 */
export type StructurePlacement =
  | {
      readonly id: number;
      readonly type: StructureType;
      readonly rect: readonly [number, number, number, number];
    }
  | {
      readonly id: number;
      /** a stone tower, or a wooden one (a timber keep, as on a motte castrale) */
      readonly type: 'tower' | 'woodTower';
      /** px: left edge and width of the tower; the side of its ladder (-1 west, 1 east) */
      readonly build: { readonly x: number; readonly width: number; readonly ladder: -1 | 1 };
    };

/** Structure states, as the sim stores them. */
export const StructureState = { Intact: 0, Cracked: 1, Ruin: 2, Fallen: 3 } as const;
