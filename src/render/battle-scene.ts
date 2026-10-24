// Greybox battle scene (BACKLOG M2): fixed-step loop with interpolation, tiled terrain on a
// diapered vellum page, placeholder figures, projectiles, cosmetic VFX, camera and the F1 debug
// overlay. The HUD and menus are DOM (src/ui).
import Phaser from 'phaser';
import { FACTIONS, unitName } from '../content/factions.ts';
import type { MapDef } from '../content/maps.ts';
import { CLASSIC_RULES, TICKS_PER_SECOND, type MatchRules } from '../content/rules.ts';
import { PhaserLocalInput } from '../input/phaser-local-input.ts';
import { MAX_POWER } from '../sim/commands.ts';
import type { SimEvent } from '../sim/events.ts';
import { cosQ14, sinQ14 } from '../sim/math/angle.ts';
import { SUBPX } from '../sim/math/fixed.ts';
import { createProjectile, stepProjectile } from '../sim/projectiles/projectile.ts';
import { Sim } from '../sim/sim.ts';
import type { MatchConfig } from '../sim/state.ts';
import type { Mask } from '../sim/terrain/mask.ts';
import type { Terrain } from '../sim/terrain/terrain.ts';
import { UNIT_HALF_WIDTH, UNIT_HEIGHT, type Unit } from '../sim/units/unit.ts';
import { Commentary, type Pop } from '../ui/commentary.ts';
import { FONT_CAPS, FONT_TEXT, FONT_TITLE } from '../ui/fonts.ts';
import { GameUi, loadOverrides } from '../ui/game-ui.ts';
import { t } from '../ui/i18n.ts';
import { applyOverrides, type TuningOverrides } from '../ui/tuning-model.ts';
import { COLORS, css } from '../ui/tokens.ts';
import { uiScale } from '../ui/ui-scale.ts';
import { AutoSaver, clearSave } from '../app/autosave.ts';
import { spawnColumns } from '../app/spawns.ts';
import { replay, type GameLog } from '../sim/log.ts';
import { frame, type Point } from './framing.ts';
import { Scenery } from './scenery.ts';
import { FixedStep } from './fixed-step.ts';
import { TerrainLayer } from './terrain-layer.ts';

export interface BattleData {
  readonly map: MapDef;
  readonly mask: Mask;
  readonly seed: number;
  /** match rules, the Classique scheme with the playtest overrides applied */
  readonly rules: MatchRules;
  /** a saved match to resume: its log replaces seed and rules */
  readonly resume?: GameLog;
}

const TICK_MS = 1000 / TICKS_PER_SECOND;
/** Catch-up limit: at most 5 sim steps per frame (TECH_SPEC §3). */
const MAX_STEPS_PER_FRAME = 5;
/** Longest frame taken into account, ms */
const MAX_FRAME_MS = 250;
/** Reference screen height: the default zoom shows as much world on any screen height. */
const REF_HEIGHT = 1080;
/** Default zoom at the reference height */
const ZOOM_DEFAULT = 0.75;
/** Closest zoom at the reference height */
const ZOOM_MAX = 1.6;
/** screen px per second of edge scrolling */
const EDGE_SCROLL_SPEED = 900;
/** ms an explosion burst lasts */
const BURST_MS = 520;
/** px from the body centre to the middle of the aim arrowhead, which can be dragged */
const AIM_TIP = 172;
/** size of the diaper pattern tile, px */
const DIAPER = 160;
/**
 * px of sky the camera may show above the map, so a wide map still fits a narrow screen whole
 * (the default view frames every unit).
 */
const SKY_EXTRA = 2000;
/** Screen px kept clear of units by the default view, before the overlay scale: HUD and bar. */
const FRAME_MARGINS = { top: 130, bottom: 110, side: 30 } as const;
/** px above the feet and either side of a unit where a click still picks it: its name label */
const LABEL_REACH = 80;
const LABEL_HALF_WIDTH = 34;

/** Phaser's polygon calls want Vector2 instances. */
const poly = (points: readonly { x: number; y: number }[]): Phaser.Math.Vector2[] =>
  points.map((p) => new Phaser.Math.Vector2(p.x, p.y));

interface Interp {
  px: number;
  py: number;
  cx: number;
  cy: number;
}

interface Burst {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly born: number;
}

export class BattleScene extends Phaser.Scene {
  private sim!: Sim;
  private data_!: BattleData;
  private input_!: PhaserLocalInput;
  private terrain!: TerrainLayer;
  private scenery!: Scenery;
  private saver!: AutoSaver;
  private world!: Phaser.GameObjects.Graphics;
  /** the burnt ends of the parchment, over the terrain, under the units */
  private burnGfx!: Phaser.GameObjects.Graphics;
  private debugGfx!: Phaser.GameObjects.Graphics;
  private labels = new Map<number, Phaser.GameObjects.Text>();
  private debugText!: Phaser.GameObjects.Text;
  private hudCam!: Phaser.Cameras.Scene2D.Camera;
  private ui!: GameUi;
  private commentary!: Commentary;
  private bursts: Burst[] = [];
  private selectedUnit: number | null = null;
  private readonly clock = new FixedStep(TICK_MS, MAX_STEPS_PER_FRAME, MAX_FRAME_MS);
  private interp = new Map<string, Interp>();
  private debug = false;
  private paused = false;
  private stepOnce = false;
  private manualCamera = false;
  private fps = 60;
  /** scene keys pressed since the last frame, latched from key events */
  private pressed = new Set<string>();

