// Life in the sky, now and then: flocks of birds crossing or flying up from a tree, a rainbow
// fading in behind the hills. Cosmetic randomness only (Math.random), never the sim PRNG; every
// object is created up front so the HUD camera can ignore it. The dragon belongs to the sim now
// (GDD §4.11): only its textures are painted here, `dragon_0` to `dragon_2`.
import Phaser from 'phaser';
import { COLORS, css } from '../ui/tokens.ts';

type Ctx = CanvasRenderingContext2D;

const FLOCK_MAX = 7;
/** ms between two flocks */
const FLOCK_EVERY: readonly [number, number] = [12_000, 35_000];
/** ms between two rainbows, and how long one stays */
const RAINBOW_EVERY: readonly [number, number] = [120_000, 260_000];
const RAINBOW_STAY = 25_000;
const RAINBOW_FADE = 4_000;
/** px per second */
const BIRD_SPEED = 150;
/** ms per wing beat */
const BIRD_FLAP = 140;
/** px of the rainbow texture: its outer radius, and the width of its five bands */
const RAINBOW_OUTER = 494;
const RAINBOW_BANDS = 5 * 22;

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

interface Pt {
  readonly x: number;
  readonly y: number;
}

/**
 * A wyvern of the marginalia (2026-10-24, drawn anew): a green serpent body with a gilt ringed
 * belly and vermilion spines, bat wings on four fingers, horns, open jaws and a forked tongue, a
 * long S tail ending in a spade. Frame 0: wings up, 1: level, 2: down.
 */
