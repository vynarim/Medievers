// Online play (TECH_SPEC §8.3): the messages the peers of a match exchange, JSON over a
// Transport. Any change to a message bumps PROTOCOL_VERSION.
import type { MatchSetup } from '../app/match-setup.ts';
import type { ClassId } from '../content/classes.ts';
import type { MatchRules } from '../content/rules.ts';
import type { GameCommand } from '../sim/commands.ts';

export const PROTOCOL_VERSION = 4;

/** Seat 0 is the match's creator; the friends who joined it take seats 1 to MAX_SEAT. */
export type Seat = number;
export const HOST_SEAT: Seat = 0;
export const MAX_SEAT: Seat = 4;

/**
 * The seat that plays each house (GDD §6): the k-th house marked « Un copain » is seat k's; the
 * creator's house and the AI's houses are seat 0's (the creator's device runs the AI).
 */
export function houseSeats(setup: Pick<MatchSetup, 'lineups' | 'players'>): Seat[] {
  let next = 0;
  return setup.lineups.map((_, h) => (setup.players?.[h] === 'friend' ? ++next : HOST_SEAT));
}

/** How many friends the match waits for: one per house marked « Un copain ». */
export const friendCount = (setup: Pick<MatchSetup, 'lineups' | 'players'>): number =>
  Math.max(0, ...houseSeats(setup));

/** Where a friend's house stands before the start: awaited, choosing its units, or ready. */
export type SeatStatus = 'absent' | 'choosing' | 'ready';

/** A house at the creator's table, without its units: nobody sees another's choice. */
export interface LobbyHouse {
  readonly player: 'host' | 'friend' | 'ai';
  /** the friend's seat (player 'friend') */
  readonly seat?: number;
  /** the AI's level (player 'ai') */
  readonly level?: string;
  /** a friend's house: where it stands */
  readonly status?: SeatStatus;
}

/** What the friends see of the match being prepared: the field, the rules, the houses. */
export interface LobbyTable {
  readonly map: string;
  readonly scheme: string;
  readonly regicide: boolean;
  readonly turnSeconds: number;
  /** units each house fields: the friends choose exactly this many */
  readonly units: number;
  readonly houses: readonly LobbyHouse[];
}

/** What every peer needs to build the same match: the map, the rules, the seed, the delay. */
export interface MatchStart {
  readonly setup: MatchSetup;
  readonly rules: MatchRules;
  readonly seed: number;
  /** ticks between the decision of a tick's commands and their application, on every peer */
  readonly delay: number;
}

export type NetMessage =
  | {
      readonly m: 'hello';
      readonly protocolVersion: number;
      readonly buildHash: string;
      /** the last tick this peer has played; 0 when it has nothing (new, or the page reloaded) */
      readonly tick: number;
    }
  /** a friend's own choice of units for its house, before the start, and whether it stands */
  | { readonly m: 'lineup'; readonly classes: readonly ClassId[]; readonly ready: boolean }
  /** the creator's table as the friends may see it, before the start (protocol 4) */
  | { readonly m: 'lobby'; readonly table: LobbyTable }
  | { readonly m: 'start'; readonly start: MatchStart }
  /** the commands of ticks from, from + 1, … (one list per tick) */
  | {
      readonly m: 'frames';
      readonly from: number;
      readonly cmds: readonly (readonly GameCommand[])[];
    }
  | { readonly m: 'turnEnd'; readonly turn: number; readonly hash: number }
  /** the match so far, for a peer back without its state: every frame known, from tick 1 */
  | {
      readonly m: 'resume';
      readonly start: MatchStart;
      readonly frames: readonly (readonly GameCommand[])[];
    }
  | { readonly m: 'pause'; readonly on: boolean }
  | { readonly m: 'resign' };

/** A message read from the wire, or null when it is not one of ours. */
export function parseMessage(raw: unknown): NetMessage | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = (raw as { m?: unknown }).m;
  return typeof m === 'string' &&
    ['hello', 'lineup', 'lobby', 'start', 'frames', 'turnEnd', 'resume', 'pause', 'resign'].includes(m)
    ? (raw as NetMessage)
    : null;
}
