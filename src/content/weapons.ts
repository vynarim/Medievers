// Weapon definitions (GDD §4). Speeds in sub-px/tick (256 = 1 px), radii in px, times in ticks.
// Only the weapons implemented in src/sim/weapons are listed; the rest arrive with M2 and M4.

export type WeaponId = 'bow' | 'sling' | 'greekFire' | 'crossbow' | 'pitchPot' | 'mace';

/** Fragments a cluster weapon throws when it bursts (pot de poix, GDD §4.1). */
export interface FragmentDef {
  readonly count: number;
  /** HP at the centre of each fragment's blast */
  readonly damage: number;
  /** px: blast radius of each fragment */
  readonly radius: number;
  /** sub-px/tick: launch speed of the fragments */
  readonly speed: number;
}

export interface WeaponDef {
  readonly id: WeaponId;
  /** behaviour implemented in src/sim/weapons */
  readonly behavior: 'directHit' | 'fusedBouncer' | 'cluster' | 'melee';
  /** px; 0 = point projectile */
  readonly projectileRadius: number;
  /** percent of wind acceleration applied (GDD §4.1 « Vent ») */
  readonly windPct: number;
  /** sub-px/tick at full power (power 1024) */
  readonly maxSpeed: number;
  /** HP: direct hit damage, or explosion damage at the centre */
  readonly damage: number;
  /** px: explosion radius; 0 for direct-hit weapons */
  readonly explosionRadius: number;
  /**
   * px: crater a direct-hit projectile digs where it strikes the ground (GDD §4.7), before the
   * material's resistance. Absent from logs recorded before 2026-10-24: no wear.
   */
  readonly chipRadius?: number;
  /** percent of the standard knockback for direct hits (sling: strong recoil) */
  readonly knockbackPct: number;
  /** percent of speed kept on each bounce (fusedBouncer) */
  readonly bouncePct: number;
  /** ticks: default fuse; 0 = no fuse */
  readonly defaultFuse: number;
  /** starting ammunition; -1 = unlimited */
  readonly ammo: number;
  /** the power is always full: only the angle is aimed (crossbow) */
  readonly fixedPower?: boolean;
  /** cluster: the fragments of the burst */
  readonly fragments?: FragmentDef;
  /** px: melee reach, from the body centre along the aim */
  readonly reach?: number;
  /**
   * The fuse is set in turns (GDD §4.1, 2026-10-24): 1 = this turn, after this many ticks;
   * 2 = at the start of the next turn; 3 = in two turns, the pot resting on the map meanwhile.
   * Absent from older logs: a fuse in seconds.
   */
  readonly fuseTurns?: number;
  /** thrown by hand (sling, pots): the slinger's passive applies (GDD §3.2) */
  readonly thrown?: boolean;
  /** its blast leaves burning flames on the ground (rules.flames, GDD §4.1) */
  readonly flames?: boolean;
}

export const WEAPONS: readonly WeaponDef[] = [
  {
    id: 'bow',
    behavior: 'directHit',
    projectileRadius: 0,
    windPct: 100,
    maxSpeed: 24 * 256,
    damage: 35,
    explosionRadius: 0,
    chipRadius: 3,
    knockbackPct: 60,
    bouncePct: 0,
    defaultFuse: 0,
    ammo: -1,
  },
  {
    id: 'sling',
    thrown: true,
    behavior: 'directHit',
    projectileRadius: 2,
    windPct: 100,
    maxSpeed: 20 * 256,
    damage: 25,
    explosionRadius: 0,
    chipRadius: 5,
    knockbackPct: 250,
    bouncePct: 0,
    defaultFuse: 0,
    ammo: -1,
  },
  {
    id: 'greekFire',
    thrown: true,
    flames: true,
    behavior: 'fusedBouncer',
    projectileRadius: 5,
    windPct: 0,
    maxSpeed: 18 * 256,
    damage: 45,
    explosionRadius: 60,
    knockbackPct: 100,
    bouncePct: 45,
    // One turn: the fuse buttons read 1 to 3 turns for this pot.
    defaultFuse: 60,
    ammo: 3,
    fuseTurns: 3 * 60,
  },
  {
    id: 'crossbow',
    behavior: 'directHit',
    projectileRadius: 0,
    windPct: 40,
    maxSpeed: 30 * 256,
    damage: 45,
    explosionRadius: 0,
    chipRadius: 4,
    knockbackPct: 80,
    bouncePct: 0,
    defaultFuse: 0,
    ammo: 2,
    fixedPower: true,
  },
  {
    id: 'pitchPot',
    thrown: true,
    behavior: 'cluster',
    projectileRadius: 5,
    windPct: 0,
    maxSpeed: 17 * 256,
    damage: 30,
    explosionRadius: 50,
    knockbackPct: 100,
    bouncePct: 40,
    defaultFuse: 3 * 60,
    ammo: 1,
    fragments: { count: 5, damage: 15, radius: 30, speed: 6 * 256 },
  },
  {
    id: 'mace',
    behavior: 'melee',
    projectileRadius: 0,
    windPct: 0,
    maxSpeed: 0,
    damage: 30,
    explosionRadius: 0,
    knockbackPct: 320,
    bouncePct: 0,
    defaultFuse: 0,
    ammo: -1,
    reach: 34,
  },
];
