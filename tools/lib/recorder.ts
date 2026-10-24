// Drives a Sim tick by tick and records every command, to build replays and scripted tests.
import {
  LOG_VERSION,
  Sim,
  type GameCommand,
  type GameLog,
  type Mask,
  type MatchConfig,
  type Phase,
  type SimEvent,
  type TimedCommand,
} from '../../src/sim/index.ts';

export class Recorder {
  readonly sim: Sim;
  readonly commands: TimedCommand[] = [];
  readonly events: SimEvent[] = [];
  readonly config: MatchConfig;
  readonly seed: number;
  readonly mapId: string;

  constructor(config: MatchConfig, seed: number, mapId: string, mask: Mask) {
    this.config = config;
    this.seed = seed;
    this.mapId = mapId;
    this.sim = new Sim(config, seed, mask);
  }

  step(cmds: GameCommand[] = []): void {
    const tick = this.sim.view().tick + 1;
    for (const c of cmds) this.commands.push([tick, c]);
    this.events.push(...this.sim.step(cmds));
  }

  steps(n: number): void {
    for (let i = 0; i < n; i++) this.step();
  }

  /** Steps until the phase is reached or the game ends. */
  until(phase: Phase, max = 20000): void {
    for (let i = 0; i < max; i++) {
      const p = this.sim.view().turn.phase;
      if (p === phase || p === 'gameOver') return;
      this.step();
    }
    throw new Error(`phase ${phase} never reached`);
  }

  log(): GameLog {
    return {
      version: LOG_VERSION,
      config: this.config,
      seed: this.seed,
      mapId: this.mapId,
      commands: this.commands,
      endTick: this.sim.view().tick,
    };
  }
}
