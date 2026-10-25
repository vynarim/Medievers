// The weapons of the full arsenal (BACKLOG M4, lot 6): sword, shield charge…
import { describe, expect, it } from 'vitest';
import { CLASSIC_RULES, type MatchRules } from '../rules-fixture.ts';
import { Material, Sim, type GameCommand, type Mask, type SimEvent } from '../../src/sim/index.ts';
import { heldAim } from '../../src/sim/weapons/weapons.ts';
import { STRUCTURE_RULES } from '../../src/content/structures.ts';

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

function match(rules: MatchRules, a: number, b: readonly number[], mask = flatMask()): Sim {
  const sim = new Sim({ rules, teams: [{ spawns: [a] }, { spawns: [...b] }] }, 2, mask);
  for (let i = 0; i < 1000 && sim.view().turn.phase !== 'action'; i++) sim.step();
  return sim;
}

function run(sim: Sim, cmds: GameCommand[], ticks: number): SimEvent[] {
  const events = [...sim.step(cmds)];
  for (let i = 0; i < ticks; i++) events.push(...sim.step());
  return events;
}

const unit = (sim: Sim, id: number) => sim.view().units.find((u) => u.id === id);
const px = (v: number | undefined) => (v ?? 0) >> 8;

describe('sword (GDD §4.3)', () => {
  it('strikes level on the facing side, whatever the aim, for 25 HP and a light recoil', () => {
    const sim = match(CALM, 300, [340]);
    run(
      sim,
      [
        { t: 'selectWeapon', id: 'sword' },
        // Aimed high on the right: the sword still strikes level, to the right.
        { t: 'aim', angle: 3200 },
        { t: 'fire', power: 0 },
      ],
      200,
    );
    const foe = unit(sim, 2);
    expect(foe?.hp).toBe(75);
    const moved = px(foe?.x) - 340;
    expect(moved).toBeGreaterThan(5);
    expect(moved).toBeLessThan(120);
  });

  it('is refused with nobody in front, the action kept', () => {
    const sim = match(CALM, 300, [800]);
    const events = run(
      sim,
      [
        { t: 'selectWeapon', id: 'sword' },
        { t: 'aim', angle: 0 },
        { t: 'fire', power: 0 },
      ],
      1,
    );
    expect(events.some((e) => e.e === 'toolRefused')).toBe(true);
    expect(sim.view().turn.phase).toBe('action');
  });
});

describe('shield charge (GDD §4.3)', () => {
  it('runs 120 px ahead and throws every unit it meets, once each', () => {
    const sim = match(CALM, 300, [360, 400]);
    run(
      sim,
      [
        { t: 'selectWeapon', id: 'shieldCharge' },
        { t: 'aim', angle: 0 },
        { t: 'fire', power: 0 },
      ],
      400,
    );
    const v = sim.view();
    expect(px(unit(sim, 1)?.x)).toBe(420);
    expect(unit(sim, 2)?.hp).toBe(80);
    expect(unit(sim, 3)?.hp).toBe(80);
    expect(px(unit(sim, 2)?.x)).toBeGreaterThan(420);
    expect(v.charge).toBeNull();
  });

  it('stops against a wall', () => {
    const mask = flatMask();
    for (let y = 300; y < 500; y++) mask.data.fill(Material.Rock, y * 1200 + 380, y * 1200 + 420);
    const sim = match(CALM, 300, [900], mask);
    run(
      sim,
      [
        { t: 'selectWeapon', id: 'shieldCharge' },
        { t: 'aim', angle: 0 },
        { t: 'fire', power: 0 },
      ],
      200,
    );
    expect(px(unit(sim, 1)?.x)).toBeLessThan(380);
    expect(px(unit(sim, 1)?.x)).toBeGreaterThan(340);
  });

  it('is forbidden to a cleric', () => {
    const sim = new Sim(
      {
        rules: CALM,
        teams: [{ spawns: [300], classes: ['cleric'] }, { spawns: [360] }],
      },
      2,
      flatMask(),
    );
    for (let i = 0; i < 1000 && sim.view().turn.phase !== 'action'; i++) sim.step();
    sim.step([{ t: 'selectWeapon', id: 'shieldCharge' }]);
    expect(sim.view().turn.weapon).toBe('bow');
  });
});

