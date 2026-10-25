// Lockstep by turn (TECH_SPEC §8.4). Each tick t has one producer: the peer of the house that
// is active once tick t - D - 1 has been played (the creator for the AI's houses). It decides
// the commands of tick t then, keeps them and sends them; every peer applies them at tick t. A
// peer plays a tick only once it knows its commands. The turn hashes are compared; a desync is
// reported, never mended.
import type { GameCommand } from '../sim/commands.ts';
import type { SimView } from '../sim/sim.ts';
import { houseSeats, type MatchStart, type NetMessage, type Seat } from './protocol.ts';
import type { Transport } from './transport.ts';

/** ticks of commands a batch gathers at most before it leaves (100 ms) */
export const BATCH_TICKS = 6;

export class Lockstep {
  readonly seat: Seat;
  readonly start: MatchStart;
  /** the seat that plays each house */
  readonly seats: readonly Seat[];
  private readonly transport: Transport;
  /** the commands of each tick (index = tick), once known */
  private readonly frames: (readonly GameCommand[] | undefined)[] = [];
  private out: { from: number; cmds: (readonly GameCommand[])[] } | null = null;
  /** each turn's state hash, from each seat that sent it (this one's included) */
  private readonly hashes = new Map<number, Map<Seat, number>>();
  /** the first turn whose hashes differ, once seen */
  desyncTurn: number | null = null;
  /** the seats whose menu stops the clock */
  private readonly pausedBy = new Set<Seat>();
  private localPaused = false;
  /** a peer gave up the match */
  remoteResigned = false;

  constructor(
    seat: Seat,
    start: MatchStart,
    transport: Transport,
    known: readonly (readonly GameCommand[])[] = [],
  ) {
    this.seat = seat;
    this.start = start;
    this.seats = houseSeats(start.setup);
    this.transport = transport;
    // Ticks 1..D: nobody could decide them, they are empty.
    for (let t = 1; t <= start.delay; t++) this.frames[t] = [];
    known.forEach((cmds, i) => {
      if (this.frames[i + 1] === undefined) this.frames[i + 1] = cmds;
    });
  }

  /** Another peer's menu stops the clock. */
  get remotePaused(): boolean {
    return this.pausedBy.size > 0;
  }

  /** The seat whose peer decides the commands while house `team` plays. */
  seatOf(team: number): Seat {
    return this.seats[team] ?? 0;
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
    if (this.seatOf(view.turn.activeTeam) !== this.seat) {
      // Another peer owns the next ticks: what is queued must not wait for a full batch.
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

  /** A turn began at this tick: every peer sends and compares the state hash. */
  turnStarted(turn: number, hash: number): void {
    this.transport.send({ m: 'turnEnd', turn, hash });
    this.compare(turn, this.seat, hash);
  }

  /** A menu that stops the clock opened or closed here: every peer stops. */
  setPaused(on: boolean): void {
    if (on === this.localPaused) return;
    this.localPaused = on;
    this.transport.send({ m: 'pause', on });
  }

  resign(): void {
    this.transport.send({ m: 'resign' });
  }

  /** A message from the peer at seat `from`. */
  receive(msg: NetMessage, from: Seat): void {
    switch (msg.m) {
      case 'frames':
        msg.cmds.forEach((cmds, i) => {
          if (this.frames[msg.from + i] === undefined) this.frames[msg.from + i] = cmds;
        });
        break;
      case 'turnEnd':
        this.compare(msg.turn, from, msg.hash);
        break;
      case 'pause':
        if (msg.on) this.pausedBy.add(from);
        else this.pausedBy.delete(from);
        break;
      case 'resign':
        this.remoteResigned = true;
        break;
      case 'hello':
        // A peer comes without its state (late, or its page reloaded): the match so far.
        if (msg.tick === 0) {
          const until = this.knownUntil();
          this.transport.send(
            {
              m: 'resume',
              start: this.start,
              frames: this.frames.slice(1, until + 1).map((c) => c ?? []),
            },
            from,
          );
          if (this.localPaused) this.transport.send({ m: 'pause', on: true }, from);
        }
        break;
      case 'start':
      case 'resume':
        break;
    }
  }

  private compare(turn: number, seat: Seat, hash: number): void {
    let seen = this.hashes.get(turn);
    if (!seen) this.hashes.set(turn, (seen = new Map()));
    seen.set(seat, hash);
    const all = [...seen.values()];
    if (all.some((h) => h !== all[0]) && (this.desyncTurn === null || turn < this.desyncTurn)) {
      this.desyncTurn = turn;
    }
  }
}