  constructor() {
    super('battle');
  }

  init(data: BattleData): void {
    this.data_ = data;
    this.clock.reset();
    this.interp.clear();
    this.labels.clear();
    this.bursts = [];
    this.manualCamera = false;
    this.selectedUnit = null;
  }

  create(): void {
    const { map, mask, seed, rules } = this.data_;
    const perTeam = rules.unitsPerTeam ?? map.spawns[0]?.length ?? 3;
    const config: MatchConfig = {
      rules,
      teams: spawnColumns(mask, map.spawns.length, perTeam).map((spawns) => ({ spawns })),
    };
    const resume = this.data_.resume;
    // A saved match replays to where it was left: same seed, same commands, same state.
    this.sim = resume ? replay(resume, mask) : new Sim(config, seed, mask);
    this.saver = resume
      ? new AutoSaver(resume.config, resume.seed, resume.mapId, [...resume.commands])
      : new AutoSaver(config, seed, map.id);

    const cam = this.cameras.main;
    cam.setBackgroundColor(css(COLORS.velin));
    cam.setBounds(0, -SKY_EXTRA, map.width, map.height + SKY_EXTRA);

    const page = this.add
      .tileSprite(0, -SKY_EXTRA, map.width, map.height + SKY_EXTRA, this.diaperTexture())
      .setOrigin(0, 0)
      .setDepth(0);
    this.scenery = new Scenery(this, this.sim.view().terrain);
    this.terrain = new TerrainLayer(this, () => this.sim.view().terrain);
    this.world = this.add.graphics().setDepth(6);
    this.burnGfx = this.add.graphics().setDepth(5.5);
    this.debugGfx = this.add.graphics().setDepth(20);

    for (const u of this.sim.view().units) {
      const label = this.add
        .text(0, 0, '', {
          fontFamily: FONT_CAPS,
          fontSize: '30px',
          color: css(COLORS.encre),
          align: 'center',
          backgroundColor: css(COLORS.ceruse),
          padding: { x: 8, y: 2 },
        })
        .setOrigin(0.5, 1)
        .setDepth(7);
      this.labels.set(u.id, label);
    }

    this.debugText = this.add
      .text(32, 200, '', {
        fontFamily: FONT_TEXT,
        fontSize: '22px',
        color: css(COLORS.encre),
        backgroundColor: css(COLORS.ceruse),
      })
      .setScrollFactor(0)
      .setDepth(31);

    // Debug text on its own unzoomed camera; the main camera only sees the world.
    const worldObjects = [
      page,
      ...this.scenery.objects,
      ...this.terrain.images,
      this.world,
      this.burnGfx,
      this.debugGfx,
      ...this.labels.values(),
    ];
    cam.ignore(this.debugText);
    this.hudCam = this.cameras.add(0, 0, this.scale.width, this.scale.height, false, 'hud');
    this.hudCam.ignore(worldObjects);

    this.input_ = new PhaserLocalInput(this);
    const kb = this.input.keyboard;
    if (!kb) throw new Error('keyboard input unavailable');
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.pressed.clear();
    for (const [name, code] of [
      ['f1', K.F1],
      ['p', K.P],
      ['n', K.N],
      ['c', K.C],
      ['r', K.R],
      ['esc', K.ESC],
    ] as const) {
      kb.addKey(code).on('down', () => this.pressed.add(name));
    }
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      this.zoomTo(cam.zoom * (dy > 0 ? 0.9 : 1.1));
      this.manualCamera = true;
    });
    this.ui = new GameUi({
      intents: this.input_.ui,
      restart: (overrides) => this.restart(overrides),
      resetView: () => this.resetView(),
    });
    // A resized window keeps the map filling the screen (the default view reframes itself).
    const onResize = (): void => {
      if (this.manualCamera) this.zoomTo(cam.zoom);
    };
    this.scale.on('resize', onResize);
    this.events.once('shutdown', () => this.scale.off('resize', onResize));
    this.commentary = new Commentary(this.ui.hud, () => this.restart(loadOverrides()));
    const turn = this.sim.view().turn;
    if (resume) {
      this.ui.hud.announce(
        t('hud.resumed'),
        t('hud.turn', { n: turn.number }),
        t('hud.resumedSub'),
        COLORS.lapis,
        this.time.now,
      );
    } else {
      this.commentary.announceTurn(turn.number, turn.activeTeam, turn.activeUnitId, this.time.now);
    }
    // Leaving or refreshing the page saves the exact tick, not the last second.
    const onHide = (): void => this.saver.flush(this.sim.view().tick, Infinity);
    window.addEventListener('pagehide', onHide);
    this.events.once('shutdown', () => {
      window.removeEventListener('pagehide', onHide);
      this.input_.dispose();
      this.ui.destroy();
    });

    this.snapshotPositions();
    this.snapshotPositions();
    const f = this.defaultFraming(0);
    if (f) {
      cam.setZoom(f.zoom);
      cam.centerOn(f.x, f.y);
    }
  }

  /** Zoom that never shows past the map edges (the sky above excepted), on this screen. */
  private minZoom(): number {
    const { map } = this.data_;
    return Math.max(this.scale.width / map.width, this.scale.height / (map.height + SKY_EXTRA));
  }

  /** « Vue par défaut »: every living unit and the flying shot on screen, clear of the HUD. */
  private defaultFraming(alpha: number): ReturnType<typeof frame> {
    const v = this.sim.view();
    const points: Point[] = [];
    for (const u of v.units) {
      if (!u.alive) continue;
      const [x, y] = this.pos(`u${u.id}`, alpha, u.x, u.y);
      points.push({ x, y });
    }
    const shot = v.shots[0];
    if (shot) {
      const [x, y] = this.pos(
        `s${shot.projectile.id}`,
        alpha,
        shot.projectile.x,
        shot.projectile.y,
      );
      // A point counts with a unit's label above it: lower it so the shot itself is framed.
      points.push({ x, y: y + 150 });
    }
    const { width, height } = this.scale;
    const u = uiScale(width, height);
    const margins = {
      top: FRAME_MARGINS.top * u,
      bottom: FRAME_MARGINS.bottom * u,
      side: FRAME_MARGINS.side * u,
    };
    const closest = Math.max(this.minZoom(), (ZOOM_DEFAULT * height) / REF_HEIGHT);
    return frame(points, width, height, margins, this.minZoom(), closest);
  }

  private zoomTo(zoom: number): void {
    const max = Math.max(this.minZoom(), (ZOOM_MAX * this.scale.height) / REF_HEIGHT);
    this.cameras.main.setZoom(Phaser.Math.Clamp(zoom, this.minZoom(), max));
  }

  /** « Vue par défaut »: the camera goes back to framing every unit. */
  private resetView(): void {
    this.manualCamera = false;
  }

  /** New match on the same map, with the next seed. */
  private restart(overrides: TuningOverrides): void {
    clearSave();
    this.scene.restart({
      map: this.data_.map,
      mask: this.data_.mask,
      rules: applyOverrides(CLASSIC_RULES, overrides),
      seed: (this.data_.seed + 0x9e3779b9) >>> 0,
    });
  }

  /** Fond diapré (ASSETS §1.1): lozenges on vellum, faint enough to keep the play readable. */
  private diaperTexture(): string {
    const key = 'page_diaper';
    if (this.textures.exists(key)) return key;
    const tex = this.textures.createCanvas(key, DIAPER, DIAPER);
    if (!tex) throw new Error('cannot create the page texture');
    const ctx = tex.getContext();
    const h = DIAPER / 2;
    ctx.fillStyle = css(COLORS.velin);
    ctx.fillRect(0, 0, DIAPER, DIAPER);
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = css(COLORS.ocre);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(h, 0);
    ctx.lineTo(DIAPER, h);
    ctx.lineTo(h, DIAPER);
    ctx.closePath();
    ctx.stroke();
    // A small quatrefoil in each lozenge, alternating lapis and vermillon.
    const flower = (x: number, y: number, color: number): void => {
      ctx.fillStyle = css(color);
      for (const [dx, dy] of [
        [0, -6],
        [6, 0],
        [0, 6],
        [-6, 0],
      ] as const) {
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    flower(h, h, COLORS.lapis);
    for (const [x, y] of [
      [0, 0],
      [DIAPER, 0],
      [0, DIAPER],
      [DIAPER, DIAPER],
    ] as const) {
      flower(x, y, COLORS.vermillon);
    }
    ctx.globalAlpha = 1;
    tex.refresh();
    return key;
  }

  override update(time: number, delta: number): void {
    this.fps += (1000 / Math.max(1, delta) - this.fps) * 0.05;
    const k = (name: string): boolean => this.pressed.has(name);
    if (k('f1')) {
      this.debug = !this.debug;
      this.terrain.setMaskView(this.debug);
    }
    if (k('p')) this.paused = !this.paused;
    if (k('n')) this.stepOnce = true;
    if (k('c')) this.resetView();
    if (k('esc')) this.ui.escape();
    const restart = k('r');
    this.pressed.clear();
    if (restart && this.sim.view().turn.phase === 'gameOver') {
      this.restart(loadOverrides());
      return;
    }

    const active = this.activeUnit();
    this.input_.unitCentre = active
      ? { x: active.x / SUBPX, y: active.y / SUBPX - UNIT_HEIGHT / 2 }
      : null;
    const turn = this.sim.view().turn;
    this.input_.aimTip =
      active && turn.phase === 'action'
        ? {
            x: active.x / SUBPX + (cosQ14(turn.aim) / 16384) * AIM_TIP,
            y: active.y / SUBPX - UNIT_HEIGHT / 2 + (sinQ14(turn.aim) / 16384) * AIM_TIP,
          }
        : null;

    // The pause menu, help and settings stop the clock; the debug pause allows single steps.
    if (this.paused || this.ui.blocking) {
      if (this.stepOnce && !this.ui.blocking) this.tick();
      this.stepOnce = false;
      this.clock.reset();
    } else {
      for (let n = this.clock.advance(delta); n > 0; n--) this.tick();
    }
    const alpha = this.paused || this.ui.blocking ? 1 : this.clock.alpha;

    const click = this.input_.takeClick();
    if (click) this.selectAt(click.x, click.y);
    this.ui.update(this.sim.view(), this.input_.controls.power, time);
    this.ui.showResetView(this.manualCamera);
    if (this.selectedUnit !== null) {
      // The card goes to the half of the screen the unit is not in.
      const u = this.sim.view().units.find((x) => x.id === this.selectedUnit);
      const cam = this.cameras.main;
      if (u) this.ui.setCardSide(u.x / SUBPX > cam.worldView.centerX ? 'left' : 'right');
    }

    const v = this.sim.view();
    if (v.turn.phase !== 'gameOver') this.saver.flush(v.tick, time);
    this.scenery.update(delta, v.turn.wind, v.terrain);
    this.terrain.flush();
    this.updateCamera(alpha, delta);
    this.drawWorld(alpha, time);
    this.drawBurn(time);
    if (this.debug) this.drawDebug();
    else {
      this.debugGfx.clear();
      this.debugText.setText('');
    }
  }

  /** Shows the card of the unit under a click (figure or name label), or hides it. */
  private selectAt(x: number, y: number): void {
    const hit = this.sim
      .view()
      .units.find(
        (u) =>
          u.alive &&
          Math.abs(x - u.x / SUBPX) <= Math.max(UNIT_HALF_WIDTH + 8, LABEL_HALF_WIDTH) &&
          y <= u.y / SUBPX + 8 &&
          y >= u.y / SUBPX - UNIT_HEIGHT - LABEL_REACH,
      );
    this.selectedUnit = hit?.id ?? null;
    this.ui.selectUnit(this.selectedUnit);
    // A click on one of the playing team's units hands it the turn (the sim decides if allowed).
    const v = this.sim.view();
    if (hit && hit.team === v.turn.activeTeam && hit.id !== v.turn.activeUnitId) {
      this.input_.ui.selectUnit = hit.id;
    }
  }

  private tick(): void {
    this.snapshotPositions();
    const view = this.sim.view();
    const cmds = this.input_.poll(view.tick + 1, view);
    this.saver.record(view.tick + 1, cmds, this.time.now);
    const events = this.sim.step(cmds);
    if (events.some((e) => e.e === 'gameOver')) clearSave();
    this.handleEvents(events);
  }

  private handleEvents(events: readonly SimEvent[]): void {
    for (const e of events) {
      if (e.e === 'terrainCarved') this.terrain.invalidate(e.x, e.y, e.radius);
      if (e.e === 'turnStarted' || e.e === 'shotFired') this.manualCamera = false;
      if (e.e === 'explosion') {
        this.cameras.main.shake(180, 0.006);
        this.bursts.push({ x: e.x / SUBPX, y: e.y / SUBPX, radius: e.radius, born: this.time.now });
      }
    }
    // interp still holds the last drawn position of a shot that just ended.
    const shotAt = (id: number): { x: number; y: number } | null => {
      const e = this.interp.get(`s${id}`);
      return e ? { x: e.cx / SUBPX, y: e.cy / SUBPX } : null;
    };
    for (const pop of this.commentary.react(events, this.sim.view(), this.time.now, shotAt)) {
      this.popText(pop);
    }
  }

  /** Comic-book word or damage figure that springs up, floats and fades. */
  private popText(pop: Pop): void {
    const style: Record<Pop['kind'], Phaser.Types.GameObjects.Text.TextStyle> = {
      boom: {
        fontFamily: FONT_TITLE,
        fontSize: '76px',
        color: css(COLORS.vermillon),
        stroke: css(COLORS.ceruse),
        strokeThickness: 10,
      },
      whack: {
        fontFamily: FONT_TITLE,
        fontSize: '54px',
        color: css(COLORS.lapis),
        stroke: css(COLORS.or),
        strokeThickness: 8,
      },
      miss: {
        fontFamily: FONT_TITLE,
        fontSize: '58px',
        color: css(COLORS.vertDeGris),
        stroke: css(COLORS.ceruse),
        strokeThickness: 8,
      },
      heal: {
        fontFamily: FONT_CAPS,
        fontSize: '40px',
        color: css(COLORS.vertDeGris),
        stroke: css(COLORS.ceruse),
        strokeThickness: 6,
      },
      damage: {
        fontFamily: FONT_CAPS,
        fontSize: '40px',
        color: css(COLORS.vermillon),
        stroke: css(COLORS.ceruse),
        strokeThickness: 6,
      },
    };
    const text = this.add
      .text(pop.x, pop.y, pop.text, style[pop.kind])
      .setOrigin(0.5, 1)
      .setDepth(12)
      .setScale(0.3)
      .setAngle(pop.kind === 'damage' || pop.kind === 'heal' ? 0 : Phaser.Math.Between(-12, 12));
    text.setShadow(3, 3, css(COLORS.encre), 0, true, true);
    this.hudCam.ignore(text);
    this.tweens.add({ targets: text, scale: 1, duration: 220, ease: 'Back.easeOut' });
    this.tweens.add({
      targets: text,
      y: pop.y - (pop.kind === 'damage' || pop.kind === 'heal' ? 70 : 50),
      alpha: 0,
      delay: pop.kind === 'damage' || pop.kind === 'heal' ? 700 : 900,
      duration: 700,
      onComplete: () => text.destroy(),
    });
  }

  /** Copies current positions to previous ones, then reads the new current positions. */
  private snapshotPositions(): void {
    const v = this.sim.view();
    const seen = new Set<string>();
    const put = (key: string, x: number, y: number): void => {
      seen.add(key);
      const e = this.interp.get(key);
      if (e) {
        e.px = e.cx;
        e.py = e.cy;
        e.cx = x;
        e.cy = y;
      } else this.interp.set(key, { px: x, py: y, cx: x, cy: y });
    };
    for (const u of v.units) put(`u${u.id}`, u.x, u.y);
    for (const s of v.shots) put(`s${s.projectile.id}`, s.projectile.x, s.projectile.y);
    for (const key of this.interp.keys()) if (!seen.has(key)) this.interp.delete(key);
  }

  /** Interpolated world position in px. */
  private pos(key: string, alpha: number, fallbackX: number, fallbackY: number): [number, number] {
    const e = this.interp.get(key);
    if (!e) return [fallbackX / SUBPX, fallbackY / SUBPX];
    return [(e.px + (e.cx - e.px) * alpha) / SUBPX, (e.py + (e.cy - e.py) * alpha) / SUBPX];
  }

  private activeUnit(): Readonly<Unit> | undefined {
    const v = this.sim.view();
    return v.units.find((u) => u.id === v.turn.activeUnitId);
  }

  private updateCamera(alpha: number, delta: number): void {
    const cam = this.cameras.main;
    const pan = this.input_.pan;
    this.input_.updateEdge(this.game.loop.time);
    const edge = this.input_.edge;
    if (edge.x !== 0 || edge.y !== 0) {
      const step = (EDGE_SCROLL_SPEED * Math.min(delta, 50)) / 1000;
      pan.dx += edge.x * step;
      pan.dy += edge.y * step;
    }
    if (pan.dx !== 0 || pan.dy !== 0) {
      cam.scrollX += pan.dx / cam.zoom;
      cam.scrollY += pan.dy / cam.zoom;
      pan.dx = 0;
      pan.dy = 0;
      this.manualCamera = true;
    }
    if (this.input_.zoom !== 1) {
      this.zoomTo(cam.zoom * this.input_.zoom);
      this.input_.zoom = 1;
      this.manualCamera = true;
    }
    if (this.input_.recenter) {
      this.input_.recenter = false;
      this.manualCamera = false;
    }
    if (this.manualCamera) return;
    const f = this.defaultFraming(alpha);
    if (!f) return;
    // Eased: faster while following a shot, gentle otherwise.
    const k = this.sim.view().shots.length > 0 ? 0.2 : 0.06;
    const zoom = cam.zoom + (f.zoom - cam.zoom) * k;
    if (Math.abs(zoom - cam.zoom) > 1e-4) cam.setZoom(zoom);
    const cx = cam.scrollX + cam.width / 2;
    const cy = cam.scrollY + cam.height / 2;
    cam.centerOn(cx + (f.x - cx) * k, cy + (f.y - cy) * k);
  }

  private drawWorld(alpha: number, time: number): void {
    const g = this.world;
    g.clear();
    const v = this.sim.view();
    const turn = v.turn;

    this.drawKitchen(g, time);
    for (const u of v.units) {
      const label = this.labels.get(u.id);
      const [x, y] = this.pos(`u${u.id}`, alpha, u.x, u.y);
      if (!u.alive) {
        label?.setVisible(false);
        this.drawGrave(g, x, y);
        continue;
      }
      const faction = FACTIONS[u.team] ?? FACTIONS[0];
      const primary = faction?.primary ?? COLORS.lapis;
      const secondary = faction?.secondary ?? COLORS.or;
      const isActive = u.id === turn.activeUnitId && turn.phase !== 'gameOver';
      if (u.id === this.selectedUnit) {
        g.lineStyle(4, COLORS.lapis, 1);
        g.strokeEllipse(x, y + 2, UNIT_HALF_WIDTH * 5, 18);
      }
      this.drawFigure(g, x, y, u.facing, primary, secondary, isActive, time);

      if (label) {
        label.setVisible(true);
        label.setPosition(x, y - UNIT_HEIGHT - 12);
        label.setText(`${unitName(u.id)}\n${u.hp}`);
        label.setColor(css(primary));
        label.setBackgroundColor(css(isActive ? COLORS.or : COLORS.ceruse));
      }
      if (isActive) {
        // Bobbing pointer above the name: who plays is never in doubt.
        const top = y - UNIT_HEIGHT - 12 - (label?.height ?? 56) - 14 + Math.sin(time / 180) * 7;
        g.fillStyle(COLORS.or, 1);
        g.lineStyle(4, COLORS.encre, 1);
        g.fillTriangle(x - 20, top - 30, x + 20, top - 30, x, top);
        g.strokeTriangle(x - 20, top - 30, x + 20, top - 30, x, top);
        g.fillStyle(primary, 1);
        g.fillRect(x - 6, top - 52, 12, 22);
        g.strokeRect(x - 6, top - 52, 12, 22);
      }
      if (isActive && (turn.phase === 'action' || turn.phase === 'transition')) {
        this.drawAim(g, x, y - UNIT_HEIGHT / 2, turn.aim);
      }
    }

    for (const s of v.shots) {
      const p = s.projectile;
      const [x, y] = this.pos(`s${p.id}`, alpha, p.x, p.y);
      const speed = Math.hypot(p.vx, p.vy) || 1;
      const dx = p.vx / speed;
      const dy = p.vy / speed;
      if (s.weapon === 'bow') {
        g.lineStyle(4, COLORS.terreOmbre, 1);
        g.lineBetween(x - dx * 34, y - dy * 34, x, y);
        g.fillStyle(COLORS.encre, 1);
        g.fillTriangle(x + dx * 10, y + dy * 10, x - dy * 6, y + dx * 6, x + dy * 6, y - dx * 6);
        g.fillStyle(COLORS.vermillon, 1);
        g.fillTriangle(
          x - dx * 34,
          y - dy * 34,
          x - dx * 24 - dy * 7,
          y - dy * 24 + dx * 7,
          x - dx * 24 + dy * 7,
          y - dy * 24 - dx * 7,
        );
      } else {
        const r = Math.max(5, p.radius);
        const fire = s.weapon === 'greekFire';
        if (fire) {
          const flicker = 1 + Math.sin(time / 40) * 0.25;
          g.fillStyle(COLORS.or, 0.9);
          g.fillCircle(x - dx * r, y - dy * r - 2, r * 0.9 * flicker);
          g.fillStyle(COLORS.vermillon, 1);
          g.fillCircle(x - dx * r * 0.6, y - dy * r * 0.6 - 2, r * 0.6 * flicker);
        }
        g.fillStyle(fire ? COLORS.terreOmbre : COLORS.roche, 1);
        g.fillCircle(x, y, r);
        g.lineStyle(3, COLORS.encre, 1);
        g.strokeCircle(x, y, r);
      }
    }

    this.drawBursts(g, time);
  }

  /** Placeholder figure in the house's tinctures: chausses, cotte, helm, almond shield. */
  private drawFigure(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    facing: number,
    primary: number,
    secondary: number,
    active: boolean,
    time: number,
  ): void {
    const hx = x + facing * 2;
    const hy = y - 66;
    if (active) {
      // Gilt nimbus, as on the saints of the manuscript.
      const pulse = 1 + Math.sin(time / 250) * 0.06;
      g.fillStyle(COLORS.or, 1);
      g.fillCircle(hx, hy, 21 * pulse);
      g.lineStyle(3, COLORS.encre, 1);
      g.strokeCircle(hx, hy, 21 * pulse);
      g.lineStyle(2, COLORS.ocre, 1);
      g.strokeCircle(hx, hy, 16 * pulse);
    }
    g.lineStyle(3, COLORS.encre, 1);
    // Legs
    g.fillStyle(COLORS.terreOmbre, 1);
    for (const lx of [x - 9, x + 2]) {
      g.fillRect(lx, y - 18, 7, 18);
      g.strokeRect(lx, y - 18, 7, 18);
    }
    // Shield on the back side
    const sx = x - facing * 13;
    const shieldPts = poly([
      { x: sx - 9, y: y - 52 },
      { x: sx + 9, y: y - 52 },
      { x: sx + 8, y: y - 36 },
      { x: sx, y: y - 22 },
      { x: sx - 8, y: y - 36 },
    ]);
    g.fillStyle(secondary, 1);
    g.fillPoints(shieldPts, true);
    g.fillStyle(primary, 1);
    g.fillRect(sx - 3, y - 51, 6, 22);
    g.strokePoints(shieldPts, true);
    // Cotte
    const tunic = poly([
      { x: x - 11, y: y - 56 },
      { x: x + 11, y: y - 56 },
      { x: x + 15, y: y - 16 },
      { x: x - 15, y: y - 16 },
    ]);
    g.fillStyle(primary, 1);
    g.fillPoints(tunic, true);
    g.strokePoints(tunic, true);
    g.fillStyle(secondary, 1);
    g.fillRect(x - 13, y - 36, 26, 5);
    g.lineStyle(2, COLORS.encre, 1);
    g.strokeRect(x - 13, y - 36, 26, 5);
    // Head and helm
    g.fillStyle(COLORS.carnation, 1);
    g.fillCircle(hx, hy, 11);
    g.fillStyle(COLORS.roche, 1);
    g.slice(hx, hy, 11.5, Math.PI, Math.PI * 2, false);
    g.fillPath();
    g.lineStyle(3, COLORS.encre, 1);
    g.strokeCircle(hx, hy, 11);
    g.fillStyle(COLORS.encre, 1);
    g.fillCircle(hx + facing * 6, hy + 2, 2.2);
  }

  /** A little tombstone where a unit fell. */
  /**
   * The burnt ends of the parchment: charred page, a brown scorched rim that curls, and a line
   * of flames along it (GDD §2.5).
   */
  private drawBurn(time: number): void {
    const g = this.burnGfx;
    g.clear();
    const burn = this.sim.view().burnPx;
    if (burn <= 0) return;
    const { map } = this.data_;
    const top = -SKY_EXTRA;
    const bottom = map.height;
    for (const side of [-1, 1] as const) {
      // edge: x of the fire line; inward: direction of the unburnt page
      const edge = side < 0 ? burn : map.width - burn;
      const inward = -side;
      g.fillStyle(COLORS.encre, 0.86);
      g.fillRect(side < 0 ? 0 : edge, top, burn, bottom - top);
      // Scorched rim, wavy like curling paper.
      g.fillStyle(COLORS.terreOmbre, 0.85);
      g.beginPath();
      g.moveTo(edge, top);
      for (let y = top; y <= bottom; y += 24) {
        const wave = 10 + 8 * Math.sin(y / 37 + time / 900) + 5 * Math.sin(y / 11);
        g.lineTo(edge + inward * wave, y);
      }
      g.lineTo(edge, bottom);
      g.closePath();
      g.fillPath();
      // Flames licking along the edge.
      for (let y = top; y <= bottom; y += 34) {
        const flick = Math.sin(time / 120 + y) * 6;
        const h = 26 + 10 * Math.sin(time / 210 + y / 7);
        const x = edge + inward * 6;
        g.fillStyle(COLORS.vermillon, 0.95);
        g.fillTriangle(x, y - 12, x, y + 12, x + inward * h + flick, y);
        g.fillStyle(COLORS.or, 0.95);
        g.fillTriangle(x, y - 6, x, y + 6, x + inward * h * 0.55 - flick, y);
      }
    }
  }

  /** La cuisine de campagne: stone hearth, flames, a cauldron on a tripod, rising steam. */
  private drawKitchen(g: Phaser.GameObjects.Graphics, time: number): void {
    const k = this.sim.view().kitchen;
    if (!k) return;
    const x = k.x / SUBPX;
    const y = k.y / SUBPX;
    // Tripod
    g.lineStyle(3, COLORS.terreOmbre, 1);
    g.lineBetween(x - 20, y, x, y - 44);
    g.lineBetween(x + 20, y, x, y - 44);
    // Flames, flickering
    const f = Math.sin(time / 90) * 3;
    g.fillStyle(COLORS.vermillon, 1);
    g.fillTriangle(x - 12, y - 4, x + 12, y - 4, x + f, y - 22);
    g.fillStyle(COLORS.or, 1);
    g.fillTriangle(x - 6, y - 4, x + 6, y - 4, x - f, y - 15);
    // Hearth stones
    g.fillStyle(COLORS.roche, 1);
    g.lineStyle(2, COLORS.encre, 1);
    for (const dx of [-18, -6, 6, 18]) {
      g.fillCircle(x + dx, y - 3, 6);
      g.strokeCircle(x + dx, y - 3, 6);
    }
    // Cauldron on its chain
    g.lineStyle(2, COLORS.encre, 1);
    g.lineBetween(x, y - 44, x, y - 34);
    g.fillStyle(COLORS.encre, 1);
    g.fillEllipse(x, y - 26, 30, 20);
    g.fillStyle(COLORS.vertTendre, 1);
    g.fillEllipse(x, y - 33, 24, 6);
    // Steam scrolls
    g.lineStyle(2, COLORS.azur, 0.8);
    for (let i = 0; i < 3; i++) {
      const p = ((time / 1400 + i / 3) % 1) * 30;
      const sx = x - 8 + i * 8 + Math.sin(time / 300 + i) * 3;
      g.beginPath();
      g.arc(sx, y - 40 - p, 4, Math.PI * 0.5, Math.PI * 1.5);
      g.strokePath();
    }
  }

  private drawGrave(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    g.fillStyle(COLORS.roche, 1);
    g.lineStyle(3, COLORS.encre, 1);
    g.fillRoundedRect(x - 12, y - 34, 24, 34, { tl: 12, tr: 12, bl: 0, br: 0 });
    g.strokeRoundedRect(x - 12, y - 34, 24, 34, { tl: 12, tr: 12, bl: 0, br: 0 });
    g.lineStyle(3, COLORS.encre, 1);
    g.lineBetween(x, y - 28, x, y - 10);
    g.lineBetween(x - 6, y - 22, x + 6, y - 22);
  }

  /** Stylised blast: a gilt star with a vermillon core, ink-outlined, shrinking out. */
  private drawBursts(g: Phaser.GameObjects.Graphics, time: number): void {
    this.bursts = this.bursts.filter((b) => time - b.born < BURST_MS);
    for (const b of this.bursts) {
      const k = (time - b.born) / BURST_MS;
      const r = b.radius * (0.7 + 0.6 * k);
      const star = (outer: number, inner: number): Phaser.Math.Vector2[] => {
        const pts: Phaser.Types.Math.Vector2Like[] = [];
        for (let i = 0; i < 20; i++) {
          const a = (i * Math.PI) / 10 + b.born;
          const rr = i % 2 === 0 ? outer : inner;
          pts.push({ x: b.x + Math.cos(a) * rr, y: b.y + Math.sin(a) * rr });
        }
        return poly(pts);
      };
      const outer = star(r, r * 0.6);
      g.fillStyle(COLORS.or, 1 - k);
      g.fillPoints(outer, true);
      g.lineStyle(3, COLORS.encre, 1 - k);
      g.strokePoints(outer, true);
      g.fillStyle(COLORS.vermillon, 1 - k);
      g.fillPoints(star(r * 0.55, r * 0.32), true);
    }
  }

  private drawAim(g: Phaser.GameObjects.Graphics, cx: number, cy: number, aim: number): void {
    const dx = cosQ14(aim) / 16384;
    const dy = sinQ14(aim) / 16384;
    // Illuminated dotted line, vermillon and gold, ending in an arrowhead.
    let i = 0;
    for (let d = 36; d <= 150; d += 14, i++) {
      g.fillStyle(i % 2 === 0 ? COLORS.vermillon : COLORS.or, 1);
      g.lineStyle(2, COLORS.encre, 1);
      g.fillCircle(cx + dx * d, cy + dy * d, 5);
      g.strokeCircle(cx + dx * d, cy + dy * d, 5);
    }
    const tip = AIM_TIP + 10;
    const base = AIM_TIP - 12;
    const pts = poly([
      { x: cx + dx * tip, y: cy + dy * tip },
      { x: cx + dx * base - dy * 12, y: cy + dy * base + dx * 12 },
      { x: cx + dx * base + dy * 12, y: cy + dy * base - dx * 12 },
    ]);
    g.fillStyle(COLORS.vermillon, 1);
    g.fillPoints(pts, true);
    g.lineStyle(3, COLORS.encre, 1);
    g.strokePoints(pts, true);

    const power = this.input_.controls.power;
    if (power > 0) {
      g.lineStyle(12, COLORS.encre, 0.9);
      g.beginPath();
      g.arc(cx, cy, 60, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * power) / MAX_POWER);
      g.strokePath();
      g.lineStyle(8, COLORS.or, 1);
      g.beginPath();
      g.arc(cx, cy, 60, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * power) / MAX_POWER);
      g.strokePath();
    }
    const drag = this.input_.drag;
    if (drag) {
      // Faint and dashed while too short to fire: releasing there cancels.
      const armed = this.input_.dragArmed;
      g.lineStyle(armed ? 4 : 2, armed ? COLORS.vermillon : COLORS.encre, armed ? 0.9 : 0.4);
      g.lineBetween(cx, cy, cx + drag.pullX, cy + drag.pullY);
    }
  }

  private drawDebug(): void {
    const g = this.debugGfx;
    g.clear();
    const v = this.sim.view();
    g.lineStyle(1, COLORS.vermillon, 1);
    for (const u of v.units) {
      if (!u.alive) continue;
      const x = u.x / SUBPX;
      const y = u.y / SUBPX;
      g.strokeRoundedRect(
        x - UNIT_HALF_WIDTH,
        y - UNIT_HEIGHT,
        UNIT_HALF_WIDTH * 2,
        UNIT_HEIGHT,
        UNIT_HALF_WIDTH,
      );
      g.fillStyle(COLORS.vermillon, 1);
      for (const [dx, dy] of [
        [-13, -1],
        [0, -1],
        [13, -1],
        [-13, -20],
        [-13, -60],
        [13, -20],
        [13, -60],
        [-6, -80],
        [6, -80],
      ] as const) {
        g.fillRect(x + dx, y + dy, 2, 2);
      }
    }
    // Predicted trajectory of the selected weapon at the charged power (or full power).
    const u = this.activeUnit();
    const def = v.rules.weapons.find((w) => w.id === v.turn.weapon);
    if (u && def && v.turn.phase === 'action') {
      const power = this.input_.controls.power || MAX_POWER;
      const speed = Math.trunc((def.maxSpeed * power) / MAX_POWER);
      const p = createProjectile(
        0,
        u.id,
        u.x,
        u.y - (UNIT_HEIGHT * SUBPX) / 2,
        Math.trunc((speed * cosQ14(v.turn.aim)) / 16384),
        Math.trunc((speed * sinQ14(v.turn.aim)) / 16384),
        { radius: def.projectileRadius, windPct: def.windPct, gravityPct: 100 },
      );
      g.fillStyle(COLORS.lapis, 1);
      for (let i = 0; i < 240; i++) {
        // The debug preview reads the terrain only; stepProjectile never writes it.
        const hit = stepProjectile(
          p,
          v.terrain as Terrain,
          [],
          v.turn.wind,
          v.rules.wind.accelPerUnit,
        );
        if (i % 3 === 0) g.fillCircle(p.x / SUBPX, p.y / SUBPX, 2);
        if (hit) break;
      }
    }
    this.debugText.setText(
      [
        `tick ${v.tick}   hash ${(this.sim.hash() >>> 0).toString(16).padStart(8, '0')}`,
        `fps ${this.fps.toFixed(0)}   tuiles en attente ${this.terrain.pendingTiles}`,
        `phase ${v.turn.phase} ${v.turn.phaseTicks}   vent ${v.turn.wind}   visée ${v.turn.aim}`,
        this.paused ? t('debug.paused') : '',
      ].join('\n'),
    );
  }
}