describe('rain of arrows (GDD §4.2)', () => {
  it('drops twelve arrows around the point, each one striking like an arrow', () => {
    const sim = match(CALM, 300, [900, 1000]);
    const events = run(
      sim,
      [
        { t: 'selectWeapon', id: 'arrowRain' },
        { t: 'aim', angle: 0 },
        { t: 'fireAt', x: 900, y: 0 },
      ],
      600,
    );
    expect(events.filter((e) => e.e === 'shotEnded')).toHaveLength(12);
    expect(events.some((e) => e.e === 'explosion')).toBe(false);
    const hp = unit(sim, 2)?.hp ?? 100;
    expect(hp).toBeLessThan(100);
    expect((100 - hp) % 10).toBe(0);
    // The other enemy, 100 px off, is out of the rain.
    expect(unit(sim, 3)?.hp).toBe(100);
    expect(events.some((e) => e.e === 'terrainCarved')).toBe(true);
  });
});

describe('miracle (GDD §4.4)', () => {
  it('sets the unit down on the free point clicked, on the ground below, and ends the turn', () => {
    const sim = match(CALM, 300, [1000]);
    const events = run(
      sim,
      [
        { t: 'selectWeapon', id: 'miracle' },
        { t: 'fireAt', x: 700, y: 300 },
      ],
      0,
    );
    expect(events.some((e) => e.e === 'teleported')).toBe(true);
    expect(px(unit(sim, 1)?.x)).toBe(700);
    expect(px(unit(sim, 1)?.y)).toBe(500);
    expect(sim.view().turn.phase).toBe('resolution');
    run(sim, [], 300);
    expect(unit(sim, 1)?.hp).toBe(100);
  });

  it('is refused in the ground, on another unit or over the void, the action kept', () => {
    const sim = match(CALM, 300, [1000]);
    sim.step([{ t: 'selectWeapon', id: 'miracle' }]);
    for (const at of [
      { x: 700, y: 540 },
      { x: 1000, y: 440 },
    ]) {
      const events = run(sim, [{ t: 'fireAt', ...at }], 0);
      expect(events.some((e) => e.e === 'toolRefused')).toBe(true);
    }
    expect(sim.view().turn.phase).toBe('action');
    expect(px(unit(sim, 1)?.x)).toBe(300);
  });
});

describe('ladder (GDD §4.4)', () => {
  /** A rock cliff from x = 360, up to y = 360 (140 px above the plain). */
  function cliff(): Mask {
    const mask = flatMask();
    for (let y = 360; y < 500; y++) mask.data.fill(Material.Rock, y * 1200 + 360, y * 1200 + 700);
    return mask;
  }

  it('is set against the wall in front without taking the action, then climbed', () => {
    const sim = match(CALM, 320, [1000], cliff());
    const events = run(
      sim,
      [
        { t: 'selectWeapon', id: 'ladder' },
        { t: 'aim', angle: 3584 },
        { t: 'fire', power: 0 },
      ],
      0,
    );
    const placed = events.find((e) => e.e === 'ladderPlaced');
    expect(placed).toMatchObject({ x: 351, y: 358 });
    expect(sim.view().turn.phase).toBe('action');
    expect(sim.view().turn.fired).toBe(false);
    run(sim, [{ t: 'climb', dir: -1 }], 400);
    expect(px(unit(sim, 1)?.y)).toBe(360);
    expect(px(unit(sim, 1)?.x)).toBeGreaterThan(340);
  });
});

describe('banner (GDD §4.4)', () => {
  /** A plateau 300 px above the plain, left of x = 400. */
  function plateau(): Mask {
    const mask = flatMask();
    for (let y = 200; y < 500; y++) mask.data.fill(Material.Rock, y * 1200, y * 1200 + 400);
    return mask;
  }

  const walkOff = (sim: Sim): void => {
    run(sim, [{ t: 'move', dir: 1 }], 60);
    run(sim, [{ t: 'move', dir: 0 }], 400);
  };

  it('slows a fall to nothing hurtful, without taking the action', () => {
    const plain = match(CALM, 370, [1000], plateau());
    walkOff(plain);
    expect(unit(plain, 1)?.hp).toBeLessThan(100);

    const sim = match(CALM, 370, [1000], plateau());
    run(
      sim,
      [
        { t: 'selectWeapon', id: 'banner' },
        { t: 'fire', power: 0 },
      ],
      0,
    );
    expect(sim.view().turn.fired).toBe(false);
    walkOff(sim);
    expect(px(unit(sim, 1)?.y)).toBe(500);
    expect(unit(sim, 1)?.hp).toBe(100);
    expect(unit(sim, 1)?.banner).toBe(false);
  });

  it('drifts with the wind', () => {
    const windy = (wind: number): number => {
      const sim = match(CALM, 370, [1000], plateau());
      (sim.view() as { turn: { wind: number } }).turn.wind = wind;
      run(
        sim,
        [
          { t: 'selectWeapon', id: 'banner' },
          { t: 'fire', power: 0 },
        ],
        0,
      );
      walkOff(sim);
      return px(unit(sim, 1)?.x);
    };
    expect(windy(8)).toBeGreaterThan(windy(0) + 60);
  });
});

