// Painted terrain layer (TECH_SPEC §4.3): 512 × 512 CanvasTexture tiles. Greybox colours are
// drawn from the mask in the manuscript manner (ink outline, grass, wavy strata); carves clear the tile pixels the mask turned to air, so the picture
// matches the collision mask pixel for pixel. At most 4 tiles are re-uploaded per frame (§9).
import Phaser from 'phaser';
import { MASK_PALETTE } from '../content/materials.ts';
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

/** Mixes a colour with the vellum, as the illuminators thinned their pigments with white. */
const pale = (c: number, k: number): Rgb => {
  const [r, g, b] = rgb(c);
  const [vr, vg, vb] = rgb(COLORS.ceruse);
  return [r + (vr - r) * k, g + (vg - g) * k, b + (vb - b) * k];
};

/**
 * Tints per material for the stratified ground (ASSETS §1.1: « sol en bandes ondulées
 * stratifiées, rochers en marches arrondies »): the bands cycle through these pigments.
 */
const MATERIAL_RGB: Record<number, readonly Rgb[]> = {
  [Material.Earth]: [
    pale(COLORS.vertTendre, 0.25),
    pale(COLORS.roseGarance, 0.45),
    pale(COLORS.ocre, 0.35),
    pale(COLORS.vertDeGris, 0.35),
  ],
  [Material.Rock]: [pale(COLORS.roche, 0.1), pale(COLORS.azur, 0.35), pale(COLORS.roche, 0.3)],
  [Material.BuiltStone]: [rgb(COLORS.ceruse), pale(COLORS.velin, 0.2)],
  [Material.Wood]: [rgb(COLORS.terreOmbre), pale(COLORS.ocre, 0.1)],
  [Material.Ladder]: [rgb(COLORS.or), rgb(COLORS.ocre)],
};
const FALLBACK: readonly Rgb[] = [rgb(COLORS.roseGarance)];
const HIGHLIGHT = rgb(COLORS.ceruse);
const MORTAR = pale(COLORS.terreOmbre, 0.2);
/** px: height of a band of strata, and width of the rounded steps along its edge */
const BAND = 56;
const STEP = 92;
/** px: masonry courses and stones of built stone */
const COURSE = 16;
const STONE = 34;
/** Rounded steps: how far below its nominal line a band edge sits at u in [0, STEP). */
const STEP_DROP = Array.from({ length: STEP }, (_, u) => {
  const t = (u - STEP / 2) / (STEP / 2);
  return Math.round(18 * Math.sqrt(Math.max(0, 1 - t * t)));
});
const GRASS = rgb(COLORS.vertDeGris);
const GRASS_LIGHT = rgb(COLORS.vertTendre);
const INK = rgb(COLORS.encre);
/** Mask PNG colours per material, for the debug view of the raw collision mask. */
const MASK_RGB: Record<number, Rgb> = Object.fromEntries(
  MASK_PALETTE.map((c) => [c.material, [c.r, c.g, c.b] as const]),
);
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
  /** debug: paint the raw mask colours instead of the greybox look */
  private maskView = false;

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

  /** Debug overlay (F1): shows the raw collision mask, repainted a few tiles per frame. */
  setMaskView(on: boolean): void {
    if (on === this.maskView) return;
    this.maskView = on;
    const m = this.mask();
    this.tiles.forEach((tile, i) =>
      this.dirty.set(i, [
        tile.x,
        tile.y,
        Math.min(m.width - 1, tile.x + tile.w - 1),
        Math.min(m.height - 1, tile.y + tile.h - 1),
      ]),
    );
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
        if (this.maskView) c = MASK_RGB[mat] ?? INK;
        else if (nearAir(airAt, wx, wy)) c = INK;
        else if (mat === Material.Earth && !solidAt(wx, wy - GRASS_DEPTH)) {
          // Grass in tufts: lighter blades every few px.
          c = (wx + (wy >> 2)) % 7 < 2 ? GRASS_LIGHT : GRASS;
        } else if (mat === Material.BuiltStone) {
          // Ashlar: courses of dressed stones, mortar joints, a lighter top edge to each stone.
          const course = Math.floor(wy / COURSE);
          const sx = (wx + (course & 1) * (STONE >> 1)) % STONE;
          const sy = wy % COURSE;
          const tints = MATERIAL_RGB[mat] ?? FALLBACK;
          const tint =
            tints[(course + Math.floor((wx + (course & 1) * 17) / STONE)) % tints.length];
          if (sx < 2 || sy < 2) c = MORTAR;
          else if (sy < 4) c = HIGHLIGHT;
          else c = tint ?? HIGHLIGHT;
        } else {
          // Strata in rounded steps: each band's lower edge bulges in arcs, ink line on the edge,
          // a white highlight just under it, as on the hills of the manuscript.
          const tints = MATERIAL_RGB[mat] ?? FALLBACK;
          const row = Math.floor(wy / BAND);
          const shift = (((row * 23) % STEP) + STEP) % STEP;
          const drop = STEP_DROP[(wx + shift) % STEP] ?? 0;
          const v = wy - row * BAND; // 0..BAND-1 inside the nominal band
          const edge = BAND - 20 + drop - 18; // where this band ends, in the next band's space
          const band = v >= edge ? row + 1 : row;
          const d = v - edge;
          const base = tints[((band % tints.length) + tints.length) % tints.length] ?? HIGHLIGHT;
          if (d >= 0 && d < 3) c = INK;
          else if (d >= 3 && d < 6) c = HIGHLIGHT;
          else c = base;
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