function drawDragon(ctx: Ctx, frame: 0 | 1 | 2): void {
  const ink = css(COLORS.encre);
  const green = css(COLORS.vertDeGris);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const P = (x: number, y: number): Pt => ({ x, y });
  const bez = (s: readonly Pt[], t: number): Pt => {
    const u = 1 - t;
    const k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
    return P(
      k.reduce((sum, w, i) => sum + w * (s[i]?.x ?? 0), 0),
      k.reduce((sum, w, i) => sum + w * (s[i]?.y ?? 0), 0),
    );
  };
  // A limb or tail that narrows from w0 to w1 px: an ink outline, then the colour inside.
  const taper = (
    segs: readonly (readonly Pt[])[],
    w0: number,
    w1: number,
    colour: string,
  ): Pt[] => {
    const pts: Pt[] = [];
    for (const s of segs) for (let i = 0; i <= 24; i++) pts.push(bez(s, i / 24));
    for (const pass of [0, 1]) {
      ctx.strokeStyle = pass ? colour : ink;
      for (let i = 1; i < pts.length; i++) {
        const w = w0 + ((w1 - w0) * i) / (pts.length - 1);
        ctx.lineWidth = pass ? w : w + 5;
        ctx.beginPath();
        const a = pts[i - 1];
        const b = pts[i];
        if (!a || !b) continue;
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
    return pts;
  };
  // A bat wing: the arm from the shoulder to the wrist, four fingers, a scalloped membrane.
  const wing = (dx: number, dy: number, membrane: string): void => {
    const S = P(170 + dx, 76 + dy);
    const E = [P(148, 14), P(112, 46), P(152, 120)][frame] ?? P(112, 46);
    const tips = (
      [
        [P(70, 4), P(84, 38), P(106, 62), P(136, 76)],
        [P(40, 40), P(58, 70), P(90, 86), P(130, 88)],
        [P(150, 164), P(126, 162), P(104, 148), P(96, 122)],
      ] as const
    )[frame];
    const e = P(E.x + dx, E.y + dy);
    const t = tips.map((p) => P(p.x + dx, p.y + dy));
    const root = P(134 + dx, 82 + dy);
    const scallop = (a: Pt, b: Pt): void => {
      const m = P((a.x + b.x) / 2, (a.y + b.y) / 2);
      ctx.quadraticCurveTo(m.x + (e.x - m.x) * 0.32, m.y + (e.y - m.y) * 0.32, b.x, b.y);
    };
    ctx.fillStyle = membrane;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(S.x, S.y);
    ctx.lineTo(e.x, e.y);
    const first = t[0];
    if (first) ctx.lineTo(first.x, first.y);
    for (let i = 1; i < t.length; i++) {
      const a = t[i - 1];
      const b = t[i];
      if (a && b) scallop(a, b);
    }
    const last = t[t.length - 1];
    if (last) scallop(last, root);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 2;
    for (const p of t) {
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    taper(
      [[S, P((S.x + e.x) / 2, (S.y + e.y) / 2), P((S.x + e.x) / 2, (S.y + e.y) / 2), e]],
      7,
      4,
      membrane,
    );
    // The thumb claw at the wrist.
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(e.x - 3, e.y);
    ctx.lineTo(e.x + 2, e.y - 9);
    ctx.lineTo(e.x + 4, e.y + 1);
    ctx.closePath();
    ctx.fill();
  };
  // A leg with three claws, bent under the body.
  const leg = (hip: Pt, knee: Pt, foot: Pt, colour: string): void => {
    taper([[hip, knee, knee, foot]], 10, 6, colour);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2;
    for (const d of [-5, 0, 5]) {
      ctx.beginPath();
      ctx.moveTo(foot.x, foot.y);
      ctx.quadraticCurveTo(foot.x + d + 4, foot.y + 6, foot.x + d + 7, foot.y + 3);
      ctx.stroke();
    }
  };

  // Far wing and far leg, behind.
  wing(-16, -4, css(COLORS.roseGarance));
  leg(P(128, 98), P(118, 112), P(126, 124), css(COLORS.vertDeGris));
  // The tail: a long S that curls up at its end, tipped with a spade.
  const tail = taper(
    [
      [P(110, 96), P(76, 120), P(44, 124), P(28, 108)],
      [P(28, 108), P(14, 94), P(18, 76), P(34, 76)],
    ],
    18,
    4,
    green,
  );
  const end = tail[tail.length - 1] ?? P(34, 76);
  ctx.fillStyle = css(COLORS.vermillon);
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(end.x - 2, end.y);
  ctx.quadraticCurveTo(end.x + 4, end.y - 12, end.x + 14, end.y - 4);
  ctx.quadraticCurveTo(end.x + 4, end.y + 8, end.x - 2, end.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Body and neck, in one outline.
  const back = [P(102, 96), P(118, 70), P(166, 64), P(198, 70)];
  const body = new Path2D();
  body.moveTo(102, 96);
  body.bezierCurveTo(118, 70, 166, 64, 198, 70);
  body.bezierCurveTo(214, 58, 222, 42, 236, 40);
  body.lineTo(246, 56);
  body.bezierCurveTo(230, 62, 222, 82, 208, 94);
  body.bezierCurveTo(182, 112, 132, 114, 102, 96);
  body.closePath();
  // Dorsal spines, vermilion, along the back.
  ctx.fillStyle = css(COLORS.vermillon);
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2;
  for (let i = 1; i <= 7; i++) {
    const a = bez(back, i / 8.5);
    const b = bez(back, i / 8.5 + 0.06);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y + 2);
    ctx.lineTo((a.x + b.x) / 2 - 3, a.y - 10);
    ctx.lineTo(b.x, b.y + 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = green;
  ctx.fill(body);
  // The gilt belly, ringed like a worm's, inside the body.
  ctx.save();
  ctx.clip(body);
  ctx.strokeStyle = css(COLORS.or);
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.moveTo(104, 104);
  ctx.bezierCurveTo(132, 118, 184, 116, 212, 96);
  ctx.bezierCurveTo(226, 84, 232, 66, 248, 60);
  ctx.stroke();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.5;
  const belly = [P(104, 104), P(132, 118), P(184, 116), P(212, 96)];
  for (let i = 1; i < 12; i++) {
    const p = bez(belly, i / 12);
    ctx.beginPath();
    ctx.moveTo(p.x - 2, p.y - 9);
    ctx.quadraticCurveTo(p.x + 3, p.y, p.x - 2, p.y + 9);
    ctx.stroke();
  }
  // Scales on the flank: little arcs in rows.
  ctx.strokeStyle = css(COLORS.encre);
  ctx.globalAlpha = 0.45;
  for (let row = 0; row < 2; row++) {
    for (let x = 122 + row * 6; x < 196; x += 12) {
      ctx.beginPath();
      ctx.arc(x, 82 + row * 8, 5, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 3;
  ctx.stroke(body);

  // Head: brow, long snout, open jaws with teeth and a forked tongue.
  ctx.fillStyle = css(COLORS.vermillon);
  ctx.beginPath();
  ctx.moveTo(254, 54);
  ctx.lineTo(284, 56);
  ctx.lineTo(258, 62);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = css(COLORS.vermillon);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(266, 58);
  ctx.quadraticCurveTo(284, 60, 294, 54);
  ctx.moveTo(288, 57);
  ctx.lineTo(297, 62);
  ctx.stroke();
  ctx.fillStyle = green;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(244, 64);
  ctx.bezierCurveTo(254, 64, 268, 66, 280, 64);
  ctx.lineTo(276, 70);
  ctx.bezierCurveTo(262, 74, 248, 72, 238, 64);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(230, 44);
  ctx.bezierCurveTo(240, 30, 260, 28, 270, 36);
  ctx.lineTo(288, 42);
  ctx.quadraticCurveTo(292, 48, 286, 52);
  ctx.lineTo(258, 54);
  ctx.lineTo(244, 62);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Teeth.
  ctx.fillStyle = css(COLORS.ceruse);
  ctx.lineWidth = 1;
  for (const x of [264, 272, 280]) {
    ctx.beginPath();
    ctx.moveTo(x - 3, 53.5);
    ctx.lineTo(x, 59);
    ctx.lineTo(x + 3, 53);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // Horns, swept back.
  ctx.fillStyle = css(COLORS.or);
  ctx.lineWidth = 2;
  for (const [x, y, l] of [
    [244, 34, 26],
    [252, 32, 18],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x, y + 4);
    ctx.quadraticCurveTo(x - l * 0.5, y - 4, x - l, y - 10);
    ctx.quadraticCurveTo(x - l * 0.4, y + 2, x + 8, y + 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // Eye: gilt, a black slit; a nostril.
  ctx.fillStyle = css(COLORS.or);
  ctx.beginPath();
  ctx.ellipse(258, 41, 5, 4, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.ellipse(259, 41, 1.3, 3.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(283, 45, 1.6, 0, Math.PI * 2);
  ctx.fill();

  // Near leg, near wing in front.
  leg(P(186, 100), P(194, 114), P(186, 122), css(COLORS.vertDeGris));
  wing(0, 0, css(COLORS.vermillon));
}

/** Bands of manuscript colours, outlined in ink, as the illuminators drew the bow of the Flood. */
function drawRainbow(ctx: Ctx, w: number, h: number): void {
  const bands = [COLORS.vermillon, COLORS.or, COLORS.vertTendre, COLORS.azur, COLORS.lapis];
  const band = 22;
  const cx = w / 2;
  const cy = h;
  const outer = RAINBOW_OUTER;
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

/** The far landscape the rainbow stands in: its parallax, and the y of its ground at an x. */
export interface FarGround {
  readonly scroll: readonly [number, number];
  readonly groundAt: (x: number) => number;
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
  private readonly rainbow: Phaser.GameObjects.Image;
  private readonly skyBottom: number;
  private readonly trees: () => readonly { x: number; y: number }[];
  private readonly far: FarGround;
  private nextFlock = between([4_000, 10_000]);
  private nextRainbow = between(RAINBOW_EVERY);
  /** ms since the rainbow appeared; -1 when there is none */
  private rainbowAge = -1;
  private clock = 0;

  /** skyBottom: world y under which nothing flies; trees: where a flock may take off from */
  constructor(
    scene: Phaser.Scene,
    skyBottom: number,
    trees: () => readonly { x: number; y: number }[],
    far: FarGround,
  ) {
    this.scene = scene;
    this.skyBottom = skyBottom;
    this.trees = trees;
    this.far = far;
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
    for (const f of [0, 1, 2] as const) tex(`dragon_${f}`, 300, 170, (ctx) => drawDragon(ctx, f));
    const rainbowKey = tex('rainbow', 1000, 500, (ctx) => drawRainbow(ctx, 1000, 500));

    const flyer = (key: string, depth: number): Flyer => {
      const image = scene.add.image(0, 0, key).setDepth(depth).setVisible(false);
      this.objects.push(image);
      return { image, vx: 0, vy: 0, phase: 0, live: false };
    };
    for (let i = 0; i < FLOCK_MAX; i++) this.birds.push(flyer('bird_up', 3.5));
    this.rainbow = scene.add
      .image(0, 0, rainbowKey)
      .setOrigin(0.5, 1)
      .setScrollFactor(far.scroll[0], far.scroll[1])
      // Just behind the far hills: its feet go into them.
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

  private showRainbow(): void {
    const cam = this.scene.cameras.main;
    const [fx] = this.far.scroll;
    // A factor-f object at x shows at x + scroll·(1 − f): put it about the middle of the screen.
    const x = cam.midPoint.x - cam.scrollX * (1 - fx) + (Math.random() - 0.5) * 400;
    const scale = 0.8 + Math.random() * 0.5;
    // Both feet stand on the far ground: the bow's base at the lower of the two, a little
    // into the hill, so neither foot hangs in the air.
    const foot = (RAINBOW_OUTER - RAINBOW_BANDS / 2) * scale;
    const y = Math.max(this.far.groundAt(x - foot), this.far.groundAt(x + foot)) + 6 * scale;
    this.rainbow.setPosition(x, y).setScale(scale).setAlpha(0).setVisible(true);
    this.rainbowAge = 0;
  }
}
