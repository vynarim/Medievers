// Events emitted by a tick for the renderer and UI. They never feed back into the state.
import type { WeaponId } from '../content/weapons.ts';

/** kingFell: Régicide, the house's king is dead (GDD §2.3) */
export type DeathCause = 'hp' | 'outOfMap' | 'drowned' | 'kingFell' | 'dragon' | 'burnt';

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
  | { readonly e: 'dragonAppeared'; readonly dir: -1 | 1 }
  /** shot at, it swoops on this unit */
  | { readonly e: 'dragonEnraged'; readonly unitId: number }
  | { readonly e: 'dragonAte'; readonly unitId: number }
  | { readonly e: 'dragonGone' }
  | { readonly e: 'unicornAppeared'; readonly dir: -1 | 1 }
  /** a shot of this unit touched it: `heal` HP back, all it had lost */
  | { readonly e: 'unicornTouched'; readonly unitId: number; readonly heal: number }
  | { readonly e: 'unicornGone' }
  /** the unit throws a rope up (or down) a wall */
  | { readonly e: 'ropeThrown'; readonly unitId: number }
  /** no room above its head to jump (rules.unit.jumpHeadroom): nothing spent */
  | { readonly e: 'jumpRefused'; readonly unitId: number }
  /** shot by unitId, the angel lifts it in a beam of light */
  | { readonly e: 'angelLift'; readonly unitId: number }
  /** the angel lets go of it */
  | { readonly e: 'angelDropped'; readonly unitId: number }
  /** reached by the water, it was washed up here (px, feet) */
  | { readonly e: 'washedUp'; readonly unitId: number; readonly x: number; readonly y: number }
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
  /** a wooden tower catches fire */
  | { readonly e: 'towerAlight'; readonly id: number }
  /** a burning tower has burnt away */
  | { readonly e: 'towerBurnt'; readonly id: number }
  /** its footing dug away, it is about to fall */
  | { readonly e: 'structureUndermined'; readonly id: number }
  /** a falling block struck a unit */
  | { readonly e: 'crushed'; readonly unitId: number }
  /** the weather (GDD §5 bis): rain begins or stops; px of a lightning strike */
  | { readonly e: 'rainStarted' }
  | { readonly e: 'rainStopped' }
  | { readonly e: 'lightning'; readonly x: number; readonly y: number }
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
  /** the miracle took the unit from (fromX, fromY) to (x, y), px, feet */
  | {
      readonly e: 'teleported';
      readonly unitId: number;
      readonly fromX: number;
      readonly fromY: number;
      readonly x: number;
      readonly y: number;
    }
  /** a ladder was set up, its left edge at x, from y down h px */
  | { readonly e: 'ladderPlaced'; readonly x: number; readonly y: number; readonly h: number }
  /** a flaming pig went up (blast queued), or fizzled out in the water or off the map */
  | { readonly e: 'walkerGone'; readonly id: number; readonly fizzled: boolean }
  /** a hive broke: its swarm came out at (x, y) px */
  | { readonly e: 'swarmOut'; readonly id: number; readonly x: number; readonly y: number }
  /** a swarm stung a unit (the damage comes as unitDamaged) */
  | { readonly e: 'stung'; readonly unitId: number }
  /** a swarm scattered */
  | { readonly e: 'swarmGone'; readonly id: number }
  /** a unit held up its banner */
  | { readonly e: 'bannerRaised'; readonly unitId: number }
  | { readonly e: 'gameOver'; readonly winner: number };
