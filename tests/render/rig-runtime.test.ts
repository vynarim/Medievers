// The cutout runtime: keyframe interpolation, loops, cross-fades, events, slots, aim, and the
// transform of each piece down the bone hierarchy.
import { describe, expect, it } from 'vitest';
import { parseAnim, parseRig } from '../../src/render/rig/format.ts';
import {
  AnimPlayer,
  boneOrigin,
  ease,
  pieceTransforms,
  restPose,
  samplePose,
  sampleKeys,
} from '../../src/render/rig/runtime.ts';

const rig = parseRig({
  format: 'medieverse.rig/1',
  id: 'test',
  height: 60,
  bones: [
    { id: 'root', parent: null },
    { id: 'body', parent: 'root', x: 0, y: -40 },
    { id: 'arm', parent: 'body', x: 10, y: 0 },
    { id: 'hand', parent: 'arm', x: 0, y: 20 },
  ],
  pieces: [
    { id: 'body', bone: 'body', key: 'unit_test_body', size: [20, 40], pivot: [10, 20] },
    { id: 'arm', bone: 'arm', key: 'unit_test_arm', size: [6, 24], pivot: [3, 2] },
    {
      id: 'stone',
      bone: 'hand',
      key: 'weapon_stone_held',
      size: [8, 8],
      pivot: [4, 4],
      slot: { slot: 'weapon', attachment: 'stone' },
    },
  ],
  slots: [{ id: 'weapon', default: null }],
});

const anims = new Map(
  [
    {
      format: 'medieverse.anim/1',
      id: 'idle',
      rig: 'test',
      duration: 1,
      mode: 'loop',
      mix: 0,
      tracks: {
        arm: {
          rot: [
            { t: 0, v: 0 },
            { t: 0.5, v: 20 },
            { t: 1, v: 0 },
          ],
        },
      },
      events: [
        { t: 0, name: 'start' },
        { t: 0.25, name: 'tick' },
      ],
    },
    {
      format: 'medieverse.anim/1',
      id: 'throw',
      rig: 'test',
      duration: 0.4,
      mode: 'once',
      mix: 0.2,
      tracks: {
        arm: {
          rot: [
            { t: 0, v: -90, ease: 'easeIn' },
            { t: 0.2, v: 30 },
          ],
        },
      },
      slots: {
        weapon: [
          { t: 0, v: 'stone' },
          { t: 0.1, v: null },
        ],
      },
      events: [{ t: 0.1, name: 'release' }],
      aim: [{ bone: 'arm', weight: 0.5 }],
    },
    {
      format: 'medieverse.anim/1',
      id: 'aim',
      rig: 'test',
      duration: 0.2,
      mode: 'hold',
      mix: 0,
      tracks: {
        body: {
          y: [
            { t: 0, v: 0 },
            { t: 0.2, v: 4 },
          ],
          sx: [{ t: 0, v: 2 }],
        },
      },
    },
  ].map((j) => {
    const a = parseAnim(j, rig);
    return [a.id, a] as const;
  }),
);

const armRot = (p: AnimPlayer): number => p.pose.bones[2]?.rot ?? NaN;

describe('easing and keys', () => {
  it('every ease runs from 0 to 1, step holds', () => {
    for (const e of ['linear', 'easeIn', 'easeOut', 'easeInOut'] as const) {
      expect(ease(e, 0)).toBeCloseTo(0, 9);
      expect(ease(e, 1)).toBeCloseTo(1, 9);
    }
    expect(ease('easeInOut', 0.5)).toBeCloseTo(0.5, 9);
    expect(ease('easeIn', 0.5)).toBeLessThan(0.5);
    expect(ease('easeOut', 0.5)).toBeGreaterThan(0.5);
    expect(ease('step', 0.99)).toBe(0);
  });

  it('interpolates between keys and holds outside them', () => {
    const keys = [
      { t: 0.2, v: 10, ease: 'linear' as const },
      { t: 0.6, v: 30, ease: 'step' as const },
      { t: 1, v: 0, ease: 'linear' as const },
    ];
    expect(sampleKeys(keys, 0)).toBe(10);
    expect(sampleKeys(keys, 0.4)).toBeCloseTo(20, 9);
    expect(sampleKeys(keys, 0.8)).toBe(30);
    expect(sampleKeys(keys, 1)).toBe(0);
    expect(sampleKeys(keys, 5)).toBe(0);
  });
});

