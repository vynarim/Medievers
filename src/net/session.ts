// Meeting before the match (TECH_SPEC §8.3): the creator opens a lobby where friends say hello
// and are checked to run the same game; it starts the match when it chooses, and every peer
// gets it. A peer that comes later, or back without its state, gets the match resumed.
import type { ClassId } from '../content/classes.ts';
import { Lockstep } from './lockstep.ts';
import {
  HOST_SEAT,
  PROTOCOL_VERSION,
  type MatchStart,
  type NetMessage,
  type Seat,
} from './protocol.ts';
import type { Transport } from './transport.ts';

export interface Joined {
  readonly lockstep: Lockstep;
  /** true when the match was already under way (a page reloaded): replay it to catch up */
  readonly resumed: boolean;
}

export type JoinError = 'version';

const helloOf = (buildHash: string): NetMessage => ({
  m: 'hello',
  protocolVersion: PROTOCOL_VERSION,
  buildHash,
  tick: 0,
});

/** The creator's side of the meeting, before the match starts. */
export class Lobby {
  private readonly transport: Transport;
  private readonly buildHash: string;
  /** the friends who said hello with the same game, by seat */
  readonly joined = new Set<Seat>();
  /** the units each friend chose for its house, by seat */
  readonly lineups = new Map<Seat, readonly ClassId[]>();
  private lockstep: Lockstep | null = null;
  private listener: ((joined: ReadonlySet<Seat>) => void) | null = null;
  private lineupListener: ((lineups: ReadonlyMap<Seat, readonly ClassId[]>) => void) | null = null;

  constructor(transport: Transport, buildHash: string) {
    this.transport = transport;
    this.buildHash = buildHash;
    transport.onMessage((msg, from) => {
      if (this.lockstep) {
        this.lockstep.receive(msg, from);
        return;
      }
      // Kept even ahead of its hello: the friend may choose before the hello is through.
      if (msg.m === 'lineup') {
        if (!Array.isArray(msg.classes)) return;
        this.lineups.set(from, msg.classes);
        this.lineupListener?.(this.lineups);
        return;
      }
      if (msg.m !== 'hello') return;
      if (msg.protocolVersion !== PROTOCOL_VERSION || msg.buildHash !== buildHash) {
        // Its answer tells the friend it cannot play this match.
        transport.send(helloOf(buildHash), from);
        return;
      }
      this.joined.add(from);
      this.listener?.(this.joined);
    });
  }

  /** `fn` hears of each friend that joins (and is called at once). */
  onJoin(fn: (joined: ReadonlySet<Seat>) => void): void {
    this.listener = fn;
    fn(this.joined);
  }

  /** `fn` hears of the units each friend chooses (and is called at once). */
  onLineup(fn: (lineups: ReadonlyMap<Seat, readonly ClassId[]>) => void): void {
    this.lineupListener = fn;
    fn(this.lineups);
  }

  /** A friend left the lobby before the match started. */
  forget(seat: Seat): void {
    this.lineups.delete(seat);
    if (this.lockstep || !this.joined.delete(seat)) return;
    this.listener?.(this.joined);
  }

  /** Starts the match: every friend who joined gets it; one who comes later gets it resumed. */
  start(start: MatchStart): Lockstep {
    if (this.lockstep) return this.lockstep;
    this.listener = null;
    this.lineupListener = null;
    const ls = new Lockstep(HOST_SEAT, start, this.transport);
    this.lockstep = ls;
    for (const seat of this.joined) {
      this.transport.send(helloOf(this.buildHash), seat);
      this.transport.send({ m: 'start', start }, seat);
    }
    return ls;
  }
}

/**
 * Connects to a match over `transport`: a friend who joins, or any peer whose page reloaded. It
 * says hello and gets the match, new (from the creator's lobby) or resumed (from any peer).
 * Messages after that go to the lockstep.
 */
export function connect(transport: Transport, seat: Seat, buildHash: string): Promise<Joined> {
  return new Promise((resolve, reject) => {
    let lockstep: Lockstep | null = null;
    let failed = false;
    transport.onMessage((msg, from) => {
      if (failed) return;
      if (
        msg.m === 'hello' &&
        (msg.protocolVersion !== PROTOCOL_VERSION || msg.buildHash !== buildHash)
      ) {
        failed = true;
        reject(new Error('version' satisfies JoinError));
        return;
      }
      if (lockstep) {
        lockstep.receive(msg, from);
        return;
      }
      if (msg.m === 'start') {
        lockstep = new Lockstep(seat, msg.start, transport);
        resolve({ lockstep, resumed: false });
      } else if (msg.m === 'resume') {
        lockstep = new Lockstep(seat, msg.start, transport, msg.frames);
        resolve({ lockstep, resumed: msg.frames.length > msg.start.delay });
      }
    });
    transport.send(helloOf(buildHash));
  });
}
