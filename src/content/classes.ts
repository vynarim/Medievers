// Unit classes (GDD §3.2): the arsenal is shared, each class adds one passive and its drawback.
// Percentages are applied to the shared value (100 = unchanged).

export type ClassId = 'knight' | 'archer' | 'slinger' | 'sapper' | 'cleric' | 'king';

export const CLASS_IDS: readonly ClassId[] = [
  'knight',
  'archer',
  'slinger',
  'sapper',
  'cleric',
  'king',
];

export interface ClassRules {
  readonly knight: {
    /** Haubert: percent of explosion damage taken */
    readonly blastTakenPct: number;
    /** heavy: percent of the jump speeds (84 % ≈ −30 % of reach and height) */
    readonly jumpPct: number;
  };
  readonly archer: {
    /** Œil exercé: percent of the aim preview length, with the bow and the crossbow */
    readonly previewPct: number;
  };
  readonly slinger: {
    /** Bras souple: percent of the top speed of thrown weapons (sling, pots) */
    readonly throwPct: number;
    /** HP added to the starting HP (negative: fewer) */
    readonly hpDelta: number;
  };
  readonly sapper: {
    /** Maître d'œuvre: percent of the digging speed (pick and sap arrive with BACKLOG M4) */
    readonly digPct: number;
  };
  readonly cleric: {
    /** Bénédiction: HP given at the end of the cleric's own turn to each ally in reach */
    readonly blessHp: number;
    /** px */
    readonly blessRadius: number;
  };
  readonly king: {
    /** Majesté: percent of the damage dealt by allies within reach of the king */
    readonly auraPct: number;
    /** px */
    readonly auraRadius: number;
    readonly hpDelta: number;
  };
}

export const CLASS_RULES: ClassRules = {
  knight: { blastTakenPct: 75, jumpPct: 84 },
  archer: { previewPct: 200 },
  slinger: { throwPct: 115, hpDelta: -10 },
  sapper: { digPct: 200 },
  cleric: { blessHp: 10, blessRadius: 120 },
  king: { auraPct: 110, auraRadius: 200, hpDelta: -20 },
};

/**
 * Default line-up of a house, cut to its number of units (GDD §3.2: free composition, one king at
 * most). In Régicide the king is always among them.
 */
export function defaultLineup(units: number, regicide: boolean): ClassId[] {
  const order: readonly ClassId[] = regicide
    ? ['king', 'knight', 'archer', 'slinger', 'cleric', 'sapper']
    : ['knight', 'archer', 'slinger', 'cleric', 'sapper', 'king'];
  return Array.from({ length: units }, (_, i) => order[i % order.length] ?? 'knight');
}

/** ticks of flight the aim preview shows by default (GDD §8.1: limited length) */
export const AIM_PREVIEW_TICKS = 22;
