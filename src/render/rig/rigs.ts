// The rigs of the game and their animations (src/content/rigs/<rig>/rig.json and anim/*.json),
// checked at load: a broken file stops the game at once, with the faulty field named. A rig may
// borrow the animations of another on the same skeleton (rig.json "anims").
import { parseAnim, parseRig, type AnimDef, type RigDef } from './format.ts';

export interface RigSet {
  readonly rig: RigDef;
  readonly anims: ReadonlyMap<string, AnimDef>;
}

const rigFiles = import.meta.glob<unknown>('../../content/rigs/*/rig.json', {
  eager: true,
  import: 'default',
});
const animFiles = import.meta.glob<unknown>('../../content/rigs/*/anim/*.json', {
  eager: true,
  import: 'default',
});

/** Builds the rig sets from parsed files, by path (`.../rigs/<rig>/rig.json`, `.../anim/<id>.json`). */
export function loadRigs(
  rigs: Readonly<Record<string, unknown>>,
  anims: Readonly<Record<string, unknown>>,
): Map<string, RigSet> {
  const out = new Map<string, RigSet>();
  for (const [path, json] of Object.entries(rigs)) {
    const dir = /rigs\/([^/]+)\/rig\.json$/.exec(path)?.[1];
    if (!dir) continue;
    const rig = parseRig(json, path);
    if (rig.id !== dir) throw new Error(`${path}: id "${rig.id}" is not its folder "${dir}"`);
    const set = new Map<string, AnimDef>();
    // A rig on another's skeleton plays that one's animations, checked against its own bones.
    const from = rig.anims ?? dir;
    for (const [ap, aj] of Object.entries(anims)) {
      const m = /rigs\/([^/]+)\/anim\/([^/]+)\.json$/.exec(ap);
      if (!m || m[1] !== from) continue;
      const anim = parseAnim(aj, rig, ap);
      if (anim.id !== m[2]) throw new Error(`${ap}: id "${anim.id}" is not its file name`);
      set.set(anim.id, anim);
    }
    out.set(rig.id, { rig, anims: set });
  }
  return out;
}

export const RIGS: ReadonlyMap<string, RigSet> = loadRigs(rigFiles, animFiles);

export function rigSet(id: string): RigSet {
  const s = RIGS.get(id);
  if (!s) throw new Error(`no rig "${id}"`);
  return s;
}
