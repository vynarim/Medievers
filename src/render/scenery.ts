// Cosmetic scenery until the painted maps (ASSETS §1.1): a far landscape with a castle and
// lollipop trees in parallax, scalloped clouds drifting with the wind, and trees and flowers
// standing on the terrain, which fall away when the ground under them is blown up.
// Cosmetic randomness only (Math.random), never the sim PRNG.
import Phaser from 'phaser';
import { COLORS, css } from '../ui/tokens.ts';
import { SkyLife } from './sky-life.ts';
import type { MaskView } from './terrain-layer.ts';

const FAR_W = 3200;
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

const ink = (ctx: Ctx, w = 2): void => {
  ctx.strokeStyle = css(COLORS.encre);
  ctx.lineWidth = w;
};

/** Half-timbered farmhouse with a thatched roof and a haystack. */
function farm(ctx: Ctx, x: number, base: number): void {
  ink(ctx, 3);
  ctx.fillStyle = css(COLORS.ceruse);
  ctx.fillRect(x, base - 44, 70, 44);
  ctx.strokeRect(x, base - 44, 70, 44);
  ctx.beginPath();
  for (const bx of [x + 20, x + 50]) {
    ctx.moveTo(bx, base - 44);
    ctx.lineTo(bx, base);
  }
  ctx.moveTo(x, base - 22);
  ctx.lineTo(x + 70, base - 22);
  ctx.stroke();
  ctx.fillStyle = css(COLORS.ocre);
  ctx.beginPath();
  ctx.moveTo(x - 8, base - 44);
  ctx.lineTo(x + 35, base - 78);
  ctx.lineTo(x + 78, base - 44);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = css(COLORS.terreOmbre);
  ctx.fillRect(x + 28, base - 18, 14, 18);
  ctx.strokeRect(x + 28, base - 18, 14, 18);
  // Haystack
  ctx.fillStyle = css(COLORS.or);
  ctx.beginPath();
  ctx.ellipse(x + 100, base - 14, 18, 16, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function windmill(ctx: Ctx, x: number, base: number): void {
  ink(ctx, 3);
  ctx.fillStyle = css(COLORS.ceruse);
  ctx.beginPath();
  ctx.moveTo(x - 16, base);
  ctx.lineTo(x - 10, base - 60);
  ctx.lineTo(x + 10, base - 60);
  ctx.lineTo(x + 16, base);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = css(COLORS.vermillon);
  ctx.beginPath();
  ctx.moveTo(x - 14, base - 60);
  ctx.lineTo(x, base - 76);
  ctx.lineTo(x + 14, base - 60);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = css(COLORS.velin);
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    ctx.save();
    ctx.translate(x, base - 62);
    ctx.rotate(a);
    ctx.fillRect(4, -5, 40, 10);
    ctx.strokeRect(4, -5, 40, 10);
    ctx.restore();
  }
}

/** Four-legged beast: body, head, legs, in the manuscript's flat tints. */
function beast(
  ctx: Ctx,
  x: number,
  feet: number,
  facing: number,
  size: number,
  body: number,
  head: number,
  patches: number | null,
): void {
  ink(ctx, 2);
  const w = 26 * size;
  const h = 13 * size;
  const top = feet - 10 * size - h;
  ctx.fillStyle = css(head);
  for (const lx of [x - w / 2 + 4, x - w / 2 + 9, x + w / 2 - 9, x + w / 2 - 4]) {
    ctx.fillRect(lx - 1.5, top + h - 2, 3, 10 * size + 2);
  }
  ctx.fillStyle = css(body);
  ctx.beginPath();
  ctx.ellipse(x, top + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (patches !== null) {
    ctx.fillStyle = css(patches);
    ctx.beginPath();
    ctx.ellipse(x - w * 0.15, top + h * 0.4, w * 0.14, h * 0.25, 0.4, 0, Math.PI * 2);
    ctx.ellipse(x + w * 0.2, top + h * 0.6, w * 0.1, h * 0.2, -0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = css(head);
  ctx.beginPath();
  ctx.ellipse(
    x + facing * (w / 2 + 3 * size),
    top + 2,
    5 * size,
    4 * size,
    facing * 0.5,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.stroke();
}

const sheep = (ctx: Ctx, x: number, feet: number, f: number): void =>
  beast(ctx, x, feet, f, 0.9, COLORS.ceruse, COLORS.encre, null);
const cow = (ctx: Ctx, x: number, feet: number, f: number): void =>
  beast(ctx, x, feet, f, 1.3, COLORS.ceruse, COLORS.terreOmbre, COLORS.terreOmbre);
const horse = (ctx: Ctx, x: number, feet: number, f: number): void =>
  beast(ctx, x, feet, f, 1.4, COLORS.terreOmbre, COLORS.terreOmbre, null);

/**
 * The far landscape: soft hills, a castle, farms, a mill, trees and grazing beasts; muted so
 * the play stays readable. FAR_W is one repeat of the tile.
 */
function drawFar(ctx: Ctx): void {
  ctx.clearRect(0, 0, FAR_W, FAR_H);
  // Periodic in FAR_W so the tile repeats without a seam.
  const crest =
    (y0: number, amp: number, period: number) =>
    (x: number): number => {
      const k = (x / FAR_W) * Math.PI * 2;
      return y0 - amp * Math.sin(k * period) - amp * 0.4 * Math.sin(k * period * 3 + 1);
    };
  const hill = (top: (x: number) => number, color: number, alpha: number): void => {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = css(color);
    ink(ctx, 3);
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
  const back = crest(300, 40, 4);
  const front = crest(380, 26, 6);
  hill(back, COLORS.vertTendre, 0.45);
  ctx.globalAlpha = 0.55;
  tower(ctx, 980, back(1000) + 10, 40, 120, COLORS.vermillon);
  tower(ctx, 1030, back(1060) + 10, 60, 90, COLORS.lapis);
  tower(ctx, 1100, back(1120) + 10, 40, 130, COLORS.vermillon);
  farm(ctx, 380, back(420) + 6);
  farm(ctx, 2300, back(2340) + 6);
  windmill(ctx, 1720, back(1720) + 6);
  windmill(ctx, 2900, back(2900) + 6);
  ctx.globalAlpha = 1;
  for (const [x, r] of [
    [140, 22],
    [210, 16],
    [620, 20],
    [760, 26],
    [1320, 18],
    [1450, 24],
    [1980, 20],
    [2560, 24],
    [2700, 16],
    [3080, 22],
  ] as const) {
    lollipop(ctx, x, back(x) + 30, r, COLORS.vertDeGris, 0.5);
  }
  hill(front, COLORS.ocre, 0.35);
  // Grazing beasts on the near fields.
  ctx.globalAlpha = 0.75;
  for (const [kind, x, f] of [
    [sheep, 300, 1],
    [sheep, 330, -1],
    [sheep, 352, 1],
    [cow, 860, -1],
    [horse, 1240, 1],
    [sheep, 1580, -1],
    [sheep, 1606, 1],
    [cow, 2050, 1],
    [cow, 2100, -1],
    [horse, 2480, -1],
    [sheep, 2820, 1],
    [sheep, 2846, 1],
  ] as const) {
    kind(ctx, x, front(x) + 4, f);
  }
  ctx.globalAlpha = 1;
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
  readonly tree: boolean;
}

export class Scenery {
  /** every game object of the scenery, so a HUD camera can ignore them */
  readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly clouds: Phaser.GameObjects.Image[] = [];
  private props: Prop[] = [];
  private readonly width: number;
  private readonly sky: SkyLife;

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
      this.props.push({ image, x, y, tree: isTree });
      this.objects.push(image);
    }

    this.sky = new SkyLife(scene, mask.height * 0.4, () => this.props.filter((p) => p.tree));
    this.objects.push(...this.sky.objects);
  }

  /** Drifts the clouds and the sky life; drops props whose ground was blown away. */
  update(delta: number, wind: number, mask: MaskView): void {
    this.sky.update(delta, wind);
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
