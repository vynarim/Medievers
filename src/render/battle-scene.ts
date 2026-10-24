// Greybox battle scene (BACKLOG M2): fixed-step loop with interpolation, tiled terrain,
// capsule units, projectiles, camera, HUD and the F1 debug overlay.
import Phaser from 'phaser';
import { FACTIONS, UNIT_NAMES } from '../content/factions.ts';
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
import { GameUi } from '../ui/game-ui.ts';
import { t } from '../ui/i18n.ts';
import { applyOverrides } from '../ui/tuning-model.ts';
import { COLORS, css } from '../ui/tokens.ts';
import { TerrainLayer } from './terrain-layer.ts';

export interface BattleData {
  readonly map: MapDef;
  readonly mask: Mask;
  readonly seed: number;
  /** match rules, the Classique scheme with the playtest overrides applied */
  readonly rules: MatchRules;
}

const TICK_MS = 1000 / TICKS_PER_SECOND;
/** Catch-up limit: at most 5 sim steps per frame (TECH_SPEC §3). */
const MAX_STEPS_PER_FRAME = 5;
const VIEW_W = 1920;
const VIEW_H = 1080;
const ZOOM_MIN = 0.35;
const ZOOM_MAX = 1.6;

interface Interp {
  px: number;
  py: number;
  cx: number;
  cy: number;
}

const HUD_FONT = 'Georgia, "Book Antiqua", serif';

