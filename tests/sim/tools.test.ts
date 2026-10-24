import { describe, expect, it } from 'vitest';
import { CLASSIC_RULES, weaponIndexIn, type MatchRules } from '../rules-fixture.ts';
import { WEAPONS } from '../../src/content/weapons.ts';
import { Material, Sim, type GameCommand, type Mask, type SimEvent } from '../../src/sim/index.ts';
import { sapAngle, wallAngle, wallShape, wallSize } from '../../src/sim/tools.ts';

/** Earth from y = 500 down; a block of rock from x = 800 under y = 560. */
function mask(): Mask {
  const width = 1200;
  const height = 800;
  const data = new Uint8Array(width * height);
  for (let y = 500; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data[y * width + x] = x >= 800 && y >= 560 ? Material.Rock : Material.Earth;
    }
  }
  return { width, height, data };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { kitchen, burn, barrels, crates, beasts, deluge, ...BASE } = CLASSIC_RULES;
const CALM: MatchRules = { ...BASE, wind: { ...CLASSIC_RULES.wind, max: 0 } };

function duel(a: number, b: number, rules: MatchRules = CALM, classes?: string[]): Sim {
  const sim = new Sim(
    {
      rules,
      teams: [
        { spawns: [a], ...(classes ? { classes: [classes[0] as 'sapper'] } : {}) },
        { spawns: [b], ...(classes ? { classes: [classes[1] as 'sapper'] } : {}) },
      ],
    },
    2,
    mask(),
  );
  for (let i = 0; i < 1000 && sim.view().turn.phase !== 'action'; i++) sim.step();
  return sim;
}

function run(sim: Sim, cmds: GameCommand[], ticks: number): SimEvent[] {
  const events = [...sim.step(cmds)];
  for (let i = 0; i < ticks; i++) events.push(...sim.step());
  return events;
}

const def = (id: string) => WEAPONS.find((w) => w.id === id);
const unit = (sim: Sim, id = 1) => sim.view().units.find((u) => u.id === id);
const px = (v: number | undefined) => (v ?? 0) >> 8;

describe('pick (GDD §4.4)', () => {
  it('digs straight down for 3 s, the unit going down the shaft', () => {
    const sim = duel(300, 1000);
    run(
      sim,
      [
        { t: 'selectWeapon', id: 'pick' },
        { t: 'fire', power: 0 },
      ],
      240,
    );
    const depth = px(unit(sim)?.y) - 500;
    expect(depth).toBeGreaterThan(70);
    expect(depth).toBeLessThan(100);
    expect(px(unit(sim)?.x)).toBe(300);
    expect(sim.view().dig).toBeNull();
    expect(sim.view().teams[0]?.ammo[weaponIndexIn(CALM, 'pick')]).toBe(1);
  });

  it('digs twice as deep for a sapper (Maître d’œuvre)', () => {
    const plain = duel(300, 1000, CALM, ['knight', 'knight']);
    run(
      plain,
      [
        { t: 'selectWeapon', id: 'pick' },
        { t: 'fire', power: 0 },
      ],
      240,
    );
    const sapper = duel(300, 1000, CALM, ['sapper', 'knight']);
    run(
      sapper,
      [
        { t: 'selectWeapon', id: 'pick' },
        { t: 'fire', power: 0 },
      ],
      240,
    );
    const a = px(unit(plain)?.y) - 500;
    const b = px(unit(sapper)?.y) - 500;
    expect(b).toBeGreaterThan(a + 70);
  });

  it('stops at rock', () => {
    const sim = duel(900, 300);
    run(
      sim,
      [
        { t: 'selectWeapon', id: 'pick' },
        { t: 'fire', power: 0 },
      ],
      240,
    );
    expect(px(unit(sim)?.y)).toBeLessThanOrEqual(560);
  });

  it('holds the clock and ignores walking while it digs', () => {
    const sim = duel(300, 1000);
    run(
      sim,
      [
        { t: 'selectWeapon', id: 'pick' },
        { t: 'fire', power: 0 },
      ],
      10,
    );
    const phase = sim.view().turn.phaseTicks;
    run(sim, [{ t: 'move', dir: 1 }], 30);
    expect(px(unit(sim)?.x)).toBe(300);
    expect(sim.view().turn.phaseTicks).toBe(phase);
  });
});

