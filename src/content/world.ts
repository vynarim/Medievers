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
