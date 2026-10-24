// Events emitted by a tick for the renderer and UI. They never feed back into the state.
import type { WeaponId } from '../content/weapons.ts';

/** kingFell: Régicide, the house's king is dead (GDD §2.3) */
export type DeathCause = 'hp' | 'outOfMap' | 'drowned' | 'kingFell';

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
  /** Bénédiction of a cleric (GDD §3.2) */
  | { readonly e: 'unitHealed'; readonly unitId: number; readonly heal: number }
  | { readonly e: 'unitDied'; readonly unitId: number; readonly cause: DeathCause }
  /** px: base of the hearth */
  | { readonly e: 'kitchenAppeared'; readonly x: number; readonly y: number }
  | { readonly e: 'kitchenUsed'; readonly unitId: number; readonly heal: number }
  | { readonly e: 'kitchenGone' }
  | { readonly e: 'barrelLost'; readonly id: number }
  /** px: column where the angel brings a reliquary down */
  | { readonly e: 'crateDropped'; readonly id: number; readonly x: number }
  | {
      readonly e: 'crateTaken';
      readonly id: number;
      readonly unitId: number;
      readonly kind: number;
      readonly weapon: number;
      readonly heal: number;
    }
  | { readonly e: 'crateBurst'; readonly id: number; readonly trap: boolean }
  /** px */
  | { readonly e: 'beastAppeared'; readonly kind: number; readonly x: number; readonly y: number }
  /** px */
  | { readonly e: 'beastMoved'; readonly x: number; readonly y: number }
  | {
      readonly e: 'beastStruck';
      readonly kind: number;
      readonly unitId: number;
      readonly trick: number;
    }
  | { readonly e: 'beastKilled' }
  | { readonly e: 'beastGone' }
  | { readonly e: 'panicked'; readonly unitId: number }
  | { readonly e: 'potPlaced'; readonly id: number; readonly turns: number }
  | { readonly e: 'potLit'; readonly id: number }
  /** px */
  | { readonly e: 'unitPlaced'; readonly unitId: number; readonly x: number }
  | { readonly e: 'placeRefused'; readonly x: number }
  /** the two fires met in the middle: the match ends on the HP left (rules.burn.endWhenMet) */
  | { readonly e: 'burnMet' }
  /** px burnt away at each end of the map, after the fire spread */
  | { readonly e: 'burnSpread'; readonly px: number }
  /** px: a rectangle of the terrain changed (a structure fell, rubble landed) */
  | {
      readonly e: 'terrainChanged';
      readonly x: number;
      readonly y: number;
      readonly w: number;
      readonly h: number;
    }
  | {
      readonly e: 'structureHit';
      readonly id: number;
      readonly damage: number;
      readonly state: number;
    }
  | { readonly e: 'structureFell'; readonly id: number }
  /** a falling block struck a unit */
  | { readonly e: 'crushed'; readonly unitId: number }
  /** « Et les eaux montèrent… » (GDD §2.4) */
  | { readonly e: 'delugeStarted' }
  /** px: new top of the water */
  | { readonly e: 'waterRose'; readonly y: number }
  /** a chausse-trape left on the ground (GDD §4.4) */
  | { readonly e: 'minePlaced'; readonly id: number; readonly team: number }
  | { readonly e: 'mineSprung'; readonly id: number; readonly team: number }
  /** px: middle of a stone wall just set */
  | { readonly e: 'wallBuilt'; readonly x: number; readonly y: number }
  /** a tool could not be used there (a wall too far, on a unit, in the ground) */
  | { readonly e: 'toolRefused'; readonly weapon: WeaponId }
  | { readonly e: 'gameOver'; readonly winner: number };