describe('flaming pig (GDD §4.1)', () => {
  const loose = (sim: Sim): SimEvent[] =>
    run(
      sim,
      [
        { t: 'selectWeapon', id: 'flamingPig' },
        { t: 'aim', angle: 0 },
        { t: 'fire', power: 0 },
      ],
      0,
    );

  it('trots on by itself at 2 px a tick and goes up at a second press of Fire', () => {
    const sim = match(CALM, 300, [600]);
    loose(sim);
    expect(sim.view().walkers).toHaveLength(1);
    run(sim, [], 60);
    const x = px(sim.view().walkers[0]?.x);
    expect(x).toBeGreaterThan(400);
    expect(x).toBeLessThan(460);
    run(sim, [], 80);
    const events = run(sim, [{ t: 'fire', power: 0 }], 2);
    expect(events.some((e) => e.e === 'walkerGone')).toBe(true);
    expect(events.some((e) => e.e === 'explosion')).toBe(true);
    expect(unit(sim, 2)?.hp).toBeLessThan(60);
    expect(sim.view().walkers).toHaveLength(0);
  });

  it('goes up by itself at the end of its fuse', () => {
    const short: MatchRules = {
      ...CALM,
      weapons: CALM.weapons.map((w) =>
        w.walker ? { ...w, walker: { ...w.walker, fuse: 120 } } : w,
      ),
    };
    const sim = match(short, 300, [1100]);
    loose(sim);
    expect(run(sim, [], 117).some((e) => e.e === 'explosion')).toBe(false);
    expect(run(sim, [], 4).some((e) => e.e === 'explosion')).toBe(true);
  });

  it('hops over a low wall, and turns round at a high one', () => {
    const mask = flatMask();
    // A low wall 20 px high at x = 400, a high one 200 px high at x = 700.
    for (let y = 480; y < 500; y++) mask.data.fill(Material.Rock, y * 1200 + 400, y * 1200 + 410);
    for (let y = 300; y < 500; y++) mask.data.fill(Material.Rock, y * 1200 + 700, y * 1200 + 720);
    const sim = match(CALM, 300, [1100], mask);
    loose(sim);
    let farthest = 0;
    for (let i = 0; i < 400; i++) {
      sim.step();
      farthest = Math.max(farthest, px(sim.view().walkers[0]?.x));
    }
    expect(farthest).toBeGreaterThan(450);
    expect(farthest).toBeLessThan(700);
    expect(px(sim.view().walkers[0]?.x)).toBeLessThan(farthest);
  });
});

describe('beehive (GDD §4.1)', () => {
  it('breaks where it lands and its swarm stings the nearest unit for 4 s', () => {
    const sim = match(CALM, 300, [700]);
    // Thrown high at the enemy: a lob that lands near it.
    let landed = false;
    for (const power of [600, 650, 700, 750, 800, 850, 900]) {
      const probe = Sim.fromState(sim.snapshot());
      const events = run(
        probe,
        [
          { t: 'selectWeapon', id: 'beehive' },
          { t: 'aim', angle: 3584 },
          { t: 'fire', power },
        ],
        400,
      );
      const out = events.find((e) => e.e === 'swarmOut');
      if (!out || out.e !== 'swarmOut' || Math.abs(out.x - 700) > 60) continue;
      landed = true;
      const stings = events.filter((e) => e.e === 'stung');
      expect(stings.length).toBeGreaterThan(3);
      expect(stings.length).toBeLessThanOrEqual(8);
      expect(stings.every((e) => e.e === 'stung' && e.unitId === 2)).toBe(true);
      expect(probe.view().units.find((u) => u.id === 2)?.hp).toBe(100 - 5 * stings.length);
      expect(probe.view().swarms).toHaveLength(0);
      expect(events.some((e) => e.e === 'swarmGone')).toBe(true);
      break;
    }
    expect(landed).toBe(true);
  });
});

