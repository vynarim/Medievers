// The cutout animation runtime (TECH_SPEC §7, ADR 0003): samples the keyframes of an animation,
// cross-fades between two, fires its events and turns the bones' pose into the transform of
// each piece. Pure and cosmetic: no Phaser, wall-clock time is allowed (render only).
import type { AnimDef, Ease, Key, RigDef, SlotKey } from './format.ts';

/** Offsets of one bone from its rest transform. */
export interface BonePose {
  rot: number;
  x: number;
  y: number;
  sx: number;
  sy: number;
}

/** A pose of the whole rig: an offset per bone, in rig order, and what each slot holds. */
export interface Pose {
  readonly bones: BonePose[];
  readonly slots: Map<string, string | null>;
}

/** Where a piece is drawn, in the rig's frame (facing right, origin between the feet). */
export interface PieceTransform {
  x: number;
  y: number;
  /** radians, clockwise on screen */
  rotation: number;
  scaleX: number;
  scaleY: number;
  visible: boolean;
}

const DEG = Math.PI / 180;

export function ease(kind: Ease, k: number): number {
  switch (kind) {
    case 'linear':
      return k;
    case 'step':
      return 0;
    case 'easeIn':
      return 1 - Math.cos((k * Math.PI) / 2);
    case 'easeOut':
      return Math.sin((k * Math.PI) / 2);
    case 'easeInOut':
      return (1 - Math.cos(k * Math.PI)) / 2;
  }
}

/** The value of a channel at `t` seconds: held before the first key and after the last. */
export function sampleKeys(keys: readonly Key[], t: number): number {
  const first = keys[0];
  if (!first) return 0;
  if (t <= first.t) return first.v;
  for (let i = 1; i < keys.length; i++) {
    const b = keys[i];
    const a = keys[i - 1];
    if (!a || !b) break;
    if (t < b.t) {
      const k = (t - a.t) / (b.t - a.t);
      return a.v + (b.v - a.v) * ease(a.ease, k);
    }
  }
  return keys[keys.length - 1]?.v ?? first.v;
}

function sampleSlot(keys: readonly SlotKey[], t: number, rest: string | null): string | null {
  let v = rest;
  for (const k of keys) {
    if (k.t <= t) v = k.v;
    else break;
  }
  return v;
}

export function restPose(rig: RigDef): Pose {
  return {
    bones: rig.bones.map(() => ({ rot: 0, x: 0, y: 0, sx: 1, sy: 1 })),
    slots: new Map(rig.slots.map((s) => [s.id, s.default])),
  };
}

/**
 * The pose of `anim` at `t` seconds (already wrapped or clamped to its duration), with the
 * bones bound to the aim turned by `aimDeg` (0: straight ahead, positive downward).
 */
export function samplePose(rig: RigDef, anim: AnimDef, t: number, aimDeg = 0, out?: Pose): Pose {
  const pose = out ?? restPose(rig);
  rig.bones.forEach((b, i) => {
    const p = pose.bones[i];
    if (!p) return;
    const tr = anim.tracks[b.id];
    p.rot = tr?.rot ? sampleKeys(tr.rot, t) : 0;
    p.x = tr?.x ? sampleKeys(tr.x, t) : 0;
    p.y = tr?.y ? sampleKeys(tr.y, t) : 0;
    p.sx = tr?.sx ? sampleKeys(tr.sx, t) : 1;
    p.sy = tr?.sy ? sampleKeys(tr.sy, t) : 1;
  });
  for (const a of anim.aim) {
    const i = rig.bones.findIndex((b) => b.id === a.bone);
    const p = pose.bones[i];
    if (p) p.rot += aimDeg * a.weight;
  }
  for (const s of rig.slots) {
    const ks = anim.slots[s.id];
    pose.slots.set(s.id, ks ? sampleSlot(ks, t, s.default) : s.default);
  }
  return pose;
}

/** `a` towards `b` by k (0..1), into `out`; slots switch at once to `b`'s. */
export function blendPose(a: Pose, b: Pose, k: number, out: Pose): Pose {
  out.bones.forEach((o, i) => {
    const pa = a.bones[i];
    const pb = b.bones[i];
    if (!pa || !pb) return;
    o.rot = pa.rot + (pb.rot - pa.rot) * k;
    o.x = pa.x + (pb.x - pa.x) * k;
    o.y = pa.y + (pb.y - pa.y) * k;
    o.sx = pa.sx + (pb.sx - pa.sx) * k;
    o.sy = pa.sy + (pb.sy - pa.sy) * k;
  });
  for (const [s, v] of b.slots) out.slots.set(s, v);
  return out;
}

function copyPose(from: Pose, to: Pose): void {
  from.bones.forEach((p, i) => {
    const q = to.bones[i];
    if (q) Object.assign(q, p);
  });
  for (const [s, v] of from.slots) to.slots.set(s, v);
}

/**
 * Plays the animations of one rig: one at a time, cross-faded from the pose shown when it
 * started, its events fired as the playhead passes them (every lap of a loop).
 */
export class AnimPlayer {
  readonly rig: RigDef;
  private readonly anims: ReadonlyMap<string, AnimDef>;
  private current: AnimDef | null = null;
  /** seconds since the current animation started */
  private elapsed = 0;
  private readonly from: Pose;
  private readonly target: Pose;
  readonly pose: Pose;
  /** degrees the bones bound to the aim turn by */
  aimDeg = 0;
  /** a slot kept empty whatever the animation puts in it (a pose borrowed from another tool) */
  hiddenSlot: string | null = null;

