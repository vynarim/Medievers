// Reference replay files (tests/replays/*.json): a game log plus its expected final hash.
import type { GameLog } from './log.ts';

export interface ReplayFile extends GameLog {
  readonly description: string;
  /** final state hash as 8 lowercase hex digits */
  readonly expectedHash: string;
}

export function formatHash(h: number): string {
  return (h >>> 0).toString(16).padStart(8, '0');
}
