// Online play (TECH_SPEC §8.3): the messages two peers exchange, JSON over a Transport. Any
// change to a message bumps PROTOCOL_VERSION.
import type { MatchSetup } from '../app/match-setup.ts';
import type { MatchRules } from '../content/rules.ts';
import type { GameCommand } from '../sim/commands.ts';

export const PROTOCOL_VERSION = 1;

/** The creator of the match plays the even houses, the one who joined the odd ones. */
export type Role = 'host' | 'guest';

export const otherRole = (r: Role): Role => (r === 'host' ? 'guest' : 'host');

/** The peer that controls house `team` (GDD §6). */
export const roleOfTeam = (team: number): Role => (team % 2 === 0 ? 'host' : 'guest');

/** What both peers need to build the same match: the map, the rules, the seed, the delay. */
export interface MatchStart {
  readonly setup: MatchSetup;
  readonly rules: MatchRules;
  readonly seed: number;
  /** ticks between the decision of a tick's commands and their application, on both peers */
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
    ['hello', 'start', 'frames', 'turnEnd', 'resume', 'pause', 'resign'].includes(m)
    ? (raw as NetMessage)
    : null;
}
