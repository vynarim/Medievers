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
}

export const UNIT_RULES: UnitRules = {
  walkSpeed: 384,
  maxStep: 12,
  slopeWindow: 7,
  jumpForward: { vx: 640, vy: -1280 },
  jumpBack: { vx: 256, vy: -1920 },
  fallSafeHeight: 160,
  fallPxPerHp: 8,
  fallMaxDamage: 30,
};
