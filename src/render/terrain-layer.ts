// Painted terrain layer (TECH_SPEC §4.3): 512 × 512 CanvasTexture tiles. Greybox colours are
// drawn from the mask in the manuscript manner (ink outline, grass, wavy strata); carves clear the tile pixels the mask turned to air, so the picture
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

type Rgb = readonly [number, number, number];
const rgb = (c: number): Rgb => [(c >> 16) & 255, (c >> 8) & 255, c & 255];

/** Greybox tints per material: two flat tints for the wavy strata (« bandes ondulées »). */
const MATERIAL_RGB: Record<number, readonly [Rgb, Rgb]> = {
  [Material.Earth]: [rgb(COLORS.ocre), rgb(COLORS.terreOmbre)],
  [Material.Rock]: [rgb(COLORS.roche), rgb(COLORS.azur)],
  [Material.BuiltStone]: [rgb(COLORS.ceruse), rgb(COLORS.velin)],
  [Material.Wood]: [rgb(COLORS.terreOmbre), rgb(COLORS.ocre)],
  [Material.Ladder]: [rgb(COLORS.or), rgb(COLORS.ocre)],
};
const FALLBACK: readonly [Rgb, Rgb] = [rgb(COLORS.roseGarance), rgb(COLORS.roseGarance)];
const GRASS = rgb(COLORS.vertDeGris);
const GRASS_LIGHT = rgb(COLORS.vertTendre);
const INK = rgb(COLORS.encre);
/** px: ink outline (cerne) along every edge with the air, ASSETS §1.1 */
const CERNE = 3;
/** px: depth of the grass on top of earth */
const GRASS_DEPTH = 12;

/** True when air lies within CERNE px (4 directions, plus the diagonal neighbours). */
function nearAir(airAt: (x: number, y: number) => boolean, x: number, y: number): boolean {
  for (let d = 1; d <= CERNE; d++) {
    if (airAt(x - d, y) || airAt(x + d, y) || airAt(x, y - d) || airAt(x, y + d)) return true;
  }
  return airAt(x - 1, y - 1) || airAt(x + 1, y - 1) || airAt(x - 1, y + 1) || airAt(x + 1, y + 1);
}

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
    // The outline and the grass below a crater change too.
    const r = radius + GRASS_DEPTH + 2;
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
    const airAt = (x: number, y: number): boolean => !solidAt(x, y);
    for (let ly = 0; ly < h; ly++) {
      const wy = tile.y + ly0 + ly;
      for (let lx = 0; lx < w; lx++) {
        const wx = tile.x + lx0 + lx;
        const mat = m.data[wy * m.width + wx] ?? 0;
        const o = (ly * w + lx) * 4;
        if (mat === Material.Air) continue; // alpha stays 0
        let c: Rgb;
        if (nearAir(airAt, wx, wy)) c = INK;
        else if (mat === Material.Earth && !solidAt(wx, wy - GRASS_DEPTH)) {
          // Grass in tufts: lighter blades every few px.
          c = (wx + (wy >> 2)) % 7 < 2 ? GRASS_LIGHT : GRASS;
        } else {
          // Strata: wavy bands, a thin ink-shaded line between two bands.
          const [a1, a2] = MATERIAL_RGB[mat] ?? FALLBACK;
          const phase = wy + 7 * Math.sin(wx / 37) + 3 * Math.sin(wx / 11);
          const band = ((phase % 44) + 44) % 44;
          const base = band < 26 ? a1 : a2;
          const shade = band < 2 || (band >= 26 && band < 28) ? 0.72 : 1;
          c = [base[0] * shade, base[1] * shade, base[2] * shade];
        }
        img.data[o] = c[0];
        img.data[o + 1] = c[1];
        img.data[o + 2] = c[2];
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, lx0, ly0);
  }
}
