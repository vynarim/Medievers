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
   * ticks: walking towards the other side first turns the unit round on the spot for this long,
   * without moving, so turning round costs no walk and keeps the jump (2026-10-24). Absent from
   * older logs: the unit turns and walks at once.
   */
  readonly turnTicks?: number;
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
  moveBudget: 280,
  slopeTakeoff: true,
  turnTicks: 12,
};
