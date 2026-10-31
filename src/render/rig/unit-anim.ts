// Which animation a unit plays (ASSETS §3.4), read from the state of the sim and its events:
// idle, walk, jump, fall, land, tumble, aim and fire, hurt, death. Pure, like the runtime: the
// battle scene feeds it what it reads and shows the pose it gets.
import type { WeaponId } from '../../content/weapons.ts';
import type { AnimDef, RigDef } from './format.ts';
import { AnimPlayer } from './runtime.ts';

/** The aiming poses of ASSETS §3.4; each has its aim_<pose> and fire_<pose>. */
export type AimPose = 'bow' | 'crossbow' | 'sling' | 'throw' | 'melee' | 'pointer';

/** The pose each tool is aimed in; null: none (tools at work, siege engines). */
export const AIM_POSE: Readonly<Record<WeaponId, AimPose | null>> = {
  bow: 'bow',
  fireArrow: 'bow',
  crossbow: 'crossbow',
  sling: 'sling',
  greekFire: 'throw',
  pitchPot: 'throw',
  flamingPig: 'throw',
  beehive: 'throw',
  falcon: 'throw',
  caltrop: 'throw',
  grapple: 'throw',
  trebuchet: 'pointer',
  arrowRain: 'pointer',
  miracle: 'pointer',
  mace: 'melee',
  sword: 'melee',
  shieldCharge: 'melee',
  ladder: null,
  banner: null,
  pick: null,
  sap: null,
  stoneWall: null,
  ballista: null,
  scorpion: null,
  catapult: null,
  greatTrebuchet: null,
  siegeRam: null,
};

/**
 * A pose a rig has no animation for yet (the P1 ones) borrows another's; its held tool, which
 * would be the wrong one, is hidden.
 */
const POSE_FALLBACK: Readonly<Record<AimPose, AimPose | null>> = {
  bow: null,
  throw: null,
  crossbow: 'bow',
  sling: 'throw',
  melee: 'throw',
  pointer: 'throw',
};

/** What the animator reads of a unit, at each frame. */
export interface UnitAnimInput {
  readonly alive: boolean;
  readonly grounded: boolean;
  readonly knocked: boolean;
  readonly climbing: boolean;
  /** px per tick, last tick's move (interpolation) */
  readonly dx: number;
  readonly dy: number;
  /** sub-px per tick */
  readonly vy: number;
  readonly facing: -1 | 1;
  /** the pose it aims in, when it is the unit that plays and may shoot; null otherwise */
  readonly aiming: AimPose | null;
  /** degrees, in the unit's frame: 0 straight ahead, positive downward */
  readonly aimDeg: number;
}

/** px per tick: slower than this, a unit on the ground stands */
const WALK_MIN = 0.25;
/** seconds in the air before touching down plays `land` */
const LAND_AFTER = 0.18;
/** degrees: the arms never aim further back than this */
const AIM_LIMIT = 110;

/** Animation for a unit in the air or on the ground, before any one-shot (land, hurt, fire). */
export function baseAnim(s: UnitAnimInput): string {
  if (!s.grounded && s.knocked) return 'fly_tumble';
  if (!s.grounded && !s.climbing) {
    if (s.vy < 0) return s.dx * s.facing >= 0 ? 'jump_forward' : 'jump_back';
    return 'fall';
  }
  if (Math.abs(s.dx) >= WALK_MIN || (s.climbing && Math.abs(s.dy) >= WALK_MIN)) return 'walk';
  if (s.aiming) return `aim_${s.aiming}`;
  return 'idle';
}

/** One figure's animator: the base animation from its state, one-shots from its events. */
export class UnitAnimator {
  readonly player: AnimPlayer;
  /** a one-shot asked for, started at the next update */
  private pending: string | null = null;
  /** the one-shot playing, resolved */
  private oneShot: string | null = null;
  private oneShotBorrowed = false;
  /** seconds in the air so far */
  private air = 0;
  private dying = false;
  /** the death is over: the figure gives way to its tombstone */
  gone: boolean;

  constructor(rig: RigDef, anims: ReadonlyMap<string, AnimDef>, alive = true) {
    this.player = new AnimPlayer(rig, anims);
    this.gone = !alive;
    this.player.play('idle');
  }

  /** `want`, or what stands in for it, and whether it is borrowed from another pose. */
  resolve(want: string): [string, boolean] {
    if (this.player.has(want)) return [want, false];
    const m = /^(aim|fire)_(\w+)$/.exec(want);
    if (m) {
      let pose = POSE_FALLBACK[m[2] as AimPose] ?? null;
      while (pose && !this.player.has(`${m[1]}_${pose}`)) pose = POSE_FALLBACK[pose];
      if (pose) return [`${m[1]}_${pose}`, true];
    }
    return ['idle', false];
  }

  /** It took a blow: flinches, unless it is dead. */
  hurt(): void {
    if (!this.dying && !this.gone) this.pending = 'hurt';
  }

  /** It let fly with a tool aimed in `pose`. */
  fire(pose: AimPose): void {
    if (!this.dying && !this.gone) this.pending = `fire_${pose}`;
  }

  /**
   * Moves on by `dt` seconds with the unit's state `s`; returns the animation events passed
   * (`step`, `release`, `dust`...).
   */
  update(s: UnitAnimInput, dt: number): string[] {
    const p = this.player;
    const fired: string[] = [];
    if (this.gone) return fired;
    if (!s.alive) {
      if (!this.dying) {
        this.dying = true;
        p.hiddenSlot = null;
        fired.push(...p.play('death', true));
      }
      fired.push(...p.update(dt));
      if (p.finished) this.gone = true;
      return fired;
    }
    const airborne = !s.grounded && !s.climbing;
    if (airborne) this.air += dt;
    else {
      if (this.air >= LAND_AFTER && !s.knocked && !this.pending) this.pending = 'land';
      this.air = 0;
    }
    // Flying from a blast wins over everything but the death.
    if (airborne && s.knocked) {
      this.pending = null;
      this.oneShot = null;
    }
    p.aimDeg = Math.max(-AIM_LIMIT, Math.min(AIM_LIMIT, s.aimDeg));

    if (this.pending) {
      const [id, borrowed] = this.resolve(this.pending);
      this.pending = null;
      this.oneShot = id;
      this.oneShotBorrowed = borrowed;
      p.hiddenSlot = borrowed ? 'weapon' : null;
      fired.push(...p.play(id, true));
    } else if (this.oneShot && (p.playing !== this.oneShot || p.finished)) {
      this.oneShot = null;
    }
    if (!this.oneShot) {
      const [id, borrowed] = this.resolve(baseAnim(s));
      p.hiddenSlot = borrowed ? 'weapon' : null;
      fired.push(...p.play(id));
    } else p.hiddenSlot = this.oneShotBorrowed ? 'weapon' : null;
    fired.push(...p.update(dt));
    return fired;
  }
}
