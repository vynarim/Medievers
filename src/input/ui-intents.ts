// Intents from the on-screen action bar (mouse and touch), merged into the local input each tick.
import type { WeaponId } from '../content/weapons.ts';

export class UiIntents {
  /** walking button held: -1 left, 1 right */
  walk: -1 | 0 | 1 = 0;
  /** aim button held: 1 raises the aim, -1 lowers it */
  aim: -1 | 0 | 1 = 0;
  /** fire button held (gauge) */
  charge = false;
  /** turn around, keeping the elevation */
  flip = false;
  jump: 'forward' | 'back' | null = null;
  selectWeapon: WeaponId | null = null;
  fuse: number | null = null;
  skip = false;

  /** Returns and clears the one-shot intents. */
  take(): {
    jump: UiIntents['jump'];
    selectWeapon: WeaponId | null;
    fuse: number | null;
    skip: boolean;
    flip: boolean;
  } {
    const out = {
      jump: this.jump,
      selectWeapon: this.selectWeapon,
      fuse: this.fuse,
      skip: this.skip,
      flip: this.flip,
    };
    this.jump = null;
    this.selectWeapon = null;
    this.fuse = null;
    this.skip = false;
    this.flip = false;
    return out;
  }
}
