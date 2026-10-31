// A rig at rest, without Phaser: where each piece's rectangle lies, and the whole figure drawn
// straight onto a pen (the help's SVG figures, the placement ghost).
import type { RigDef } from './format.ts';
import { Frame, type Pen, type PieceDrawer, type Tinctures } from './pen.ts';
import { boneOrigin, restPose } from './runtime.ts';

/** The top-left corner of each piece at rest, in the rig's frame. */
export function restCorners(rig: RigDef): Map<string, { x: number; y: number }> {
  const pose = restPose(rig);
  const out = new Map<string, { x: number; y: number }>();
  for (const pc of rig.pieces) {
    const o = boneOrigin(rig, pose, pc.bone);
    out.set(pc.id, { x: o.x - pc.pivot[0], y: o.y - pc.pivot[1] });
  }
  return out;
}

/** The rig at rest drawn onto `pen`, feet at (x, y), in the house's tinctures. */
export function drawRigAtRest(
  pen: Pen,
  rig: RigDef,
  drawers: Readonly<Record<string, PieceDrawer>>,
  x: number,
  y: number,
  facing: number,
  t: Tinctures,
): void {
  const F = new Frame(pen, x, y, facing);
  const shown = restPose(rig).slots;
  for (const pc of rig.pieces) {
    if (pc.slot && shown.get(pc.slot.slot) !== pc.slot.attachment) continue;
    drawers[pc.id]?.(F, t);
  }
}
