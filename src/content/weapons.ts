// Weapon definitions (GDD §4). Speeds in sub-px/tick (256 = 1 px), radii in px, times in ticks.
// Only the weapons implemented in src/sim/weapons are listed; the rest arrive with M2 and M4.

export type WeaponId = 'bow' | 'sling' | 'greekFire';

export interface WeaponDef {
  readonly id: WeaponId;
  /** behaviour implemented in src/sim/weapons */
  readonly behavior: 'directHit' | 'fusedBouncer';
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
  /** percent of the standard knockback for direct hits (sling: strong recoil) */
  readonly knockbackPct: number;
  /** percent of speed kept on each bounce (fusedBouncer) */
  readonly bouncePct: number;
  /** ticks: default fuse; 0 = no fuse */
  readonly defaultFuse: number;
  /** starting ammunition; -1 = unlimited */
  readonly ammo: number;
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
    knockbackPct: 60,
    bouncePct: 0,
    defaultFuse: 0,
    ammo: -1,
  },
  {
    id: 'sling',
    behavior: 'directHit',
    projectileRadius: 2,
    windPct: 100,
    maxSpeed: 20 * 256,
    damage: 25,
    explosionRadius: 0,
    knockbackPct: 250,
    bouncePct: 0,
    defaultFuse: 0,
    ammo: -1,
  },
  {
    id: 'greekFire',
    behavior: 'fusedBouncer',
    projectileRadius: 5,
    windPct: 0,
    maxSpeed: 18 * 256,
    damage: 45,
    explosionRadius: 60,
    knockbackPct: 100,
    bouncePct: 45,
    defaultFuse: 3 * 60,
    ammo: -1,
  },
];

export function weaponIndex(id: WeaponId): number {
  const i = WEAPONS.findIndex((w) => w.id === id);
  if (i < 0) throw new Error(`unknown weapon ${id}`);
  return i;
}
