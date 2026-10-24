// Weather (GDD §5 bis, 2026-10-25): now and then the clouds pour with rain, and while it rains a
// bolt of lightning may strike anywhere on the field, wounding, carving and setting off barrels.
// Chances in per mille, drawn at the end of each turn with the sim's PRNG.

export interface WeatherRules {
  /** per mille at each turn end, while it is dry, that the rain begins */
  readonly rainPermille: number;
  /** turns the rain lasts once begun: least and most */
  readonly rainTurnsMin: number;
  readonly rainTurnsMax: number;
  /** per mille at each turn end, while it rains, that lightning strikes */
  readonly lightningPermille: number;
  /** HP at the centre of the strike */
  readonly damage: number;
  /** px: radius of the strike's blast and crater */
  readonly radius: number;
}

export const WEATHER_RULES: WeatherRules = {
  rainPermille: 120,
  rainTurnsMin: 2,
  rainTurnsMax: 5,
  lightningPermille: 300,
  damage: 35,
  radius: 45,
};
