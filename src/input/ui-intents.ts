// Intents from the on-screen action bar (mouse and touch), merged into the local input each tick.
import type { WeaponId } from '../content/weapons.ts';

export class UiIntents {
  /** walking button held: -1 left, 1 right */
  walk: -1 | 0 | 1 = 0;
  /** aim button held: the aim sweeps all the way round */
  spin = false;
  /** fire button held (gauge) */
  charge = false;
  jump: 'forward' | 'back' | null = null;
  selectWeapon: WeaponId | null = null;
  fuse: number | null = null;
  skip = false;
  /** a unit of the active team clicked to play it this turn */
  selectUnit: number | null = null;

  /** Returns and clears the one-shot intents. */
  take(): {
    jump: UiIntents['jump'];
    selectWeapon: WeaponId | null;
    fuse: number | null;
    skip: boolean;
    selectUnit: number | null;
  } {
    const out = {
      jump: this.jump,
      selectWeapon: this.selectWeapon,
      fuse: this.fuse,
      skip: this.skip,
      selectUnit: this.selectUnit,
    };
    this.jump = null;
    this.selectWeapon = null;
    this.fuse = null;
    this.skip = false;
    this.selectUnit = null;
    return out;
  }
}
