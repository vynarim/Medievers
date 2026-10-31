// The cutout rig format (TECH_SPEC §7, ADR 0003): `rig.json` (bones, pieces, slots) and
// `anim/*.json` (keyframes per bone, events, slot switches), with their validation. Pure: no
// Phaser, no DOM, so the tests and the tools read the same files the game does.
//
// Conventions, frozen for the art lot:
// - units are world px at ×1 (a standing unit is about 88 px tall); textures may be at any
//   resolution, each piece is shown at its declared `size`;
// - the rig faces right; y grows downward; the root bone sits between the feet, on the ground;
// - angles in degrees, positive clockwise on screen (with y down); facing left mirrors the
//   whole figure (scaleX = −1), never the data;
// - a bone's x, y and rot are its rest transform in its parent's frame;
// - a piece is drawn with its pivot on its bone's origin and turns with it; pieces are drawn in
//   the order of the `pieces` array, back to front;
// - animation values are offsets from the rest pose: rot and x, y are added, sx and sy multiply.

export const RIG_FORMAT = 'medieverse.rig/1';
export const ANIM_FORMAT = 'medieverse.anim/1';

/** House colour a piece is tinted with (multiply): its field, its second tincture, or none. */
export type Tint = 'primary' | 'secondary';

export interface BoneDef {
  readonly id: string;
  /** null for the root only */
  readonly parent: string | null;
  /** px, in the parent's frame */
  readonly x: number;
  readonly y: number;
  /** degrees */
  readonly rot: number;
}

export interface PieceDef {
  readonly id: string;
  readonly bone: string;
  /** asset key of the texture (ASSETS §2), e.g. `unit_knight_thigh_near` */
  readonly key: string;
  /** px: width and height the piece is shown at */
  readonly size: readonly [number, number];
  /** px from the top-left corner of the piece: the point that sits on the bone's origin */
  readonly pivot: readonly [number, number];
  readonly tint: Tint | null;
  /** shown only while slot `slot` holds attachment `attachment` */
  readonly slot: { readonly slot: string; readonly attachment: string } | null;
}

export interface SlotDef {
  readonly id: string;
  /** attachment held at rest; null: empty */
  readonly default: string | null;
}

export interface RigDef {
  readonly format: typeof RIG_FORMAT;
  readonly id: string;
  /** px: height of the figure at rest, from the ground to the top of the head */
  readonly height: number;
  /** parents always before their children */
  readonly bones: readonly BoneDef[];
  /** in draw order, back to front */
  readonly pieces: readonly PieceDef[];
  readonly slots: readonly SlotDef[];
}

export type Ease = 'linear' | 'step' | 'easeIn' | 'easeOut' | 'easeInOut';
export const EASES: readonly Ease[] = ['linear', 'step', 'easeIn', 'easeOut', 'easeInOut'];

/** One key: at `t` seconds the channel is `v`; `ease` shapes the way to the next key. */
export interface Key {
  readonly t: number;
  readonly v: number;
  readonly ease: Ease;
}

export type Channel = 'rot' | 'x' | 'y' | 'sx' | 'sy';
export const CHANNELS: readonly Channel[] = ['rot', 'x', 'y', 'sx', 'sy'];

export type BoneTrack = Partial<Record<Channel, readonly Key[]>>;

/** A slot switch: from `t` seconds on, the slot holds `v` (null: empty). Always a step. */
export interface SlotKey {
  readonly t: number;
  readonly v: string | null;
}

/**
 * `loop`: plays round and round; `once`: plays to the end, holds its last pose and reports
 * itself finished; `hold`: a held pose (aim), like once but never finished.
 */
export type AnimMode = 'loop' | 'once' | 'hold';
export const ANIM_MODES: readonly AnimMode[] = ['loop', 'once', 'hold'];

export interface AnimEvent {
  readonly t: number;
  readonly name: string;
}

/** A bone that turns with the aim, by `weight` times its angle (0: straight ahead). */
export interface AimBinding {
  readonly bone: string;
  readonly weight: number;
}

export interface AnimDef {
  readonly format: typeof ANIM_FORMAT;
  readonly id: string;
  /** id of the rig it moves */
  readonly rig: string;
  /** seconds */
  readonly duration: number;
  readonly mode: AnimMode;
  /** seconds: cross-fade from the pose before it */
  readonly mix: number;
  readonly tracks: Readonly<Record<string, BoneTrack>>;
  readonly slots: Readonly<Record<string, readonly SlotKey[]>>;
  readonly events: readonly AnimEvent[];
  readonly aim: readonly AimBinding[];
}

