// Turns raw player input (keys held, presses, drags) into GameCommands, one tick at a time
// (GDD §8). Pure logic, so it is tested in Node; the Phaser adapter only fills RawInput.
import { isTargeted, usesPower, type WeaponDef, type WeaponId } from '../content/weapons.ts';
import { MAX_POWER, type GameCommand } from '../sim/commands.ts';
import { atan2Bam } from '../sim/math/angle.ts';
import type { SimView } from '../sim/sim.ts';
import { canClimb, ropeTarget } from '../sim/units/climb.ts';

/** Input state sampled once per tick. Presses are edges: true on the tick of the press only. */
export interface RawInput {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jumpPressed: boolean;
  /** direct jump from a button, no double-press detection */
  jumpKind: 'forward' | 'back' | null;
  /** side of a button jump (arc buttons); null: the side the unit faces */
  jumpDir: -1 | 1 | null;
  /** weapon chosen in the arsenal */
  selectWeapon: WeaponId | null;
  skipPressed: boolean;
  /** unit of the active team chosen to play this turn */
  selectUnit: number | null;
  /** px: map column chosen for the next unit, during the placement */
  place: number | null;
  /** ↑ / ↓ buttons held on a ladder: -1 up, 1 down */
  climb: -1 | 0 | 1;
  /** charge key held (gauge aiming) */
  charge: boolean;
  /** fire pressed this tick (an edge, kept even if released before the tick) */
  firePressed: boolean;
  /** px: map point clicked to aim a targeted weapon (stone wall, trebuchet volley) */
  target: { readonly x: number; readonly y: number } | null;
  nextWeaponPressed: boolean;
  /** turn around on the spot, keeping the elevation */
  flipPressed: boolean;
  /** « Grimper » (G): a rope up the wall in front, or down the drop in front */
  ropePressed: boolean;
  /** aim button held: the aim sweeps all the way round, turning the unit as it passes behind */
  spin: boolean;
  /** 1..5 when a fuse key was pressed this tick */
  fusePressed: number | null;
  /** arrowhead dragged: pointer position relative to the unit's body centre, in world px */
  aimAt: { readonly x: number; readonly y: number } | null;
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
  jumpDir: null,
  selectWeapon: null,
  skipPressed: false,
  selectUnit: null,
  place: null,
  climb: 0,
  ropePressed: false,
  charge: false,
  firePressed: false,
  target: null,
  nextWeaponPressed: false,
  flipPressed: false,
  spin: false,
  fusePressed: null,
  aimAt: null,
  drag: null,
});

/** BAM per tick while an aim key is held (≈ 1.4°). */
export const AIM_SPEED = 16;
/** BAM per tick while the aim button is held: a full turn in about 3 s. */
export const SPIN_SPEED = 24;
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

/** Which way a rope takes the unit: -1 up the wall in front, 1 down the drop in front, 0 none. */
export function ropeDir(
  view: SimView,
  u: { readonly x: number; readonly y: number; readonly facing: -1 | 1 },
): -1 | 0 | 1 {
  const px = u.x >> 8;
  const py = u.y >> 8;
  const rules = view.rules.unit;
  if (ropeTarget(view.terrain, px, py, u.facing, -1, rules)) return -1;
  if (ropeTarget(view.terrain, px, py, u.facing, 1, rules)) return 1;
  return 0;
}

export class LocalControls {
  private walkSent: -1 | 0 | 1 = 0;
  private climbSent: -1 | 0 | 1 = 0;
  /** ↑ and ↓ held on the previous tick: a key already held on reaching a ladder does not climb */
  private upBefore = false;
  private downBefore = false;
  private pendingJumpTick = -1;
  private charging = false;
  /** 0..1024 while charging, for the HUD gauge */
  power = 0;

