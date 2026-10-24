// Player intents, applied by the sim at the tick they are scheduled for (CLAUDE.md rule 3).
// Every input source (local, AI, remote, replay) produces exactly these.
import type { WeaponId } from '../content/weapons.ts';

export type GameCommand =
  /** walking state: -1 left, 1 right, 0 stop; persists until changed */
  | { readonly t: 'move'; readonly dir: -1 | 0 | 1 }
  | { readonly t: 'jump'; readonly kind: 'forward' | 'back' }
  /** BAM 0..4095, 0 = right, 1024 = down, 3072 = up */
  | { readonly t: 'aim'; readonly angle: number }
  | { readonly t: 'selectWeapon'; readonly id: WeaponId }
  /** seconds, for fused weapons */
  | { readonly t: 'setFuse'; readonly seconds: 1 | 2 | 3 | 4 | 5 }
  /** power 0..1024 */
  | { readonly t: 'fire'; readonly power: number }
  | { readonly t: 'skip' };

/** A command scheduled at a tick, as stored in game logs. */
export type TimedCommand = readonly [tick: number, command: GameCommand];

export const MAX_POWER = 1024;