export const DEFAULT_MIX = 0.1;

/** A rig or an animation file that breaks the format; `path` names the faulty field. */
export class RigFormatError extends Error {
  readonly path: string;

  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.path = path;
    this.name = 'RigFormatError';
  }
}

type Json = unknown;

const isObj = (v: Json): v is Record<string, Json> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const ID = /^[a-z][a-z0-9_]*$/;

function obj(v: Json, path: string): Record<string, Json> {
  if (!isObj(v)) throw new RigFormatError(path, 'expected an object');
  return v;
}

function only(o: Record<string, Json>, path: string, allowed: readonly string[]): void {
  for (const k of Object.keys(o)) {
    if (!allowed.includes(k)) throw new RigFormatError(`${path}.${k}`, 'unknown field');
  }
}

function num(v: Json, path: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new RigFormatError(path, 'expected a finite number');
  }
  return v;
}

function id(v: Json, path: string): string {
  if (typeof v !== 'string' || !ID.test(v)) {
    throw new RigFormatError(path, 'expected an id in snake_case');
  }
  return v;
}

function arr(v: Json, path: string): readonly Json[] {
  if (!Array.isArray(v)) throw new RigFormatError(path, 'expected an array');
  return v;
}

function pair(v: Json, path: string): readonly [number, number] {
  const a = arr(v, path);
  if (a.length !== 2) throw new RigFormatError(path, 'expected [x, y]');
  return [num(a[0], `${path}[0]`), num(a[1], `${path}[1]`)];
}

/** Checks a parsed `rig.json` and returns it typed, defaults filled in. */
export function parseRig(json: Json, path = 'rig'): RigDef {
  const o = obj(json, path);
  only(o, path, ['format', 'id', 'height', 'bones', 'pieces', 'slots']);
  if (o['format'] !== RIG_FORMAT) {
    throw new RigFormatError(`${path}.format`, `expected "${RIG_FORMAT}"`);
  }
  const rigId = id(o['id'], `${path}.id`);
  const height = num(o['height'], `${path}.height`);
  if (height <= 0) throw new RigFormatError(`${path}.height`, 'must be positive');

  const bones: BoneDef[] = [];
  const boneIds = new Set<string>();
  arr(o['bones'], `${path}.bones`).forEach((b, i) => {
    const p = `${path}.bones[${i}]`;
    const bo = obj(b, p);
    only(bo, p, ['id', 'parent', 'x', 'y', 'rot']);
    const bid = id(bo['id'], `${p}.id`);
    if (boneIds.has(bid)) throw new RigFormatError(`${p}.id`, `duplicate bone "${bid}"`);
    const parent = bo['parent'] === null ? null : id(bo['parent'], `${p}.parent`);
    if (i === 0 && parent !== null) {
      throw new RigFormatError(`${p}.parent`, 'the first bone is the root: parent null');
    }
    if (i > 0 && parent === null) throw new RigFormatError(`${p}.parent`, 'only one root');
    if (parent !== null && !boneIds.has(parent)) {
      throw new RigFormatError(`${p}.parent`, `"${parent}" is not a bone declared before`);
    }
    boneIds.add(bid);
    bones.push({
      id: bid,
      parent,
      x: num(bo['x'] ?? 0, `${p}.x`),
      y: num(bo['y'] ?? 0, `${p}.y`),
      rot: num(bo['rot'] ?? 0, `${p}.rot`),
    });
  });
  if (bones.length === 0) throw new RigFormatError(`${path}.bones`, 'at least the root');

  const slots: SlotDef[] = [];
  const slotIds = new Set<string>();
  arr(o['slots'] ?? [], `${path}.slots`).forEach((s, i) => {
    const p = `${path}.slots[${i}]`;
    const so = obj(s, p);
    only(so, p, ['id', 'default']);
    const sid = id(so['id'], `${p}.id`);
    if (slotIds.has(sid)) throw new RigFormatError(`${p}.id`, `duplicate slot "${sid}"`);
    slotIds.add(sid);
    const def = so['default'] ?? null;
    slots.push({ id: sid, default: def === null ? null : id(def, `${p}.default`) });
  });

  const pieces: PieceDef[] = [];
  const pieceIds = new Set<string>();
  const attachments = new Map<string, Set<string>>();
  arr(o['pieces'], `${path}.pieces`).forEach((pc, i) => {
    const p = `${path}.pieces[${i}]`;
    const po = obj(pc, p);
    only(po, p, ['id', 'bone', 'key', 'size', 'pivot', 'tint', 'slot']);
    const pid = id(po['id'], `${p}.id`);
    if (pieceIds.has(pid)) throw new RigFormatError(`${p}.id`, `duplicate piece "${pid}"`);
    pieceIds.add(pid);
    const bone = id(po['bone'], `${p}.bone`);
    if (!boneIds.has(bone)) throw new RigFormatError(`${p}.bone`, `no bone "${bone}"`);
    const key = id(po['key'], `${p}.key`);
    const size = pair(po['size'], `${p}.size`);
    if (size[0] <= 0 || size[1] <= 0) throw new RigFormatError(`${p}.size`, 'must be positive');
    const pivot = pair(po['pivot'], `${p}.pivot`);
    const tintV = po['tint'] ?? null;
    if (tintV !== null && tintV !== 'primary' && tintV !== 'secondary') {
      throw new RigFormatError(`${p}.tint`, 'expected "primary", "secondary" or null');
    }
    let slot: PieceDef['slot'] = null;
    if (po['slot'] !== undefined && po['slot'] !== null) {
      const so = obj(po['slot'], `${p}.slot`);
      only(so, `${p}.slot`, ['slot', 'attachment']);
      const s = id(so['slot'], `${p}.slot.slot`);
      if (!slotIds.has(s)) throw new RigFormatError(`${p}.slot.slot`, `no slot "${s}"`);
      const a = id(so['attachment'], `${p}.slot.attachment`);
      slot = { slot: s, attachment: a };
      const set = attachments.get(s) ?? new Set<string>();
      set.add(a);
      attachments.set(s, set);
    }
    pieces.push({ id: pid, bone, key, size, pivot, tint: tintV, slot });
  });
  if (pieces.length === 0) throw new RigFormatError(`${path}.pieces`, 'at least one piece');
  slots.forEach((s, i) => {
    if (s.default !== null && !attachments.get(s.id)?.has(s.default)) {
      throw new RigFormatError(
        `${path}.slots[${i}].default`,
        `no piece is attachment "${s.default}"`,
      );
    }
  });

  return { format: RIG_FORMAT, id: rigId, height, bones, pieces, slots };
}

