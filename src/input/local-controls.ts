// Turns raw player input (keys held, presses, drags) into GameCommands, one tick at a time
// (GDD §8). Pure logic, so it is tested in Node; the Phaser adapter only fills RawInput.
import type { WeaponDef, WeaponId } from '../content/weapons.ts';
import { MAX_POWER, type GameCommand } from '../sim/commands.ts';
import { atan2Bam } from '../sim/math/angle.ts';
import type { SimView } from '../sim/sim.ts';

/** Input state sampled once per tick. Presses are edges: true on the tick of the press only. */
export interface RawInput {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jumpPressed: boolean;
  /** direct jump from a button, no double-press detection */
  jumpKind: 'forward' | 'back' | null;
  /** weapon chosen in the arsenal */
  selectWeapon: WeaponId | null;
  skipPressed: boolean;
  /** charge key held (gauge aiming) */
  charge: boolean;
  nextWeaponPressed: boolean;
  /** turn around on the spot, keeping the elevation */
  flipPressed: boolean;
  /** 1..5 when a fuse key was pressed this tick */
  fusePressed: number | null;
  /** drag-to-aim: pull vector from the unit, in world px (pull back to shoot forward) */
  drag: { readonly pullX: number; readonly pullY: number; readonly released: boolean } | null;
}

export const emptyInput = (): RawInput => ({
  left: false,
  right: false,
  up: false,
  down: false,
  jumpPressed: false,
  jumpKind: null,
  selectWeapon: null,
  skipPressed: false,
  charge: false,
  nextWeaponPressed: false,
  flipPressed: false,
  fusePressed: null,
  drag: null,
});

/** BAM per tick while an aim key is held (≈ 1.4°). */
export const AIM_SPEED = 16;
/** Power gained per tick while charging: full gauge in 1.5 s. */
export const CHARGE_SPEED = Math.ceil(MAX_POWER / 90);
/** Ticks to wait for a second jump press before jumping forward. */
export const DOUBLE_PRESS_TICKS = 12;
/** px of drag for full power. */
export const DRAG_FULL_POWER = 220;
/** BAM: aim limits, straight up and straight down. */
const ELEVATION_MAX = 1024;

/** Elevation in BAM (positive = up) of an aim angle seen from a facing direction. */
export function elevationOf(aim: number, facing: number): number {
  const e = facing > 0 ? (4096 - aim) & 4095 : (aim - 2048) & 4095;
  return e > 2048 ? e - 4096 : e;
}

/** Aim angle for an elevation (positive = up) and a facing direction. */
export function aimFor(elevation: number, facing: number): number {
  return (facing > 0 ? -elevation : 2048 + elevation) & 4095;
}

export class LocalControls {
  private walkSent: -1 | 0 | 1 = 0;
  private pendingJumpTick = -1;
  private charging = false;
  /** 0..1024 while charging, for the HUD gauge */
  power = 0;

  /** Commands for this tick, given the current input and the sim view. */
  update(tick: number, input: RawInput, view: SimView): GameCommand[] {
    const out: GameCommand[] = [];
    const turn = view.turn;
    const unit = view.units.find((u) => u.id === turn.activeUnitId);
    const canMove = turn.phase === 'action' || turn.phase === 'retreat';
    if (!unit || !canMove) {
      this.reset();
      return out;
    }

    // Walking: a persistent state, sent only when it changes.
    const dir: -1 | 0 | 1 = input.left === input.right ? 0 : input.left ? -1 : 1;
    if (dir !== this.walkSent) {
      out.push({ t: 'move', dir });
      this.walkSent = dir;
    }
    // Turning around (walking or flipping) mirrors the aim so the elevation stays the same.
    const flip = input.flipPressed && dir === 0 && turn.phase === 'action';
    const facing = dir !== 0 ? dir : flip ? -unit.facing : unit.facing;
    let elevation = elevationOf(turn.aim, unit.facing);

    // Jump: one press = forward after a short wait, two presses = backward.
    if (input.jumpKind) {
      out.push({ t: 'jump', kind: input.jumpKind });
      this.pendingJumpTick = -1;
    } else if (input.jumpPressed) {
      if (this.pendingJumpTick >= 0) {
        out.push({ t: 'jump', kind: 'back' });
        this.pendingJumpTick = -1;
      } else {
        this.pendingJumpTick = tick + DOUBLE_PRESS_TICKS;
      }
    } else if (this.pendingJumpTick >= 0 && tick >= this.pendingJumpTick) {
      out.push({ t: 'jump', kind: 'forward' });
      this.pendingJumpTick = -1;
    }

    if (turn.phase !== 'action') {
      this.charging = false;
      this.power = 0;
      return out;
    }

    if (input.skipPressed) {
      out.push({ t: 'skip' });
      return out;
    }
    if (input.selectWeapon) out.push({ t: 'selectWeapon', id: input.selectWeapon });
    else if (input.nextWeaponPressed) {
      out.push({ t: 'selectWeapon', id: nextWeapon(view.rules.weapons, turn.weapon) });
    }
    if (input.fusePressed !== null && input.fusePressed >= 1 && input.fusePressed <= 5) {
      out.push({ t: 'setFuse', seconds: input.fusePressed as 1 | 2 | 3 | 4 | 5 });
    }

    // Drag-to-aim: the shot goes opposite to the pull, power grows with its length.
    if (input.drag) {
      const { pullX, pullY, released } = input.drag;
      const aim = atan2Bam(-pullY, -pullX);
      const length = Math.trunc(Math.hypot(pullX, pullY));
      this.power = Math.min(MAX_POWER, Math.trunc((length * MAX_POWER) / DRAG_FULL_POWER));
      if (aim !== turn.aim) out.push({ t: 'aim', angle: aim });
      if (released) {
        out.push({ t: 'fire', power: this.power });
        this.power = 0;
      }
      return out;
    }

    // Keyboard aim.
    const delta = (input.up ? AIM_SPEED : 0) - (input.down ? AIM_SPEED : 0);
    elevation = Math.max(-ELEVATION_MAX, Math.min(ELEVATION_MAX, elevation + delta));
    const aim = aimFor(elevation, facing);
    if (aim !== turn.aim) out.push({ t: 'aim', angle: aim });

    // Gauge: hold to charge, release to fire; a full gauge fires by itself.
    if (input.charge) {
      this.charging = true;
      this.power = Math.min(MAX_POWER, this.power + CHARGE_SPEED);
      if (this.power === MAX_POWER) this.fire(out);
    } else if (this.charging) {
      this.fire(out);
    }
    return out;
  }

  private fire(out: GameCommand[]): void {
    out.push({ t: 'fire', power: this.power });
    this.charging = false;
    this.power = 0;
  }

  private reset(): void {
    this.walkSent = 0;
    this.pendingJumpTick = -1;
    this.charging = false;
    this.power = 0;
  }
}

function nextWeapon(weapons: readonly WeaponDef[], current: WeaponId): WeaponId {
  const i = weapons.findIndex((w) => w.id === current);
  return weapons[(i + 1) % weapons.length]?.id ?? current;
}
