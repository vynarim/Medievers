import { describe, expect, it } from 'vitest';
import { CLASSIC_RULES } from '../../src/content/rules.ts';
import {
  CHARGE_SPEED,
  DOUBLE_PRESS_TICKS,
  LocalControls,
  aimFor,
  elevationOf,
  emptyInput,
  type RawInput,
} from '../../src/input/local-controls.ts';
import { Material, Sim, type GameCommand, type Mask } from '../../src/sim/index.ts';

function flatMask(): Mask {
  const width = 1200;
  const height = 600;
  const data = new Uint8Array(width * height);
  for (let y = 500; y < height; y++) data.fill(Material.Earth, y * width, (y + 1) * width);
  return { width, height, data };
}

/** A sim in its first action phase, driven through LocalControls. */
function setup(): {
  sim: Sim;
  controls: LocalControls;
  tick: (i?: Partial<RawInput>) => GameCommand[];
} {
  const sim = new Sim(
    { rules: CLASSIC_RULES, teams: [{ spawns: [300] }, { spawns: [900] }] },
    1,
    flatMask(),
  );
  while (sim.view().turn.phase !== 'action') sim.step();
  const controls = new LocalControls();
  const tick = (i: Partial<RawInput> = {}): GameCommand[] => {
    const v = sim.view();
    const cmds = controls.update(v.tick + 1, { ...emptyInput(), ...i }, v);
    sim.step(cmds);
    return cmds;
  };
  return { sim, controls, tick };
}

describe('aim helpers', () => {
  it('converts between elevation and aim on both sides', () => {
    expect(aimFor(0, 1)).toBe(0);
    expect(aimFor(1024, 1)).toBe(3072);
    expect(aimFor(512, -1)).toBe(2560);
    for (const e of [-1024, -300, 0, 300, 1024]) {
      expect(elevationOf(aimFor(e, 1), 1)).toBe(e);
      expect(elevationOf(aimFor(e, -1), -1)).toBe(e);
    }
  });
});

describe('LocalControls', () => {
  it('sends walking only when it changes', () => {
    const { tick } = setup();
    expect(tick({ right: true })).toContainEqual({ t: 'move', dir: 1 });
    expect(tick({ right: true }).filter((c) => c.t === 'move')).toEqual([]);
    expect(tick({})).toContainEqual({ t: 'move', dir: 0 });
  });

  it('keeps the elevation when turning around', () => {
    const { sim, tick } = setup();
    for (let i = 0; i < 10; i++) tick({ up: true });
    const before = sim.view();
    const unit = before.units.find((u) => u.id === before.turn.activeUnitId);
    const e = elevationOf(before.turn.aim, unit?.facing ?? 1);
    tick({ left: true });
    tick({ left: true });
    const after = sim.view();
    const u2 = after.units.find((u) => u.id === after.turn.activeUnitId);
    expect(u2?.facing).toBe(-1);
    expect(elevationOf(after.turn.aim, -1)).toBe(e);
  });

  it('turns around on the spot with flip, keeping the elevation and the position', () => {
    const { sim, tick } = setup();
    for (let i = 0; i < 10; i++) tick({ up: true });
    const before = sim.view();
    const unit = before.units.find((u) => u.id === before.turn.activeUnitId);
    const facing = unit?.facing ?? 1;
    const e = elevationOf(before.turn.aim, facing);
    const cmds = tick({ flipPressed: true });
    expect(cmds.filter((c) => c.t === 'move')).toEqual([]);
    const after = sim.view();
    const u2 = after.units.find((u) => u.id === after.turn.activeUnitId);
    expect(u2?.facing).toBe(-facing);
    expect(u2?.x).toBe(unit?.x);
    expect(elevationOf(after.turn.aim, -facing)).toBe(e);
  });

  it('jumps forward after a single press and back after a double press', () => {
    const a = setup();
    expect(a.tick({ jumpPressed: true })).toEqual([]);
    const out: GameCommand[] = [];
    for (let i = 0; i < DOUBLE_PRESS_TICKS + 1; i++) out.push(...a.tick());
    expect(out).toContainEqual({ t: 'jump', kind: 'forward' });

    const b = setup();
    b.tick({ jumpPressed: true });
    b.tick();
    expect(b.tick({ jumpPressed: true })).toContainEqual({ t: 'jump', kind: 'back' });
  });

  it('charges while the key is held and fires on release', () => {
    const { sim, controls, tick } = setup();
    for (let i = 0; i < 20; i++) tick({ charge: true });
    expect(controls.power).toBe(20 * CHARGE_SPEED);
    const cmds = tick({});
    expect(cmds).toContainEqual({ t: 'fire', power: 20 * CHARGE_SPEED });
    expect(sim.view().turn.phase).toBe('retreat');
  });

  it('fires by itself at full charge', () => {
    const { tick } = setup();
    let fired: GameCommand | undefined;
    for (let i = 0; i < 200 && !fired; i++)
      fired = tick({ charge: true }).find((c) => c.t === 'fire');
    expect(fired).toEqual({ t: 'fire', power: 1024 });
  });

  it('aims opposite to a drag and fires on release', () => {
    const { sim, tick } = setup();
    // Pulling down-left shoots up-right.
    tick({ drag: { pullX: -110, pullY: 110, released: false } });
    expect(sim.view().turn.aim).toBe(3584);
    const cmds = tick({ drag: { pullX: -110, pullY: 110, released: true } });
    const fire = cmds.find((c) => c.t === 'fire');
    expect(fire && fire.t === 'fire' ? fire.power : -1).toBe(721); // trunc(155 × 1024 / 220)
  });

  it('cycles weapons and sets fuses', () => {
    const { sim, tick } = setup();
    tick({ nextWeaponPressed: true });
    expect(sim.view().turn.weapon).toBe('sling');
    tick({ nextWeaponPressed: true });
    tick({ fusePressed: 2 });
    expect([sim.view().turn.weapon, sim.view().turn.fuse]).toEqual(['greekFire', 120]);
  });

  it('sends nothing outside action and retreat', () => {
    const sim = new Sim(
      { rules: CLASSIC_RULES, teams: [{ spawns: [300] }, { spawns: [900] }] },
      1,
      flatMask(),
    );
    const controls = new LocalControls();
    const v = sim.view();
    expect(controls.update(1, { ...emptyInput(), right: true, charge: true }, v)).toEqual([]);
  });
  it('takes direct jumps, weapon choices and skips from the action bar', () => {
    const a = setup();
    expect(a.tick({ jumpKind: 'back' })).toContainEqual({ t: 'jump', kind: 'back' });
    const b = setup();
    b.tick({ selectWeapon: 'greekFire' });
    expect(b.sim.view().turn.weapon).toBe('greekFire');
    expect(b.tick({ skipPressed: true })).toEqual([{ t: 'skip' }]);
    expect(b.sim.view().turn.number).toBe(2); // everything at rest: the next turn starts at once
  });
});
