// Autosave of the match in progress (GDD §12): the game log (config, seed, commands) is kept in
// localStorage; replaying it rebuilds the exact state after a refresh, a crash or a reboot.
import type { GameCommand, TimedCommand } from '../sim/commands.ts';
import { LOG_VERSION, type GameLog } from '../sim/log.ts';
import type { MatchConfig } from '../sim/state.ts';

// Storage keys keep the game's first name (Medievers), so players keep their saves and settings.
const KEY = 'medievers.save.v1';
/** the last match played to its end, for « Revoir la dernière partie » */
const LAST_KEY = 'medievers.lastReplay.v1';
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

  /** The game log of the match up to `tick`: what a replay plays back. */
  logAt(tick: number): GameLog {
    return {
      version: LOG_VERSION,
      config: this.config,
      seed: this.seed,
      mapId: this.mapId,
      commands: [...this.commands],
      endTick: tick,
    };
  }

  /** Writes the log up to `tick`, at most once a second unless commands arrived. */
  flush(tick: number, now: number): void {
    if (now - this.lastWrite < FLUSH_MS) return;
    const log = this.logAt(tick);
    try {
      localStorage.setItem(KEY, JSON.stringify(log));
    } catch {
      // Full or blocked storage: the match goes on, unsaved.
    }
    this.lastWrite = now;
  }
}

/** A game log read from JSON (a saved or imported replay), or null if it is not one. */
export function parseLog(text: string): GameLog | null {
  try {
    const log = JSON.parse(text) as GameLog;
    const ok =
      log.version === LOG_VERSION &&
      Array.isArray(log.commands) &&
      typeof log.seed === 'number' &&
      typeof log.endTick === 'number' &&
      typeof log.mapId === 'string' &&
      Array.isArray(log.config?.teams);
    return ok ? log : null;
  } catch {
    return null;
  }
}

/** Keeps the log of a match that just ended, for « Revoir la dernière partie ». */
export function saveLastReplay(log: GameLog): void {
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify(log));
  } catch {
    // Full or blocked storage: the replay lasts as long as the page.
  }
}

export function loadLastReplay(): GameLog | null {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    return raw ? parseLog(raw) : null;
  } catch {
    return null;
  }
}

/** Offers the log as a JSON file to save (GDD §6: replays are exported in JSON). */
export function downloadLog(log: GameLog): void {
  const blob = new Blob([JSON.stringify(log)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `medieverse-replay-${log.seed.toString(16)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
