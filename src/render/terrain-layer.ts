// Painted terrain layer (TECH_SPEC §4.3): 512 × 512 CanvasTexture tiles. Greybox colours are
// drawn from the mask; carves clear the tile pixels the mask turned to air, so the picture
// matches the collision mask pixel for pixel. At most 4 tiles are re-uploaded per frame (§9).
import Phaser from 'phaser';
import { Material } from '../sim/terrain/material.ts';
import { COLORS } from '../ui/tokens.ts';

export const TILE_SIZE = 512;
export const MAX_TILE_UPLOADS_PER_FRAME = 4;

/** Read-only view of the collision mask, as exposed by the sim view. */
export interface MaskView {
  readonly width: number;
  readonly height: number;
  readonly data: ArrayLike<number>;
}

const rgb = (c: number): [number, number, number] => [(c >> 16) & 255, (c >> 8) & 255, c & 255];

/** Greybox colours per material: flat tints with a darker band every few rows. */
const MATERIAL_RGB: Record<number, [number, number, number]> = {
  [Material.Earth]: rgb(COLORS.ocre),
  [Material.Rock]: rgb(COLORS.roche),
  [Material.BuiltStone]: rgb(COLORS.velin),
  [Material.Wood]: rgb(COLORS.terreOmbre),
  [Material.Ladder]: rgb(COLORS.or),
};
const EDGE_RGB = rgb(COLORS.vertDeGris);

interface Tile {
  readonly key: string;
  readonly texture: Phaser.Textures.CanvasTexture;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export class TerrainLayer {
  private readonly tiles: Tile[] = [];
  /** tile images, so a HUD camera can ignore them */
  readonly images: Phaser.GameObjects.Image[] = [];
  private readonly cols: number;
  /** tile index → dirty rectangle in world px [x0, y0, x1, y1] (inclusive) */
  private readonly dirty = new Map<number, [number, number, number, number]>();

  private readonly mask: () => MaskView;

  constructor(scene: Phaser.Scene, mask: () => MaskView) {
    this.mask = mask;
    const m = mask();
    this.cols = Math.ceil(m.width / TILE_SIZE);
    const rows = Math.ceil(m.height / TILE_SIZE);
    for (let ty = 0; ty < rows; ty++) {
      for (let tx = 0; tx < this.cols; tx++) {
        const x = tx * TILE_SIZE;
        const y = ty * TILE_SIZE;
        const w = Math.min(TILE_SIZE, m.width - x);
        const h = Math.min(TILE_SIZE, m.height - y);
        const key = `terrain_tile_${tx}_${ty}`;
        if (scene.textures.exists(key)) scene.textures.remove(key);
        const texture = scene.textures.createCanvas(key, w, h);
        if (!texture) throw new Error(`cannot create canvas texture ${key}`);
        const tile: Tile = { key, texture, x, y, w, h };
        this.tiles.push(tile);
        this.paint(tile, 0, 0, w - 1, h - 1);
        texture.refresh();
        // 512² tiles are powers of two and would REPEAT: their edges would sample the opposite
        // side and draw seams. Clamp, and keep nearest filtering for crisp mask edges.
        texture.setWrap(
          Phaser.Textures.WrapMode.CLAMP_TO_EDGE,
          Phaser.Textures.WrapMode.CLAMP_TO_EDGE,
        );
        texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
        this.images.push(scene.add.image(x, y, key).setOrigin(0, 0).setDepth(4));
      }
    }
  }

  /** Marks the area of a carve (px, centre and radius) for repaint. */
  invalidate(cx: number, cy: number, radius: number): void {
    const m = this.mask();
    const r = radius + 2;
    const x0 = Math.max(0, cx - r);
    const y0 = Math.max(0, cy - r);
    const x1 = Math.min(m.width - 1, cx + r);
    const y1 = Math.min(m.height - 1, cy + r);
    for (let ty = Math.floor(y0 / TILE_SIZE); ty <= Math.floor(y1 / TILE_SIZE); ty++) {
      for (let tx = Math.floor(x0 / TILE_SIZE); tx <= Math.floor(x1 / TILE_SIZE); tx++) {
        const i = ty * this.cols + tx;
        const d = this.dirty.get(i);
        this.dirty.set(
          i,
          d
            ? [Math.min(d[0], x0), Math.min(d[1], y0), Math.max(d[2], x1), Math.max(d[3], y1)]
            : [x0, y0, x1, y1],
        );
      }
    }
  }

  /** Repaints and re-uploads at most MAX_TILE_UPLOADS_PER_FRAME dirty tiles. */
  flush(): number {
    let uploads = 0;
    for (const [i, [x0, y0, x1, y1]] of this.dirty) {
      if (uploads === MAX_TILE_UPLOADS_PER_FRAME) break;
      this.dirty.delete(i);
      const tile = this.tiles[i];
      if (!tile) continue;
      this.paint(
        tile,
        Math.max(0, x0 - tile.x),
        Math.max(0, y0 - tile.y),
        Math.min(tile.w - 1, x1 - tile.x),
        Math.min(tile.h - 1, y1 - tile.y),
      );
      tile.texture.refresh();
      uploads++;
    }
    return uploads;
  }

  get pendingTiles(): number {
    return this.dirty.size;
  }

  /** Paints a tile rectangle (tile-local px, inclusive) from the mask. */
  private paint(tile: Tile, lx0: number, ly0: number, lx1: number, ly1: number): void {
    if (lx1 < lx0 || ly1 < ly0) return;
    const m = this.mask();
    const ctx = tile.texture.getContext();
    const w = lx1 - lx0 + 1;
    const h = ly1 - ly0 + 1;
    const img = ctx.createImageData(w, h);
    const solidAt = (x: number, y: number): boolean =>
      x >= 0 && y >= 0 && x < m.width && y < m.height && (m.data[y * m.width + x] ?? 0) !== 0;
    for (let ly = 0; ly < h; ly++) {
      const wy = tile.y + ly0 + ly;
      for (let lx = 0; lx < w; lx++) {
        const wx = tile.x + lx0 + lx;
        const mat = m.data[wy * m.width + wx] ?? 0;
        const o = (ly * w + lx) * 4;
        if (mat === Material.Air) continue; // alpha stays 0
        const base = MATERIAL_RGB[mat] ?? EDGE_RGB;
        // Grass edge on top of earth, darker wavy bands below (greybox « bandes ondulées »).
        const top = mat === Material.Earth && !solidAt(wx, wy - 3);
        const band = (wy + ((wx >> 4) % 3)) % 24 < 3 ? 0.82 : 1;
        const [r, g, b] = top ? EDGE_RGB : base;
        img.data[o] = Math.round(r * band);
        img.data[o + 1] = Math.round(g * band);
        img.data[o + 2] = Math.round(b * band);
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, lx0, ly0);
  }
}
