// Lockstep by turn (TECH_SPEC §8.4). Each tick t has one producer: the peer of the house that
// is active once tick t - D - 1 has been played. It decides the commands of tick t then, keeps
// them and sends them; both peers apply them at tick t. A peer plays a tick only once it knows
// its commands. The turn hashes are compared; a desync is reported, never mended.
import type { GameCommand } from '../sim/commands.ts';
import type { SimView } from '../sim/sim.ts';
import { roleOfTeam, type MatchStart, type NetMessage, type Role } from './protocol.ts';
import type { Transport } from './transport.ts';

/** ticks of commands a batch gathers at most before it leaves (100 ms) */
export const BATCH_TICKS = 6;

export class Lockstep {
  readonly role: Role;
  readonly start: MatchStart;
  private readonly transport: Transport;
  /** the commands of each tick (index = tick), once known */
  private readonly frames: (readonly GameCommand[] | undefined)[] = [];
  private out: { from: number; cmds: (readonly GameCommand[])[] } | null = null;
  private readonly localHashes = new Map<number, number>();
  private readonly remoteHashes = new Map<number, number>();
  /** the first turn whose hashes differ, once seen */
  desyncTurn: number | null = null;
  remotePaused = false;
  private localPaused = false;
  /** the other peer gave up the match */
  remoteResigned = false;

  constructor(
    role: Role,
    start: MatchStart,
    transport: Transport,
    known: readonly (readonly GameCommand[])[] = [],
  ) {
    this.role = role;
    this.start = start;
    this.transport = transport;
    // Ticks 1..D: nobody could decide them, they are empty.
    for (let t = 1; t <= start.delay; t++) this.frames[t] = [];
    known.forEach((cmds, i) => {
      if (this.frames[i + 1] === undefined) this.frames[i + 1] = cmds;
    });
  }

  /** The commands of `tick` are known: the tick can be played. */
  ready(tick: number): boolean {
    return this.frames[tick] !== undefined;
  }

  /** The commands of `tick` (empty if unknown: call ready() first). */
  commandsAt(tick: number): readonly GameCommand[] {
    return this.frames[tick] ?? [];
  }

  /** The last tick from which every earlier tick is known. */
  knownUntil(): number {
    let t = 0;
    while (this.frames[t + 1] !== undefined) t++;
    return t;
  }

  /**
   * After tick `view.tick` has been played: if this peer owns tick view.tick + D + 1, decides
   * its commands with `input` and queues them for the other peer.
   */
  produceAfter(view: SimView, input: (tick: number) => readonly GameCommand[]): void {
    const t = view.tick + this.start.delay + 1;
    if (this.frames[t] !== undefined) return;
    if (roleOfTeam(view.turn.activeTeam) !== this.role) {
      // The other peer owns the next ticks: what is queued must not wait for a full batch.
      this.flush(true);
      return;
    }
    const cmds = [...input(t)];
    this.frames[t] = cmds;
    if (this.out && this.out.from + this.out.cmds.length !== t) this.flush(true);
    if (!this.out) this.out = { from: t, cmds: [] };
    this.out.cmds.push(cmds);
    this.flush(false);
  }

  /** Sends the queued commands: when forced, when they hold a command, or a full batch. */
  flush(force: boolean): void {
    const out = this.out;
    if (!out) return;
    if (!force && out.cmds.length < BATCH_TICKS && out.cmds.every((c) => c.length === 0)) return;
    this.transport.send({ m: 'frames', from: out.from, cmds: out.cmds });
    this.out = null;
  }

  /** A turn began at this tick: both peers send and compare the state hash. */
  turnStarted(turn: number, hash: number): void {
    this.localHashes.set(turn, hash);
    this.transport.send({ m: 'turnEnd', turn, hash });
    this.compare(turn);
  }

  /** A menu that stops the clock opened or closed here: both peers stop. */
  setPaused(on: boolean): void {
    if (on === this.localPaused) return;
    this.localPaused = on;
    this.transport.send({ m: 'pause', on });
  }

  resign(): void {
    this.transport.send({ m: 'resign' });
  }

  /** A message from the other peer. */
  receive(msg: NetMessage): void {
    switch (msg.m) {
      case 'frames':
        msg.cmds.forEach((cmds, i) => {
          if (this.frames[msg.from + i] === undefined) this.frames[msg.from + i] = cmds;
        });
        break;
      case 'turnEnd':
        this.remoteHashes.set(msg.turn, msg.hash);
        this.compare(msg.turn);
        break;
      case 'pause':
        this.remotePaused = msg.on;
        break;
      case 'resign':
        this.remoteResigned = true;
        break;
      case 'hello':
        // The other peer is back without its state (its page reloaded): the match so far.
        if (msg.tick === 0) {
          const until = this.knownUntil();
          this.transport.send({
            m: 'resume',
            start: this.start,
            frames: this.frames.slice(1, until + 1).map((c) => c ?? []),
          });
          if (this.localPaused) this.transport.send({ m: 'pause', on: true });
        }
        break;
      case 'start':
      case 'resume':
        break;
    }
  }

  private compare(turn: number): void {
    const a = this.localHashes.get(turn);
    const b = this.remoteHashes.get(turn);
    if (a === undefined || b === undefined) return;
    if (a !== b && (this.desyncTurn === null || turn < this.desyncTurn)) this.desyncTurn = turn;
  }
}
