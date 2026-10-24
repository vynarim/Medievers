// The wire between two peers (TECH_SPEC §8): the lockstep only sends and receives messages,
// whatever carries them (Firebase in the game, memory in the tests).
import type { NetMessage } from './protocol.ts';

export interface Transport {
  send(msg: NetMessage): void;
  /** Registers the receiver; messages that arrived before are handed over at once. */
  onMessage(handler: (msg: NetMessage) => void): void;
  close(): void;
}

/**
 * Two transports joined in memory, for tests: each message arrives after `latency()` steps of
 * the shared clock, so a random latency also reorders them. `tick()` delivers what is due.
 */
export class MemoryLink {
  private now = 0;
  private queue: { at: number; seq: number; to: 0 | 1; msg: NetMessage }[] = [];
  private seq = 0;
  private readonly handlers: (((msg: NetMessage) => void) | null)[] = [null, null];
  private readonly early: NetMessage[][] = [[], []];
  private readonly latency: () => number;
  /** messages sent, both ways, for the cost checks */
  sent = 0;
  readonly a: Transport;
  readonly b: Transport;

  constructor(latency: () => number = () => 0) {
    this.latency = latency;
    this.a = this.end(0);
    this.b = this.end(1);
  }

  private end(me: 0 | 1): Transport {
    const to: 0 | 1 = me === 0 ? 1 : 0;
    return {
      send: (msg) => {
        this.sent++;
        // A copy, as a real wire would make: no shared objects between the peers.
        const copy = JSON.parse(JSON.stringify(msg)) as NetMessage;
        this.queue.push({ at: this.now + this.latency(), seq: this.seq++, to, msg: copy });
      },
      onMessage: (handler) => {
        this.handlers[me] = handler;
        for (const msg of this.early[me]?.splice(0) ?? []) handler(msg);
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
      if (h) h(q.msg);
      else this.early[q.to]?.push(q.msg);
    }
  }

  /** Drops what is in flight towards end `to` (a peer whose page reloads). */
  drop(to: 0 | 1): void {
    this.queue = this.queue.filter((q) => q.to !== to);
    this.early[to] = [];
  }
}
