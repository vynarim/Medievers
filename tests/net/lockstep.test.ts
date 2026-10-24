import { describe, expect, it } from 'vitest';
import { defaultSetup } from '../../src/app/match-setup.ts';
import { Lockstep } from '../../src/net/lockstep.ts';
import { roleOfTeam, type MatchStart, type Role } from '../../src/net/protocol.ts';
import { connect } from '../../src/net/session.ts';
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
const CONFIG: MatchConfig = {
  rules: { ...RULES, startHp: 40 },
  teams: [{ spawns: [300, 700] }, { spawns: [1000, 1300] }],
};
const START: MatchStart = { setup: defaultSetup(false), rules: CONFIG.rules, seed: 77, delay: 30 };

/** What a player does: walk a little, then a sling shot towards the other side. */
function play(role: Role) {
  return (tick: number, sim: Sim): GameCommand[] => {
    const v = sim.view();
    if (v.turn.phase !== 'action' || roleOfTeam(v.turn.activeTeam) !== role) return [];
    const since = tick % 240;
    if (since === 10) return [{ t: 'move', dir: role === 'host' ? 1 : -1 }];
    if (since === 40) return [{ t: 'move', dir: 0 }];
    if (since === 60) {
      return [
        { t: 'selectWeapon', id: 'sling' },
        { t: 'aim', angle: role === 'host' ? 3700 : 2440 },
        { t: 'fire', power: 760 + (tick % 97) },
      ];
    }
    return [];
  };
}

class Peer {
  sim = new Sim(CONFIG, START.seed, flatMask());
  lockstep: Lockstep;
  readonly role: Role;
  private readonly input: (tick: number, sim: Sim) => GameCommand[];

  constructor(role: Role, lockstep: Lockstep) {
    this.role = role;
    this.lockstep = lockstep;
    this.input = play(role);
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

/** Host and guest joined by `link`, through the meeting of session.ts. */
async function meet(link: MemoryLink): Promise<[Peer, Peer]> {
  const h = connect(link.a, 'host', 'build', START);
  const g = connect(link.b, 'guest', 'build', null);
  for (let i = 0; i < 50; i++) link.tick();
  const [host, guest] = await Promise.all([h, g]);
  return [new Peer('host', host.lockstep), new Peer('guest', guest.lockstep)];
}

/** Both peers play side by side, a few ticks per step of the wire, until `ticks`. */
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
    const back = connect(link.b, 'guest', 'build', null);
    for (let i = 0; i < 10; i++) link.tick();
    const joined = await back;
    expect(joined.resumed).toBe(true);
    const again = new Peer('guest', joined.lockstep);
    // It replays the match so far at full speed, deciding nothing on the way.
    again.run(100000, false);
    expect(again.sim.view().tick).toBeGreaterThan(2000);
    race(link, [host, again], 7000);
    expect(again.sim.hash()).toBe(host.sim.hash());
    expect(host.lockstep.desyncTurn).toBeNull();
  });

  it('refuses a peer that runs another build', async () => {
    const link = new MemoryLink(() => 1);
    const h = connect(link.a, 'host', 'build-a', START);
    const g = connect(link.b, 'guest', 'build-b', null);
    for (let i = 0; i < 10; i++) link.tick();
    await expect(g).rejects.toThrow('version');
    await expect(h).rejects.toThrow('version');
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
});

/** Unused-transport guard: a Transport is all the lockstep needs. */
export type { Transport };
