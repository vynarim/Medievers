// A rig on the stage (TECH_SPEC §7): one Phaser image per piece in a container, set from the
// pose of the runtime each frame. Its textures are the asset keys of rig.json; a key no file
// provides yet gets a placeholder drawn by code (ASSETS §2.1), at the piece's size and pivot.
import Phaser from 'phaser';
import type { RigDef } from './format.ts';
import { CanvasPen, Frame, type PieceDrawer, type Tinctures } from './pen.ts';
import { restCorners } from './rest.ts';
import { pieceTransforms, type PieceTransform, type Pose } from './runtime.ts';

/** texture px per world px of the placeholders: crisp under the camera's zoom */
export const PLACEHOLDER_RES = 2;

/** The house's pieces are drawn white, and take its tinctures by tint (multiply). */
const WHITE: Tinctures = { primary: 0xffffff, secondary: 0xffffff };

/** Paints the placeholder of every piece whose texture is not loaded. */
export function rigTextures(
  scene: Phaser.Scene,
  rig: RigDef,
  drawers: Readonly<Record<string, PieceDrawer>>,
): void {
  const corners = restCorners(rig);
  for (const pc of rig.pieces) {
    if (scene.textures.exists(pc.key)) continue;
    const draw = drawers[pc.id];
    const corner = corners.get(pc.id);
    if (!corner) throw new Error(`rig ${rig.id}: no piece ${pc.id}`);
    const w = Math.ceil(pc.size[0] * PLACEHOLDER_RES);
    const h = Math.ceil(pc.size[1] * PLACEHOLDER_RES);
    const t = scene.textures.createCanvas(pc.key, w, h);
    if (!t) throw new Error(`cannot create texture ${pc.key}`);
    const ctx = t.getContext();
    if (!draw) {
      // No drawing for it and no file: a plain frame at its size (ASSETS §2.1).
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
      t.refresh();
      continue;
    }
    const r = PLACEHOLDER_RES;
    ctx.setTransform(r, 0, 0, r, -corner.x * r, -corner.y * r);
    draw(new Frame(new CanvasPen(ctx), 0, 0, 1), WHITE);
    t.refresh();
  }
}

export class RigView {
  readonly rig: RigDef;
  readonly container: Phaser.GameObjects.Container;
  private readonly images: Phaser.GameObjects.Image[];
  /** scale that shows each texture at its piece's size */
  private readonly base: { x: number; y: number }[];
  private readonly transforms: PieceTransform[] = [];
  private tinted: Tinctures | null = null;

  constructor(scene: Phaser.Scene, rig: RigDef, depth: number) {
    this.rig = rig;
    this.container = scene.add.container(0, 0).setDepth(depth);
    this.images = [];
    this.base = [];
    for (const pc of rig.pieces) {
      const img = scene.add.image(0, 0, pc.key);
      img.setOrigin(pc.pivot[0] / pc.size[0], pc.pivot[1] / pc.size[1]);
      this.base.push({ x: pc.size[0] / img.width, y: pc.size[1] / img.height });
      this.images.push(img);
    }
    this.container.add(this.images);
  }

  /** Shows `pose` with the feet at (x, y), facing `facing`, in the house's tinctures. */
  show(pose: Pose, x: number, y: number, facing: number, t: Tinctures): void {
    this.container.setVisible(true).setPosition(x, y).setScale(facing, 1);
    if (this.tinted?.primary !== t.primary || this.tinted.secondary !== t.secondary) {
      this.rig.pieces.forEach((pc, i) => {
        const img = this.images[i];
        if (!img) return;
        if (pc.tint === null) img.clearTint();
        else img.setTint(pc.tint === 'primary' ? t.primary : t.secondary);
      });
      this.tinted = t;
    }
    pieceTransforms(this.rig, pose, this.transforms);
    this.transforms.forEach((tr, i) => {
      const img = this.images[i];
      const b = this.base[i];
      if (!img || !b) return;
      img.setVisible(tr.visible);
      if (!tr.visible) return;
      img.setPosition(tr.x, tr.y);
      img.setRotation(tr.rotation);
      img.setScale(b.x * tr.scaleX, b.y * tr.scaleY);
    });
  }

  hide(): void {
    this.container.setVisible(false);
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
