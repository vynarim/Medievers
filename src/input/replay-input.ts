// Replays a game log (GDD §6, « Revoir la partie »): hands the sim the commands recorded at each
// tick, as any other InputSource would (CLAUDE.md rule 5).
import type { GameCommand } from '../sim/commands.ts';
import type { GameLog } from '../sim/log.ts';
import type { InputSource } from './InputSource.ts';

export class ReplayInput implements InputSource {
  readonly kind = 'replay' as const;
  private readonly log: GameLog;
  private next = 0;

  constructor(log: GameLog) {
    this.log = log;
  }

  /** The commands recorded for `tick`, in their order; ticks must be polled in order. */
  poll(tick: number): GameCommand[] {
    const out: GameCommand[] = [];
    const cmds = this.log.commands;
    while (this.next < cmds.length && (cmds[this.next]?.[0] ?? Infinity) < tick) this.next++;
    while (this.next < cmds.length && cmds[this.next]?.[0] === tick) {
      const c = cmds[this.next++]?.[1];
      if (c) out.push(c);
    }
    return out;
  }

  /** True once every recorded tick has been played. */
  done(tick: number): boolean {
    return tick >= this.log.endTick;
  }

  dispose(): void {
    // Nothing held.
  }
}
