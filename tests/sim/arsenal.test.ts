import { describe, expect, it } from 'vitest';
import { CRATE_RULES, CrateKind } from '../../src/content/crates.ts';
import { CLASSIC_RULES, weaponIndexIn, type MatchRules } from '../rules-fixture.ts';
import { WEAPONS } from '../../src/content/weapons.ts';
import { Material, Sim, type GameCommand, type Mask, type SimEvent } from '../../src/sim/index.ts';

function flatMask(): Mask {
  const width = 1200;
  const height = 600;
  const data = new Uint8Array(width * height);
  for (let y = 500; y < height; y++) data.fill(Material.Earth, y * width, (y + 1) * width);
  return { width, height, data };
}

// Only the arsenal under test: no wind, kitchen, fire, barrels or reliquaries.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { kitchen, burn, barrels, crates, beasts, ...BASE } = CLASSIC_RULES;
const CALM: MatchRules = { ...BASE, wind: { ...CLASSIC_RULES.wind, max: 0 } };

function duel(rules: MatchRules, a: number, b: number): Sim {
  const sim = new Sim({ rules, teams: [{ spawns: [a] }, { spawns: [b] }] }, 2, flatMask());
  for (let i = 0; i < 1000 && sim.view().turn.phase !== 'action'; i++) sim.step();
  return sim;
}

function run(sim: Sim, cmds: GameCommand[], ticks: number): SimEvent[] {
  const events = [...sim.step(cmds)];
  for (let i = 0; i < ticks; i++) events.push(...sim.step());
  return events;
}

const def = (id: string) => WEAPONS.find((w) => w.id === id);

describe('crossbow', () => {
  it('always shoots at full power, whatever the gauge', () => {
    const sim = duel(CALM, 300, 900);
    sim.step([
      { t: 'selectWeapon', id: 'crossbow' },
      { t: 'aim', angle: 0 },
      { t: 'fire', power: 10 },
    ]);
    const p = sim.view().shots[0]?.projectile;
    expect(p?.vx).toBe(def('crossbow')?.maxSpeed);
  });

  it('has two bolts', () => {
    const sim = duel(CALM, 300, 900);
    const i = weaponIndexIn(CALM, 'crossbow');
    expect(sim.view().teams[0]?.ammo[i]).toBe(2);
    sim.step([
      { t: 'selectWeapon', id: 'crossbow' },
      { t: 'aim', angle: 3500 },
      { t: 'fire', power: 1024 },
    ]);
    expect(sim.view().teams[0]?.ammo[i]).toBe(1);
  });
});

describe('pot de poix', () => {
  it('bursts into five fragments that explode where they land', () => {
    const sim = duel(CALM, 300, 900);
    const events = run(
      sim,
      [
        { t: 'selectWeapon', id: 'pitchPot' },
        { t: 'setFuse', seconds: 1 },
        { t: 'aim', angle: 3584 },
        { t: 'fire', power: 500 },
      ],
      400,
    );
    const blasts = events.filter((e) => e.e === 'explosion');
    expect(blasts).toHaveLength(1 + (def('pitchPot')?.fragments?.count ?? 0));
    expect(sim.view().shots).toHaveLength(0);
  });
});

