// Life in the sky, now and then: flocks of birds crossing or flying up from a tree, a dragon
// flapping across, a rainbow fading in behind the hills. Cosmetic randomness only (Math.random),
// never the sim PRNG; every object is created up front so the HUD camera can ignore it.
import Phaser from 'phaser';
import { COLORS, css } from '../ui/tokens.ts';

type Ctx = CanvasRenderingContext2D;

const FLOCK_MAX = 7;
/** ms between two flocks */
const FLOCK_EVERY: readonly [number, number] = [12_000, 35_000];
/** ms between two dragons */
const DRAGON_EVERY: readonly [number, number] = [90_000, 200_000];
/** ms between two rainbows, and how long one stays */
const RAINBOW_EVERY: readonly [number, number] = [120_000, 260_000];
const RAINBOW_STAY = 25_000;
const RAINBOW_FADE = 4_000;
/** px per second */
const BIRD_SPEED = 150;
const DRAGON_SPEED = 120;
/** ms per wing beat */
const BIRD_FLAP = 140;
const DRAGON_FLAP = 420;
/** parallax of the rainbow: far behind, with the hills */
const RAINBOW_SCROLL = 0.3;

const between = ([a, b]: readonly [number, number]): number => a + Math.random() * (b - a);

/** A manuscript bird: a curved ink « m », wings up or down. */
function drawBird(ctx: Ctx, up: boolean): void {
  ctx.strokeStyle = css(COLORS.encre);
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  const tip = up ? 2 : 14;
  ctx.beginPath();
  ctx.moveTo(2, tip);
  ctx.quadraticCurveTo(8, 4, 14, 10);
  ctx.quadraticCurveTo(20, 4, 26, tip);
  ctx.stroke();
}

