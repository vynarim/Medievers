import { describe, expect, it } from 'vitest';
import { defaultSetup, type Player } from '../../src/app/match-setup.ts';
import { Lockstep } from '../../src/net/lockstep.ts';
import { houseSeats, type MatchStart, type Seat } from '../../src/net/protocol.ts';
import { Lobby, connect } from '../../src/net/session.ts';
import { MemoryLink, type Transport } from '../../src/net/transport.ts';
import {
  Material,
  Sim,
  type GameCommand,
  type Mask,
  type MatchConfig,
} from '../../src/sim/index.ts';
import { mulberry } from './prng.ts';
import { CLASSIC_RULES } from '../rules-fixture.ts';

function flatMask(): Mask {
  const width = 1600;
  const height = 600;
  const data = new Uint8Array(width * height);
  for (let y = 480; y < height; y++) data.fill(Material.Earth, y * width, (y + 1) * width);
  return { width, height, data };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { kitchen, crates, beasts, barrels, burn, deluge, ...RULES } = CLASSIC_RULES;
const SPAWNS = [
  [300, 700],
  [1000, 1300],
  [500, 900],
  [1150, 1450],
];

/** A match of `players.length` houses: the creator's, friends', the AI's. */
function startOf(players: Player[], seed = 77): { start: MatchStart; config: MatchConfig } {
  const config: MatchConfig = {
    rules: { ...RULES, startHp: 40 },
    teams: players.map((_, h) => ({ spawns: SPAWNS[h] ?? [800] })),
  };
  const setup = { ...defaultSetup(false), lineups: players.map(() => ['knight' as const]), players };
  return { start: { setup, rules: config.rules, seed, delay: 30 }, config };
}

const { start: START, config: CONFIG } = startOf(['human', 'friend']);

/**
 * What a seat does on its houses' turns (the AI's included, for the creator): walk a little,
 * then a sling shot towards the other side.
 */
function play(seat: Seat, start: MatchStart) {
  const seats = houseSeats(start.setup);
  return (tick: number, sim: Sim): GameCommand[] => {
    const v = sim.view();
    const team = v.turn.activeTeam;
    const since = tick % 240;
    if (seats[team] !== seat) return [];
    // The walk left after the shot is not wanted: the turn ends a second after it.
    if (v.turn.phase === 'retreat' && since === 120) return [{ t: 'skip' }];
    if (v.turn.phase !== 'action') return [];
    const left = team % 2 === 0;
    if (since === 10) return [{ t: 'move', dir: left ? 1 : -1 }];
    if (since === 40) return [{ t: 'move', dir: 0 }];
    if (since === 60) {
      return [
        { t: 'selectWeapon', id: 'sling' },
        { t: 'aim', angle: left ? 3700 : 2440 },
        { t: 'fire', power: 760 + (tick % 97) },
      ];
    }
    return [];
  };
}

class Peer {
  sim: Sim;
  lockstep: Lockstep;
  readonly seat: Seat;
  private readonly input: (tick: number, sim: Sim) => GameCommand[];

  constructor(seat: Seat, lockstep: Lockstep, config: MatchConfig = CONFIG) {
    this.seat = seat;
    this.lockstep = lockstep;
    this.sim = new Sim(config, lockstep.start.seed, flatMask());
    this.input = play(seat, lockstep.start);
    lockstep.produceAfter(this.sim.view(), (t) => this.input(t, this.sim));
  }

  /** Plays the ticks it knows, `max` at most; returns how many. */
  run(max: number, input = true): number {
    let n = 0;
    while (n < max && this.sim.view().turn.phase !== 'gameOver') {
      const t = this.sim.view().tick + 1;
      if (!this.lockstep.ready(t)) break;
      const events = this.sim.step(this.lockstep.commandsAt(t));
      for (const e of events) {
        if (e.e === 'turnStarted') this.lockstep.turnStarted(e.turn, this.sim.hash());
      }
      this.lockstep.produceAfter(this.sim.view(), (tt) => (input ? this.input(tt, this.sim) : []));
      n++;
    }
    return n;
  }
}

/**
 * The creator and its friends joined by `link`, through the lobby of session.ts: each friend
 * says hello, then the creator starts the match.
 */
async function meetAll(
  link: MemoryLink,
  start: MatchStart,
  config: MatchConfig,
): Promise<Peer[]> {
  const lobby = new Lobby(link.a, 'build');
  const friends = link.ends.slice(1).map((end, k) => connect(end, k + 1, 'build'));
  for (let i = 0; i < 20; i++) link.tick();
  expect(lobby.joined.size).toBe(friends.length);
  const host = lobby.start(start);
  for (let i = 0; i < 20; i++) link.tick();
  const joined = await Promise.all(friends);
  return [
    new Peer(0, host, config),
    ...joined.map((j, k) => new Peer(k + 1, j.lockstep, config)),
  ];
}

/** The creator and one friend. */
async function meet(link: MemoryLink): Promise<[Peer, Peer]> {
  const [host, guest] = await meetAll(link, START, CONFIG);
  if (!host || !guest) throw new Error('two peers');
  return [host, guest];
}

/** The peers play side by side, a few ticks per step of the wire, until `ticks`. */
function race(link: MemoryLink, peers: Peer[], ticks: number, speeds: number[] = [1, 1]): void {
  for (let i = 0; i < ticks * 4 && peers.some((p) => p.sim.view().tick < ticks); i++) {
    link.tick();
    peers.forEach((p, k) => {
      p.run(Math.min(speeds[k] ?? 1, ticks - p.sim.view().tick));
    });
  }
}

describe('online lockstep (TECH_SPEC §8.4)', () => {
  it('keeps both peers on the same match through latency and reordering', async () => {
    const rnd = mulberry(5);
    const link = new MemoryLink(() => 1 + Math.floor(rnd() * 12));
    const [host, guest] = await meet(link);
    race(link, [host, guest], 6000, [1, 2]);
    expect(host.sim.view().tick).toBe(6000);
    expect(guest.sim.view().tick).toBe(6000);
    expect(host.sim.view().turn.number).toBeGreaterThan(3);
    expect(guest.sim.hash()).toBe(host.sim.hash());
    expect(host.lockstep.desyncTurn).toBeNull();
    expect(guest.lockstep.desyncTurn).toBeNull();
    // Both houses fired: the guest's commands reached the host and the other way round.
    const hp = host.sim.view().units.map((u) => u.hp);
    expect(hp.some((x) => x < 40)).toBe(true);
    // Batches, not a message per tick.
    expect(link.sent).toBeLessThan(6000 / 3);
  });

  it('waits for the commands it does not have, and never plays ahead of them', async () => {
    const link = new MemoryLink(() => 1);
    const [host, guest] = await meet(link);
    // The guest runs alone: it stops where the host's commands end.
    guest.run(10000);
    const stop = guest.sim.view().tick;
    expect(stop).toBeLessThanOrEqual(START.delay);
    host.run(200);
    link.tick();
    link.tick();
    guest.run(10000);
    expect(guest.sim.view().tick).toBeGreaterThan(stop);
    expect(guest.sim.view().tick).toBeLessThanOrEqual(200 + START.delay + 1);
  });

  it('tells both peers when the match no longer agrees', async () => {
    const link = new MemoryLink(() => 2);
    const [host, guest] = await meet(link);
    race(link, [host, guest], 1500);
    // A corrupted guest: one HP off.
    const snap = guest.sim.snapshot();
    const u = snap.units[0];
    if (u) u.hp -= 1;
    guest.sim.restore(snap);
    race(link, [host, guest], 8000);
    expect(host.lockstep.desyncTurn).not.toBeNull();
    expect(guest.lockstep.desyncTurn).toBe(host.lockstep.desyncTurn);
  });

  it('resumes a peer whose page reloaded, at the same state', async () => {
    const rnd = mulberry(9);
    const link = new MemoryLink(() => 1 + Math.floor(rnd() * 6));
    const [host, guest] = await meet(link);
    race(link, [host, guest], 2500);
    // The guest's page reloads: its state is gone, so is what was on its way to it.
    link.drop(1);
    const back = connect(link.b, 1, 'build');
    for (let i = 0; i < 10; i++) link.tick();
    const joined = await back;
    expect(joined.resumed).toBe(true);
    const again = new Peer(1, joined.lockstep);
    // It replays the match so far at full speed, deciding nothing on the way.
    again.run(100000, false);
    expect(again.sim.view().tick).toBeGreaterThan(2000);
    race(link, [host, again], 7000);
    expect(again.sim.hash()).toBe(host.sim.hash());
    expect(host.lockstep.desyncTurn).toBeNull();
  });

  it('refuses a peer that runs another build', async () => {
    const link = new MemoryLink(() => 1);
    const lobby = new Lobby(link.a, 'build-a');
    const g = connect(link.b, 1, 'build-b');
    for (let i = 0; i < 10; i++) link.tick();
    await expect(g).rejects.toThrow('version');
    expect(lobby.joined.size).toBe(0);
  });

  it('pauses both peers from either one', async () => {
    const link = new MemoryLink(() => 1);
    const [host, guest] = await meet(link);
    guest.lockstep.setPaused(true);
    link.tick();
    link.tick();
    expect(host.lockstep.remotePaused).toBe(true);
    guest.lockstep.setPaused(false);
    link.tick();
    link.tick();
    expect(host.lockstep.remotePaused).toBe(false);
  });

  it('plays two friends and the AI with the creator, who decides for the AI', async () => {
    const rnd = mulberry(13);
    const { start, config } = startOf(['human', 'friend', 'friend', 'squire']);
    expect(houseSeats(start.setup)).toEqual([0, 1, 2, 0]);
    const link = new MemoryLink(() => 1 + Math.floor(rnd() * 10), 3);
    const peers = await meetAll(link, start, config);
    race(link, peers, 9000, [1, 2, 3]);
    const [host, ...friends] = peers;
    if (!host) throw new Error('creator');
    // Each of the four houses had turns: the friends' and the AI's commands went round.
    expect(host.sim.view().turn.number).toBeGreaterThan(8);
    expect(host.sim.view().units.filter((u) => u.hp < 40).length).toBeGreaterThan(1);
    for (const f of friends) {
      expect(f.sim.view().tick).toBe(9000);
      expect(f.sim.hash()).toBe(host.sim.hash());
      expect(f.lockstep.desyncTurn).toBeNull();
    }
    expect(host.lockstep.desyncTurn).toBeNull();
  });

  it('gives the match so far to a friend who joins after the start', async () => {
    const rnd = mulberry(21);
    const { start, config } = startOf(['human', 'friend']);
    const link = new MemoryLink(() => 1 + Math.floor(rnd() * 4));
    const lobby = new Lobby(link.a, 'build');
    const host = new Peer(0, lobby.start(start), config);
    // Alone, the creator plays until the friend's house is to play.
    race(link, [host], 600);
    const late = connect(link.b, 1, 'build');
    for (let i = 0; i < 10; i++) link.tick();
    const joined = await late;
    const friend = new Peer(1, joined.lockstep, config);
    friend.run(100000, false);
    race(link, [host, friend], 5000);
    expect(friend.sim.view().tick).toBe(5000);
    expect(friend.sim.hash()).toBe(host.sim.hash());
  });
});

/** Unused-transport guard: a Transport is all the lockstep needs. */
export type { Transport };