describe('mace', () => {
  it('hits the unit right in front and sends it flying along the aim', () => {
    const sim = duel(CALM, 300, 330);
    const events = run(
      sim,
      [
        { t: 'selectWeapon', id: 'mace' },
        { t: 'aim', angle: 0 },
        { t: 'fire', power: 0 },
      ],
      5,
    );
    expect(events).toContainEqual({ e: 'unitDamaged', unitId: 2, damage: def('mace')?.damage });
    const u = sim.view().units.find((x) => x.id === 2);
    expect(u?.vx).toBeGreaterThan(0);
  });

  it('throws further the more it is charged', () => {
    const vx = (power: number) => {
      const sim = duel(CALM, 300, 330);
      sim.step([
        { t: 'selectWeapon', id: 'mace' },
        { t: 'aim', angle: 0 },
        { t: 'fire', power },
      ]);
      return sim.view().units.find((x) => x.id === 2)?.vx ?? 0;
    };
    const min = def('mace')?.knockbackMinPct ?? 0;
    const full = vx(1024);
    expect(vx(0)).toBeGreaterThan(0);
    expect(vx(0)).toBeLessThan(vx(512));
    expect(vx(512)).toBeLessThan(full);
    expect(Math.abs(vx(0) - Math.trunc((full * min) / 100))).toBeLessThanOrEqual(2);
  });

  it('misses a unit out of reach', () => {
    const sim = duel(CALM, 300, 420);
    const events = run(
      sim,
      [
        { t: 'selectWeapon', id: 'mace' },
        { t: 'aim', angle: 0 },
        { t: 'fire', power: 0 },
      ],
      5,
    );
    expect(events.some((e) => e.e === 'unitDamaged')).toBe(false);
    // Nothing in reach: the blow is refused and the turn keeps its action.
    expect(events).toContainEqual({ e: 'toolRefused', weapon: 'mace' });
    expect(sim.view().turn.phase).toBe('action');
    expect(sim.view().turn.fired).toBe(false);
    expect(sim.strikeRefused()).toBe(true);
  });

  it('is not refused with someone in reach', () => {
    const sim = duel(CALM, 300, 330);
    sim.step([
      { t: 'selectWeapon', id: 'mace' },
      { t: 'aim', angle: 0 },
    ]);
    expect(sim.strikeRefused()).toBe(false);
    // Aimed the other way, there is nothing to strike.
    sim.step([{ t: 'aim', angle: 2048 }]);
    expect(sim.strikeRefused()).toBe(true);
  });
});

describe('reliquaries (GDD §4.5)', () => {
  const withCrates: MatchRules = { ...CALM, crates: { ...CRATE_RULES, chancePermille: 1000 } };

  it('come down at the end of a turn and settle on the ground', () => {
    const sim = duel(withCrates, 300, 900);
    const events = run(sim, [{ t: 'skip' }], 900);
    expect(events.some((e) => e.e === 'crateDropped')).toBe(true);
    const c = sim.view().crates[0];
    expect(c?.landed).toBe(true);
    expect((c?.y ?? 0) / 256).toBe(500);
  });

  it('give a balm to the unit that touches them, without going over the starting HP', () => {
    const sim = duel(withCrates, 300, 900);
    const snap = sim.snapshot();
    const u = snap.units.find((x) => x.id === 1);
    if (u) u.hp = 50;
    snap.crates.push({
      id: 500,
      x: 300 * 256,
      y: 500 * 256,
      kind: CrateKind.Balm,
      weapon: -1,
      landed: true,
    });
    sim.restore(snap);
    const events = run(sim, [], 2);
    expect(events).toContainEqual({
      e: 'crateTaken',
      id: 500,
      unitId: 1,
      kind: CrateKind.Balm,
      weapon: -1,
      heal: CRATE_RULES.balmHp,
    });
    expect(sim.view().units.find((x) => x.id === 1)?.hp).toBe(75);
  });

  it('give one more shot of a limited weapon', () => {
    const sim = duel(withCrates, 300, 900);
    const i = weaponIndexIn(CALM, 'greekFire');
    const snap = sim.snapshot();
    snap.crates.push({
      id: 500,
      x: 300 * 256,
      y: 500 * 256,
      kind: CrateKind.Weapon,
      weapon: i,
      landed: true,
    });
    sim.restore(snap);
    run(sim, [], 2);
    expect(sim.view().teams[0]?.ammo[i]).toBe((def('greekFire')?.ammo ?? 0) + 1);
  });

  it('blow up when trapped, or when shot', () => {
    const sim = duel(withCrates, 300, 900);
    const snap = sim.snapshot();
    snap.crates.push(
      { id: 500, x: 300 * 256, y: 500 * 256, kind: CrateKind.Trap, weapon: -1, landed: true },
      { id: 501, x: 500 * 256, y: 500 * 256, kind: CrateKind.Balm, weapon: -1, landed: true },
    );
    sim.restore(snap);
    const events = run(sim, [], 4);
    expect(events).toContainEqual({ e: 'crateBurst', id: 500, trap: true });
    expect(events.some((e) => e.e === 'explosion')).toBe(true);
    expect(sim.view().crates.map((c) => c.id)).toEqual([501]);
  });

  it('never come down in logs recorded without them', () => {
    const sim = duel(CALM, 300, 900);
    run(sim, [{ t: 'skip' }], 900);
    expect(sim.view().crates).toHaveLength(0);
  });
});