  constructor(rig: RigDef, anims: ReadonlyMap<string, AnimDef>) {
    this.rig = rig;
    this.anims = anims;
    this.from = restPose(rig);
    this.target = restPose(rig);
    this.pose = restPose(rig);
  }

  has(id: string): boolean {
    return this.anims.has(id);
  }

  get playing(): string | null {
    return this.current?.id ?? null;
  }

  /** seconds into the current animation, wrapped for a loop, clamped otherwise */
  get time(): number {
    const a = this.current;
    if (!a) return 0;
    return a.mode === 'loop' ? this.elapsed % a.duration : Math.min(this.elapsed, a.duration);
  }

  /** A `once` animation that has reached its end. */
  get finished(): boolean {
    const a = this.current;
    return a !== null && a.mode === 'once' && this.elapsed >= a.duration;
  }

  /**
   * Starts animation `id` (unless it already plays and `restart` is false), cross-fading from
   * the pose shown now. Returns the events at its very start (t = 0).
   */
  play(id: string, restart = false): string[] {
    if (this.current?.id === id && !restart) return [];
    const a = this.anims.get(id);
    if (!a) throw new Error(`rig ${this.rig.id}: no animation "${id}"`);
    copyPose(this.pose, this.from);
    this.current = a;
    this.elapsed = 0;
    const fired: string[] = [];
    for (const e of a.events) if (e.t === 0) fired.push(e.name);
    this.compose();
    return fired;
  }

  /** Moves on by `dt` seconds; returns the names of the events passed, in order. */
  update(dt: number): string[] {
    const a = this.current;
    if (!a) return [];
    const fired: string[] = [];
    const t0 = this.elapsed;
    const t1 = t0 + Math.max(0, dt);
    this.elapsed = t1;
    if (a.events.length > 0 && t1 > t0) {
      if (a.mode === 'loop') {
        // Every lap the playhead completes or enters: events in (t0, t1].
        const d = a.duration;
        const lap0 = Math.floor(t0 / d);
        const lap1 = Math.floor(t1 / d);
        for (let lap = lap0; lap <= lap1; lap++) {
          for (const e of a.events) {
            const at = lap * d + e.t;
            if (at > t0 && at <= t1) fired.push(e.name);
          }
        }
      } else {
        for (const e of a.events) if (e.t > t0 && e.t <= t1) fired.push(e.name);
      }
    }
    this.compose();
    return fired;
  }

  private compose(): void {
    const a = this.current;
    if (!a) return;
    samplePose(this.rig, a, this.time, this.aimDeg, this.target);
    const k = a.mix > 0 ? Math.min(1, this.elapsed / a.mix) : 1;
    blendPose(this.from, this.target, k, this.pose);
    if (this.hiddenSlot !== null) this.pose.slots.set(this.hiddenSlot, null);
  }
}

/** World transform of a bone: a 2D affine matrix [a c tx; b d ty]. */
export interface Mat {
  a: number;
  b: number;
  c: number;
  d: number;
  tx: number;
  ty: number;
}

const IDENTITY: Mat = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };

/**
 * The transform of every piece for `pose`, in the rig's frame, written into `out` (one per
 * piece, in draw order). Rotation and scale are read back from each bone's world matrix.
 */
export function pieceTransforms(
  rig: RigDef,
  pose: Pose,
  out: PieceTransform[] = [],
): PieceTransform[] {
  const world = boneMatrices(rig, pose);
  rig.pieces.forEach((pc, i) => {
    const m = world.get(pc.bone) ?? IDENTITY;
    const sx = Math.hypot(m.a, m.b);
    const det = m.a * m.d - m.b * m.c;
    const t = out[i] ?? { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, visible: true };
    t.x = m.tx;
    t.y = m.ty;
    t.rotation = Math.atan2(m.b, m.a);
    t.scaleX = sx;
    t.scaleY = sx > 0 ? det / sx : 0;
    t.visible = pc.slot === null || pose.slots.get(pc.slot.slot) === pc.slot.attachment;
    out[i] = t;
  });
  out.length = rig.pieces.length;
  return out;
}

/** World matrix of every bone for `pose`, in the rig's frame, by bone id. */
export function boneMatrices(rig: RigDef, pose: Pose): Map<string, Mat> {
  const world = new Map<string, Mat>();
  rig.bones.forEach((b, i) => {
    const p = pose.bones[i] ?? { rot: 0, x: 0, y: 0, sx: 1, sy: 1 };
    const r = (b.rot + p.rot) * DEG;
    const cos = Math.cos(r);
    const sin = Math.sin(r);
    // local = T(x, y) · R(r) · S(sx, sy)
    const l: Mat = {
      a: cos * p.sx,
      b: sin * p.sx,
      c: -sin * p.sy,
      d: cos * p.sy,
      tx: b.x + p.x,
      ty: b.y + p.y,
    };
    const parent = b.parent === null ? undefined : world.get(b.parent);
    if (!parent) {
      world.set(b.id, l);
      return;
    }
    world.set(b.id, {
      a: parent.a * l.a + parent.c * l.b,
      b: parent.b * l.a + parent.d * l.b,
      c: parent.a * l.c + parent.c * l.d,
      d: parent.b * l.c + parent.d * l.d,
      tx: parent.a * l.tx + parent.c * l.ty + parent.tx,
      ty: parent.b * l.tx + parent.d * l.ty + parent.ty,
    });
  });
  return world;
}

/** Where bone `id`'s origin is for `pose`, in the rig's frame (e.g. the hand, for a held tool). */
export function boneOrigin(rig: RigDef, pose: Pose, id: string): { x: number; y: number } {
  const m = boneMatrices(rig, pose).get(id) ?? IDENTITY;
  return { x: m.tx, y: m.ty };
}
