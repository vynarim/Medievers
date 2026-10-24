// Autosave of the match in progress (GDD §12): the game log (config, seed, commands) is kept in
// localStorage; replaying it rebuilds the exact state after a refresh, a crash or a reboot.
import type { GameCommand, TimedCommand } from '../sim/commands.ts';
import { LOG_VERSION, type GameLog } from '../sim/log.ts';
import type { MatchConfig } from '../sim/state.ts';

const KEY = 'medievers.save.v1';
/** ms between two writes when only time has passed */
const FLUSH_MS = 1000;

/** The saved match, if any, readable by this version. */
export function loadSave(): GameLog | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const log = JSON.parse(raw) as GameLog;
    return log.version === LOG_VERSION && Array.isArray(log.commands) ? log : null;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Blocked storage: nothing was saved either.
  }
}

/** Records the commands of the match being played and writes the log to localStorage. */
export class AutoSaver {
  private readonly config: MatchConfig;
  private readonly seed: number;
  private readonly mapId: string;
  private readonly commands: TimedCommand[];
  private lastWrite = -Infinity;

  constructor(config: MatchConfig, seed: number, mapId: string, commands: TimedCommand[] = []) {
    this.config = config;
    this.seed = seed;
    this.mapId = mapId;
    this.commands = [...commands];
  }

  /** Commands applied at `tick`; written at once, since they change the course of the match. */
  record(tick: number, cmds: readonly GameCommand[], now: number): void {
    if (cmds.length === 0) return;
    for (const c of cmds) this.commands.push([tick, c]);
    this.lastWrite = -Infinity;
    this.flush(tick, now);
  }

  /** Writes the log up to `tick`, at most once a second unless commands arrived. */
  flush(tick: number, now: number): void {
    if (now - this.lastWrite < FLUSH_MS) return;
    const log: GameLog = {
      version: LOG_VERSION,
      config: this.config,
      seed: this.seed,
      mapId: this.mapId,
      commands: this.commands,
      endTick: tick,
    };
    try {
      localStorage.setItem(KEY, JSON.stringify(log));
    } catch {
      // Full or blocked storage: the match goes on, unsaved.
    }
    this.lastWrite = now;
  }
}
