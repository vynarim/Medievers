// The wire between the peers of a match (TECH_SPEC §8): the lockstep only sends and receives
// messages, whatever carries them (Firebase in the game, memory in the tests).
import type { NetMessage, Seat } from './protocol.ts';

export interface Transport {
  /** Sends to every other peer of the match, or to seat `to` alone. */
  send(msg: NetMessage, to?: Seat): void;
  /** Registers the receiver; messages that arrived before are handed over at once. */
  onMessage(handler: (msg: NetMessage, from: Seat) => void): void;
  close(): void;
}

/**
 * Transports joined in memory, for tests, one per seat: each message arrives after `latency()`
 * steps of the shared clock, so a random latency also reorders them. `tick()` delivers what is
 * due.
 */
export class MemoryLink {
  private now = 0;
  private queue: { at: number; seq: number; from: Seat; to: Seat; msg: NetMessage }[] = [];
  private seq = 0;
  private readonly handlers: (((msg: NetMessage, from: Seat) => void) | null)[];
  private readonly early: { msg: NetMessage; from: Seat }[][];
  private readonly latency: () => number;
  /** messages sent, every way, for the cost checks (a message to N peers counts N) */
  sent = 0;
  /** the transport of each seat */
  readonly ends: readonly Transport[];

  constructor(latency: () => number = () => 0, seats = 2) {
    this.latency = latency;
    this.handlers = Array.from({ length: seats }, () => null);
    this.early = Array.from({ length: seats }, () => []);
    this.ends = Array.from({ length: seats }, (_, me) => this.end(me));
  }

  /** The creator's end and the first friend's. */
  get a(): Transport {
    return this.ends[0] as Transport;
  }
  get b(): Transport {
    return this.ends[1] as Transport;
  }

  private end(me: Seat): Transport {
    const post = (msg: NetMessage, to: Seat): void => {
      this.sent++;
      // A copy, as a real wire would make: no shared objects between the peers.
      const copy = JSON.parse(JSON.stringify(msg)) as NetMessage;
      this.queue.push({ at: this.now + this.latency(), seq: this.seq++, from: me, to, msg: copy });
    };
    return {
      send: (msg, to) => {
        if (to !== undefined) post(msg, to);
        else this.handlers.forEach((_, k) => k !== me && post(msg, k));
      },
      onMessage: (handler) => {
        this.handlers[me] = handler;
        for (const q of this.early[me]?.splice(0) ?? []) handler(q.msg, q.from);
      },
      close: () => {
        this.handlers[me] = null;
      },
    };
  }

  /** Advances the clock one step and delivers the messages due, earliest first. */
  tick(): void {
    this.now++;
    const due = this.queue
      .filter((q) => q.at <= this.now)
      .sort((x, y) => x.at - y.at || x.seq - y.seq);
    this.queue = this.queue.filter((q) => q.at > this.now);
    for (const q of due) {
      const h = this.handlers[q.to];
      if (h) h(q.msg, q.from);
      else this.early[q.to]?.push({ msg: q.msg, from: q.from });
    }
  }

  /** Drops what is in flight towards seat `to` (a peer whose page reloads). */
  drop(to: Seat): void {
    this.queue = this.queue.filter((q) => q.to !== to);
    this.early[to] = [];
  }
}
