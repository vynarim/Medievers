// The rig files of the game against their format (ADR 0003), and the format's own refusals.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseAnim, parseRig, RigFormatError, type RigDef } from '../../src/render/rig/format.ts';
import { KNIGHT_PIECES } from '../../src/render/rig/knight-art.ts';
import { BoundsPen, Frame } from '../../src/render/rig/pen.ts';
import { restCorners } from '../../src/render/rig/rest.ts';
import { RIGS } from '../../src/render/rig/rigs.ts';

const ROOT = join(import.meta.dirname, '../../src/content/rigs');
const read = (p: string): unknown => JSON.parse(readFileSync(p, 'utf8'));

describe('rig files', () => {
  const dirs = readdirSync(ROOT);

  it('every rig folder holds a valid rig.json and valid animations', () => {
    expect(dirs.length).toBeGreaterThan(0);
    for (const dir of dirs) {
      const rig = parseRig(read(join(ROOT, dir, 'rig.json')), `${dir}/rig.json`);
      expect(rig.id).toBe(dir);
      for (const file of readdirSync(join(ROOT, dir, 'anim'))) {
        const anim = parseAnim(read(join(ROOT, dir, 'anim', file)), rig, file);
        expect(`${anim.id}.json`).toBe(file);
      }
      // The game loads the very same files.
      expect(RIGS.get(dir)?.anims.size).toBe(readdirSync(join(ROOT, dir, 'anim')).length);
    }
  });

  const knight = RIGS.get('knight');
  if (!knight) throw new Error('no knight rig');

  it('the knight has every P0 animation of ASSETS §3.4, with its loop and duration', () => {
    const want: Record<string, [mode: string, min: number, max: number]> = {
      idle: ['loop', 2, 2],
      walk: ['loop', 0.8, 0.8],
      jump_forward: ['hold', 0.1, 0.5],
      jump_back: ['hold', 0.1, 0.5],
      fall: ['hold', 0.1, 1],
      land: ['once', 0.1, 0.5],
      fly_tumble: ['loop', 0.6, 0.6],
      hurt: ['once', 0.4, 0.4],
      aim_bow: ['hold', 0.1, 0.5],
      aim_throw: ['hold', 0.1, 0.5],
      fire_bow: ['once', 0.3, 0.5],
      fire_throw: ['once', 0.3, 0.5],
      death: ['once', 1, 1],
    };
    for (const [id, [mode, min, max]] of Object.entries(want)) {
      const a = knight.anims.get(id);
      expect(a, id).toBeDefined();
      expect(a?.mode, id).toBe(mode);
      expect(a?.duration, id).toBeGreaterThanOrEqual(min);
      expect(a?.duration, id).toBeLessThanOrEqual(max);
    }
    // The fire animations say when the shot leaves the hand.
    for (const id of ['fire_bow', 'fire_throw']) {
      expect(knight.anims.get(id)?.events.map((e) => e.name)).toContain('release');
    }
  });

  it('a loop ends on its first pose, so that it never jumps', () => {
    for (const a of knight.anims.values()) {
      if (a.mode !== 'loop') continue;
      for (const [bone, tr] of Object.entries(a.tracks)) {
        for (const [ch, keys] of Object.entries(tr)) {
          const first = keys[0];
          const last = keys[keys.length - 1];
          if (!first || !last || keys.length === 1) continue;
          expect(last.t, `${a.id} ${bone}.${ch}`).toBe(a.duration);
          // A turn of 360° is the same pose.
          expect(Math.abs(last.v - first.v) % 360, `${a.id} ${bone}.${ch}`).toBe(0);
        }
      }
    }
  });

  it('house pieces, and only they, carry the _tint suffix (ASSETS §2)', () => {
    for (const pc of knight.rig.pieces) {
      expect(pc.key.endsWith('_tint'), pc.id).toBe(pc.tint !== null);
    }
  });

  it('every piece has its placeholder, drawn inside the piece at its size and pivot', () => {
    const rig: RigDef = knight.rig;
    expect(Object.keys(KNIGHT_PIECES).sort()).toEqual(rig.pieces.map((p) => p.id).sort());
    const corners = restCorners(rig);
    for (const pc of rig.pieces) {
      const pen = new BoundsPen();
      KNIGHT_PIECES[pc.id]?.(new Frame(pen, 0, 0, 1), { primary: 0, secondary: 0 });
      const c = corners.get(pc.id);
      if (!c) throw new Error(pc.id);
      expect(pen.minX, pc.id).toBeGreaterThanOrEqual(c.x);
      expect(pen.minY, pc.id).toBeGreaterThanOrEqual(c.y);
      expect(pen.maxX, pc.id).toBeLessThanOrEqual(c.x + pc.size[0]);
      expect(pen.maxY, pc.id).toBeLessThanOrEqual(c.y + pc.size[1]);
    }
  });

  it('the figure at rest stands on the ground and is as tall as the rig says', () => {
    const pen = new BoundsPen();
    for (const pc of knight.rig.pieces) {
      if (pc.slot) continue;
      KNIGHT_PIECES[pc.id]?.(new Frame(pen, 0, 0, 1), { primary: 0, secondary: 0 });
    }
    expect(pen.maxY).toBeCloseTo(0, 0);
    expect(-pen.minY).toBeGreaterThanOrEqual(knight.rig.height - 1);
  });
});

