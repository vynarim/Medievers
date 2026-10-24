// Game log (TECH_SPEC §2.1): match config, seed, map and timed commands. It is the replay
// format, the test fixture format and how an online match is resumed.
import type { TimedCommand } from './commands.ts';
import { Sim } from './sim.ts';
import type { MatchConfig } from './state.ts';
import type { Mask } from './terrain/mask.ts';

export const LOG_VERSION = 1;

export interface GameLog {
  readonly version: number;
  readonly config: MatchConfig;
  readonly seed: number;
  readonly mapId: string;
  /** sorted by tick; several commands may share a tick and apply in order */
  readonly commands: readonly TimedCommand[];
  /** number of ticks to simulate */
  readonly endTick: number;
}

/** Plays a log from the start and returns the simulation at endTick. */
export function replay(log: GameLog, mask: Mask): Sim {
  if (log.version !== LOG_VERSION) {
    throw new Error(`unsupported game log version ${log.version}`);
  }
  const sim = new Sim(log.config, log.seed, mask);
  let next = 0;
  for (let tick = 1; tick <= log.endTick; tick++) {
    const cmds = [];
    while (next < log.commands.length && (log.commands[next]?.[0] ?? Infinity) <= tick) {
      const entry = log.commands[next++];
      if (entry && entry[0] === tick) cmds.push(entry[1]);
    }
    sim.step(cmds);
  }
  return sim;
}
