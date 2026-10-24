// Intents from the on-screen action bar (mouse and touch), merged into the local input each tick.
import type { WeaponId } from '../content/weapons.ts';

export class UiIntents {
  /** walking button held: -1 left, 1 right */
  walk: -1 | 0 | 1 = 0;
  /** ↑ or ↓ held on a ladder: -1 up, 1 down */
  climb: -1 | 0 | 1 = 0;
  /** aim button held: the aim sweeps all the way round */
  spin = false;
  /** fire button held (gauge) */
  charge = false;
  /** fire button pressed since the last tick, even if already let go */
  firePressed = false;
  /** px: map point clicked to aim a targeted weapon */
  target: { x: number; y: number } | null = null;
  jump: 'forward' | 'back' | null = null;
  /** side of the jump (arc buttons); null: the side the unit faces */
  jumpDir: -1 | 1 | null = null;
  selectWeapon: WeaponId | null = null;
  fuse: number | null = null;
  skip = false;
  /** a unit of the active team clicked to play it this turn */
  selectUnit: number | null = null;
  /** px: map column clicked during the placement */
  place: number | null = null;
  /** « Grimper » pressed: a rope up or down the wall at hand */
  rope = false;

  /** Returns and clears the one-shot intents. */
  take(): {
    jump: UiIntents['jump'];
    jumpDir: UiIntents['jumpDir'];
    selectWeapon: WeaponId | null;
    fuse: number | null;
    skip: boolean;
    selectUnit: number | null;
    place: number | null;
    firePressed: boolean;
    target: UiIntents['target'];
    rope: boolean;
  } {
    const out = {
      jump: this.jump,
      jumpDir: this.jumpDir,
      selectWeapon: this.selectWeapon,
      fuse: this.fuse,
      skip: this.skip,
      selectUnit: this.selectUnit,
      place: this.place,
      firePressed: this.firePressed,
      target: this.target,
      rope: this.rope,
    };
    this.rope = false;
    this.firePressed = false;
    this.target = null;
    this.jump = null;
    this.jumpDir = null;
    this.selectWeapon = null;
    this.fuse = null;
    this.skip = false;
    this.selectUnit = null;
    this.place = null;
    return out;
  }
}