function keys(v: Json, path: string, duration: number): readonly Key[] {
  const out: Key[] = [];
  arr(v, path).forEach((k, i) => {
    const p = `${path}[${i}]`;
    const ko = obj(k, p);
    only(ko, p, ['t', 'v', 'ease']);
    const t = num(ko['t'], `${p}.t`);
    if (t < 0 || t > duration) throw new RigFormatError(`${p}.t`, `outside 0..${duration}`);
    const prev = out[out.length - 1];
    if (prev && t <= prev.t) throw new RigFormatError(`${p}.t`, 'keys must be in strict order');
    const ease = ko['ease'] ?? 'linear';
    if (typeof ease !== 'string' || !EASES.includes(ease as Ease)) {
      throw new RigFormatError(`${p}.ease`, `expected one of ${EASES.join(', ')}`);
    }
    out.push({ t, v: num(ko['v'], `${p}.v`), ease: ease as Ease });
  });
  if (out.length === 0) throw new RigFormatError(path, 'at least one key');
  return out;
}

/**
 * Checks a parsed `anim/*.json` against the rig it moves and returns it typed, defaults filled
 * in.
 */
export function parseAnim(json: Json, rig: RigDef, path = 'anim'): AnimDef {
  const o = obj(json, path);
  only(o, path, [
    'format',
    'id',
    'rig',
    'duration',
    'mode',
    'mix',
    'tracks',
    'slots',
    'events',
    'aim',
  ]);
  if (o['format'] !== ANIM_FORMAT) {
    throw new RigFormatError(`${path}.format`, `expected "${ANIM_FORMAT}"`);
  }
  const animId = id(o['id'], `${path}.id`);
  const rigId = id(o['rig'], `${path}.rig`);
  if (rigId !== rig.id) throw new RigFormatError(`${path}.rig`, `expected "${rig.id}"`);
  const duration = num(o['duration'], `${path}.duration`);
  if (duration <= 0) throw new RigFormatError(`${path}.duration`, 'must be positive');
  const mode = o['mode'];
  if (typeof mode !== 'string' || !ANIM_MODES.includes(mode as AnimMode)) {
    throw new RigFormatError(`${path}.mode`, `expected one of ${ANIM_MODES.join(', ')}`);
  }
  const mix = num(o['mix'] ?? DEFAULT_MIX, `${path}.mix`);
  if (mix < 0) throw new RigFormatError(`${path}.mix`, 'must not be negative');

  const boneIds = new Set(rig.bones.map((b) => b.id));
  const tracks: Record<string, BoneTrack> = {};
  for (const [bone, tr] of Object.entries(obj(o['tracks'] ?? {}, `${path}.tracks`))) {
    const p = `${path}.tracks.${bone}`;
    if (!boneIds.has(bone)) throw new RigFormatError(p, `no bone "${bone}" in rig "${rig.id}"`);
    const to = obj(tr, p);
    only(to, p, CHANNELS);
    const track: Partial<Record<Channel, readonly Key[]>> = {};
    for (const c of CHANNELS)
      if (to[c] !== undefined) track[c] = keys(to[c], `${p}.${c}`, duration);
    tracks[bone] = track;
  }

  const slotIds = new Set(rig.slots.map((s) => s.id));
  const attachments = new Map<string, Set<string>>();
  for (const pc of rig.pieces) {
    if (!pc.slot) continue;
    const set = attachments.get(pc.slot.slot) ?? new Set<string>();
    set.add(pc.slot.attachment);
    attachments.set(pc.slot.slot, set);
  }
  const slots: Record<string, readonly SlotKey[]> = {};
  for (const [slot, ks] of Object.entries(obj(o['slots'] ?? {}, `${path}.slots`))) {
    const p = `${path}.slots.${slot}`;
    if (!slotIds.has(slot)) throw new RigFormatError(p, `no slot "${slot}" in rig "${rig.id}"`);
    const out: SlotKey[] = [];
    arr(ks, p).forEach((k, i) => {
      const kp = `${p}[${i}]`;
      const ko = obj(k, kp);
      only(ko, kp, ['t', 'v']);
      const t = num(ko['t'], `${kp}.t`);
      if (t < 0 || t > duration) throw new RigFormatError(`${kp}.t`, `outside 0..${duration}`);
      const prev = out[out.length - 1];
      if (prev && t <= prev.t) throw new RigFormatError(`${kp}.t`, 'keys must be in strict order');
      const v = ko['v'] === null ? null : id(ko['v'], `${kp}.v`);
      if (v !== null && !attachments.get(slot)?.has(v)) {
        throw new RigFormatError(`${kp}.v`, `no piece is attachment "${v}" of slot "${slot}"`);
      }
      out.push({ t, v });
    });
    if (out.length === 0) throw new RigFormatError(p, 'at least one key');
    slots[slot] = out;
  }

  const events: AnimEvent[] = [];
  arr(o['events'] ?? [], `${path}.events`).forEach((e, i) => {
    const p = `${path}.events[${i}]`;
    const eo = obj(e, p);
    only(eo, p, ['t', 'name']);
    const t = num(eo['t'], `${p}.t`);
    if (t < 0 || t > duration) throw new RigFormatError(`${p}.t`, `outside 0..${duration}`);
    const prev = events[events.length - 1];
    if (prev && t < prev.t) throw new RigFormatError(`${p}.t`, 'events must be in order');
    events.push({ t, name: id(eo['name'], `${p}.name`) });
  });

  const aim: AimBinding[] = [];
  arr(o['aim'] ?? [], `${path}.aim`).forEach((a, i) => {
    const p = `${path}.aim[${i}]`;
    const ao = obj(a, p);
    only(ao, p, ['bone', 'weight']);
    const bone = id(ao['bone'], `${p}.bone`);
    if (!boneIds.has(bone)) throw new RigFormatError(`${p}.bone`, `no bone "${bone}"`);
    aim.push({ bone, weight: num(ao['weight'] ?? 1, `${p}.weight`) });
  });

  return {
    format: ANIM_FORMAT,
    id: animId,
    rig: rigId,
    duration,
    mode: mode as AnimMode,
    mix,
    tracks,
    slots,
    events,
    aim,
  };
}