describe('format refusals', () => {
  const rig = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    format: 'medieverse.rig/1',
    id: 'test',
    height: 80,
    bones: [
      { id: 'root', parent: null, x: 0, y: 0 },
      { id: 'arm', parent: 'root', x: 0, y: -40 },
    ],
    pieces: [
      { id: 'arm', bone: 'arm', key: 'unit_test_arm', size: [10, 20], pivot: [5, 2] },
      {
        id: 'bow',
        bone: 'arm',
        key: 'weapon_bow_held',
        size: [10, 20],
        pivot: [5, 2],
        slot: { slot: 'weapon', attachment: 'bow' },
      },
    ],
    slots: [{ id: 'weapon', default: null }],
    ...over,
  });
  const anim = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    format: 'medieverse.anim/1',
    id: 'swing',
    rig: 'test',
    duration: 1,
    mode: 'loop',
    tracks: {
      arm: {
        rot: [
          { t: 0, v: 0 },
          { t: 1, v: 0 },
        ],
      },
    },
    ...over,
  });
  const bad = (f: () => unknown, path: string): void => {
    try {
      f();
    } catch (e) {
      expect(e).toBeInstanceOf(RigFormatError);
      expect((e as RigFormatError).path).toBe(path);
      return;
    }
    throw new Error(`accepted, expected a refusal at ${path}`);
  };

  it('accepts a sound rig and fills in the defaults', () => {
    const r = parseRig(rig());
    expect(r.bones[0]?.rot).toBe(0);
    expect(r.pieces[0]?.tint).toBeNull();
    expect(r.pieces[0]?.slot).toBeNull();
    const a = parseAnim(anim(), r);
    expect(a.mix).toBe(0.1);
    expect(a.events).toEqual([]);
    expect(a.aim).toEqual([]);
  });

  it('refuses a broken rig, naming the field', () => {
    bad(() => parseRig(rig({ format: 'other' })), 'rig.format');
    bad(() => parseRig(rig({ colour: 'red' })), 'rig.colour');
    bad(
      () => parseRig(rig({ bones: [{ id: 'root', parent: 'nothing', x: 0, y: 0 }] })),
      'rig.bones[0].parent',
    );
    bad(
      () =>
        parseRig(
          rig({
            bones: [
              { id: 'root', parent: null },
              { id: 'leg', parent: 'foot' },
              { id: 'foot', parent: 'root' },
            ],
          }),
        ),
      'rig.bones[1].parent',
    );
    bad(
      () =>
        parseRig(
          rig({ pieces: [{ id: 'a', bone: 'tail', key: 'k', size: [1, 1], pivot: [0, 0] }] }),
        ),
      'rig.pieces[0].bone',
    );
    bad(
      () =>
        parseRig(
          rig({
            pieces: [{ id: 'a', bone: 'arm', key: 'k', size: [0, 1], pivot: [0, 0] }],
          }),
        ),
      'rig.pieces[0].size',
    );
    bad(
      () =>
        parseRig(
          rig({
            pieces: [
              { id: 'a', bone: 'arm', key: 'k', size: [1, 1], pivot: [0, 0], tint: 'gules' },
            ],
          }),
        ),
      'rig.pieces[0].tint',
    );
    bad(() => parseRig(rig({ slots: [{ id: 'weapon', default: 'axe' }] })), 'rig.slots[0].default');
    bad(() => parseRig(rig({ id: 'Knight' })), 'rig.id');
  });

  it('refuses a broken animation, naming the field', () => {
    const r = parseRig(rig());
    bad(() => parseAnim(anim({ rig: 'other' }), r), 'anim.rig');
    bad(() => parseAnim(anim({ mode: 'pingpong' }), r), 'anim.mode');
    bad(() => parseAnim(anim({ duration: 0 }), r), 'anim.duration');
    bad(
      () => parseAnim(anim({ tracks: { tail: { rot: [{ t: 0, v: 1 }] } } }), r),
      'anim.tracks.tail',
    );
    bad(
      () => parseAnim(anim({ tracks: { arm: { spin: [{ t: 0, v: 1 }] } } }), r),
      'anim.tracks.arm.spin',
    );
    bad(
      () =>
        parseAnim(
          anim({
            tracks: {
              arm: {
                rot: [
                  { t: 0.5, v: 1 },
                  { t: 0.5, v: 2 },
                ],
              },
            },
          }),
          r,
        ),
      'anim.tracks.arm.rot[1].t',
    );
    bad(
      () => parseAnim(anim({ tracks: { arm: { rot: [{ t: 2, v: 1 }] } } }), r),
      'anim.tracks.arm.rot[0].t',
    );
    bad(
      () => parseAnim(anim({ tracks: { arm: { rot: [{ t: 0, v: 1, ease: 'bounce' }] } } }), r),
      'anim.tracks.arm.rot[0].ease',
    );
    bad(() => parseAnim(anim({ tracks: { arm: { rot: [] } } }), r), 'anim.tracks.arm.rot');
    bad(
      () => parseAnim(anim({ slots: { weapon: [{ t: 0, v: 'axe' }] } }), r),
      'anim.slots.weapon[0].v',
    );
    bad(() => parseAnim(anim({ slots: { hat: [{ t: 0, v: null }] } }), r), 'anim.slots.hat');
    bad(() => parseAnim(anim({ events: [{ t: 3, name: 'release' }] }), r), 'anim.events[0].t');
    bad(() => parseAnim(anim({ aim: [{ bone: 'tail' }] }), r), 'anim.aim[0].bone');
  });
});
