// Unit movement and damage rules (GDD §3.1). Speeds in sub-pixels per tick (256 = 1 px).

export interface UnitRules {
  /** sub-px per tick; 384 = 1.5 px/tick */
  readonly walkSpeed: number;
  /** px: highest step a walking unit climbs */
  readonly maxStep: number;
  /** px: horizontal window over which the rise may not exceed maxStep (≈ 60° max slope) */
  readonly slopeWindow: number;
  /** sub-px per tick: initial velocity of the forward jump */
  readonly jumpForward: { readonly vx: number; readonly vy: number };
  /** sub-px per tick: initial velocity of the backward jump (vx is away from facing) */
  readonly jumpBack: { readonly vx: number; readonly vy: number };
  /** px: falls up to this height are harmless */
  readonly fallSafeHeight: number;
  /** px of extra fall per HP lost */
  readonly fallPxPerHp: number;
  /** HP: maximum fall damage */
  readonly fallMaxDamage: number;
  /**
   * A walking unit does not walk down a slope steeper than it could walk up (a drop of more than
   * maxStep over slopeWindow px ahead): it falls off it (2026-10-25). A single step down is still
   * walked. Absent from older logs: any slope is walked down.
   */
  readonly steepFall?: boolean;
  /**
   * A fall of at least fallMinHeight px (off a wall, a cliff, a steep slope) always costs at least
   * fallMinDamage HP (2026-10-25). Absent from older logs: only falls over fallSafeHeight hurt.
   */
  readonly fallMinHeight?: number;
  readonly fallMinDamage?: number;
  /**
   * px a unit may walk in one turn, if it does not jump; a jump takes the whole turn's move
   * (GDD §3.1). Absent from logs recorded before 2026-10-24: unlimited walking and jumps.
   */
  readonly moveBudget?: number;
  /**
   * A rising unit blocked sideways by the ground keeps going if rising clears it, so a jump
   * from a slope takes off (2026-10-24). Absent from older logs, which keep the old physics.
   */
  readonly slopeTakeoff?: boolean;
  /**
   * px of free room a unit needs above its head to jump: under a lower ceiling (the wall-walk of
   * a curtain wall), the jump is refused and costs nothing (2026-10-25). Absent from older logs:
   * the jump goes, and bumps its head.
   */
  readonly jumpHeadroom?: number;
  /**
   * ticks: walking towards the other side first turns the unit round on the spot for this long,
   * without moving, so turning round costs no walk and keeps the jump (2026-10-24). Absent from
   * older logs: the unit turns and walks at once.
   */
  readonly turnTicks?: number;
  /**
   * sub-px per tick up or down a ladder (GDD §4.4); climbing spends the turn's walk like walking.
   * Absent from older logs: ladders cannot be climbed.
   */
  readonly climbSpeed?: number;
  /** percent of the walk a climbed pixel costs (50: a ladder twice the walk per turn) */
  readonly climbCostPct?: number;
  /**
   * px of tolerance beyond the body's side within which a ladder is grabbed, to climb it up or to
   * go down it from the top (2026-10-25: a unit's width). Absent from older logs: 6 px.
   */
  readonly ladderReach?: number;
  /**
   * Taking a ladder is the unit's whole move and ends its turn (2026-10-24): one press of ↑ or ↓
   * climbs it all the way up (or down), without spending the walk, and the turn ends at the end
   * of the ladder. Absent from older logs: the unit climbs while ↑ or ↓ is held, at the cost of
   * the walk (climbCostPct).
   */
  readonly ladderEndsTurn?: boolean;
  /**
   * Taking a ladder is the turn's action, like a shot, not a move (2026-10-25): it is only taken
   * before the shot, never after it. Absent from older logs: after the shot too.
   */
  readonly ladderIsAction?: boolean;
  /**
   * px: a unit facing a wall (or standing at its top) may climb it, or down it, with a rope, as
   * on a ladder and under the same rules (the turn's action, ending the turn), up to this height
   * (2026-10-25). Absent from older logs: walls are not climbed.
   */
  readonly wallClimb?: number;
}

export const UNIT_RULES: UnitRules = {
  walkSpeed: 384,
  maxStep: 12,
  slopeWindow: 7,
  jumpForward: { vx: 2100, vy: -2304 },
  jumpBack: { vx: 256, vy: -2688 },
  fallSafeHeight: 160,
  fallPxPerHp: 8,
  fallMaxDamage: 30,
  steepFall: true,
  fallMinHeight: 40,
  fallMinDamage: 5,
  moveBudget: 280,
  slopeTakeoff: true,
  jumpHeadroom: 40,
  turnTicks: 12,
  climbSpeed: 256,
  climbCostPct: 50,
  ladderReach: 28,
  ladderEndsTurn: true,
  ladderIsAction: true,
  wallClimb: 220,
};
