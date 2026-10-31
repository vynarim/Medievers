// Which animation the knight plays for each state of a unit (ASSETS §3.4), and its one-shots.
import { describe, expect, it } from 'vitest';
import { RIGS } from '../../src/render/rig/rigs.ts';
import { baseAnim, UnitAnimator, type UnitAnimInput } from '../../src/render/rig/unit-anim.ts';

const knight = RIGS.get('knight');
if (!knight) throw new Error('no knight rig');

const still: UnitAnimInput = {
  alive: true,
  grounded: true,
  knocked: false,
  climbing: false,
  dx: 0,
  dy: 0,
  vy: 0,
  facing: 1,
  aiming: null,
  aimDeg: 0,
};
const at = (over: Partial<UnitAnimInput>): UnitAnimInput => ({ ...still, ...over });
const FRAME = 1 / 60;

/** Runs `n` frames in state `s`; returns the events passed. */
function run(a: UnitAnimator, s: UnitAnimInput, seconds: number): string[] {
  const out: string[] = [];
  for (let t = 0; t < seconds - 1e-9; t += FRAME) out.push(...a.update(s, FRAME));
  return out;
}

describe('baseAnim', () => {
  it('maps the state of a unit to its animation', () => {
    expect(baseAnim(still)).toBe('idle');
    expect(baseAnim(at({ dx: 1 }))).toBe('walk');
    expect(baseAnim(at({ dx: -1, facing: -1 }))).toBe('walk');
    expect(baseAnim(at({ climbing: true, dy: -1 }))).toBe('walk');
    expect(baseAnim(at({ grounded: false, vy: -500, dx: 2 }))).toBe('jump_forward');
    expect(baseAnim(at({ grounded: false, vy: -500, dx: -2 }))).toBe('jump_back');
    expect(baseAnim(at({ grounded: false, vy: -500, dx: 2, facing: -1 }))).toBe('jump_back');
    expect(baseAnim(at({ grounded: false, vy: 300 }))).toBe('fall');
    expect(baseAnim(at({ grounded: false, knocked: true, vy: -300 }))).toBe('fly_tumble');
    expect(baseAnim(at({ aiming: 'bow' }))).toBe('aim_bow');
    // Walking wins over aiming: the aim comes back once it stands.
    expect(baseAnim(at({ aiming: 'throw', dx: 1 }))).toBe('walk');
  });
});

describe('UnitAnimator', () => {
  const make = (alive = true): UnitAnimator => new UnitAnimator(knight.rig, knight.anims, alive);

  it('walks, steps and comes back to idle', () => {
    const a = make();
    const events = run(a, at({ dx: 1 }), 1);
    expect(a.player.playing).toBe('walk');
    expect(events.filter((e) => e === 'step').length).toBeGreaterThanOrEqual(2);
    run(a, still, 0.1);
    expect(a.player.playing).toBe('idle');
  });

  it('jumps, falls, then lands with a puff of dust before standing', () => {
    const a = make();
    run(a, at({ grounded: false, vy: -600, dx: 2 }), 0.2);
    expect(a.player.playing).toBe('jump_forward');
    run(a, at({ grounded: false, vy: 400 }), 0.2);
    expect(a.player.playing).toBe('fall');
    const events = a.update(still, FRAME);
    expect(a.player.playing).toBe('land');
    expect(events).toContain('dust');
    run(a, still, 0.4);
    expect(a.player.playing).toBe('idle');
  });

  it('a step down too short to be a fall does not land', () => {
    const a = make();
    run(a, at({ grounded: false, vy: 200 }), 0.05);
    a.update(still, FRAME);
    expect(a.player.playing).toBe('idle');
  });

  it('flinches at a blow, then goes back to what it was doing', () => {
    const a = make();
    run(a, at({ aiming: 'bow' }), 0.3);
    a.hurt();
    a.update(at({ aiming: 'bow' }), FRAME);
    expect(a.player.playing).toBe('hurt');
    run(a, at({ aiming: 'bow' }), 0.5);
    expect(a.player.playing).toBe('aim_bow');
  });

  it('a blast that throws it tumbles at once, and it does not land after a tumble', () => {
    const a = make();
    a.hurt();
    a.update(at({ grounded: false, knocked: true, vy: -800 }), FRAME);
    expect(a.player.playing).toBe('fly_tumble');
    run(a, at({ grounded: false, knocked: true, vy: 300 }), 0.5);
    a.update(at({ knocked: true }), FRAME);
    expect(a.player.playing).toBe('idle');
  });

  it('aims and fires in the pose of its tool, the bow shown, then the stone let go', () => {
    const a = make();
    run(a, at({ aiming: 'bow', aimDeg: -30 }), 0.3);
    expect(a.player.pose.slots.get('weapon')).toBe('bow');
    a.fire('bow');
    const events = run(a, at({ aiming: 'bow', aimDeg: -30 }), 0.1);
    expect(a.player.playing).toBe('fire_bow');
    expect(events).toContain('release');
    run(a, at({ aiming: 'bow', aimDeg: -30 }), 0.4);
    expect(a.player.playing).toBe('aim_bow');

    run(a, at({ aiming: 'throw' }), 0.3);
    expect(a.player.pose.slots.get('weapon')).toBe('stone');
    a.fire('throw');
    run(a, at({ aiming: 'throw' }), 0.15);
    expect(a.player.playing).toBe('fire_throw');
    expect(a.player.pose.slots.get('weapon')).toBeNull();
  });

  it('a pose the rig lacks (P1) borrows another, its held tool hidden', () => {
    const a = make();
    run(a, at({ aiming: 'crossbow' }), 0.3);
    expect(a.player.playing).toBe('aim_bow');
    expect(a.player.pose.slots.get('weapon')).toBeNull();
    run(a, at({ aiming: 'melee' }), 0.3);
    expect(a.player.playing).toBe('aim_throw');
    expect(a.player.pose.slots.get('weapon')).toBeNull();
    a.fire('sling');
    a.update(at({ aiming: 'sling' }), FRAME);
    expect(a.player.playing).toBe('fire_throw');
    expect(a.resolve('dig_down')).toEqual(['idle', false]);
  });

  it('dies stiffly over a second, then gives way to its tombstone', () => {
    const a = make();
    run(a, still, 0.2);
    run(a, at({ alive: false }), 0.5);
    expect(a.player.playing).toBe('death');
    expect(a.gone).toBe(false);
    a.hurt();
    run(a, at({ alive: false }), 0.6);
    expect(a.gone).toBe(true);
    // Lying flat, its root turned a quarter back.
    expect(a.player.pose.bones[0]?.rot).toBeCloseTo(-90, 6);
  });

  it('a unit already dead when first seen lies under its stone', () => {
    expect(make(false).gone).toBe(true);
  });
});