export class BattleScene extends Phaser.Scene {
  private sim!: Sim;
  private data_!: BattleData;
  private input_!: PhaserLocalInput;
  private terrain!: TerrainLayer;
  private world!: Phaser.GameObjects.Graphics;
  private debugGfx!: Phaser.GameObjects.Graphics;
  private labels = new Map<number, Phaser.GameObjects.Text>();
  private hud!: Record<
    'turn' | 'timer' | 'wind' | 'weapon' | 'teams' | 'banner' | 'debug',
    Phaser.GameObjects.Text
  >;
  private hudGfx!: Phaser.GameObjects.Graphics;
  private ui!: GameUi;
  private selectedUnit: number | null = null;
  private acc = 0;
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
    this.acc = 0;
    this.interp.clear();
    this.labels.clear();
    this.manualCamera = false;
    this.selectedUnit = null;
  }

  create(): void {
    const { map, mask, seed, rules } = this.data_;
    const config: MatchConfig = {
      rules,
      teams: map.spawns.map((spawns) => ({ spawns })),
    };
    this.sim = new Sim(config, seed, mask);

    const cam = this.cameras.main;
    cam.setBackgroundColor(css(COLORS.ciel));
    cam.setBounds(0, 0, map.width, map.height);
    cam.setZoom(0.6);

    this.terrain = new TerrainLayer(this, () => this.sim.view().terrain);
    this.world = this.add.graphics().setDepth(6);
    this.debugGfx = this.add.graphics().setDepth(20);
    this.hudGfx = this.add.graphics().setScrollFactor(0).setDepth(30);

    for (const u of this.sim.view().units) {
      const label = this.add
        .text(0, 0, '', {
          fontFamily: HUD_FONT,
          fontSize: '22px',
          color: css(COLORS.encre),
          align: 'center',
          backgroundColor: css(COLORS.ceruse),
          padding: { x: 6, y: 2 },
        })
        .setOrigin(0.5, 1)
        .setDepth(7);
      this.labels.set(u.id, label);
    }

    const text = (x: number, y: number, size: number, originX = 0): Phaser.GameObjects.Text =>
      this.add
        .text(x, y, '', {
          fontFamily: HUD_FONT,
          fontSize: `${size}px`,
          color: css(COLORS.encre),
        })
        .setOrigin(originX, 0)
        .setScrollFactor(0)
        .setDepth(31);
    this.hud = {
      turn: text(32, 24, 34),
      timer: text(VIEW_W - 32, 24, 44, 1),
      wind: text(VIEW_W / 2, 24, 30, 0.5),
      weapon: text(32, VIEW_H - 150, 30),
      teams: text(VIEW_W - 32, VIEW_H - 150, 28, 1),
      banner: text(VIEW_W / 2, VIEW_H / 2 - 80, 64, 0.5),
      debug: text(32, 90, 22),
    };
    this.hud.banner.setAlign('center');

    // HUD on its own unzoomed camera; the main camera only sees the world.
    const hudObjects = [this.hudGfx, ...Object.values(this.hud)];
    const worldObjects = [
      ...this.terrain.images,
      this.world,
      this.debugGfx,
      ...this.labels.values(),
    ];
    cam.ignore(hudObjects);
    this.cameras.add(0, 0, VIEW_W, VIEW_H, false, 'hud').ignore(worldObjects);

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
    ] as const) {
      kb.addKey(code).on('down', () => this.pressed.add(name));
    }
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      cam.setZoom(Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 0.9 : 1.1), ZOOM_MIN, ZOOM_MAX));
    });
    this.ui = new GameUi({
      intents: this.input_.ui,
      restart: (overrides) =>
        this.scene.restart({
          ...this.data_,
          rules: applyOverrides(CLASSIC_RULES, overrides),
          seed: (this.data_.seed + 0x9e3779b9) >>> 0,
        }),
    });
    this.events.once('shutdown', () => {
      this.input_.dispose();
      this.ui.destroy();
    });

    this.snapshotPositions();
    this.snapshotPositions();
    const active = this.activeUnit();
    if (active) cam.centerOn(active.x / SUBPX, active.y / SUBPX - 200);
  }

  override update(_time: number, delta: number): void {
    this.fps += (1000 / Math.max(1, delta) - this.fps) * 0.05;
    const k = (name: string): boolean => this.pressed.has(name);
    if (k('f1')) this.debug = !this.debug;
    if (k('p')) this.paused = !this.paused;
    if (k('n')) this.stepOnce = true;
    if (k('c')) this.manualCamera = false;
    const restart = k('r');
    this.pressed.clear();
    if (restart && this.sim.view().turn.phase === 'gameOver') {
      this.scene.restart({ ...this.data_, seed: (this.data_.seed + 0x9e3779b9) >>> 0 });
      return;
    }

    const active = this.activeUnit();
    this.input_.unitCentre = active
      ? { x: active.x / SUBPX, y: active.y / SUBPX - UNIT_HEIGHT / 2 }
      : null;

    if (this.paused) {
      if (this.stepOnce) this.tick();
      this.stepOnce = false;
      this.acc = 0;
    } else {
      let steps = 0;
      this.acc += Math.min(delta, 250);
      while (this.acc >= TICK_MS && steps < MAX_STEPS_PER_FRAME) {
        this.tick();
        this.acc -= TICK_MS;
        steps++;
      }
      if (steps === MAX_STEPS_PER_FRAME) this.acc = 0;
    }
    const alpha = this.paused ? 1 : this.acc / TICK_MS;

    const click = this.input_.takeClick();
    if (click) this.selectAt(click.x, click.y);
    this.ui.update(this.sim.view());

    this.terrain.flush();
    this.updateCamera(alpha);
    this.drawWorld(alpha);
    this.drawHud();
    if (this.debug) this.drawDebug();
    else {
      this.debugGfx.clear();
      this.hud.debug.setText('');
    }
  }

  /** Shows the card of the unit under a click, or hides it on empty ground. */
  private selectAt(x: number, y: number): void {
    const hit = this.sim
      .view()
      .units.find(
        (u) =>
          u.alive &&
          Math.abs(x - u.x / SUBPX) <= UNIT_HALF_WIDTH + 8 &&
          y <= u.y / SUBPX + 8 &&
          y >= u.y / SUBPX - UNIT_HEIGHT - 8,
      );
    this.selectedUnit = hit?.id ?? null;
    this.ui.selectUnit(this.selectedUnit);
  }

  private tick(): void {
    this.snapshotPositions();
    const view = this.sim.view();
    const cmds = this.input_.poll(view.tick + 1, view);
    const events = this.sim.step(cmds);
    this.handleEvents(events);
  }

  private handleEvents(events: readonly SimEvent[]): void {
    for (const e of events) {
      if (e.e === 'terrainCarved') this.terrain.invalidate(e.x, e.y, e.radius);
      if (e.e === 'turnStarted' || e.e === 'shotFired') this.manualCamera = false;
      if (e.e === 'explosion') this.cameras.main.shake(180, 0.006);
    }
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

  private updateCamera(alpha: number): void {
    const cam = this.cameras.main;
    const pan = this.input_.pan;
    if (pan.dx !== 0 || pan.dy !== 0) {
      cam.scrollX += pan.dx / cam.zoom;
      cam.scrollY += pan.dy / cam.zoom;
      pan.dx = 0;
      pan.dy = 0;
      this.manualCamera = true;
    }
    if (this.manualCamera) return;
    const v = this.sim.view();
    const shot = v.shots[0];
    let target: [number, number] | null = null;
    if (shot) {
      target = this.pos(`s${shot.projectile.id}`, alpha, shot.projectile.x, shot.projectile.y);
    } else {
      const u = this.activeUnit();
      if (u) {
        const [x, y] = this.pos(`u${u.id}`, alpha, u.x, u.y);
        target = [x, y - 150];
      }
    }
    if (!target) return;
    const cx = cam.scrollX + cam.width / 2;
    const cy = cam.scrollY + cam.height / 2;
    const k = shot ? 0.25 : 0.08;
    cam.centerOn(cx + (target[0] - cx) * k, cy + (target[1] - cy) * k);
  }

  private drawWorld(alpha: number): void {
    const g = this.world;
    g.clear();
    const v = this.sim.view();
    const turn = v.turn;

    for (const u of v.units) {
      const label = this.labels.get(u.id);
      if (!u.alive) {
        label?.setVisible(false);
        continue;
      }
      const [x, y] = this.pos(`u${u.id}`, alpha, u.x, u.y);
      const faction = FACTIONS[u.team] ?? FACTIONS[0];
      const isActive = u.id === turn.activeUnitId && turn.phase !== 'gameOver';
      // Placeholder body: a capsule in the house colours (ASSETS §2.1).
      g.fillStyle(faction?.primary ?? COLORS.lapis, 1);
      g.fillRoundedRect(
        x - UNIT_HALF_WIDTH,
        y - UNIT_HEIGHT,
        UNIT_HALF_WIDTH * 2,
        UNIT_HEIGHT,
        UNIT_HALF_WIDTH,
      );
      g.fillStyle(faction?.secondary ?? COLORS.or, 1);
      g.fillRect(x - UNIT_HALF_WIDTH + 4, y - 46, UNIT_HALF_WIDTH * 2 - 8, 8);
      g.lineStyle(isActive ? 5 : 3, isActive ? COLORS.or : COLORS.encre, 1);
      g.strokeRoundedRect(
        x - UNIT_HALF_WIDTH,
        y - UNIT_HEIGHT,
        UNIT_HALF_WIDTH * 2,
        UNIT_HEIGHT,
        UNIT_HALF_WIDTH,
      );
      if (u.id === this.selectedUnit) {
        g.lineStyle(2, COLORS.lapis, 1);
        g.strokeEllipse(x, y + 2, UNIT_HALF_WIDTH * 4, 14);
      }
      // Eye on the facing side.
      g.fillStyle(COLORS.encre, 1);
      g.fillCircle(x + u.facing * 7, y - 64, 3.5);

      if (label) {
        label.setVisible(true);
        label.setPosition(x, y - UNIT_HEIGHT - 10);
        label.setText(`${UNIT_NAMES[(u.id - 1) % UNIT_NAMES.length]}\n${u.hp}`);
        label.setColor(css(faction?.primary ?? COLORS.encre));
      }

      if (isActive && (turn.phase === 'action' || turn.phase === 'transition')) {
        this.drawAim(g, x, y - UNIT_HEIGHT / 2, turn.aim);
      }
    }

    for (const s of v.shots) {
      const p = s.projectile;
      const [x, y] = this.pos(`s${p.id}`, alpha, p.x, p.y);
      g.fillStyle(s.weapon === 'greekFire' ? COLORS.vermillon : COLORS.encre, 1);
      g.fillCircle(x, y, Math.max(3, p.radius));
      if (s.weapon === 'greekFire') {
        g.lineStyle(2, COLORS.or, 1);
        g.strokeCircle(x, y, Math.max(3, p.radius) + 2);
      }
    }
  }

  private drawAim(g: Phaser.GameObjects.Graphics, cx: number, cy: number, aim: number): void {
    const dx = cosQ14(aim) / 16384;
    const dy = sinQ14(aim) / 16384;
    g.fillStyle(COLORS.vermillon, 1);
    for (let d = 34; d <= 110; d += 12) g.fillCircle(cx + dx * d, cy + dy * d, 3);
    g.lineStyle(3, COLORS.vermillon, 1);
    g.strokeCircle(cx + dx * 120, cy + dy * 120, 9);

    const power = this.input_.controls.power;
    if (power > 0) {
      g.lineStyle(10, COLORS.or, 0.9);
      g.beginPath();
      g.arc(cx, cy, 58, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * power) / MAX_POWER);
      g.strokePath();
    }
    const drag = this.input_.drag;
    if (drag) {
      g.lineStyle(3, COLORS.encre, 0.6);
      g.lineBetween(cx, cy, cx + drag.pullX, cy + drag.pullY);
    }
  }

  private drawHud(): void {
    const v = this.sim.view();
    const turn = v.turn;
    const g = this.hudGfx;
    g.clear();
    const faction = FACTIONS[turn.activeTeam];
    const house = faction ? t(faction.nameKey) : '';
    this.hud.turn.setText(
      `${t('hud.turn', { n: turn.number })} — ${house}\n${t(`hud.phase.${turn.phase}`)}`,
    );
    this.hud.turn.setColor(css(faction?.primary ?? COLORS.encre));

    const seconds =
      turn.phase === 'action' || turn.phase === 'retreat'
        ? Math.ceil(turn.phaseTicks / TICKS_PER_SECOND)
        : null;
    this.hud.timer.setText(seconds === null ? '' : `⌛ ${seconds}`);
    this.hud.timer.setColor(
      css(seconds !== null && seconds <= 5 ? COLORS.vermillon : COLORS.encre),
    );

    // Wind banner: length and direction follow the wind (GDD §5).
    this.hud.wind.setText(
      `${t('hud.wind')} ${turn.wind > 0 ? '→' : turn.wind < 0 ? '←' : '·'} ${Math.abs(turn.wind)}`,
    );
    const wx = VIEW_W / 2;
    const len = (Math.abs(turn.wind) / v.rules.wind.max) * 220;
    g.fillStyle(COLORS.ceruse, 0.85);
    g.fillRect(wx - 240, 66, 480, 18);
    g.fillStyle(COLORS.azur, 1);
    g.fillRect(turn.wind >= 0 ? wx : wx - len, 66, len, 18);
    g.lineStyle(2, COLORS.encre, 1);
    g.strokeRect(wx - 240, 66, 480, 18);

    const def = v.rules.weapons.find((w) => w.id === turn.weapon);
    const fuse =
      def?.behavior === 'fusedBouncer'
        ? `   ${t('hud.fuse', { s: Math.round((turn.fuse || def.defaultFuse) / TICKS_PER_SECOND) })}`
        : '';
    this.hud.weapon.setText(`${t('hud.weapon')} : ${t(`weapons.${turn.weapon}`)}${fuse}`);
    const power = this.input_.controls.power;
    g.fillStyle(COLORS.ceruse, 0.85);
    g.fillRect(32, VIEW_H - 104, 360, 22);
    g.fillStyle(COLORS.vermillon, 1);
    g.fillRect(32, VIEW_H - 104, (360 * power) / MAX_POWER, 22);
    g.strokeRect(32, VIEW_H - 104, 360, 22);

    const lines = v.teams.map((team) => {
      const f = FACTIONS[team.id];
      const hp = team.unitIds.reduce((sum, id) => {
        const u = v.units.find((x) => x.id === id);
        return sum + (u?.alive ? u.hp : 0);
      }, 0);
      return `${f ? t(f.nameKey) : ''}  ${hp}`;
    });
    this.hud.teams.setText(lines.join('\n'));

    if (turn.phase === 'gameOver') {
      const winner = v.winner !== null && v.winner >= 0 ? FACTIONS[v.winner] : undefined;
      this.hud.banner.setText(
        `${winner ? t('hud.winner', { house: t(winner.nameKey).replace(/^Maison /, 'Maison ') }) : t('hud.draw')}\n${t('hud.restart')}`,
      );
      this.hud.banner.setColor(css(winner?.primary ?? COLORS.encre));
    } else this.hud.banner.setText('');
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
    this.hud.debug.setText(
      [
        `tick ${v.tick}   hash ${(this.sim.hash() >>> 0).toString(16).padStart(8, '0')}`,
        `fps ${this.fps.toFixed(0)}   tuiles en attente ${this.terrain.pendingTiles}`,
        `phase ${v.turn.phase} ${v.turn.phaseTicks}   vent ${v.turn.wind}   visée ${v.turn.aim}`,
        this.paused ? t('debug.paused') : '',
      ].join('\n'),
    );
  }
}
