// Cosmetic scenery until the painted maps (ASSETS §1.1): a far landscape with a castle and
// lollipop trees in parallax, scalloped clouds drifting with the wind, and trees and flowers
// standing on the terrain, which fall away when the ground under them is blown up.
// Cosmetic randomness only (Math.random), never the sim PRNG.
import Phaser from 'phaser';
import { COLORS, css } from '../ui/tokens.ts';
import type { MaskView } from './terrain-layer.ts';

const FAR_W = 1600;
/** tall enough for the lower hill to reach below the terrain everywhere */
const FAR_H = 1000;
/** parallax factor of the far landscape */
const FAR_SCROLL = 0.45;
const CLOUD_SCROLL = 0.6;
/** px per second per wind point */
const CLOUD_DRIFT = 4;

type Ctx = CanvasRenderingContext2D;

function lollipop(ctx: Ctx, x: number, y: number, r: number, leaf: number, alpha = 1): void {
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 3;
  ctx.strokeStyle = css(COLORS.encre);
  ctx.fillStyle = css(COLORS.terreOmbre);
  ctx.fillRect(x - 3, y - r * 1.6, 6, r * 1.6);
  ctx.strokeRect(x - 3, y - r * 1.6, 6, r * 1.6);
  ctx.fillStyle = css(leaf);
  ctx.beginPath();
  ctx.arc(x, y - r * 1.6 - r * 0.8, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Leaves as little arcs, the way the manuscript hatches its foliage.
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * r * 0.5, y - r * 2.4 + Math.sin(a) * r * 0.5, r * 0.28, 0, Math.PI);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function tower(ctx: Ctx, x: number, base: number, w: number, h: number, roof: number): void {
  ctx.lineWidth = 3;
  ctx.strokeStyle = css(COLORS.encre);
  ctx.fillStyle = css(COLORS.ceruse);
  ctx.fillRect(x, base - h, w, h);
  ctx.strokeRect(x, base - h, w, h);
  // Crenels
  for (let cx = x; cx < x + w - 2; cx += 12) {
    ctx.fillRect(cx, base - h - 8, 7, 8);
    ctx.strokeRect(cx, base - h - 8, 7, 8);
  }
  // Scale-tiled roof
  ctx.fillStyle = css(roof);
  ctx.beginPath();
  ctx.moveTo(x - 4, base - h - 8);
  ctx.lineTo(x + w / 2, base - h - 8 - w * 1.1);
  ctx.lineTo(x + w + 4, base - h - 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Window
  ctx.fillStyle = css(COLORS.encre);
  ctx.beginPath();
  ctx.arc(x + w / 2, base - h * 0.6, 5, Math.PI, 0);
  ctx.lineTo(x + w / 2 + 5, base - h * 0.6 + 12);
  ctx.lineTo(x + w / 2 - 5, base - h * 0.6 + 12);
  ctx.fill();
}

/** The far landscape: soft hills, a castle, trees; muted so the play stays readable. */
function drawFar(ctx: Ctx): void {
  ctx.clearRect(0, 0, FAR_W, FAR_H);
  const hill = (y0: number, amp: number, period: number, color: number, alpha: number): void => {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = css(color);
    ctx.strokeStyle = css(COLORS.encre);
    ctx.lineWidth = 3;
    // Periodic in FAR_W so the tile repeats without a seam.
    const top = (x: number): number => {
      const k = (x / FAR_W) * Math.PI * 2;
      return y0 - amp * Math.sin(k * period) - amp * 0.4 * Math.sin(k * period * 3 + 1);
    };
    ctx.beginPath();
    ctx.moveTo(0, FAR_H);
    for (let x = 0; x <= FAR_W; x += 8) ctx.lineTo(x, top(x));
    ctx.lineTo(FAR_W, FAR_H);
    ctx.closePath();
    ctx.fill();
    // Ink only along the crest: the sides and the bottom would show as seams.
    ctx.beginPath();
    ctx.moveTo(0, top(0));
    for (let x = 8; x <= FAR_W; x += 8) ctx.lineTo(x, top(x));
    ctx.stroke();
    ctx.globalAlpha = 1;
  };
  hill(300, 40, 2, COLORS.vertTendre, 0.45);
  ctx.globalAlpha = 0.55;
  tower(ctx, 980, 290, 40, 120, COLORS.vermillon);
  tower(ctx, 1030, 270, 60, 90, COLORS.lapis);
  tower(ctx, 1100, 285, 40, 130, COLORS.vermillon);
  ctx.globalAlpha = 1;
  for (const [x, r] of [
    [140, 22],
    [210, 16],
    [520, 20],
    [760, 26],
    [1320, 18],
    [1450, 24],
  ] as const) {
    lollipop(ctx, x, 330, r, COLORS.vertDeGris, 0.5);
  }
  hill(380, 26, 3, COLORS.ocre, 0.35);
}

/** A scalloped manuscript cloud. */
function drawCloud(ctx: Ctx, w: number, h: number): void {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = css(COLORS.ceruse);
  ctx.strokeStyle = css(COLORS.lapis);
  ctx.lineWidth = 3;
  const lobes = 5;
  const lobe = (r: number): void => {
    ctx.beginPath();
    for (let i = 0; i < lobes; i++) {
      const cx = 30 + (i * (w - 60)) / (lobes - 1);
      const cy = h / 2 + (i % 2 === 0 ? 6 : -8);
      ctx.moveTo(cx + r, cy);
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
    }
  };
  // Outline only around the whole cloud: stroke the lobes, then cover the inner strokes.
  lobe(28);
  ctx.fill();
  ctx.stroke();
  lobe(26.5);
  ctx.fill();
  // Inner scallops
  ctx.lineWidth = 2;
  for (let i = 0; i < lobes - 1; i++) {
    const cx = 45 + (i * (w - 90)) / (lobes - 2);
    ctx.beginPath();
    ctx.arc(cx, h / 2 + 10, 14, Math.PI, 0);
    ctx.stroke();
  }
}

interface Prop {
  readonly image: Phaser.GameObjects.Image;
  readonly x: number;
  readonly y: number;
}

export class Scenery {
  /** every game object of the scenery, so a HUD camera can ignore them */
  readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly clouds: Phaser.GameObjects.Image[] = [];
  private props: Prop[] = [];
  private readonly width: number;

  constructor(scene: Phaser.Scene, mask: MaskView) {
    this.width = mask.width;
    const tex = (key: string, w: number, h: number, draw: (ctx: Ctx) => void): string => {
      if (scene.textures.exists(key)) return key;
      const t = scene.textures.createCanvas(key, w, h);
      if (!t) throw new Error(`cannot create texture ${key}`);
      draw(t.getContext());
      t.refresh();
      return key;
    };
    const far = scene.add
      // Three map widths, starting one to the left, so the parallax never shows an edge.
      .tileSprite(
        -mask.width,
        mask.height * 0.32,
        mask.width * 3,
        FAR_H,
        tex('far', FAR_W, FAR_H, drawFar),
      )
      .setOrigin(0, 0)
      .setScrollFactor(FAR_SCROLL, 0.8)
      .setDepth(1);
    this.objects.push(far);

    const cloudKey = tex('cloud', 300, 90, (ctx) => drawCloud(ctx, 300, 90));
    for (let i = 0; i < 6; i++) {
      const c = scene.add
        .image(Math.random() * mask.width, 60 + Math.random() * mask.height * 0.25, cloudKey)
        .setScrollFactor(CLOUD_SCROLL, 0.7)
        .setScale(0.7 + Math.random() * 0.6)
        .setAlpha(0.85)
        .setDepth(2);
      this.clouds.push(c);
      this.objects.push(c);
    }

    // Trees and flowers on the terrain surface.
    const treeKey = tex('tree', 70, 110, (ctx) => lollipop(ctx, 35, 108, 22, COLORS.vertDeGris));
    const flowerKey = tex('flowers', 40, 24, (ctx) => {
      for (const [x, color] of [
        [8, COLORS.vermillon],
        [20, COLORS.lapis],
        [32, COLORS.or],
      ] as const) {
        ctx.strokeStyle = css(COLORS.vertDeGris);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, 24);
        ctx.lineTo(x, 10);
        ctx.stroke();
        ctx.fillStyle = css(color);
        ctx.beginPath();
        ctx.arc(x, 8, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    const solid = (x: number, y: number): boolean =>
      x >= 0 &&
      y >= 0 &&
      x < mask.width &&
      y < mask.height &&
      (mask.data[y * mask.width + x] ?? 0) !== 0;
    for (let x = 60; x < mask.width - 60; x += 70 + Math.floor(Math.random() * 160)) {
      let y = 0;
      while (y < mask.height && !solid(x, y)) y++;
      // Only on wide, fairly flat ground, not on thin platforms.
      if (y >= mask.height - 40 || !solid(x - 20, y + 4) || !solid(x + 20, y + 4)) continue;
      if (!solid(x, y + 30)) continue;
      const isTree = Math.random() < 0.35;
      const image = scene.add
        .image(x, y + 3, isTree ? treeKey : flowerKey)
        .setOrigin(0.5, 1)
        .setDepth(isTree ? 3 : 5);
      this.props.push({ image, x, y });
      this.objects.push(image);
    }
  }

  /** Drifts the clouds; drops props whose ground was blown away. */
  update(delta: number, wind: number, mask: MaskView): void {
    for (const c of this.clouds) {
      c.x += ((wind * CLOUD_DRIFT + 6) * delta) / 1000;
      if (c.x > this.width + 200) c.x = -200;
      if (c.x < -200) c.x = this.width + 200;
    }
    this.props = this.props.filter((p) => {
      const under = p.y * mask.width + p.x;
      if ((mask.data[under] ?? 0) !== 0 || (mask.data[under + mask.width] ?? 0) !== 0) return true;
      p.image.destroy();
      return false;
    });
  }
}
