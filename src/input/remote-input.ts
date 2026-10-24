// Commands of an online match (TECH_SPEC §8): whoever decided them, this peer or the other one,
// they come out of the lockstep, tick by tick, as from any other InputSource (CLAUDE.md rule 5).
import type { Lockstep } from '../net/lockstep.ts';
import type { GameCommand } from '../sim/commands.ts';
import type { InputSource } from './InputSource.ts';

export class RemoteInputSource implements InputSource {
  readonly kind = 'remote' as const;
  private readonly lockstep: Lockstep;

  constructor(lockstep: Lockstep) {
    this.lockstep = lockstep;
  }

  /** The tick's commands are known: it can be played. */
  ready(tick: number): boolean {
    return this.lockstep.ready(tick);
  }

  poll(tick: number): GameCommand[] {
    return [...this.lockstep.commandsAt(tick)];
  }

  dispose(): void {
    // The lockstep belongs to the match, which closes the transport.
  }
}
