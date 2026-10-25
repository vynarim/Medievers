// How the AI plays a turn it has planned, tick by tick: the same script runs in its sandboxes,
// to score a plan, and on the real match, through AIInputSource, so what was scored is what is
// played. It reads the view and returns the commands of the tick, like a player's hands.
import type { WeaponId } from '../content/weapons.ts';
import type { GameCommand } from '../sim/commands.ts';
import { ANGLE_MASK, angleDelta } from '../sim/math/angle.ts';
import { subToPx } from '../sim/math/fixed.ts';
import type { SimView } from '../sim/sim.ts';

/** Where the unit goes before shooting. */
export type AiMove =
  | { readonly kind: 'stay' }
  /** walks towards x (px) until there, stopped, or out of breath */
  | { readonly kind: 'walk'; readonly x: number }
  | {
      readonly kind: 'jump';
      readonly jump: 'forward' | 'back';
      readonly dir: -1 | 1;
      /** the banner held up first, to come down unhurt (GDD §4.4) */
      readonly banner?: boolean;
    }
  /** the miracle: set down at (x, y) px, the body's middle; it ends the turn */
  | { readonly kind: 'miracle'; readonly x: number; readonly y: number }
  /** a ladder set up against the wall on side `face`, then climbed; it ends the turn */
  | { readonly kind: 'ladder'; readonly face: -1 | 1 }
  /**
   * the grappling hook shot along `angle`, the rope hauled in for at most `haul` ticks (a ledge
   * at the hook hoists the unit onto it), then let go with a jump
   */
  | { readonly kind: 'grapple'; readonly angle: number; readonly haul: number }
  /**
   * « Grimper »: a rope up the wall (dir -1) or down the drop (1) on side `face`; it is the turn's
   * action and ends the turn (rules.unit.wallClimb), so no shot follows
   */
  | { readonly kind: 'rope'; readonly dir: -1 | 1; readonly face: -1 | 1 };

export interface AiShot {
  readonly weapon: WeaponId;
  /** BAM */
  readonly angle: number;
  /** 0..1024 */
  readonly power: number;
  /** a weapon aimed at a point (the trebuchet volley): that point, px */
  readonly at?: { readonly x: number; readonly y: number };
  /** the flaming pig: ticks after it is let loose at which Fire sets it off */
  readonly detonate?: number;
}

/** A turn of the AI: which unit, where it goes, what it shoots; no shot passes the turn. */
export interface AiPlan {
  readonly unitId: number;
  readonly move: AiMove;
  readonly shot: AiShot | null;
}

export interface ScriptPace {
  /** BAM the aim turns by per tick; Infinity: at once */
  readonly aimPerTick: number;
  /** ticks between the shot and « Fin du tour » */
  readonly afterShot: number;
  /** ticks of rest before acting, once the unit stands still */
  readonly settle: number;
}

/** In the sandboxes: everything at once. */
export const SANDBOX_PACE: ScriptPace = { aimPerTick: Infinity, afterShot: 1, settle: 4 };

type Stage =
  | 'select'
  | 'move'
  | 'walking'
  | 'face'
  | 'rope'
  | 'roping'
  | 'banner'
  | 'pray'
  | 'ladder'
  | 'hook'
  | 'hauling'
  | 'settle'
  | 'weapon'
  | 'aim'
  | 'after'
  | 'done';

/** px from the target at which a walk stops */
const WALK_CLOSE = 3;
/** ticks without moving after which a walk is given up (blocked; turning round takes 12) */
const WALK_STUCK = 24;
/** ticks a stage may last at most, so that a plan never hangs the turn */
const STAGE_MAX = 600;

export class TurnScript {
  private stage: Stage = 'select';
  private ticks = 0;
  private lastX = 0;
  private still = 0;
  private readonly plan: AiPlan;
  private readonly pace: ScriptPace;

  constructor(plan: AiPlan, pace: ScriptPace) {
    this.plan = plan;
    this.pace = pace;
  }

  /** The unit has moved and stands still: the shot is next (the sandboxes look around here). */
  get moved(): boolean {
    return this.stage === 'weapon' || this.stage === 'aim' || this.stage === 'after' || this.done;
  }

  get done(): boolean {
    return this.stage === 'done';
  }

  private go(stage: Stage): void {
    this.stage = stage;
    this.ticks = 0;
  }

