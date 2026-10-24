// The Classique rules for tests: the same, but the match starts on the spawn columns, without
// the placement phase, so tests can play turn 1 straight away. Placement has its own tests.
import { CLASSIC_RULES as CLASSIC, type MatchRules, type TurnRules } from '../src/content/rules.ts';

export * from '../src/content/rules.ts';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { placementTicks, ...turn }: TurnRules = CLASSIC.turn;
// Nor the dragon, which would cross the sky at random: it has its own tests.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { dragon, ...classic } = CLASSIC;

export const CLASSIC_RULES: MatchRules = { ...classic, turn };