describe('AnimPlayer', () => {
  it('a loop wraps round and fires its events every lap, even over a long frame', () => {
    const p = new AnimPlayer(rig, anims);
    expect(p.play('idle')).toEqual(['start']);
    expect(p.update(0.5)).toEqual(['tick']);
    expect(armRot(p)).toBeCloseTo(20, 9);
    // 0.5 → 2.75: laps 1 and 2 enter (start, tick each).
    expect(p.update(2.25)).toEqual(['start', 'tick', 'start', 'tick']);
    expect(p.time).toBeCloseTo(0.75, 9);
    expect(armRot(p)).toBeCloseTo(10, 9);
    expect(p.finished).toBe(false);
  });

  it('play() of the animation already playing does not restart it, unless told to', () => {
    const p = new AnimPlayer(rig, anims);
    p.play('idle');
    p.update(0.3);
    expect(p.play('idle')).toEqual([]);
    expect(p.time).toBeCloseTo(0.3, 9);
    p.play('idle', true);
    expect(p.time).toBe(0);
  });

  it('a once animation holds its last pose and reports itself finished', () => {
    const p = new AnimPlayer(rig, anims);
    p.play('throw');
    expect(p.update(0.05)).toEqual([]);
    expect(p.update(0.1)).toEqual(['release']);
    expect(p.finished).toBe(false);
    p.update(1);
    expect(p.finished).toBe(true);
    expect(armRot(p)).toBe(30);
  });

  it('a held pose never finishes', () => {
    const p = new AnimPlayer(rig, anims);
    p.play('aim');
    p.update(10);
    expect(p.finished).toBe(false);
    expect(p.pose.bones[1]?.y).toBe(4);
    expect(p.pose.bones[1]?.sx).toBe(2);
  });

  it('cross-fades from the pose shown when the new animation starts', () => {
    const p = new AnimPlayer(rig, anims);
    p.play('idle');
    p.update(0.5);
    expect(armRot(p)).toBeCloseTo(20, 9);
    p.play('throw');
    // At once, still the old pose; after mix (0.2 s), the new animation alone.
    expect(armRot(p)).toBeCloseTo(20, 9);
    p.update(0.1);
    const target = -90 + 120 * ease('easeIn', 0.5);
    expect(armRot(p)).toBeCloseTo(20 + (target - 20) * 0.5, 9);
    p.update(0.15);
    expect(armRot(p)).toBe(30);
  });

  it('switches slots by step keys, and a hidden slot stays empty', () => {
    const p = new AnimPlayer(rig, anims);
    p.play('throw');
    expect(p.pose.slots.get('weapon')).toBe('stone');
    p.update(0.1);
    expect(p.pose.slots.get('weapon')).toBeNull();
    p.play('throw', true);
    p.hiddenSlot = 'weapon';
    p.update(0.01);
    expect(p.pose.slots.get('weapon')).toBeNull();
  });

  it('turns the bones bound to the aim by their weight', () => {
    const p = new AnimPlayer(rig, anims);
    p.play('throw');
    p.aimDeg = 40;
    p.update(1);
    expect(armRot(p)).toBe(30 + 20);
  });

  it('refuses an animation the rig does not have', () => {
    expect(() => new AnimPlayer(rig, anims).play('dance')).toThrow(/dance/);
  });
});

describe('piece transforms', () => {
  it('at rest, each piece sits on its bone, unturned', () => {
    const t = pieceTransforms(rig, restPose(rig));
    expect(t.map((x) => [x.x, x.y])).toEqual([
      [0, -40],
      [10, -40],
      [10, -20],
    ]);
    for (const x of t) {
      expect(x.rotation).toBe(0);
      expect(x.scaleX).toBe(1);
      expect(x.scaleY).toBe(1);
    }
    // The stone is out of its slot at rest.
    expect(t.map((x) => x.visible)).toEqual([true, true, false]);
  });

  it('a bone turned carries its children round its origin', () => {
    const pose = samplePose(rig, anims.get('throw') ?? (null as never), 0);
    // Arm at −90° (counter-clockwise): the hand, 20 px below the shoulder, swings forward.
    const hand = boneOrigin(rig, pose, 'hand');
    expect(hand.x).toBeCloseTo(30, 9);
    expect(hand.y).toBeCloseTo(-40, 9);
    const t = pieceTransforms(rig, pose);
    expect(t[1]?.rotation).toBeCloseTo(-Math.PI / 2, 9);
    expect(t[2]?.rotation).toBeCloseTo(-Math.PI / 2, 9);
    expect(t[2]?.visible).toBe(true);
  });

  it("a scaled bone scales its pieces and its children's offsets", () => {
    const pose = restPose(rig);
    const body = pose.bones[1];
    if (body) body.sx = 2;
    const t = pieceTransforms(rig, pose);
    expect(t[0]?.scaleX).toBeCloseTo(2, 9);
    expect(t[0]?.scaleY).toBeCloseTo(1, 9);
    // The arm, 10 px from the body's origin, is now 20 px from it.
    expect(t[1]?.x).toBeCloseTo(20, 9);
  });
});