  /** Commands for this tick, given the current input and the sim view. */
  update(tick: number, input: RawInput, view: SimView): GameCommand[] {
    const out: GameCommand[] = [];
    const turn = view.turn;
    // Choosing the unit is allowed during the transition too, before anything else.
    if (input.selectUnit !== null) out.push({ t: 'selectUnit', unitId: input.selectUnit });
    if (input.place !== null && turn.phase === 'placement') {
      out.push({ t: 'place', x: Math.trunc(input.place) });
    }
    const unit = view.units.find((u) => u.id === turn.activeUnitId);
    const canMove = turn.phase === 'action' || turn.phase === 'retreat';
    const upPressed = input.up && !this.upBefore;
    const downPressed = input.down && !this.downBefore;
    this.upBefore = input.up;
    this.downBefore = input.down;
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
    // At a ladder, a press of ↑ or ↓ (key or button) climbs instead of aiming (GDD §4.4). Climbing
    // is a choice: walking up to a ladder with ↑ or ↓ already held (aiming) does not take it.
    const onLadder = canClimb(view.terrain, unit, view.rules.unit);
    const held = this.climbSent === -1 ? input.up : this.climbSent === 1 ? input.down : false;
    const keyClimb: -1 | 0 | 1 = !onLadder
      ? 0
      : held
        ? this.climbSent
        : upPressed && !input.down
          ? -1
          : downPressed && !input.up
            ? 1
            : 0;
    const climbDir: -1 | 0 | 1 = input.climb !== 0 ? input.climb : keyClimb;
    if (climbDir !== this.climbSent) {
      out.push({ t: 'climb', dir: climbDir });
      this.climbSent = climbDir;
    }
    // « Grimper »: up the wall in front if there is one to climb, else down the drop in front.
    if (input.ropePressed && turn.phase === 'action') {
      const dir = ropeDir(view, unit);
      if (dir !== 0) {
        out.push({ t: 'climb', dir });
        this.climbSent = dir;
      }
    }
    // Turning around (walking or flipping) mirrors the aim so the elevation stays the same.
    const flip = input.flipPressed && dir === 0 && turn.phase === 'action';
    const facing = dir !== 0 ? dir : flip ? -unit.facing : unit.facing;
    let elevation = elevationOf(turn.aim, unit.facing);

    // Jump: one press = forward after a short wait, two presses = backward.
    if (input.jumpKind) {
      const dir = input.jumpDir;
      out.push({ t: 'jump', kind: input.jumpKind, ...(dir !== null ? { dir } : {}) });
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

    if (input.skipPressed) {
      out.push({ t: 'skip' });
      return out;
    }
    // A flaming pig of this unit trotting: a press of Fire sets it off (GDD §4.1).
    if (input.firePressed && view.walkers.some((w) => w.ownerId === unit.id)) {
      out.push({ t: 'fire', power: 0 });
      this.charging = false;
      this.power = 0;
      return out;
    }

    if (turn.phase !== 'action') {
      this.charging = false;
      this.power = 0;
      return out;
    }
    if (input.selectWeapon) out.push({ t: 'selectWeapon', id: input.selectWeapon });
    else if (input.nextWeaponPressed) {
      const ammo = view.teams[turn.activeTeam]?.ammo ?? [];
      out.push({ t: 'selectWeapon', id: nextWeapon(view.rules.weapons, turn.weapon, ammo) });
    }
    if (input.fusePressed !== null && input.fusePressed >= 1 && input.fusePressed <= 5) {
      out.push({ t: 'setFuse', seconds: input.fusePressed as 1 | 2 | 3 | 4 | 5 });
    }

    const def = view.rules.weapons.find((w) => w.id === (input.selectWeapon ?? turn.weapon));
    // A targeted weapon goes where the map was clicked.
    if (input.target && def && isTargeted(def)) {
      out.push({ t: 'fireAt', x: Math.trunc(input.target.x), y: Math.trunc(input.target.y) });
      this.charging = false;
      this.power = 0;
      return out;
    }
    // Weapons without power (mace, pick, sap, chausse-trape) act as soon as fire is pressed.
    if (def && !usesPower(def) && input.firePressed) {
      this.fire(out);
      return out;
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

    if (input.spin) {
      // Counter-clockwise on screen: right, up, left, down. The sim turns the unit to match.
      out.push({ t: 'aim', angle: (turn.aim - SPIN_SPEED) & 4095 });
    } else if (input.aimAt) {
      // Arrowhead dragged: aim at the pointer, on either side (the sim turns the unit).
      const aim = atan2Bam(input.aimAt.y, input.aimAt.x);
      if (aim !== turn.aim) out.push({ t: 'aim', angle: aim });
    } else if (climbDir === 0) {
      // Keyboard aim.
      const delta = (input.up ? AIM_SPEED : 0) - (input.down ? AIM_SPEED : 0);
      elevation = Math.max(-ELEVATION_MAX, Math.min(ELEVATION_MAX, elevation + delta));
      const aim = aimFor(elevation, facing);
      if (aim !== turn.aim) out.push({ t: 'aim', angle: aim });
    }

    // Gauge: hold to charge, release to fire. A full gauge starts again from empty, so the
    // shot only leaves when the button is let go at the right moment.
    if (input.charge && def && !usesPower(def)) {
      // Held on from the press that already struck: nothing more.
    } else if (input.charge) {
      this.charging = true;
      this.power = this.power >= MAX_POWER ? 0 : Math.min(MAX_POWER, this.power + CHARGE_SPEED);
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
    this.climbSent = 0;
    this.pendingJumpTick = -1;
    this.charging = false;
    this.power = 0;
  }
}

/** The next weapon in the arsenal the house still has ammunition for. */
function nextWeapon(
  weapons: readonly WeaponDef[],
  current: WeaponId,
  ammo: readonly number[],
): WeaponId {
  const i = weapons.findIndex((w) => w.id === current);
  for (let k = 1; k <= weapons.length; k++) {
    const j = (i + k) % weapons.length;
    if ((ammo[j] ?? -1) !== 0) return weapons[j]?.id ?? current;
  }
  return current;
}