  /** The commands of the next tick, given the match as it stands. */
  next(v: SimView): GameCommand[] {
    const t = v.turn;
    if (t.phase !== 'action' && t.phase !== 'transition' && t.phase !== 'retreat') return [];
    const u = v.units.find((x) => x.id === t.activeUnitId);
    if (!u?.alive) return [];
    this.ticks++;
    if (this.ticks > STAGE_MAX && this.stage !== 'done') {
      // Something kept the plan from going on: end the turn rather than wait.
      this.go('done');
      return [{ t: 'move', dir: 0 }, { t: 'skip' }];
    }
    const plan = this.plan;
    switch (this.stage) {
      case 'select':
        if (t.phase !== 'action') {
          // The unit may be chosen during the transition already.
          return plan.unitId !== t.activeUnitId ? [{ t: 'selectUnit', unitId: plan.unitId }] : [];
        }
        this.go('move');
        return plan.unitId !== t.activeUnitId ? [{ t: 'selectUnit', unitId: plan.unitId }] : [];
      case 'move': {
        const m = plan.move;
        if (m.kind === 'walk') {
          const dir = m.x > subToPx(u.x) ? 1 : -1;
          if (Math.abs(m.x - subToPx(u.x)) <= WALK_CLOSE) {
            this.go('settle');
            return [];
          }
          this.lastX = u.x;
          this.still = 0;
          this.go('walking');
          return [{ t: 'move', dir }];
        }
        if (m.kind === 'rope' || m.kind === 'ladder') {
          // Turned towards the wall first (on the spot: no walk spent), then the rope or ladder.
          if (u.facing !== m.face) {
            this.go('face');
            return [{ t: 'move', dir: m.face }];
          }
          this.go(m.kind);
          return m.kind === 'ladder' ? [{ t: 'selectWeapon', id: 'ladder' }] : [];
        }
        if (m.kind === 'grapple') {
          this.go('hook');
          return [
            { t: 'selectWeapon', id: 'grapple' },
            { t: 'aim', angle: m.angle },
          ];
        }
        if (m.kind === 'miracle') {
          this.go('pray');
          return [{ t: 'selectWeapon', id: 'miracle' }];
        }
        if (m.kind === 'jump' && m.banner) {
          this.go('banner');
          return [
            { t: 'selectWeapon', id: 'banner' },
            { t: 'fire', power: 0 },
          ];
        }
        this.go('settle');
        if (m.kind === 'jump') return [{ t: 'jump', kind: m.jump, dir: m.dir }];
        return [];
      }
      case 'banner': {
        const m = plan.move;
        this.go('settle');
        return m.kind === 'jump' ? [{ t: 'jump', kind: m.jump, dir: m.dir }] : [];
      }
      case 'hook':
        this.go('hauling');
        return [
          { t: 'fire', power: 0 },
          { t: 'climb', dir: -1 },
        ];
      case 'hauling': {
        const m = plan.move;
        // Hoisted onto a ledge, or never caught: on to the shot.
        if (!t.grapple) {
          this.go('settle');
          return [{ t: 'climb', dir: 0 }];
        }
        if (m.kind === 'grapple' && this.ticks < m.haul) return [];
        this.go('settle');
        return [
          { t: 'climb', dir: 0 },
          { t: 'jump', kind: 'forward' },
        ];
      }
      case 'pray': {
        const m = plan.move;
        this.go('done');
        // Refused (somebody moved there): the turn is passed.
        return m.kind === 'miracle'
          ? [{ t: 'fireAt', x: m.x, y: m.y }, { t: 'skip' }]
          : [{ t: 'skip' }];
      }
      case 'ladder':
        if (t.turnHold > 0) return [];
        // Set up, then climbed: the climb is the turn's action and ends it, as with the rope.
        this.go('roping');
        return [
          { t: 'fire', power: 0 },
          { t: 'climb', dir: -1 },
        ];
      case 'face': {
        const m = plan.move;
        if (m.kind === 'ladder') {
          this.go('ladder');
          return [
            { t: 'move', dir: 0 },
            { t: 'selectWeapon', id: 'ladder' },
          ];
        }
        this.go('rope');
        return [{ t: 'move', dir: 0 }];
      }
      case 'rope': {
        const m = plan.move;
        if (m.kind !== 'rope' || t.turnHold > 0) return [];
        this.go('roping');
        return [{ t: 'climb', dir: m.dir }];
      }
      case 'roping':
        // The rope is thrown and the turn ends at its end; with no rope taken, the turn is passed.
        if (t.climbDir !== 0) return [];
        this.go('done');
        return t.phase === 'action' ? [{ t: 'skip' }] : [];
      case 'walking': {
        const m = plan.move;
        const x = subToPx(u.x);
        const target = m.kind === 'walk' ? m.x : x;
        this.still = u.x === this.lastX ? this.still + 1 : 0;
        this.lastX = u.x;
        const passed = (t.walkDir > 0 && x >= target) || (t.walkDir < 0 && x <= target);
        if (
          Math.abs(target - x) <= WALK_CLOSE ||
          passed ||
          this.still >= WALK_STUCK ||
          t.walkDir === 0 ||
          // Out of breath (rules.unit.moveBudget).
          (v.rules.unit.moveBudget !== undefined && t.moveLeft === 0)
        ) {
          this.go('settle');
          return [{ t: 'move', dir: 0 }];
        }
        return [];
      }
      case 'settle':
        if (!u.grounded || u.vx !== 0 || u.vy !== 0) this.ticks = Math.min(this.ticks, 0);
        if (this.ticks < this.pace.settle) return [];
        if (t.phase !== 'action') {
          // Hurt or out of time on the way: the turn is over anyway.
          this.go('done');
          return [];
        }
        this.go('weapon');
        return [];
      case 'weapon': {
        const shot = plan.shot;
        if (!shot) {
          this.go('done');
          return [{ t: 'skip' }];
        }
        this.go('aim');
        return t.weapon !== shot.weapon ? [{ t: 'selectWeapon', id: shot.weapon }] : [];
      }
      case 'aim': {
        const shot = plan.shot;
        if (!shot || t.phase !== 'action') {
          this.go('done');
          return [];
        }
        const d = angleDelta(t.aim, shot.angle);
        if (d !== 0) {
          const step = Math.min(Math.abs(d), this.pace.aimPerTick);
          const angle = (t.aim + Math.sign(d) * step) & ANGLE_MASK;
          return [{ t: 'aim', angle }];
        }
        this.go('after');
        return [
          shot.at ? { t: 'fireAt', x: shot.at.x, y: shot.at.y } : { t: 'fire', power: shot.power },
        ];
      }
      case 'after': {
        const at = plan.shot?.detonate;
        if (at !== undefined) {
          // The pig trots on; Fire sets it off at the planned moment, then the turn ends.
          if (this.ticks < at) return [];
          this.go('done');
          return [{ t: 'fire', power: 0 }, { t: 'skip' }];
        }
        if (this.ticks < this.pace.afterShot) return [];
        this.go('done');
        return [{ t: 'skip' }];
      }
      case 'done':
        return [];
    }
  }
}
