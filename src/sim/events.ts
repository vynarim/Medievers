// Events emitted by a tick for the renderer and UI. They never feed back into the state.
import type { WeaponId } from '../content/weapons.ts';

export type DeathCause = 'hp' | 'outOfMap';

export type SimEvent =
  | {
      readonly e: 'turnStarted';
      readonly turn: number;
      readonly team: number;
      readonly unitId: number;
      readonly wind: number;
    }
  | { readonly e: 'phase'; readonly phase: string }
  | { readonly e: 'shotFired'; readonly shotId: number; readonly weapon: WeaponId }
  | { readonly e: 'shotEnded'; readonly shotId: number }
  | {
      readonly e: 'explosion';
      readonly x: number;
      readonly y: number;
      readonly radius: number;
    }
  | {
      readonly e: 'terrainCarved';
      readonly x: number;
      readonly y: number;
      readonly radius: number;
    }
  | { readonly e: 'unitDamaged'; readonly unitId: number; readonly damage: number }
  | { readonly e: 'unitDied'; readonly unitId: number; readonly cause: DeathCause }
  /** px: base of the hearth */
  | { readonly e: 'kitchenAppeared'; readonly x: number; readonly y: number }
  | { readonly e: 'kitchenUsed'; readonly unitId: number; readonly heal: number }
  | { readonly e: 'kitchenGone' }
  | { readonly e: 'gameOver'; readonly winner: number };