describe('sap (GDD §4.4)', () => {
  it('cuts a level tunnel the unit walks along', () => {
    const sim = duel(300, 1100);
    // Into a bank: first walk down a pick shaft, then sap sideways from the bottom.
    run(
      sim,
      [
        { t: 'selectWeapon', id: 'pick' },
        { t: 'fire', power: 0 },
      ],
      400,
    );
    run(sim, [{ t: 'skip' }], 900);
    for (let i = 0; i < 2000 && sim.view().turn.activeTeam !== 0; i++) {
      const phase = sim.view().turn.phase;
      if (phase === 'action' || phase === 'retreat') sim.step([{ t: 'skip' }]);
      else sim.step();
    }
    for (let i = 0; i < 1000 && sim.view().turn.phase !== 'action'; i++) sim.step();
    const y0 = px(unit(sim)?.y);
    run(
      sim,
      [
        { t: 'selectWeapon', id: 'sap' },
        { t: 'aim', angle: 0 },
        { t: 'fire', power: 0 },
      ],
      300,
    );
    const u = unit(sim);
    expect(px(u?.x) - 300).toBeGreaterThan(120);
    // Level: the floor of the tunnel stays within a few px of where it started.
    expect(Math.abs(px(u?.y) - y0)).toBeLessThanOrEqual(4);
  });

  it('cuts level, or 45° up or down, on the aimed side', () => {
    expect(sapAngle(0)).toBe(0);
    expect(sapAngle(3700)).toBe(3584);
    expect(sapAngle(300)).toBe(512);
    expect(sapAngle(2100)).toBe(2048);
    expect(sapAngle(2500)).toBe(2560);
    expect(sapAngle(1700)).toBe(1536);
  });
});

describe('chausse-trape (GDD §4.4)', () => {
  it('is left ahead of the unit, arms in 2 s and goes off under a unit', () => {
    const sim = duel(300, 1000);
    run(
      sim,
      [
        { t: 'selectWeapon', id: 'caltrop' },
        { t: 'fire', power: 0 },
      ],
      5,
    );
    const mine = sim.view().mines[0];
    expect(mine).toBeDefined();
    expect(px(mine?.x)).toBeGreaterThan(320);
    expect(px(mine?.y)).toBe(500);
    // Not armed yet: walking over it does nothing.
    const snap = sim.snapshot();
    const u = snap.units[0];
    if (u) u.x = (mine?.x ?? 0) - 4 * 256;
    sim.restore(snap);
    expect(run(sim, [], 30).some((e) => e.e === 'explosion')).toBe(false);
    const events = run(sim, [], def('caltrop')?.mine?.armTicks ?? 0);
    expect(events).toContainEqual({ e: 'mineSprung', id: mine?.id, team: 0 });
    expect(events).toContainEqual({ e: 'unitDamaged', unitId: 1, damage: expect.any(Number) });
    expect(sim.view().mines).toHaveLength(0);
  });

  it('goes behind its unit against a wall, not under it', () => {
    const sim = duel(300, 1000);
    const snap = sim.snapshot();
    const t = snap.terrain;
    for (let y = 300; y < 500; y++) for (let x = 315; x < 360; x++) t.data[y * t.width + x] = 1;
    sim.restore(snap);
    run(
      sim,
      [
        { t: 'selectWeapon', id: 'caltrop' },
        { t: 'aim', angle: 0 },
        { t: 'fire', power: 0 },
      ],
      5,
    );
    const mine = sim.view().mines[0];
    expect(px(mine?.x)).toBeLessThan(280);
    expect(px(mine?.y)).toBe(500);
    // Armed, it stays put while its unit stands still.
    expect(run(sim, [], 200).some((e) => e.e === 'mineSprung')).toBe(false);
  });

  it('is left up a gentle rise ahead', () => {
    const sim = duel(300, 1000);
    const snap = sim.snapshot();
    const t = snap.terrain;
    for (let y = 490; y < 500; y++) for (let x = 315; x < 400; x++) t.data[y * t.width + x] = 1;
    sim.restore(snap);
    run(
      sim,
      [
        { t: 'selectWeapon', id: 'caltrop' },
        { t: 'aim', angle: 0 },
        { t: 'fire', power: 0 },
      ],
      5,
    );
    const mine = sim.view().mines[0];
    expect(px(mine?.x)).toBeGreaterThan(320);
    expect(px(mine?.y)).toBe(490);
  });

  it('is set off by a blast that reaches it', () => {
    const sim = duel(300, 1000);
    run(
      sim,
      [
        { t: 'selectWeapon', id: 'caltrop' },
        { t: 'fire', power: 0 },
      ],
      2,
    );
    const snap = sim.snapshot();
    const m = snap.mines[0];
    if (m)
      snap.explosions.items.push({
        tick: snap.tick + 1,
        seq: 99,
        explosion: {
          x: m.x + 20 * 256,
          y: m.y,
          radius: 40,
          carveRadius: 0,
          maxDamage: 10,
          sourceId: 9999,
        },
      });
    sim.restore(snap);
    const events = run(sim, [], 20);
    expect(events.filter((e) => e.e === 'explosion')).toHaveLength(2);
  });
});