/** A wyvern in the manner of the marginalia: green body, vermilion wings, curled tail. */
function drawDragon(ctx: Ctx, up: boolean): void {
  const ink = css(COLORS.encre);
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = ink;
  // Curled tail, behind.
  ctx.beginPath();
  ctx.moveTo(60, 62);
  ctx.bezierCurveTo(30, 70, 10, 50, 22, 36);
  ctx.bezierCurveTo(30, 28, 40, 40, 30, 44);
  ctx.lineWidth = 7;
  ctx.strokeStyle = css(COLORS.vertDeGris);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = ink;
  // Far wing.
  const wing = (dx: number, shade: number): void => {
    ctx.fillStyle = css(shade);
    ctx.beginPath();
    ctx.moveTo(95 + dx, 52);
    if (up) {
      ctx.lineTo(70 + dx, 4);
      ctx.quadraticCurveTo(90 + dx, 18, 100 + dx, 10);
      ctx.quadraticCurveTo(108 + dx, 30, 125 + dx, 26);
    } else {
      ctx.lineTo(72 + dx, 104);
      ctx.quadraticCurveTo(92 + dx, 90, 102 + dx, 102);
      ctx.quadraticCurveTo(110 + dx, 80, 128 + dx, 86);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };
  wing(-12, COLORS.roseGarance);
  // Body and neck.
  ctx.fillStyle = css(COLORS.vertDeGris);
  ctx.beginPath();
  ctx.moveTo(55, 60);
  ctx.bezierCurveTo(80, 44, 120, 44, 140, 50);
  ctx.bezierCurveTo(150, 40, 160, 30, 172, 30);
  ctx.lineTo(176, 40);
  ctx.bezierCurveTo(165, 42, 158, 52, 150, 62);
  ctx.bezierCurveTo(120, 74, 80, 72, 55, 60);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Head with a gilt eye and a little tongue of flame.
  ctx.beginPath();
  ctx.ellipse(180, 33, 13, 8, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = css(COLORS.or);
  ctx.beginPath();
  ctx.arc(183, 30, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = css(COLORS.vermillon);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(193, 36);
  ctx.quadraticCurveTo(200, 34, 204, 40);
  ctx.stroke();
  // Legs.
  ctx.strokeStyle = ink;
  ctx.lineWidth = 3;
  for (const x of [95, 120]) {
    ctx.beginPath();
    ctx.moveTo(x, 68);
    ctx.lineTo(x - 4, 80);
    ctx.lineTo(x + 2, 82);
    ctx.stroke();
  }
  // Near wing.
  wing(6, COLORS.vermillon);
  // Belly scales.
  ctx.lineWidth = 1.5;
  for (let x = 75; x < 140; x += 10) {
    ctx.beginPath();
    ctx.arc(x, 64, 4, 0, Math.PI);
    ctx.stroke();
  }
}

/** Bands of manuscript colours, outlined in ink, as the illuminators drew the bow of the Flood. */
function drawRainbow(ctx: Ctx, w: number, h: number): void {
  const bands = [COLORS.vermillon, COLORS.or, COLORS.vertTendre, COLORS.azur, COLORS.lapis];
  const band = 22;
  const cx = w / 2;
  const cy = h;
  const outer = h - 6;
  bands.forEach((c, i) => {
    ctx.strokeStyle = css(c);
    ctx.lineWidth = band;
    ctx.beginPath();
    ctx.arc(cx, cy, outer - band / 2 - i * band, Math.PI, 0);
    ctx.stroke();
  });
  ctx.strokeStyle = css(COLORS.encre);
  ctx.lineWidth = 2;
  for (const r of [outer, outer - bands.length * band]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, 0);
    ctx.stroke();
  }
}

interface Flyer {
  readonly image: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  /** ms, offsets the wing beats so a flock does not flap in step */
  phase: number;
  live: boolean;
}

export class SkyLife {
  readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly scene: Phaser.Scene;
  private readonly birds: Flyer[] = [];
  private readonly dragon: Flyer;
  private readonly rainbow: Phaser.GameObjects.Image;
  private readonly skyBottom: number;
  private readonly trees: () => readonly { x: number; y: number }[];
  private nextFlock = between([4_000, 10_000]);
  private nextDragon = between(DRAGON_EVERY);
  private nextRainbow = between(RAINBOW_EVERY);
  /** ms since the rainbow appeared; -1 when there is none */
  private rainbowAge = -1;
  private clock = 0;

  /** skyBottom: world y under which nothing flies; trees: where a flock may take off from */
  constructor(
    scene: Phaser.Scene,
    skyBottom: number,
    trees: () => readonly { x: number; y: number }[],
  ) {
    this.scene = scene;
    this.skyBottom = skyBottom;
    this.trees = trees;
    const tex = (key: string, w: number, h: number, draw: (ctx: Ctx) => void): string => {
      if (scene.textures.exists(key)) return key;
      const t = scene.textures.createCanvas(key, w, h);
      if (!t) throw new Error(`cannot create texture ${key}`);
      draw(t.getContext());
      t.refresh();
      return key;
    };
    tex('bird_up', 28, 16, (ctx) => drawBird(ctx, true));
    tex('bird_down', 28, 16, (ctx) => drawBird(ctx, false));
    tex('dragon_up', 210, 110, (ctx) => drawDragon(ctx, true));
    tex('dragon_down', 210, 110, (ctx) => drawDragon(ctx, false));
    const rainbowKey = tex('rainbow', 1000, 500, (ctx) => drawRainbow(ctx, 1000, 500));

    const flyer = (key: string, depth: number): Flyer => {
      const image = scene.add.image(0, 0, key).setDepth(depth).setVisible(false);
      this.objects.push(image);
      return { image, vx: 0, vy: 0, phase: 0, live: false };
    };
    for (let i = 0; i < FLOCK_MAX; i++) this.birds.push(flyer('bird_up', 3.5));
    this.dragon = flyer('dragon_up', 2.5);
    this.dragon.image.setScale(1.6);
    this.rainbow = scene.add
      .image(0, 0, rainbowKey)
      .setOrigin(0.5, 1)
      .setScrollFactor(RAINBOW_SCROLL, 0.6)
      .setDepth(0.5)
      .setAlpha(0)
      .setVisible(false);
    this.objects.push(this.rainbow);
  }

  update(delta: number, wind: number): void {
    this.clock += delta;
    const dt = delta / 1000;
    if ((this.nextFlock -= delta) <= 0) {
      this.nextFlock = between(FLOCK_EVERY);
      this.launchFlock();
    }
    if ((this.nextDragon -= delta) <= 0) {
      this.nextDragon = between(DRAGON_EVERY);
      if (!this.dragon.live) this.launchDragon();
    }
    if ((this.nextRainbow -= delta) <= 0) {
      this.nextRainbow = between(RAINBOW_EVERY);
      if (this.rainbowAge < 0) this.showRainbow();
    }

    const view = this.scene.cameras.main.worldView;
    const fly = (f: Flyer, flap: number, up: string, down: string): void => {
      if (!f.live) return;
      f.image.x += (f.vx + wind * 4) * dt;
      f.image.y += f.vy * dt;
      const beat = Math.floor((this.clock + f.phase) / flap) % 2 === 0;
      f.image.setTexture(beat ? up : down);
      const margin = 300;
      if (
        f.image.x < view.left - margin ||
        f.image.x > view.right + margin ||
        f.image.y < view.top - margin
      ) {
        f.live = false;
        f.image.setVisible(false);
      }
    };
    for (const b of this.birds) {
      // Birds taking off level out once they are up in the sky.
      if (b.live && b.vy < -20 && b.image.y < this.skyBottom * 0.6) b.vy *= 0.97;
      fly(b, BIRD_FLAP, 'bird_up', 'bird_down');
    }
    if (this.dragon.live) {
      this.dragon.vy = Math.sin(this.clock / 900) * 25;
    }
    fly(this.dragon, DRAGON_FLAP, 'dragon_up', 'dragon_down');

    if (this.rainbowAge >= 0) {
      this.rainbowAge += delta;
      const a = this.rainbowAge;
      const fade =
        a < RAINBOW_FADE
          ? a / RAINBOW_FADE
          : a > RAINBOW_STAY - RAINBOW_FADE
            ? Math.max(0, (RAINBOW_STAY - a) / RAINBOW_FADE)
            : 1;
      this.rainbow.setAlpha(0.55 * fade);
      if (a >= RAINBOW_STAY) {
        this.rainbowAge = -1;
        this.rainbow.setVisible(false);
      }
    }
  }

  /** Either a flock crossing the sky, or birds flushed out of a tree on screen. */
  private launchFlock(): void {
    const view = this.scene.cameras.main.worldView;
    const free = this.birds.filter((b) => !b.live);
    const n = Math.min(free.length, 3 + Math.floor(Math.random() * (FLOCK_MAX - 2)));
    if (n === 0) return;
    const trees = this.trees().filter((t) => t.x > view.left + 50 && t.x < view.right - 50);
    const tree = trees[Math.floor(Math.random() * trees.length)];
    const fromTree = tree !== undefined && Math.random() < 0.5;
    const dir = Math.random() < 0.5 ? -1 : 1;
    const top = Math.max(40, view.top + 40);
    const y0 =
      top + Math.random() * Math.max(60, Math.min(this.skyBottom, view.bottom) - top) * 0.5;
    for (let i = 0; i < n; i++) {
      const b = free[i];
      if (!b) break;
      b.live = true;
      b.phase = Math.random() * 1000;
      b.image.setVisible(true).setFlipX(dir < 0);
      if (fromTree) {
        // Flushed out: up and away from the tree, scattering a little.
        b.image.setPosition(tree.x + (Math.random() - 0.5) * 30, tree.y - 60 - Math.random() * 20);
        b.vx = dir * (60 + Math.random() * 80);
        b.vy = -(120 + Math.random() * 60);
      } else {
        // A loose V across the sky.
        const back = Math.abs(i - (n - 1) / 2);
        b.image.setPosition(
          (dir > 0 ? view.left - 60 : view.right + 60) - dir * back * 34,
          y0 + back * 18 + (Math.random() - 0.5) * 6,
        );
        b.vx = dir * BIRD_SPEED;
        b.vy = (Math.random() - 0.5) * 10;
      }
    }
  }

  private launchDragon(): void {
    const view = this.scene.cameras.main.worldView;
    const dir = Math.random() < 0.5 ? -1 : 1;
    const top = Math.max(80, view.top + 90);
    const d = this.dragon;
    d.live = true;
    d.image
      .setVisible(true)
      .setFlipX(dir < 0)
      .setPosition(dir > 0 ? view.left - 150 : view.right + 150, top + Math.random() * 80);
    d.vx = dir * DRAGON_SPEED;
    d.vy = 0;
  }

  private showRainbow(): void {
    const cam = this.scene.cameras.main;
    // A factor-f object at x shows at x + scroll·(1 − f): put it about the middle of the screen.
    const x = cam.midPoint.x - cam.scrollX * (1 - RAINBOW_SCROLL) + (Math.random() - 0.5) * 400;
    const y = this.skyBottom - cam.scrollY * (1 - 0.6) + 120;
    this.rainbow
      .setPosition(x, y)
      .setScale(0.8 + Math.random() * 0.5)
      .setAlpha(0)
      .setVisible(true);
    this.rainbowAge = 0;
  }
}
