// World rules shared by every weapon (GDD §5). Accelerations in sub-px/tick² (256 = 1 px).

export interface WindRules {
  /** wind values are integers in [-max, max] (GDD §5) */
  readonly max: number;
  /** sub-px/tick² of horizontal acceleration per wind unit, before the weapon's wind factor */
  readonly accelPerUnit: number;
}

export const WIND_RULES: WindRules = {
  max: 10,
  accelPerUnit: 2,
};

export interface ExplosionRules {
  /** sub-px/tick of knockback speed per HP of damage dealt */
  readonly knockbackPerHp: number;
  /** percent of the knockback speed added upward, so blasts lift units off the ground */
  readonly liftPct: number;
  /**
   * The blast reaches the nearest point of the body's axis, from its waist down to its knees
   * and up to its shoulders, instead of its centre (decided 2026-10-31: a stone at a unit's
   * feet, 40 px from its centre, did 3 HP). Absent from old logs: measured to the centre.
   */
  readonly toBody?: boolean;
}

export const EXPLOSION_RULES: ExplosionRules = {
  knockbackPerHp: 40,
  liftPct: 35,
  toBody: true,
};