describe('falcon (GDD §4.1)', () => {
  it('flies to the point clicked, round a wall in its way, and strikes', () => {
    const mask = flatMask();
    for (let y = 380; y < 500; y++) mask.data.fill(Material.Rock, y * 1200 + 500, y * 1200 + 520);
    const sim = match(CALM, 300, [800], mask);
    const events = run(
      sim,
      [
        { t: 'selectWeapon', id: 'falcon' },
        { t: 'fireAt', x: 800, y: 460 },
      ],
      300,
    );
    expect(events.some((e) => e.e === 'explosion')).toBe(true);
    expect(unit(sim, 2)?.hp ?? 100).toBeLessThan(70);
  });

  it('veers up and over a tall wall in its way', () => {
    const mask = flatMask();
    for (let y = 200; y < 500; y++) mask.data.fill(Material.Rock, y * 1200 + 500, y * 1200 + 530);
    const sim = match(CALM, 300, [800], mask);
    run(
      sim,
      [
        { t: 'selectWeapon', id: 'falcon' },
        { t: 'fireAt', x: 800, y: 460 },
      ],
      400,
    );
    expect(unit(sim, 2)?.hp ?? 100).toBeLessThan(70);
  });

  it('is pushed aside by the wind', () => {
    const land = (wind: number): number => {
      const sim = match(CALM, 300, [1100]);
      (sim.view() as { turn: { wind: number } }).turn.wind = wind;
      const events = run(
        sim,
        [
          { t: 'selectWeapon', id: 'falcon' },
          { t: 'fireAt', x: 300, y: 100 },
        ],
        200,
      );
      const e = events.find((x) => x.e === 'explosion');
      return e && e.e === 'explosion' ? e.x >> 8 : -1;
    };
    expect(land(10)).toBeGreaterThan(land(0));
  });
});

describe('grapple (GDD §4.4)', () => {
  it('catches the ground above, swings, lets go with a jump, without taking the action', () => {
    const mask = flatMask();
    // A rock ceiling from y = 200 to 220, over x 300 to 800; the unit stands left of it.
    for (let y = 200; y < 220; y++) mask.data.fill(Material.Rock, y * 1200 + 300, y * 1200 + 800);
    const sim = match(CALM, 240, [1000], mask);
    const events = run(
      sim,
      [
        { t: 'selectWeapon', id: 'grapple' },
        { t: 'aim', angle: 3584 },
        { t: 'fire', power: 0 },
      ],
      0,
    );
    expect(events.find((e) => e.e === 'hooked')).toMatchObject({ y: 219 });
    expect(sim.view().turn.fired).toBe(false);
    // Hauled in: up it goes.
    run(sim, [{ t: 'climb', dir: -1 }], 90);
    expect(px(unit(sim, 1)?.y)).toBeLessThan(420);
    // A push to the right swings it.
    run(
      sim,
      [
        { t: 'climb', dir: 0 },
        { t: 'move', dir: 1 },
      ],
      40,
    );
    expect(px(unit(sim, 1)?.x)).toBeGreaterThan(260);
    // A jump lets go: it falls, and lands.
    run(
      sim,
      [
        { t: 'move', dir: 0 },
        { t: 'jump', kind: 'forward' },
      ],
      200,
    );
    expect(sim.view().turn.grapple).toBeNull();
    expect(px(unit(sim, 1)?.y)).toBe(500);
    const i = CALM.weapons.findIndex((w) => w.id === 'grapple');
    expect(sim.view().teams[0]?.ammo[i]).toBe(4);
  });

  it('gets a unit out of a pit 300 px deep (BACKLOG 4.5)', () => {
    const tall: Mask = { width: 1200, height: 900, data: new Uint8Array(1200 * 900) };
    for (let y = 500; y < 900; y++) tall.data.fill(Material.Earth, y * 1200, (y + 1) * 1200);
    // A shaft 40 px wide and 300 px deep at x 280 to 320.
    for (let y = 500; y < 800; y++) tall.data.fill(Material.Air, y * 1200 + 280, y * 1200 + 320);
    const sim = match(CALM, 300, [1000], tall);
    expect(px(unit(sim, 1)?.y)).toBe(800);
    // At the lip of the right-hand wall, just below the rim.
    run(
      sim,
      [
        { t: 'selectWeapon', id: 'grapple' },
        { t: 'aim', angle: 3124 },
        { t: 'fire', power: 0 },
      ],
      0,
    );
    expect(sim.view().turn.grapple).toBeTruthy();
    run(sim, [{ t: 'climb', dir: -1 }], 150);
    expect(px(unit(sim, 1)?.y)).toBe(500);
    expect(unit(sim, 1)?.grounded).toBe(true);
  });
});