describe('mur de pierres (GDD §4.4)', () => {
  it('sets dressed stone below where clicked, along the aim, dropped onto the ground', () => {
    const sim = duel(300, 1000);
    const events = run(
      sim,
      [
        { t: 'selectWeapon', id: 'stoneWall' },
        { t: 'aim', angle: 0 },
        { t: 'fireAt', x: 450, y: 420 },
      ],
      1,
    );
    // Clicked 80 px above the ground (500): the stone falls until it stands on it.
    const built = events.find((e) => e.e === 'wallBuilt');
    expect(built).toEqual({ e: 'wallBuilt', x: 450, y: 500 - 8 });
    const t = sim.view().terrain;
    expect(t.data[420 * t.width + 450]).toBe(Material.Air);
    expect(t.data[495 * t.width + 450]).toBe(Material.BuiltStone);
    expect(t.data[495 * t.width + 450 + 38]).toBe(Material.BuiltStone);
    expect(t.data[(495 - 20) * t.width + 450]).toBe(Material.Air);
    expect(sim.view().turn.phase).toBe('retreat');
  });

  it('is refused too far, or on a unit, and keeps its stones', () => {
    const sim = duel(300, 1000);
    const i = weaponIndexIn(CALM, 'stoneWall');
    const events = run(
      sim,
      [
        { t: 'selectWeapon', id: 'stoneWall' },
        { t: 'fireAt', x: 900, y: 400 },
        { t: 'fireAt', x: 300, y: 460 },
      ],
      1,
    );
    expect(events.filter((e) => e.e === 'toolRefused')).toHaveLength(2);
    expect(sim.view().teams[0]?.ammo[i]).toBe(def('stoneWall')?.ammo);
    expect(sim.view().turn.phase).toBe('action');
  });

  it('comes in three lengths and turns by steps of 22.5°', () => {
    expect(wallSize(60)).toBe(1);
    expect(wallSize(180)).toBe(3);
    expect(wallAngle(130)).toBe(256);
    expect(wallAngle(4090)).toBe(0);
    const w = def('stoneWall')?.wall;
    if (!w) throw new Error('no wall');
    const level = wallShape(w, 80, 0).shape;
    const count = level.data.reduce((n, v) => n + v, 0);
    expect(count).toBe(81 * 15);
  });

  it('is fired with the gauge as far along the aim as the power says', () => {
    const sim = duel(300, 1000);
    const events = run(
      sim,
      [
        { t: 'selectWeapon', id: 'stoneWall' },
        { t: 'aim', angle: 0 },
        { t: 'fire', power: 512 },
      ],
      1,
    );
    const reach = def('stoneWall')?.wall?.reach ?? 0;
    expect(events).toContainEqual({ e: 'wallBuilt', x: 300 + (reach >> 1), y: 500 - 8 });
  });

  it('stays where it is set in logs recorded before walls fell', () => {
    const rules: MatchRules = {
      ...CALM,
      weapons: CALM.weapons.map((w) => {
        if (!w.wall) return w;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { fall, ...old } = w.wall;
        return { ...w, wall: old };
      }),
    };
    const sim = duel(300, 1000, rules);
    const events = run(
      sim,
      [
        { t: 'selectWeapon', id: 'stoneWall' },
        { t: 'aim', angle: 0 },
        { t: 'fireAt', x: 450, y: 420 },
      ],
      1,
    );
    expect(events).toContainEqual({ e: 'wallBuilt', x: 450, y: 420 });
  });
});

describe('volée de trébuchet (GDD §4.2)', () => {
  it('drops five stones around the clicked point, each bursting where it lands', () => {
    const sim = duel(300, 1000);
    const events = run(
      sim,
      [
        { t: 'selectWeapon', id: 'trebuchet' },
        { t: 'aim', angle: 0 },
        { t: 'fireAt', x: 1000, y: 0 },
      ],
      400,
    );
    const blasts = events.filter((e) => e.e === 'explosion');
    expect(blasts).toHaveLength(5);
    for (const b of blasts) {
      if (b.e !== 'explosion') continue;
      expect(Math.abs((b.x >> 8) - 1000)).toBeLessThan(80);
    }
    expect(events.some((e) => e.e === 'unitDamaged' && e.unitId === 2)).toBe(true);
  });
});
