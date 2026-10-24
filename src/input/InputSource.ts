// Every source of commands (local player, AI, remote peer, replay) implements this interface;
// gameplay code never knows where a command comes from (CLAUDE.md rule 5).
import type { GameCommand } from '../sim/commands.ts';
import type { SimView } from '../sim/sim.ts';

export interface InputSource {
  readonly kind: 'local' | 'ai' | 'remote' | 'replay';
  /** Called once per tick while this source's team is active; returns the tick's commands. */
  poll(tick: number, view: SimView): GameCommand[];
  dispose(): void;
}