describe('siege engines (GDD §4.8)', () => {
  const siege = (
    engines: {
      id: number;
      type: 'ballista' | 'scorpion' | 'catapult' | 'trebuchet' | 'ram';
      x: number;
    }[],
    a: number,
    b: readonly number[],
  ): Sim => {
    const sim = new Sim(
      { rules: CALM, teams: [{ spawns: [a] }, { spawns: [...b] }], engines },
      2,
      flatMask(),
    );
    for (let i = 0; i < 1000 && sim.view().turn.phase !== 'action'; i++) sim.step();
    return sim;
  };

  it('a ballista is served from beside it: its bolt goes through the first unit', () => {
    const sim = siege([{ id: 50, type: 'ballista', x: 340 }], 300, [700, 800]);
    expect(sim.view().engines[0]?.y).toBe(500 * 256);
    run(
      sim,
      [
        { t: 'selectWeapon', id: 'ballista' },
        { t: 'aim', angle: 4090 },
        { t: 'fire', power: 0 },
      ],
      200,
    );
    expect(unit(sim, 2)?.hp).toBe(45);
    expect(unit(sim, 3)?.hp).toBe(45);
    expect(sim.view().engines[0]?.reload).toBe(3);
  });

  it('is out of reach farther than 40 px from its side, and reloads for its turns', () => {
    const far = siege([{ id: 50, type: 'ballista', x: 400 }], 300, [700]);
    far.step([{ t: 'selectWeapon', id: 'ballista' }]);
    expect(far.view().turn.weapon).toBe('bow');
    const sim = siege([{ id: 50, type: 'scorpion', x: 330 }], 300, [700]);
    const events = run(
      sim,
      [
        { t: 'selectWeapon', id: 'scorpion' },
        { t: 'aim', angle: 3900 },
        { t: 'fire', power: 0 },
      ],
      0,
    );
    expect(events.filter((e) => e.e === 'shotFired')).toHaveLength(1);
    expect(sim.view().shots).toHaveLength(3);
    run(sim, [], 200);
    run(sim, [{ t: 'skip' }], 600);
    // Reloading: 1 turn after its own, it is ready again.
    expect(sim.view().turn.number).toBe(2);
    expect(sim.view().engines[0]?.reload).toBe(1);
  });

  it('a catapult stone bursts where it lands; the trebuchet holds its aim at 45° ± 15°', () => {
    const sim = siege(
      [
        { id: 50, type: 'catapult', x: 330 },
        { id: 51, type: 'trebuchet', x: 1000 },
      ],
      300,
      [1100],
    );
    const events = run(
      sim,
      [
        { t: 'selectWeapon', id: 'catapult' },
        { t: 'aim', angle: 3584 },
        { t: 'fire', power: 700 },
      ],
      300,
    );
    expect(events.some((e) => e.e === 'explosion')).toBe(true);
    const def = CALM.weapons.find((w) => w.id === 'greatTrebuchet');
    expect(def && heldAim(def, 0)).toBe(4096 - 341);
    expect(def && heldAim(def, 3072)).toBe(4096 - 683);
    expect(def && heldAim(def, 2048)).toBe(2048 + 341);
  });

  it('falls apart to rubble at 0 HP, under blasts', () => {
    const sim = siege([{ id: 50, type: 'scorpion', x: 700 }], 300, [1000]);
    const before = sim.view().engines[0]?.hp ?? 0;
    expect(before).toBe(80);
    const events = run(
      sim,
      [
        { t: 'selectWeapon', id: 'arrowRain' },
        { t: 'aim', angle: 0 },
        { t: 'fireAt', x: 700, y: 0 },
      ],
      400,
    );
    expect(events.some((e) => e.e === 'engineHit')).toBe(true);
    expect(sim.view().engines[0]?.hp ?? 0).toBeLessThan(before);
  });

  it('a ram crushes a wall four times as hard, and spares the units', () => {
    const sim = new Sim(
      {
        rules: { ...CALM, structures: STRUCTURE_RULES },
        teams: [{ spawns: [300] }, { spawns: [370] }],
        engines: [{ id: 50, type: 'ram', x: 260 }],
        structures: [{ id: 1, type: 'tower', rect: [340, 380, 20, 120] }],
      },
      2,
      (() => {
        const m = flatMask();
        for (let y = 380; y < 500; y++)
          m.data.fill(Material.BuiltStone, y * 1200 + 340, y * 1200 + 360);
        return m;
      })(),
    );
    for (let i = 0; i < 1000 && sim.view().turn.phase !== 'action'; i++) sim.step();
    const hp0 = sim.view().structures[0]?.hp ?? 0;
    run(
      sim,
      [
        { t: 'selectWeapon', id: 'siegeRam' },
        { t: 'aim', angle: 0 },
        { t: 'fire', power: 0 },
      ],
      10,
    );
    expect(hp0 - (sim.view().structures[0]?.hp ?? 0)).toBe(160);
    expect(sim.view().units.every((u) => u.hp === 100)).toBe(true);
  });
});
