// Greybox battle scene (BACKLOG M2): fixed-step loop with interpolation, tiled terrain on a
// diapered vellum page, placeholder figures, projectiles, cosmetic VFX, camera and the F1 debug
// overlay. The HUD and menus are DOM (src/ui).
import Phaser from 'phaser';
import { FACTIONS, unitName } from '../content/factions.ts';
import type { MapDef } from '../content/maps.ts';
import { TICKS_PER_SECOND, type MatchRules } from '../content/rules.ts';
import { PhaserLocalInput } from '../input/phaser-local-input.ts';
import { MAX_POWER } from '../sim/commands.ts';
import type { SimEvent } from '../sim/events.ts';
import { cosQ14, sinQ14 } from '../sim/math/angle.ts';
import { SUBPX } from '../sim/math/fixed.ts';
import { createProjectile, stepProjectile } from '../sim/projectiles/projectile.ts';
import { Sim, canSwitchUnit, type SimView } from '../sim/sim.ts';
import type { MatchConfig } from '../sim/state.ts';
import type { Mask } from '../sim/terrain/mask.ts';
import type { Terrain } from '../sim/terrain/terrain.ts';
import { UNIT_HALF_WIDTH, UNIT_HEIGHT, type Unit } from '../sim/units/unit.ts';
import { BARREL_HEIGHT, BARREL_WIDTH } from '../content/barrels.ts';
import { CRATE_HEIGHT } from '../content/crates.ts';
import { BeastKind, Trick } from '../content/beasts.ts';
import { Commentary, type Pop } from '../ui/commentary.ts';
import { FONT_CAPS, FONT_TEXT, FONT_TITLE } from '../ui/fonts.ts';
import { GameUi, loadOverrides } from '../ui/game-ui.ts';
import { t } from '../ui/i18n.ts';
import type { TuningOverrides } from '../ui/tuning-model.ts';
import { COLORS, css, cssAlpha } from '../ui/tokens.ts';
import { isPhonePortrait, uiScale } from '../ui/ui-scale.ts';
import { AutoSaver, clearSave } from '../app/autosave.ts';
import { ReplayInput } from '../input/replay-input.ts';
import { replay, type GameLog } from '../sim/log.ts';
import { frame, type Point } from './framing.ts';
import {
  GRAVE_HEIGHT,
  GRAVE_WIDTH,
  graveAt,
  objectAt,
  objectInfo,
  unitInfo,
  type ObjectRef,
} from '../ui/object-info.ts';
import { Scenery } from './scenery.ts';
import { dragonColours, dragonTexture } from './sky-life.ts';
import { FixedStep } from './fixed-step.ts';
import { TerrainLayer } from './terrain-layer.ts';
import { drawClassMark } from './class-marks.ts';
import { drawFigure } from './figures.ts';
import { aimPreviewTicks, classOf, maxHpOf, visibleMines } from '../sim/classes.ts';
import { shotSpeed } from '../sim/weapons/weapons.ts';
import {
  targetFor,
  teleportLanding,
  wallAngle,
  wallLanding,
  wallLength,
  wallRefusal,
  wallSize,
} from '../sim/tools.ts';
import { isProjectile, isTargeted, type WeaponDef } from '../content/weapons.ts';
import { aiHouses, matchConfig, rulesFor, saveSetup, type MatchSetup } from '../app/match-setup.ts';
import { AIInputSource } from '../input/ai-input.ts';
import { showSetupScreen } from '../ui/setup-screen.ts';
import { nameHouses } from '../ui/house-names.ts';
import { UNICORN_TEX_SCALE, unicornTextures } from './unicorn-art.ts';
import { RELIC_TEX_SCALE, reliquaryTextures } from './reliquary-art.ts';
import { showTitleScreen } from '../ui/title-screen.ts';
import { StructureState, type StructurePlacement } from '../content/structures.ts';
import { buildMap, type BuiltMap } from '../app/map-build.ts';
import { leaveMatch, type OnlineMatch } from '../app/online.ts';
import { hostFlow, joinFlow } from '../app/online-flow.ts';
import { roleOfTeam } from '../net/protocol.ts';
import { RemoteInputSource } from '../input/remote-input.ts';

/** The map fields of the battle data, from a built map. */
export function battleMap(
  b: BuiltMap,
): Pick<BattleData, 'map' | 'mask' | 'mapId' | 'structures' | 'waterLevel'> {
  return {
    map: b.def,
    mask: b.mask,
    mapId: b.mapId,
    ...(b.structures ? { structures: b.structures } : {}),
    ...(b.waterLevel !== undefined ? { waterLevel: b.waterLevel } : {}),
  };
}

export interface BattleData {
  readonly map: MapDef;
  readonly mask: Mask;
  /** id of the map in the game logs (theme and seed of a generated map) */
  readonly mapId: string;
  /** the map's structures and sea, from its generation (or the fixed map's own) */
  readonly structures?: readonly StructurePlacement[];
  readonly waterLevel?: number;
  readonly seed: number;
  /** match rules, from the setup's scheme (and the player's settings for « Personnalisé ») */
  readonly rules: MatchRules;
  /** the match chosen on the setup screen: houses, line-ups, scheme, Régicide */
  readonly setup: MatchSetup;
  /** a saved match to resume: its log replaces seed and rules */
  readonly resume?: GameLog;
  /** a match to watch from its start (the replay viewer): its log replaces seed and rules */
  readonly replay?: GameLog;
  /** an online match (GDD §6): its commands come through the lockstep */
  readonly online?: OnlineMatch;
}

/** The battle of an online match: the map and the rules the creator chose. */
export function onlineBattle(m: OnlineMatch): BattleData {
  const s = m.lockstep.start;
  return {
    ...battleMap(buildMap(s.setup.map, s.seed)),
    seed: s.seed,
    rules: s.rules,
    setup: s.setup,
    online: m,
  };
}

/** ms per wing beat of the angels bringing reliquaries down */
const ANGEL_FLAP = 260;
/** the unicorn's gallop: ms per stride, px it springs at each */
const UNICORN_STRIDE = 140;
const UNICORN_HOP = 6;
/** the dragon's drawing: its scale, and ms per quarter wing beat */
const DRAGON_SCALE = 1.15;
const DRAGON_FLAP = 210;
/** Playback speeds of the replay viewer. */
const REPLAY_SPEEDS = [1, 2, 4] as const;

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
/** ms a lightning bolt stays on screen, ms it holds full before fading, ms it strikes again */
const BOLT_MS = 1300;
const BOLT_HOLD_MS = 800;
const BOLT_RESTRIKE_MS = 260;
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
/** The same on a phone held upright: the HUD stacks on top, the game stops above the bar (overlay.ts). */
const PHONE_FRAME_MARGINS = { top: 290, bottom: 30, side: 20 } as const;
/**
 * World px a phone held upright shows across at least, by default: past it, the field cannot
 * be framed whole at a size worth seeing, and the default view follows the playing unit.
 */
const PHONE_SPAN = 1000;
/** px above the feet and either side of a unit where a click still picks it: its name label */
const LABEL_REACH = 44;
const LABEL_HALF_WIDTH = 34;
/** px a name label goes up when it would cover another one: a label, its life bar and a gap */
const LABEL_STACK = 36;
/** px apart two labels must be sideways not to overlap */
const LABEL_APART = 76;
/** ms the tiny help bubble over a unit that cannot play stays up */
const TIP_MS = 2600;

/** Phaser's polygon calls want Vector2 instances. */
const poly = (points: readonly { x: number; y: number }[]): Phaser.Math.Vector2[] =>
  points.map((p) => new Phaser.Math.Vector2(p.x, p.y));

interface Interp {
  px: number;
  py: number;
  cx: number;
  cy: number;
}

/** ms a miracle's beam of light lasts */
const HALO_MS = 1400;

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
  /** the dragon of the sim (GDD §4.11), painted by SkyLife */
  private dragonImg!: Phaser.GameObjects.Image;
  /** the unicorn of the sim (GDD §4.12) */
  private unicornImg!: Phaser.GameObjects.Image;
  /** each reliquary on the map: its shrine, and the angel bringing it down while it falls */
  private readonly relics = new Map<
    number,
    { shrine: Phaser.GameObjects.Image; angel: Phaser.GameObjects.Image }
  >();
  /** turns-left figures over the pots resting on the map, by pot id */
  private readonly potLabels = new Map<number, Phaser.GameObjects.Text>();
  /** the map object whose bubble is open */
  private infoRef: ObjectRef | null = null;
  /** a teammate clicked that cannot take the turn: why, over its head, until `until` (ms) */
  private tip: { unitId: number; key: string; until: number } | null = null;
  /** drawn position of the beast, easing after the sim's */
  private beastShown: { x: number; y: number } | null = null;
  /** the burnt ends of the parchment, over the terrain, under the units */
  private burnGfx!: Phaser.GameObjects.Graphics;
  /** the water (le Déluge), over the units it has drowned */
  private waterGfx!: Phaser.GameObjects.Graphics;
  /** rain and lightning (GDD §5 bis), over everything in the world */
  private weatherGfx!: Phaser.GameObjects.Graphics;
  /** lightning bolts being drawn: px of the strike, ms it struck */
  private bolts: { x: number; y: number; born: number }[] = [];
  /** px: top of the water as drawn, easing up after the sim's */
  private waterShown = Infinity;
  private debugGfx!: Phaser.GameObjects.Graphics;
  private labels = new Map<number, Phaser.GameObjects.Text>();
  /** px each unit's label is raised, so that labels of units standing together do not overlap */
  private labelLift = new Map<number, number>();
  private debugText!: Phaser.GameObjects.Text;
  private hudCam!: Phaser.Cameras.Scene2D.Camera;
  private ui!: GameUi;
  private commentary!: Commentary;
  private bursts: Burst[] = [];
  /** beams of light where the miracle took a unit up and set it down */
  private halos: Burst[] = [];
  private selectedUnit: number | null = null;
  private readonly clock = new FixedStep(TICK_MS, MAX_STEPS_PER_FRAME, MAX_FRAME_MS);
  private interp = new Map<string, Interp>();
  private debug = false;
  private paused = false;
  private stepOnce = false;
  private manualCamera = false;
  /** watching the replay of a match (the replay viewer): every chausse-trape is shown */
  private replaying = false;
  /** the commands of the match being watched, and its log */
  private watch: ReplayInput | null = null;
  private watchLog: GameLog | null = null;
  /** the online match being played, and the commands it hands over */
  private online: OnlineMatch | null = null;
  private remote: RemoteInputSource | null = null;
  /** the AI's houses, in a match played on this device (GDD §6) */
  private ai: AIInputSource | null = null;
  /** ms since the commands of the next tick were last missing (the other player is slow) */
  private stalledSince: number | null = null;
  /** an online match error already shown (desync, the other player left) */
  private netShown = false;
  /** sim ticks per clock tick while watching (×1, ×2, ×4) */
  private speed = 1;
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
    this.potLabels.clear();
    this.bursts = [];
    this.manualCamera = false;
    this.selectedUnit = null;
    this.infoRef = null;
    this.tip = null;
    // The scene object outlives a restart: a match chosen from the paused one starts running.
    this.paused = false;
    this.stepOnce = false;
  }

  create(): void {
    const { map, mask, seed, rules, setup, waterLevel } = this.data_;
    const structures = this.data_.structures ?? map.structures;
    const config: MatchConfig = matchConfig(
      {
        mask,
        ...(structures ? { structures } : {}),
        ...(waterLevel !== undefined ? { waterLevel } : {}),
      },
      setup,
      rules,
    );
    const resume = this.data_.resume;
    const watch = this.data_.replay;
    // A saved match replays to where it was left: same seed, same commands, same state. A
    // match being watched starts from its first tick, its commands fed by a ReplayInput.
    this.sim = watch
      ? new Sim(watch.config, watch.seed, mask)
      : resume
        ? replay(resume, mask)
        : new Sim(config, seed, mask);
    const from = watch ?? resume;
    this.saver = from
      ? new AutoSaver(from.config, from.seed, from.mapId, [...from.commands])
      : new AutoSaver(config, seed, this.data_.mapId);
    this.replaying = watch !== undefined;
    // The houses get their names for this match, from its seed: the same on every screen.
    nameHouses(this.data_.seed);
    this.online = this.data_.online ?? null;
    this.remote = this.online ? new RemoteInputSource(this.online.lockstep) : null;
    this.stalledSince = null;
    this.netShown = false;
    // An online match is not resumed from this device's save, but by its code.
    if (this.online) this.saver.persist = false;
    this.watch = watch ? new ReplayInput(watch) : null;
    this.watchLog = watch ?? null;
    // The AI plays its houses in a match on this device, not online nor in a replay.
    this.ai?.dispose();
    const levels = this.online || watch ? new Map() : aiHouses(this.data_.setup);
    this.ai = levels.size > 0 ? new AIInputSource(levels, from?.seed ?? seed) : null;
    this.speed = 1;

    const cam = this.cameras.main;
    cam.setBackgroundColor(css(COLORS.velin));
    cam.setBounds(0, -SKY_EXTRA, map.width, map.height + SKY_EXTRA);

    const page = this.add
      .tileSprite(0, -SKY_EXTRA, map.width, map.height + SKY_EXTRA, this.diaperTexture())
      .setOrigin(0, 0)
      .setDepth(0);
    this.scenery = new Scenery(this, this.sim.view().terrain, map.theme);
    this.terrain = new TerrainLayer(this, () => this.sim.view().terrain, map.theme);
    this.world = this.add.graphics().setDepth(6);
    // In front of the units it swoops on, behind their labels.
    this.dragonImg = this.add
      .image(0, 0, dragonTexture(0, 0))
      .setOrigin(0.55, 0.5)
      .setScale(DRAGON_SCALE)
      .setDepth(6.6)
      .setVisible(false);
    unicornTextures(this);
    reliquaryTextures(this);
    this.unicornImg = this.add
      .image(0, 0, 'unicorn_0')
      .setOrigin(0.5, 1)
      .setScale(1 / UNICORN_TEX_SCALE)
      .setDepth(5.9)
      .setVisible(false);
    this.burnGfx = this.add.graphics().setDepth(5.5);
    this.waterGfx = this.add.graphics().setDepth(6.5);
    this.weatherGfx = this.add.graphics().setDepth(11);
    this.bolts = [];
    this.waterShown = this.sim.view().waterY;
    this.debugGfx = this.add.graphics().setDepth(20);

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
      this.dragonImg,
      this.unicornImg,
      this.burnGfx,
      this.waterGfx,
      this.weatherGfx,
      this.debugGfx,
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
      // Applying ⚙ Réglages plays the player's own scheme, « Personnalisé ».
      restart: (overrides) => this.restart(overrides, true),
      newMatch: () => this.newMatch(),
      resetView: () => this.resetView(),
      title: () => this.showTitle(),
      ...(this.online ? { onlineCode: this.online.code } : {}),
    });
    // A resized window keeps the map filling the screen (the default view reframes itself).
    const onResize = (): void => {
      if (this.manualCamera) this.zoomTo(cam.zoom);
    };
    this.scale.on('resize', onResize);
    this.events.once('shutdown', () => this.scale.off('resize', onResize));
    this.commentary = new Commentary(
      this.ui.hud,
      () => this.newMatch(),
      () => this.watchReplay(),
    );
    if (this.watchLog) {
      this.ui.showReplayBar({
        togglePause: () => (this.paused = !this.paused),
        paused: () => this.paused,
        speed: (s) => (this.speed = s),
        speeds: REPLAY_SPEEDS,
        restart: () => this.watchReplay(),
        quit: () => this.newMatch(),
      });
    }
    if (this.online && this.remote) {
      // The first ticks this peer owns, then, for a match under way, the catch-up at full speed.
      this.online.lockstep.produceAfter(this.sim.view(), (tk) =>
        this.input_.poll(tk, this.sim.view()),
      );
      if (this.online.resumed) {
        while (this.remote.ready(this.sim.view().tick + 1)) {
          this.playOnline(this.sim.view().tick + 1, false);
        }
      }
    }
    this.ui.setLocalTeams((team) => this.mine(team));
    const turn = this.sim.view().turn;
    if (watch) {
      this.ui.hud.announce(
        t('replay.title'),
        t('replay.sub'),
        t('replay.quip'),
        COLORS.lapis,
        this.time.now,
      );
    } else if (resume || this.online?.resumed) {
      this.ui.hud.announce(
        t('hud.resumed'),
        t('hud.turn', { n: turn.number }),
        t('hud.resumedSub'),
        COLORS.lapis,
        this.time.now,
      );
    } else if (turn.phase === 'placement') {
      this.ui.hud.announce(
        t('hud.placement'),
        t('hud.placementSub'),
        t('hud.placementQuip'),
        COLORS.lapis,
        this.time.now,
      );
    } else {
      this.commentary.announceTurn(turn.number, turn.activeTeam, turn.activeUnitId, this.time.now);
    }
    // Leaving or refreshing the page saves the exact tick, not the last second.
    const onHide = (): void => {
      if (!this.watch) this.saver.flush(this.sim.view().tick, Infinity);
    };
    window.addEventListener('pagehide', onHide);
    this.events.once('shutdown', () => {
      window.removeEventListener('pagehide', onHide);
      this.input_.dispose();
      this.ai?.dispose();
      this.ai = null;
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
    // During the placement, the whole width of the map, to choose where to stand.
    if (v.turn.phase === 'placement') {
      const { map } = this.data_;
      points.push({ x: 0, y: map.height * 0.75 }, { x: map.width, y: map.height * 0.75 });
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
    // A flaming pig trotting, or a swarm, is followed like a shot.
    const pig = v.walkers[0];
    const swarm = v.swarms[0];
    if (!shot && pig) {
      const [x, y] = this.pos(`w${pig.id}`, alpha, pig.x, pig.y);
      points.push({ x, y: y + 150 });
    } else if (!shot && swarm) {
      const [x, y] = this.pos(`b${swarm.id}`, alpha, swarm.x, swarm.y);
      points.push({ x, y: y + 150 });
    }
    const { width, height } = this.scale;
    const u = uiScale(width, height);
    const phone = isPhonePortrait(width, height);
    const m = phone ? PHONE_FRAME_MARGINS : FRAME_MARGINS;
    const margins = { top: m.top * u, bottom: m.bottom * u, side: m.side * u };
    const closest = Math.max(this.minZoom(), (ZOOM_DEFAULT * height) / REF_HEIGHT);
    const f = frame(points, width, height, margins, this.minZoom(), closest);
    // Upright, a phone too narrow for every unit follows the playing one, and its shot.
    const active = this.activeUnit();
    const floor = Math.min(closest, width / PHONE_SPAN);
    if (!phone || !f || f.zoom >= floor || !active || v.turn.phase === 'placement') return f;
    const [ax, ay] = this.pos(`u${active.id}`, alpha, active.x, active.y);
    const near: Point[] = [{ x: ax, y: ay }];
    const last = points[points.length - 1];
    if ((shot || pig || swarm) && last) near.push(last);
    return frame(near, width, height, margins, floor, closest);
  }

  private zoomTo(zoom: number): void {
    const max = Math.max(this.minZoom(), (ZOOM_MAX * this.scale.height) / REF_HEIGHT);
    this.cameras.main.setZoom(Phaser.Math.Clamp(zoom, this.minZoom(), max));
  }

  /** « Vue par défaut »: the camera goes back to framing every unit. */
  private resetView(): void {
    this.manualCamera = false;
  }

  /**
   * New match on the same map with the same setup and the next seed; `custom`: the player's
   * settings were just applied, so the scheme becomes « Personnalisé ».
   */
  private restart(overrides: TuningOverrides, custom = false): void {
    if (this.online) {
      this.leaveOnline(true);
      return;
    }
    const setup: MatchSetup = custom ? { ...this.data_.setup, scheme: 'custom' } : this.data_.setup;
    if (custom) saveSetup(setup);
    this.startMatch(setup, overrides);
  }

  private startMatch(setup: MatchSetup, overrides: TuningOverrides): void {
    clearSave();
    const seed = (this.data_.seed + 0x9e3779b9) >>> 0;
    // Each match draws its map anew, from the chosen theme and its own seed.
    const built = buildMap(setup.map, seed);
    const data: BattleData = {
      ...battleMap(built),
      rules: rulesFor(setup, overrides),
      setup,
      seed,
    };
    this.scene.restart(data);
  }

  /** « Revoir la partie »: the match played so far (or the one being watched), from its start. */
  private watchReplay(): void {
    const log = this.watchLog ?? this.saver.logAt(this.sim.view().tick);
    this.scene.restart({ ...this.data_, replay: log } satisfies BattleData);
  }

  /** The title screen, over the paused match: back to it, a new match, or one to join. */
  private showTitle(): void {
    this.paused = true;
    showTitleScreen({
      resume: () => (this.paused = false),
      enter: () => this.newMatch(),
      join: () => {
        if (this.online) leaveMatch(this.online, true);
        this.online = null;
        this.remote = null;
        joinFlow(
          (m) => {
            this.scene.restart(onlineBattle(m));
          },
          () => this.showTitle(),
        );
      },
    });
  }

  /** The setup screen, over the paused match: a new match as chosen, or back to this one. */
  private newMatch(): void {
    this.paused = true;
    if (this.online) {
      // Leaving the match in the middle: the other player is told.
      leaveMatch(this.online, this.sim.view().turn.phase !== 'gameOver');
      this.online = null;
      this.remote = null;
    }
    const back = (): void => this.newMatch();
    const play = (m: OnlineMatch): void => {
      this.scene.restart(onlineBattle(m));
    };
    showSetupScreen(
      this.data_.setup,
      (setup) => {
        saveSetup(setup);
        this.startMatch(setup, loadOverrides());
      },
      () => (this.paused = false),
      {
        host: (setup) => {
          saveSetup(setup);
          const seed = (this.data_.seed + 0x9e3779b9) >>> 0;
          hostFlow(setup, rulesFor(setup, loadOverrides()), seed, play, back);
        },
        join: () => joinFlow(play, back),
      },
    );
  }

  /** Fond diapré (ASSETS §1.1): lozenges on vellum, faint enough to keep the play readable. */
  private diaperTexture(): string {
    // Fond d'or (ASSETS §1.1): burnished gold leaf, tooled in lozenges with punched dots and a
    // small fleuron in each, lightly crazed. Kept pale so the figures read against it.
    const key = 'page_gold';
    if (this.textures.exists(key)) return key;
    const tex = this.textures.createCanvas(key, DIAPER, DIAPER);
    if (!tex) throw new Error('cannot create the page texture');
    const ctx = tex.getContext();
    const h = DIAPER / 2;
    const grad = ctx.createLinearGradient(0, 0, DIAPER, DIAPER);
    grad.addColorStop(0, css(COLORS.feuilleOr));
    grad.addColorStop(0.5, css(COLORS.feuilleOrOmbre));
    grad.addColorStop(1, css(COLORS.feuilleOr));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, DIAPER, DIAPER);
    // Craquelure of the leaf: a few fine broken lines.
    ctx.strokeStyle = cssAlpha(COLORS.poincon, 0.12);
    ctx.lineWidth = 1;
    for (const [x0, y0, x1, y1] of [
      [12, 30, 44, 38],
      [44, 38, 58, 22],
      [96, 110, 130, 104],
      [130, 104, 150, 126],
      [70, 140, 86, 158],
      [20, 96, 30, 120],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
    // Tooled lozenges: an incised line doubled by punched dots.
    ctx.strokeStyle = cssAlpha(COLORS.poincon, 0.45);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(h, 0);
    ctx.lineTo(DIAPER, h);
    ctx.lineTo(h, DIAPER);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = cssAlpha(COLORS.poincon, 0.4);
    for (let k = 0; k <= 16; k++) {
      const t = k / 16;
      for (const [x, y] of [
        [t * h, h - t * h + 7],
        [h + t * h, t * h + 7],
        [t * h, h + t * h - 7],
        [h + t * h, DIAPER - t * h - 7],
      ] as const) {
        ctx.beginPath();
        ctx.arc(x, y, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // A punched fleuron in each lozenge: four petals and a centre.
    const fleuron = (x: number, y: number): void => {
      ctx.fillStyle = cssAlpha(COLORS.poincon, 0.35);
      for (const [dx, dy] of [
        [0, -7],
        [7, 0],
        [0, 7],
        [-7, 0],
      ] as const) {
        ctx.beginPath();
        ctx.ellipse(x + dx, y + dy, dx === 0 ? 3 : 5, dx === 0 ? 5 : 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = cssAlpha(COLORS.ceruse, 0.6);
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    };
    fleuron(h, h);
    for (const [x, y] of [
      [0, 0],
      [DIAPER, 0],
      [0, DIAPER],
      [DIAPER, DIAPER],
    ] as const) {
      fleuron(x, y);
    }
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
    // Online, they stop it for both players.
    const ls = this.online?.lockstep;
    ls?.setPaused(this.ui.blocking);
    const stopped = this.paused || this.ui.blocking || ls?.remotePaused === true;
    if (stopped) {
      if (this.stepOnce && !this.ui.blocking && !this.online) this.tick();
      this.stepOnce = false;
      this.clock.reset();
    } else {
      for (let n = this.clock.advance(delta) * this.speed; n > 0; n--) {
        if (!this.tick()) break;
      }
    }
    const alpha = stopped ? 1 : this.clock.alpha;
    this.updateOnline(time);

    const click = this.input_.takeClick();
    if (click) this.selectAt(click.x, click.y);
    this.ui.strikeRefused = this.sim.strikeRefused();
    this.ui.update(this.sim.view(), this.input_.controls.power, time);
    this.ui.showResetView(this.manualCamera);
    this.updateBubble();
    this.updateTip();
    if (this.selectedUnit !== null) {
      // The card goes to the half of the screen the unit is not in.
      const u = this.sim.view().units.find((x) => x.id === this.selectedUnit);
      const cam = this.cameras.main;
      if (u) this.ui.setCardSide(u.x / SUBPX > cam.worldView.centerX ? 'left' : 'right');
    }

    const v = this.sim.view();
    if (v.turn.phase !== 'gameOver' && !this.watch) this.saver.flush(v.tick, time);
    this.scenery.update(delta, v.turn.wind, v.terrain);
    this.terrain.flush();
    this.updateCamera(alpha, delta);
    this.drawWorld(alpha, time, delta);
    this.drawBurn(time);
    this.drawWater(time, delta);
    this.drawWeather(time);
    this.scenery.setStorm(v.rain > 0);
    if (this.debug) this.drawDebug();
    else {
      this.debugGfx.clear();
      this.debugText.setText('');
    }
  }

  /** Online: who is waited for, a desync, the other player gone (TECH_SPEC §8.4). */
  private updateOnline(time: number): void {
    const online = this.online;
    if (!online) return;
    const ls = online.lockstep;
    const over = this.sim.view().turn.phase === 'gameOver';
    if (!this.netShown && ls.desyncTurn !== null) {
      this.netShown = true;
      this.ui.showNetError(t('online.desync', { turn: ls.desyncTurn }), () =>
        this.leaveOnline(false),
      );
    } else if (!this.netShown && ls.remoteResigned && !over) {
      this.netShown = true;
      this.ui.showNetError(t('online.resigned'), () => this.leaveOnline(false));
    }
    const waiting = this.stalledSince !== null && time - this.stalledSince > 1500;
    this.ui.setNetStatus(
      ls.remotePaused
        ? t('online.paused')
        : waiting
          ? t(online.transport.otherOnline ? 'online.waitingPeer' : 'online.peerAway')
          : null,
    );
  }

  /** Leaves the online match (telling the other player when `resign`) for the setup screen. */
  private leaveOnline(resign: boolean): void {
    if (this.online) leaveMatch(this.online, resign);
    this.online = null;
    this.remote = null;
    this.newMatch();
  }

  /**
   * Keeps the object bubble over its object, and closes it once the object is gone. With a
   * mouse, a unit under the pointer gets a bubble with its class and HP.
   */
  private updateBubble(): void {
    const v = this.sim.view();
    let info = this.infoRef ? objectInfo(v, this.infoRef) : null;
    if (!this.infoRef) {
      const p = this.input.activePointer;
      if (!p.wasTouch && p.x > 0 && p.y > 0) {
        const at = this.cameras.main.getWorldPoint(p.x, p.y);
        const hover = this.unitAt(at.x, at.y);
        if (hover) info = unitInfo(v, hover.id, LABEL_REACH + (this.labelLift.get(hover.id) ?? 0));
        else {
          // A tombstone says who lies there, and for which house.
          const grave = graveAt(v, at.x, at.y, 4 / this.cameras.main.zoom);
          if (grave) info = objectInfo(v, grave);
        }
      }
    }
    if (!info) {
      this.infoRef = null;
      this.ui.showBubble(null, 0, 0);
      return;
    }
    const cam = this.cameras.main;
    const sx = (info.x - cam.worldView.x) * cam.zoom;
    const sy = (info.y - cam.worldView.y) * cam.zoom;
    this.ui.showBubble(info, sx, sy);
  }

  /** Shows the card of the unit under a click (figure or name label), or hides it. */
  private selectAt(x: number, y: number): void {
    // During the placement, a click puts the house's next unit down on that column.
    if (this.sim.view().turn.phase === 'placement') {
      this.input_.ui.place = x;
      return;
    }
    // A stone wall or a trebuchet volley in hand: the click says where it goes.
    if (this.targeting()) {
      this.input_.ui.target = { x, y };
      return;
    }
    const hit = this.unitAt(x, y);
    this.selectedUnit = hit?.id ?? null;
    this.ui.selectUnit(this.selectedUnit);
    // No unit there: a barrel, a reliquary, the kitchen, a beast or a pot gets its bubble.
    const slop = 10 / this.cameras.main.zoom;
    this.infoRef = hit ? null : objectAt(this.sim.view(), x, y, slop);
    // A click on one of the playing team's units hands it the turn (the sim decides if allowed).
    const v = this.sim.view();
    if (hit && hit.team === v.turn.activeTeam && hit.id !== v.turn.activeUnitId) {
      this.input_.ui.selectUnit = hit.id;
      // It cannot take the turn: a tiny bubble over it says why, at once.
      const choosing = v.turn.phase === 'transition' || v.turn.phase === 'action';
      const key =
        hit.id === v.turn.restingUnitId
          ? 'tip.resting'
          : choosing && v.rules.turn.freeSelect && !canSwitchUnit(v)
            ? 'tip.tooLate'
            : null;
      this.tip = key && choosing ? { unitId: hit.id, key, until: this.time.now + TIP_MS } : null;
    } else this.tip = null;
  }

  /** Keeps the tiny help bubble over its unit while it lasts. */
  private updateTip(): void {
    const tip = this.tip;
    const u = tip ? this.sim.view().units.find((x) => x.id === tip.unitId) : undefined;
    if (!tip || !u?.alive || this.time.now > tip.until) {
      this.tip = null;
      this.ui.showTip(null, 0, 0);
      return;
    }
    const cam = this.cameras.main;
    const [x, y] = this.pos(`u${u.id}`, 1, u.x, u.y);
    const sx = (x - cam.worldView.x) * cam.zoom;
    const sy = (y - UNIT_HEIGHT - LABEL_REACH - cam.worldView.y) * cam.zoom;
    this.ui.showTip(t(tip.key), sx, sy);
  }

  /** The weapon in hand is aimed at a point of the map, and the turn can still use it. */
  private targeting(): WeaponDef | null {
    const v = this.sim.view();
    if (v.turn.phase !== 'action') return null;
    const def = v.rules.weapons.find((w) => w.id === v.turn.weapon);
    const ammo = v.teams[v.turn.activeTeam]?.ammo[v.rules.weapons.findIndex((w) => w === def)];
    return def && isTargeted(def) && ammo !== 0 ? def : null;
  }

  /**
   * The living unit under world point (x, y): its name label first (raised when it would cover
   * another one, so each of two units standing together can be picked by its label), else its
   * figure.
   */
  private unitAt(x: number, y: number): Readonly<Unit> | undefined {
    const units = this.sim.view().units.filter((u) => u.alive);
    const byLabel = units.find((u) => {
      const bottom = u.y / SUBPX - UNIT_HEIGHT - 18 - (this.labelLift.get(u.id) ?? 0);
      return (
        Math.abs(x - u.x / SUBPX) <= LABEL_HALF_WIDTH &&
        y <= bottom + 6 &&
        y >= bottom - LABEL_STACK
      );
    });
    return (
      byLabel ??
      units.find(
        (u) =>
          Math.abs(x - u.x / SUBPX) <= UNIT_HALF_WIDTH + 8 &&
          y <= u.y / SUBPX + 8 &&
          y >= u.y / SUBPX - UNIT_HEIGHT - 18,
      )
    );
  }

  /**
   * Raises the labels of units standing together so that none covers another: the first keeps
   * its place, the next one goes up a label's height, and so on; the playing unit's comes last,
   * on top, its pointer above it all.
   */
  private stackLabels(alpha: number): void {
    this.labelLift.clear();
    const placed: { x: number; bottom: number }[] = [];
    const v = this.sim.view();
    const active = v.turn.activeUnitId;
    const order = [
      ...v.units.filter((u) => u.id !== active),
      ...v.units.filter((u) => u.id === active),
    ];
    for (const u of order) {
      if (!u.alive) continue;
      const [x, y] = this.pos(`u${u.id}`, alpha, u.x, u.y);
      const base = y - UNIT_HEIGHT - 18;
      let lift = 0;
      for (let k = 0; k < 6; k++) {
        const bottom = base - lift;
        const clash = placed.some(
          (p) => Math.abs(p.x - x) < LABEL_APART && Math.abs(p.bottom - bottom) < LABEL_STACK,
        );
        if (!clash) break;
        lift += LABEL_STACK;
      }
      placed.push({ x, bottom: base - lift });
      if (lift > 0) this.labelLift.set(u.id, lift);
    }
  }

  /** Plays one tick; false when an online match waits for the other player's commands. */
  private tick(): boolean {
    const view = this.sim.view();
    if (this.online && this.remote) {
      const next = view.tick + 1;
      if (!this.remote.ready(next)) {
        this.stalledSince ??= this.time.now;
        return false;
      }
      this.stalledSince = null;
      this.snapshotPositions();
      this.playOnline(next, true);
      return true;
    }
    this.snapshotPositions();
    if (this.watch) {
      // Watching: the recorded commands, and nothing past the end of the log.
      if (this.watch.done(view.tick)) return false;
      this.handleEvents(this.sim.step(this.watch.poll(view.tick + 1)));
      return true;
    }
    // The player's hands are read every tick, but only count on the player's own turns.
    const local = this.input_.poll(view.tick + 1, view);
    const cmds = this.ai?.plays(view) ? this.ai.poll(view.tick + 1, view) : local;
    this.saver.record(view.tick + 1, cmds, this.time.now);
    const events = this.sim.step(cmds);
    if (events.some((e) => e.e === 'gameOver')) clearSave();
    this.handleEvents(events);
    return true;
  }

  /**
   * Online: plays tick `next` with the lockstep's commands, compares the turn hashes, then
   * decides the commands of the tick this peer owns, from its player (`live`) or none (catching
   * up after a reload).
   */
  private playOnline(next: number, live: boolean): void {
    const online = this.online;
    const remote = this.remote;
    if (!online || !remote) return;
    const cmds = remote.poll(next);
    this.saver.record(next, cmds, this.time.now);
    const events = this.sim.step(cmds);
    for (const e of events) {
      if (e.e === 'turnStarted') online.lockstep.turnStarted(e.turn, this.sim.hash());
    }
    online.lockstep.produceAfter(this.sim.view(), (t) =>
      live ? this.input_.poll(t, this.sim.view()) : [],
    );
    if (events.some((e) => e.e === 'gameOver')) leaveMatch(online, false);
    if (live) this.handleEvents(events);
  }

  /**
   * The houses this device's player plays: online the creator's or the other's; otherwise all
   * but the AI's.
   */
  private mine(team: number): boolean {
    if (this.online) return roleOfTeam(team) === this.online.role;
    return !aiHouses(this.data_.setup).has(team) || this.replaying;
  }

  private handleEvents(events: readonly SimEvent[]): void {
    for (const e of events) {
      if (e.e === 'terrainCarved') this.terrain.invalidate(e.x, e.y, e.radius);
      if (e.e === 'terrainChanged') {
        const half = Math.ceil(Math.max(e.w, e.h) / 2);
        this.terrain.invalidate(e.x + Math.floor(e.w / 2), e.y + Math.floor(e.h / 2), half);
      }
      if (e.e === 'structureFell') this.cameras.main.shake(400, 0.01);
      if (e.e === 'lightning') {
        this.bolts.push({ x: e.x, y: e.y, born: this.time.now });
        this.cameras.main.flash(350, 255, 250, 235);
        // A second, weaker flash as the bolt strikes again (drawBolts flickers with it).
        this.time.delayedCall(BOLT_RESTRIKE_MS, () => this.cameras.main.flash(250, 255, 250, 235));
        this.cameras.main.shake(260, 0.008);
      }
      if (e.e === 'turnStarted' || e.e === 'shotFired') this.manualCamera = false;
      if (e.e === 'teleported') {
        // No sliding across the map: the unit is simply elsewhere.
        this.interp.delete(`u${e.unitId}`);
        const now = this.time.now;
        this.halos.push({ x: e.fromX, y: e.fromY, radius: 40, born: now });
        this.halos.push({ x: e.x, y: e.y, radius: 40, born: now });
      }
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
    for (const c of v.crates) put(`c${c.id}`, c.x, c.y);
    for (const w of v.walkers) put(`w${w.id}`, w.x, w.y);
    for (const w of v.swarms) put(`b${w.id}`, w.x, w.y);
    if (v.dragon) put(`d${v.dragon.id}`, v.dragon.x, v.dragon.y);
    if (v.unicorn) put(`n${v.unicorn.id}`, v.unicorn.x, v.unicorn.y);
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

  private drawWorld(alpha: number, time: number, delta: number): void {
    const g = this.world;
    g.clear();
    const v = this.sim.view();
    const turn = v.turn;

    this.drawKitchen(g, time);
    this.drawBarrels(g);
    this.drawCrates(alpha, time);
    this.drawBeast(g, delta, time);
    this.drawDragon(alpha, time);
    this.drawUnicorn(alpha, time);
    this.drawBeam(g, alpha, time);
    this.drawTowerFires(g, time);
    this.drawRope(g, alpha);
    this.drawPots(g, time);
    this.drawMines(g, time);
    this.drawFlames(g, time);
    this.drawStructures(g);
    this.drawPlacementGhost(g, time);
    this.stackLabels(alpha);
    for (const u of v.units) {
      const label = this.labelFor(u.id);
      const lift = this.labelLift.get(u.id) ?? 0;
      const [x, y] = this.pos(`u${u.id}`, alpha, u.x, u.y);
      if (!u.alive) {
        label?.setVisible(false);
        this.drawGrave(g, x, y, FACTIONS[u.team]?.primary ?? COLORS.roche);
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
      const cls = classOf(v, u);
      drawFigure(g, x, y, u.facing, primary, secondary, cls, isActive, time);
      drawClassMark(g, cls, x, y, u.facing);
      this.drawGear(g, v, u, x, y, primary, secondary);

      if (label) {
        // A small phylactery with the name and a thin life bar under it; the figures are in the
        // card (click) and in the bubble shown on hover.
        const bottom = y - UNIT_HEIGHT - 18 - lift;
        label.setVisible(true);
        label.setPosition(x, bottom);
        if (label.text !== unitName(u.id)) label.setText(unitName(u.id));
        label.setColor(css(faction?.ink ?? primary));
        this.drawScroll(g, x, bottom, label.width, label.height, isActive);
        this.drawLifeBar(g, x, bottom + 2, u.hp / maxHpOf(v, u), primary);
        this.drawAfflictions(g, u.id, x, bottom - label.height - 8);
      }
      if (isActive) {
        // Bobbing pointer above the name: who plays is never in doubt.
        const top =
          y - UNIT_HEIGHT - 18 - lift - (label?.height ?? 28) - 12 + Math.sin(time / 180) * 7;
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
        if (turn.phase === 'action') this.drawPreview(g, u);
      }
    }

    for (const s of v.shots) {
      const p = s.projectile;
      const [x, y] = this.pos(`s${p.id}`, alpha, p.x, p.y);
      const speed = Math.hypot(p.vx, p.vy) || 1;
      const dx = p.vx / speed;
      const dy = p.vy / speed;
      if (s.fragment) {
        // A drop of burning pitch.
        g.fillStyle(COLORS.or, 0.9);
        g.fillCircle(x - dx * 4, y - dy * 4, 4);
        g.fillStyle(COLORS.encre, 1);
        g.fillCircle(x, y, 3);
        continue;
      }
      if (s.weapon === 'falcon') {
        this.drawFalcon(g, x, y, dx, dy, time);
        continue;
      }
      if (s.weapon === 'beehive') {
        // A skep of straw, coiled.
        g.fillStyle(COLORS.ocre, 1);
        g.lineStyle(3, COLORS.encre, 1);
        g.fillEllipse(x, y, 16, 20);
        g.strokeEllipse(x, y, 16, 20);
        g.lineStyle(1.5, COLORS.encre, 1);
        for (const k of [-4, 1, 6]) g.lineBetween(x - 7, y + k, x + 7, y + k);
        continue;
      }
      if (
        s.weapon === 'bow' ||
        s.weapon === 'crossbow' ||
        s.weapon === 'fireArrow' ||
        s.weapon === 'arrowRain'
      ) {
        if (s.weapon === 'fireArrow') {
          // Its burning head, flickering.
          const flicker = 1 + Math.sin(time / 40) * 0.25;
          g.fillStyle(COLORS.or, 0.9);
          g.fillCircle(x - dx * 4, y - dy * 4 - 2, 7 * flicker);
          g.fillStyle(COLORS.vermillon, 1);
          g.fillCircle(x - dx * 2, y - dy * 2 - 2, 4 * flicker);
        }
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
        const fire = s.weapon === 'greekFire' || s.weapon === 'pitchPot';
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

    this.drawWalkers(g, alpha, time);
    this.drawSwarms(g, alpha, time);
    this.drawBursts(g, time);
    this.drawHalos(g, time);
  }

  /** The falcon, wings beating, along its flight. */
  private drawFalcon(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    dx: number,
    dy: number,
    time: number,
  ): void {
    const beat = Math.sin(time / 45) * 12;
    // Across the flight: the wings.
    const ax = -dy;
    const ay = dx;
    g.fillStyle(COLORS.terreOmbre, 1);
    g.lineStyle(2.5, COLORS.encre, 1);
    const wing = (side: number): Phaser.Math.Vector2[] =>
      poly([
        { x: x - dx * 4, y: y - dy * 4 },
        {
          x: x + ax * side * 22 - dx * 10,
          y: y + ay * side * 22 - dy * 10 + beat * side * 0.3 - Math.abs(beat),
        },
        { x: x + dx * 4, y: y + dy * 4 },
      ]);
    for (const side of [-1, 1]) {
      g.fillPoints(wing(side), true);
      g.strokePoints(wing(side), true);
    }
    g.fillStyle(COLORS.ocre, 1);
    g.fillEllipse(x, y, 14, 10);
    g.strokeEllipse(x, y, 14, 10);
    g.fillStyle(COLORS.or, 1);
    g.fillTriangle(
      x + dx * 10,
      y + dy * 10,
      x + dx * 5 - dy * 3,
      y + dy * 5 + dx * 3,
      x + dx * 5 + dy * 3,
      y + dy * 5 - dx * 3,
    );
  }

  /** Swarms of bees: a buzzing cloud of gilt specks. */
  private drawSwarms(g: Phaser.GameObjects.Graphics, alpha: number, time: number): void {
    for (const w of this.sim.view().swarms) {
      const [x, y] = this.pos(`b${w.id}`, alpha, w.x, w.y);
      for (let i = 0; i < 14; i++) {
        const a = time / (90 + i * 7) + i * 2.4;
        const r = 6 + ((i * 7) % 16);
        const bx = x + Math.cos(a) * r;
        const by = y + Math.sin(a * 1.3) * r * 0.7;
        g.fillStyle(COLORS.or, 1);
        g.fillEllipse(bx, by, 6, 4);
        g.fillStyle(COLORS.encre, 1);
        g.fillRect(bx - 0.5, by - 2, 1.5, 4);
      }
    }
  }

  /** Flaming pigs: a pink pig trotting, its back on fire. */
  private drawWalkers(g: Phaser.GameObjects.Graphics, alpha: number, time: number): void {
    for (const w of this.sim.view().walkers) {
      const [x, y] = this.pos(`w${w.id}`, alpha, w.x, w.y);
      const d = w.dir;
      const step = w.grounded ? Math.sin(time / 50) * 4 : 0;
      // Legs, two by two, trotting.
      g.lineStyle(4, COLORS.encre, 1);
      for (const [lx, phase] of [
        [-8, 1],
        [8, -1],
      ] as const) {
        g.lineBetween(x + lx * d, y - 8, x + lx * d + step * phase, y);
      }
      g.fillStyle(COLORS.roseGarance, 1);
      g.lineStyle(3, COLORS.encre, 1);
      g.fillEllipse(x, y - 13, 30, 18);
      g.strokeEllipse(x, y - 13, 30, 18);
      g.fillCircle(x + d * 15, y - 17, 7);
      g.strokeCircle(x + d * 15, y - 17, 7);
      g.fillStyle(COLORS.carnation, 1);
      g.fillEllipse(x + d * 21, y - 16, 5, 6);
      g.fillStyle(COLORS.encre, 1);
      g.fillCircle(x + d * 15, y - 19, 1.5);
      // The fire on its back.
      const flicker = 1 + Math.sin(time / 35 + w.id) * 0.25;
      g.fillStyle(COLORS.vermillon, 0.95);
      g.fillTriangle(x - 10, y - 20, x + 6, y - 20, x - 4 * d, y - 20 - 22 * flicker);
      g.fillStyle(COLORS.or, 0.95);
      g.fillTriangle(x - 6, y - 20, x + 3, y - 20, x - 2 * d, y - 20 - 13 * flicker);
    }
  }

  /** The miracle: a beam of gilt light where the unit vanished and where it stands now. */
  private drawHalos(g: Phaser.GameObjects.Graphics, time: number): void {
    this.halos = this.halos.filter((h) => time - h.born < HALO_MS);
    for (const h of this.halos) {
      const k = (time - h.born) / HALO_MS;
      const a = 1 - k;
      g.fillStyle(COLORS.or, 0.35 * a);
      g.fillRect(h.x - h.radius, h.y - 900, h.radius * 2, 900);
      g.fillStyle(COLORS.ceruse, 0.5 * a);
      g.fillRect(h.x - h.radius / 3, h.y - 900, (h.radius * 2) / 3, 900);
      g.lineStyle(3, COLORS.or, a);
      g.strokeEllipse(h.x, h.y - UNIT_HEIGHT - 14, 40 + 30 * k, 12 + 6 * k);
    }
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

  /**
   * Structures (GDD §4.7): ink cracks over a damaged one (more for a ruin), and the falling
   * blocks of a collapse, as masonry squares.
   */
  private drawStructures(g: Phaser.GameObjects.Graphics): void {
    const v = this.sim.view();
    for (const st of v.structures) {
      if (st.state !== StructureState.Cracked && st.state !== StructureState.Ruin) continue;
      const [rx, ry, rw, rh] = st.rect;
      const cracks = st.state === StructureState.Ruin ? 7 : 3;
      g.lineStyle(2.5, COLORS.encre, 0.8);
      for (let k = 0; k < cracks; k++) {
        // A fixed zigzag per crack, from the structure's id: cosmetic, stable from frame to frame.
        const seed = st.id * 97 + k * 31;
        let x = rx + 10 + ((seed * 13) % Math.max(1, rw - 20));
        let y = ry + 30 + ((seed * 7) % Math.max(1, rh - 60));
        g.beginPath();
        g.moveTo(x, y);
        for (let j = 0; j < 5; j++) {
          x += ((seed + j * 5) % 3) * 6 - 6;
          y += 9 + ((seed + j) % 4) * 3;
          g.lineTo(x, y);
        }
        g.strokePath();
      }
    }
    for (const b of v.blocks) {
      const x = b.x / SUBPX;
      const y = b.y / SUBPX;
      g.fillStyle(COLORS.ceruse, 1);
      g.fillRect(x, y, b.w, b.h);
      g.lineStyle(2, COLORS.encre, 1);
      g.strokeRect(x, y, b.w, b.h);
      g.lineStyle(1, COLORS.encre, 0.5);
      g.lineBetween(x, y + b.h / 2, x + b.w, y + b.h / 2);
      g.lineBetween(x + b.w / 2, y, x + b.w / 2, y + b.h / 2);
    }
  }

  /** Greek fire burning on the ground: tongues of vermilion and gold, flickering. */
  private drawFlames(g: Phaser.GameObjects.Graphics, time: number): void {
    for (const f of this.sim.view().flames) {
      const x = f.x / SUBPX;
      const y = f.y / SUBPX;
      const k = Math.sin(time / 90 + f.id * 1.7);
      const h = 22 + 6 * k;
      g.fillStyle(COLORS.vermillon, 0.95);
      g.lineStyle(2, COLORS.encre, 0.9);
      g.fillTriangle(x - 9, y, x + 9, y, x + 3 * k, y - h);
      g.strokeTriangle(x - 9, y, x + 9, y, x + 3 * k, y - h);
      g.fillStyle(COLORS.or, 1);
      g.fillTriangle(x - 5, y, x + 5, y, x - 2 * k, y - h * 0.6);
      g.fillStyle(COLORS.vermillon, 0.9);
      g.fillTriangle(x + 6, y, x + 13, y, x + 11 - 2 * k, y - h * 0.5);
    }
  }

  /**
   * The water of the Déluge: ultramarine bands with curling wave crests, as the manuscript draws
   * the Flood; it rises slowly to the sim's level.
   */
  private drawWater(time: number, delta: number): void {
    const g = this.waterGfx;
    g.clear();
    const { map } = this.data_;
    const target = this.sim.view().waterY;
    if (target >= map.height && this.waterShown >= map.height) return;
    this.waterShown += (target - this.waterShown) * Math.min(1, delta / 600);
    const top = this.waterShown;
    g.fillStyle(COLORS.lapis, 0.88);
    g.fillRect(0, top + 6, map.width, map.height - top);
    // Paler bands lower down, like the strokes of a brush.
    g.lineStyle(3, COLORS.azur, 0.6);
    for (let y = top + 28; y < map.height; y += 30) {
      g.beginPath();
      for (let x = 0; x <= map.width; x += 40) {
        const yy = y + Math.sin(x / 70 + time / 700 + y) * 4;
        if (x === 0) g.moveTo(x, yy);
        else g.lineTo(x, yy);
      }
      g.strokePath();
    }
    // Crests: a row of curls rolling over, outlined in ink, with a white lip.
    for (let x = -40; x <= map.width + 40; x += 48) {
      const cx = x + ((time / 40) % 48);
      const cy = top + 6 + Math.sin(cx / 90 + time / 500) * 3;
      g.fillStyle(COLORS.azur, 1);
      g.fillCircle(cx, cy, 12);
      g.lineStyle(2, COLORS.encre, 0.9);
      g.beginPath();
      g.arc(cx, cy, 12, Math.PI, Math.PI * 1.9);
      g.strokePath();
      g.lineStyle(2, COLORS.ceruse, 0.9);
      g.beginPath();
      g.arc(cx + 2, cy + 1, 6, Math.PI * 1.1, Math.PI * 2.2);
      g.strokePath();
    }
  }

  /**
   * Rain while it rains: slanted strokes of azure across the view, leaning with the wind; and the
   * lightning bolts, a jagged gold and white stroke from the sky to where they struck. Cosmetic:
   * the drops move with the clock, the bolts' zigzags come from their position.
   */
  private drawWeather(time: number): void {
    const g = this.weatherGfx;
    g.clear();
    const v = this.sim.view();
    const view = this.cameras.main.worldView;
    if (v.rain > 0) {
      const lean = v.turn.wind * 1.6;
      g.lineStyle(2, COLORS.azur, 0.55);
      const cell = 90;
      const fall = (time * 0.9) % cell;
      for (let gx = Math.floor(view.x / cell) - 1; gx * cell < view.right + cell; gx++) {
        for (let gy = Math.floor(view.y / cell) - 1; gy * cell < view.bottom + cell; gy++) {
          // Two drops per cell, offset by a fixed hash of the cell.
          for (let k = 0; k < 2; k++) {
            const h = ((gx * 73856093) ^ (gy * 19349663) ^ (k * 83492791)) >>> 0;
            const x = gx * cell + (h % cell) + (fall * lean) / 20;
            const y = gy * cell + ((h >> 8) % cell) + fall;
            g.lineBetween(x, y, x + lean, y + 22);
          }
        }
      }
    }
    this.bolts = this.bolts.filter((b) => time - b.born < BOLT_MS);
    for (const b of this.bolts) {
      // Full for a while, a flicker as it strikes again, then it fades.
      const age = time - b.born;
      const k =
        age < BOLT_RESTRIKE_MS && age > BOLT_RESTRIKE_MS - 90
          ? 0.3
          : age < BOLT_HOLD_MS
            ? 1
            : 1 - (age - BOLT_HOLD_MS) / (BOLT_MS - BOLT_HOLD_MS);
      const pts: Phaser.Math.Vector2[] = [];
      const top = view.y - 40;
      const steps = 9;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const jitter = i === 0 || i === steps ? 0 : Math.sin(b.x * 0.37 + i * 2.1) * 34;
        pts.push(new Phaser.Math.Vector2(b.x + jitter, top + (b.y - top) * t));
      }
      g.lineStyle(12, COLORS.encre, k);
      g.strokePoints(pts);
      g.lineStyle(7, COLORS.or, k);
      g.strokePoints(pts);
      g.lineStyle(3, COLORS.ceruse, k);
      g.strokePoints(pts);
    }
  }

  /**
   * The dragon (GDD §4.11): it flaps across (the sim makes it climb and sink); it swoops head first on its prey,
   * and climbs away once fed.
   */
  private drawDragon(alpha: number, time: number): void {
    const d = this.sim.view().dragon;
    const img = this.dragonImg;
    if (!d) {
      img.setVisible(false);
      return;
    }
    const [x, y] = this.pos(`d${d.id}`, alpha, d.x, d.y);
    const e = this.interp.get(`d${d.id}`);
    const vx = e ? e.cx - e.px : d.dir;
    const vy = e ? e.cy - e.py : 0;
    const flying = d.prey === 0 && !d.fed;
    // Wings up, level, down, level.
    const beat = Math.floor(time / (d.prey !== 0 ? DRAGON_FLAP / 2 : DRAGON_FLAP)) % 4;
    img
      .setVisible(true)
      .setTexture(dragonTexture(dragonColours(d.id), beat === 0 ? 0 : beat === 2 ? 2 : 1))
      .setFlipX(d.dir < 0)
      .setPosition(x, y)
      .setRotation(
        flying ? 0 : Math.max(-1.2, Math.min(1.2, Math.atan2(vy, Math.abs(vx) || 1) * d.dir)),
      );
  }

  /** The rope a unit goes up or down a wall on, from the edge of the wall to its hands. */
  private drawRope(g: Phaser.GameObjects.Graphics, alpha: number): void {
    const v = this.sim.view();
    const rope = v.turn.rope;
    const u = v.units.find((x) => x.id === v.turn.activeUnitId);
    if (!rope || !u) return;
    const [x, y] = this.pos(`u${u.id}`, alpha, u.x, u.y);
    // Tied at the top: the target's row going up, the unit's start going down.
    const top = Math.min(rope.y, y);
    const edge = x + (rope.x - x) * 0.5;
    g.lineStyle(3, COLORS.terreOmbre, 1);
    g.lineBetween(edge, top, x, y - UNIT_HEIGHT * 0.6);
  }

  /** Burning wooden towers: flames dancing along their top, higher as the fire goes on. */
  private drawTowerFires(g: Phaser.GameObjects.Graphics, time: number): void {
    const v = this.sim.view();
    const t = v.terrain;
    for (const st of v.structures) {
      if (st.fire === undefined) continue;
      const [rx, ry, rw, rh] = st.rect;
      const cx = Math.round(rx + rw / 2);
      let top = ry;
      while (top < ry + rh && (t.data[top * t.width + cx] ?? 0) === 0) top++;
      for (let x = rx + 8; x < rx + rw - 4; x += 14) {
        const h = 22 + 10 * Math.sin(time / 110 + x * 0.7);
        g.fillStyle(COLORS.vermillon, 0.9);
        g.fillTriangle(x - 8, top + 4, x + 8, top + 4, x, top - h);
        g.fillStyle(COLORS.or, 0.95);
        g.fillTriangle(x - 4, top + 4, x + 4, top + 4, x, top - h * 0.55);
      }
    }
  }

  /** The beam of light an angel lifts a unit in (GDD §4.5), shimmering up to the sky. */
  private drawBeam(g: Phaser.GameObjects.Graphics, alpha: number, time: number): void {
    const lift = this.sim.view().lift;
    const u = lift ? this.sim.view().units.find((x) => x.id === lift.unitId) : undefined;
    if (!u) return;
    const [x, y] = this.pos(`u${u.id}`, alpha, u.x, u.y);
    const shimmer = 0.18 + 0.08 * Math.sin(time / 90);
    for (const [w, a] of [
      [70, shimmer],
      [40, shimmer + 0.12],
      [14, shimmer + 0.25],
    ] as const) {
      g.fillStyle(COLORS.feuilleOr, a);
      g.fillRect(x - w / 2, -SKY_EXTRA, w, y + SKY_EXTRA + 6);
    }
  }

  /** The unicorn (GDD §4.12), galloping along the ground. */
  private drawUnicorn(alpha: number, time: number): void {
    const u = this.sim.view().unicorn;
    const img = this.unicornImg;
    if (!u) {
      img.setVisible(false);
      return;
    }
    const [x, y] = this.pos(`n${u.id}`, alpha, u.x, u.y);
    const frame = Math.floor(time / UNICORN_STRIDE) % 2;
    img
      .setVisible(true)
      .setTexture(`unicorn_${frame}`)
      .setFlipX(u.dir < 0)
      .setPosition(x, y - Math.abs(Math.sin((time * Math.PI) / UNICORN_STRIDE)) * UNICORN_HOP);
  }

  /**
   * The beast of the margins: a hare with long ears or a snail with a spiral shell. It moves
   * between turns in one go; the drawing hops (hare) or slides (snail) after it.
   */
  private drawBeast(g: Phaser.GameObjects.Graphics, delta: number, time: number): void {
    const b = this.sim.view().beast;
    if (!b) {
      this.beastShown = null;
      return;
    }
    const tx = b.x / SUBPX;
    const ty = b.y / SUBPX;
    const shown = this.beastShown ?? { x: tx, y: ty };
    const hare = b.kind === BeastKind.Hare;
    const k = Math.min(1, (delta / 1000) * (hare ? 3 : 0.8));
    shown.x += (tx - shown.x) * k;
    shown.y += (ty - shown.y) * k;
    this.beastShown = shown;
    const moving = Math.abs(tx - shown.x) > 2;
    const facing = tx >= shown.x ? 1 : -1;
    const x = shown.x;
    const hop = hare && moving ? Math.abs(Math.sin(time / 110)) * 18 : 0;
    const y = shown.y - hop;
    g.lineStyle(2, COLORS.encre, 1);
    if (hare) {
      g.fillStyle(COLORS.terreOmbre, 1);
      g.fillEllipse(x, y - 9, 26, 15);
      g.strokeEllipse(x, y - 9, 26, 15);
      g.fillEllipse(x + facing * 12, y - 16, 12, 10);
      g.strokeEllipse(x + facing * 12, y - 16, 12, 10);
      // Long ears, the pride of the margins.
      for (const dx of [8, 13]) {
        g.fillEllipse(x + facing * dx, y - 30, 5, 18);
        g.strokeEllipse(x + facing * dx, y - 30, 5, 18);
      }
      g.fillStyle(COLORS.ceruse, 1);
      g.fillCircle(x - facing * 13, y - 11, 4);
      g.fillStyle(COLORS.encre, 1);
      g.fillCircle(x + facing * 15, y - 18, 1.5);
    } else {
      g.fillStyle(COLORS.vertTendre, 1);
      g.fillEllipse(x + facing * 4, y - 4, 30, 8);
      g.strokeEllipse(x + facing * 4, y - 4, 30, 8);
      g.lineBetween(x + facing * 16, y - 6, x + facing * 20, y - 16);
      g.lineBetween(x + facing * 13, y - 6, x + facing * 14, y - 15);
      g.fillStyle(COLORS.ocre, 1);
      g.fillCircle(x - facing * 2, y - 14, 11);
      g.strokeCircle(x - facing * 2, y - 14, 11);
      g.beginPath();
      g.arc(x - facing * 2, y - 14, 6, 0, Math.PI * 1.5);
      g.strokePath();
      g.beginPath();
      g.arc(x - facing * 2, y - 14, 2.5, 0, Math.PI * 1.5);
      g.strokePath();
    }
  }

  /**
   * Name tag behind a unit's name: a small plain rectangle, gilt for the unit that plays.
   * (x, bottom) is the label's anchor, w × h its size.
   */
  private drawScroll(
    g: Phaser.GameObjects.Graphics,
    x: number,
    bottom: number,
    w: number,
    h: number,
    gilt: boolean,
  ): void {
    g.fillStyle(gilt ? COLORS.or : COLORS.ceruse, gilt ? 0.95 : 0.8);
    g.fillRect(x - w / 2, bottom - h, w, h);
    g.lineStyle(1, COLORS.encre, 0.5);
    g.strokeRect(x - w / 2, bottom - h, w, h);
  }

  /** A thin life bar in the house's colour, centred on x, its top at y; ratio 0..1. */
  private drawLifeBar(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    ratio: number,
    colour: number,
  ): void {
    const w = 36;
    const h = 4;
    const r = Math.max(0, Math.min(1, ratio));
    g.fillStyle(COLORS.encre, 0.35);
    g.fillRect(x - w / 2, y, w, h);
    g.fillStyle(colour, 1);
    g.fillRect(x - w / 2, y, w * r, h);
  }

  /** The name label of a unit, made the first time it shows (units placed during the match). */
  private labelFor(unitId: number): Phaser.GameObjects.Text {
    let label = this.labels.get(unitId);
    if (!label) {
      label = this.add
        .text(0, 0, '', {
          fontFamily: FONT_TEXT,
          fontSize: '17px',
          fontStyle: 'bold',
          color: css(COLORS.encre),
          align: 'center',
          padding: { x: 5, y: 0 },
        })
        // Drawn at three times its size, so the name stays crisp under the camera zoom.
        .setResolution(3)
        .setOrigin(0.5, 1)
        .setDepth(7);
      this.hudCam.ignore(label);
      this.labels.set(unitId, label);
    }
    return label;
  }

  /**
   * During the placement: where the pointer would put the next unit, a plumb line in the
   * house's colour down to the ground.
   */
  private drawPlacementGhost(g: Phaser.GameObjects.Graphics, time: number): void {
    const v = this.sim.view();
    if (v.turn.phase !== 'placement') return;
    const p = this.input.activePointer;
    const w = this.cameras.main.getWorldPoint(p.x, p.y);
    const x = Math.round(w.x);
    const t = v.terrain;
    if (x < 0 || x >= t.width) return;
    let y = 0;
    while (y < t.height && (t.data[y * t.width + x] ?? 0) === 0) y++;
    const faction = FACTIONS[v.turn.activeTeam];
    const color = faction?.primary ?? COLORS.encre;
    g.lineStyle(3, color, 0.5 + 0.3 * Math.sin(time / 200));
    for (let yy = Math.max(0, y - 400); yy < y - 10; yy += 24) g.lineBetween(x, yy, x, yy + 12);
    // The unit about to be placed, in its class.
    // Not on the map yet: its class comes from its house's line-up, by its id.
    const next = v.placing[0];
    const cls = next ? classOf(v, { id: next.unitId, team: next.team }) : null;
    drawFigure(g, x, y, 1, color, faction?.secondary ?? COLORS.or, cls, false, time);
    drawClassMark(g, cls, x, y, 1);
  }

  /** Pots resting on the map, smoking, with the turns left written above in roman figures. */
  private drawPots(g: Phaser.GameObjects.Graphics, time: number): void {
    const pots = this.sim.view().pots;
    const live = new Set<number>();
    for (const p of pots) {
      const x = p.x / SUBPX;
      const y = p.y / SUBPX;
      g.fillStyle(COLORS.terreOmbre, 1);
      g.lineStyle(3, COLORS.encre, 1);
      g.fillCircle(x, y, 6);
      g.strokeCircle(x, y, 6);
      const flick = Math.sin(time / 70 + p.id) * 2;
      g.fillStyle(COLORS.or, 1);
      g.fillTriangle(x - 2, y - 6, x + 2, y - 6, x + flick, y - 13);
      live.add(p.id);
      let label = this.potLabels.get(p.id);
      if (!label) {
        label = this.add
          .text(x, y - 18, '', {
            fontFamily: FONT_TITLE,
            fontSize: '30px',
            color: css(COLORS.vermillon),
            stroke: css(COLORS.ceruse),
            strokeThickness: 6,
          })
          .setOrigin(0.5, 1)
          .setDepth(7);
        this.hudCam.ignore(label);
        this.potLabels.set(p.id, label);
      }
      label.setPosition(x, y - 16).setText(['', 'I', 'II', 'III'][p.turns] ?? String(p.turns));
    }
    for (const [id, label] of this.potLabels) {
      if (live.has(id)) continue;
      label.destroy();
      this.potLabels.delete(id);
    }
  }

  /** Small marks over a unit's label for the tricks a beast played on it. */
  private drawAfflictions(g: Phaser.GameObjects.Graphics, unitId: number, x: number, y: number) {
    const marks = this.sim.view().afflictions.filter((a) => a.unitId === unitId);
    marks.forEach((a, i) => {
      const cx = x - (marks.length - 1) * 9 + i * 18;
      g.lineStyle(2, COLORS.encre, 1);
      if (a.trick === Trick.Slime) {
        g.fillStyle(COLORS.vertTendre, 1);
        g.fillCircle(cx, y, 6);
        g.strokeCircle(cx, y, 6);
      } else if (a.trick === Trick.Shell) {
        g.fillStyle(COLORS.ocre, 1);
        g.fillCircle(cx, y, 7);
        g.strokeCircle(cx, y, 7);
        g.strokeCircle(cx, y, 3);
      } else if (a.trick === Trick.Bite) {
        g.fillStyle(COLORS.vermillon, 1);
        g.fillTriangle(cx - 6, y - 5, cx + 6, y - 5, cx, y + 6);
      } else {
        g.fillStyle(COLORS.or, 1);
        g.fillRect(cx - 2, y - 8, 4, 10);
        g.fillCircle(cx, y + 6, 2);
      }
    });
  }

  /** Reliquaries: a gilt coffer with a cross, under an angel's wings while it comes down. */
  /** Reliquaries: a gilt shrine, brought down by an angel whose wings beat as it glides. */
  private drawCrates(alpha: number, time: number): void {
    const crates = this.sim.view().crates;
    const live = new Set<number>();
    for (const c of crates) {
      live.add(c.id);
      let r = this.relics.get(c.id);
      if (!r) {
        const make = (key: string, depth: number): Phaser.GameObjects.Image => {
          const image = this.add
            .image(0, 0, key)
            .setOrigin(0.5, 1)
            .setScale(1 / RELIC_TEX_SCALE)
            .setDepth(depth);
          this.hudCam.ignore(image);
          return image;
        };
        r = { shrine: make('shrine', 5.8), angel: make('angel_0', 5.85) };
        this.relics.set(c.id, r);
      }
      const [x, y] = this.pos(`c${c.id}`, alpha, c.x, c.y);
      r.shrine.setPosition(x, y);
      r.angel.setVisible(!c.landed);
      if (!c.landed) {
        // The cords end on the shrine's eaves, just under its roof.
        const beat = Math.floor(time / ANGEL_FLAP) % 2;
        r.angel.setTexture(`angel_${beat}`).setPosition(x, y - CRATE_HEIGHT + 4);
      }
    }
    for (const [id, r] of this.relics) {
      if (live.has(id)) continue;
      r.shrine.destroy();
      r.angel.destroy();
      this.relics.delete(id);
    }
  }

  /** Powder barrels: oak staves, iron hoops, a vermilion powder mark. */
  private drawBarrels(g: Phaser.GameObjects.Graphics): void {
    for (const b of this.sim.view().barrels) {
      const x = b.x / SUBPX;
      const y = b.y / SUBPX;
      const w = BARREL_WIDTH;
      const h = BARREL_HEIGHT;
      g.fillStyle(COLORS.terreOmbre, 1);
      g.lineStyle(3, COLORS.encre, 1);
      g.fillRoundedRect(x - w / 2, y - h, w, h, 5);
      g.strokeRoundedRect(x - w / 2, y - h, w, h, 5);
      g.lineStyle(2, COLORS.encre, 1);
      for (const k of [0.22, 0.78]) g.lineBetween(x - w / 2, y - h * k, x + w / 2, y - h * k);
      g.lineStyle(1, COLORS.ocre, 0.8);
      g.lineBetween(x - 4, y - h + 3, x - 4, y - 3);
      g.lineBetween(x + 4, y - h + 3, x + 4, y - 3);
      g.fillStyle(COLORS.vermillon, 1);
      g.fillCircle(x, y - h / 2, 4);
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

  /** A tombstone in the colour of the fallen unit's house. */
  private drawGrave(g: Phaser.GameObjects.Graphics, x: number, y: number, colour: number): void {
    const w = GRAVE_WIDTH;
    const h = GRAVE_HEIGHT;
    const round = { tl: w / 2, tr: w / 2, bl: 0, br: 0 };
    g.fillStyle(colour, 1);
    g.lineStyle(3, COLORS.encre, 1);
    g.fillRoundedRect(x - w / 2, y - h, w, h, round);
    g.strokeRoundedRect(x - w / 2, y - h, w, h, round);
    g.lineStyle(3, COLORS.encre, 1);
    g.lineBetween(x, y - 28, x, y - 10);
    g.lineBetween(x - 6, y - 22, x + 6, y - 22);
  }

  /** What a unit holds out while a tool of the arsenal is at work: the shield of a charge. */
  private drawGear(
    g: Phaser.GameObjects.Graphics,
    v: SimView,
    u: SimView['units'][number],
    x: number,
    y: number,
    primary: number,
    secondary: number,
  ): void {
    if (u.banner) {
      // The banner held up high, wide open while it falls, furled on the ground.
      const open = !u.grounded;
      const top = y - UNIT_HEIGHT - (open ? 70 : 40);
      g.lineStyle(4, COLORS.terreOmbre, 1);
      g.lineBetween(x, y - UNIT_HEIGHT * 0.6, x, top);
      const w = open ? 70 : 26;
      const h = open ? 34 : 40;
      const cloth = poly([
        { x: x - w / 2, y: top },
        { x: x + w / 2, y: top },
        { x: x + w / 2, y: top + h * 0.7 },
        { x: x + w / 4, y: top + h },
        { x: x, y: top + h * 0.7 },
        { x: x - w / 4, y: top + h },
        { x: x - w / 2, y: top + h * 0.7 },
      ]);
      g.fillStyle(primary, 1);
      g.fillPoints(cloth, true);
      g.fillStyle(secondary, 1);
      g.fillRect(x - w / 2, top + 6, w, 5);
      g.lineStyle(3, COLORS.encre, 1);
      g.strokePoints(cloth, true);
    }
    if (v.charge?.unitId === u.id) {
      const sx = x + u.facing * 22;
      const sy = y - UNIT_HEIGHT * 0.55;
      const shield = poly([
        { x: sx - 13, y: sy - 22 },
        { x: sx + 13, y: sy - 22 },
        { x: sx + 13, y: sy + 2 },
        { x: sx, y: sy + 22 },
        { x: sx - 13, y: sy + 2 },
      ]);
      g.fillStyle(primary, 1);
      g.fillPoints(shield, true);
      g.fillStyle(secondary, 1);
      g.fillRect(sx - 3, sy - 22, 6, 36);
      g.lineStyle(3, COLORS.encre, 1);
      g.strokePoints(shield, true);
      // Dust kicked up behind the run.
      g.fillStyle(COLORS.ocre, 0.5);
      for (let i = 1; i <= 3; i++)
        g.fillCircle(x - u.facing * (14 + i * 12), y - 4 - i * 3, 9 - i * 2);
    }
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

  /**
   * The flight the shot would take at the charged power, for a limited length (GDD §8.1), longer
   * for an archer with the bow or the crossbow (GDD §3.2). Shown while charging or dragging; the
   * crossbow, always at full power, shows it at once. Reads the terrain only.
   */
  private drawPreview(g: Phaser.GameObjects.Graphics, u: Readonly<Unit>): void {
    const v = this.sim.view();
    const def = v.rules.weapons.find((w) => w.id === v.turn.weapon);
    if (def && isTargeted(def)) {
      this.drawTarget(g, u, def);
      return;
    }
    if (!def || !isProjectile(def)) return;
    const power = def.fixedPower ? MAX_POWER : this.input_.controls.power;
    if (power <= 0) return;
    const speed = shotSpeed(v, u, def, power);
    const p = createProjectile(
      0,
      u.id,
      u.x + Math.trunc((20 * SUBPX * cosQ14(v.turn.aim)) / 16384),
      u.y - (UNIT_HEIGHT * SUBPX) / 2 + Math.trunc((20 * SUBPX * sinQ14(v.turn.aim)) / 16384),
      Math.trunc((speed * cosQ14(v.turn.aim)) / 16384),
      Math.trunc((speed * sinQ14(v.turn.aim)) / 16384),
      { radius: def.projectileRadius, windPct: def.windPct, gravityPct: 100 },
    );
    const ticks = aimPreviewTicks(v, u, def);
    for (let i = 0; i < ticks; i++) {
      const hit = stepProjectile(
        p,
        v.terrain as Terrain,
        [],
        v.turn.wind,
        v.rules.wind.accelPerUnit,
      );
      if (hit) break;
      if (i % 2 === 1) {
        // Gilt dots that fade towards the end of the line.
        g.fillStyle(COLORS.or, 1 - (0.7 * i) / ticks);
        g.lineStyle(1.5, COLORS.encre, 1 - (0.7 * i) / ticks);
        g.fillCircle(p.x / SUBPX, p.y / SUBPX, 3.5);
        g.strokeCircle(p.x / SUBPX, p.y / SUBPX, 3.5);
      }
    }
  }

  /**
   * Where a targeted weapon would go: under the mouse, or as far as the charged power says. The
   * stone wall shows its outline (vermilion where it cannot go), the volley a target with the
   * side its stones come from.
   */
  private drawTarget(g: Phaser.GameObjects.Graphics, u: Readonly<Unit>, def: WeaponDef): void {
    const v = this.sim.view();
    const p = this.input.activePointer;
    const power = this.input_.controls.power;
    let at: { x: number; y: number } | null = null;
    if (power > 0) at = targetFor(v, u, def, power);
    else if (!p.wasTouch && p.x > 0 && p.y > 0) {
      const w = this.cameras.main.getWorldPoint(p.x, p.y);
      at = { x: Math.round(w.x), y: Math.round(w.y) };
    }
    if (!at) return;
    const wall = def.wall;
    if (wall) {
      const ok = wallRefusal(v, u, def, at.x, at.y) === null;
      // Shown where it will come to rest, on the ground below.
      const spot = wall.fall ? { x: at.x, y: wallLanding(v, def, at.x, at.y) } : at;
      const length = wallLength(wall, wallSize(v.turn.fuse || def.defaultFuse));
      const a = (wallAngle(v.turn.aim) * Math.PI * 2) / 4096;
      const hl = length / 2;
      const ht = wall.thickness / 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const corners = [
        [-hl, -ht],
        [hl, -ht],
        [hl, ht],
        [-hl, ht],
      ].map(([dx = 0, dy = 0]) => ({ x: spot.x + dx * c - dy * s, y: spot.y + dx * s + dy * c }));
      g.fillStyle(ok ? COLORS.ceruse : COLORS.vermillon, 0.55);
      g.fillPoints(poly(corners), true);
      g.lineStyle(3, ok ? COLORS.encre : COLORS.vermillon, 0.9);
      g.strokePoints(poly(corners), true);
      return;
    }
    if (def.teleport) {
      // The miracle: the figure's outline where it will stand, vermilion where it cannot go.
      const to = teleportLanding(v, u.id, at.x, at.y);
      const fx = to?.x ?? at.x;
      const fy = to?.y ?? at.y + UNIT_HEIGHT / 2;
      const ok = to !== null;
      g.fillStyle(ok ? COLORS.or : COLORS.vermillon, 0.35);
      g.fillRoundedRect(
        fx - UNIT_HALF_WIDTH,
        fy - UNIT_HEIGHT,
        UNIT_HALF_WIDTH * 2,
        UNIT_HEIGHT,
        14,
      );
      g.lineStyle(3, ok ? COLORS.or : COLORS.vermillon, 0.9);
      g.strokeRoundedRect(
        fx - UNIT_HALF_WIDTH,
        fy - UNIT_HEIGHT,
        UNIT_HALF_WIDTH * 2,
        UNIT_HEIGHT,
        14,
      );
      if (ok && fy > at.y + UNIT_HEIGHT / 2) {
        // The drop to the ground under the point.
        g.lineStyle(2, COLORS.or, 0.7);
        g.lineBetween(fx, at.y, fx, fy - UNIT_HEIGHT);
      }
      return;
    }
    // Trebuchet volley: the target on the ground, and an arrow for the side of the throw.
    const t = v.terrain;
    let y = 0;
    const x = Math.max(0, Math.min(t.width - 1, at.x));
    while (y < t.height && (t.rules.solid[t.data[y * t.width + x] ?? 0] ?? false) === false) y++;
    if (def.homing) {
      // The falcon goes for the very point: a target there, in the air or on the ground.
      g.lineStyle(4, COLORS.vermillon, 0.9);
      g.strokeCircle(at.x, at.y, 22);
      g.strokeCircle(at.x, at.y, 8);
      g.lineBetween(at.x - 30, at.y, at.x + 30, at.y);
      g.lineBetween(at.x, at.y - 30, at.x, at.y + 30);
      return;
    }
    const dir = Math.cos((v.turn.aim * Math.PI * 2) / 4096) >= 0 ? 1 : -1;
    g.lineStyle(4, COLORS.vermillon, 0.9);
    g.strokeCircle(x, y - 6, 26);
    g.strokeCircle(x, y - 6, 12);
    g.lineBetween(x - 34, y - 6, x + 34, y - 6);
    g.lineBetween(x, y - 40, x, y + 28);
    g.lineStyle(5, COLORS.encre, 0.8);
    g.lineBetween(x - dir * 150, y - 170, x - dir * 50, y - 60);
    g.fillStyle(COLORS.encre, 0.8);
    g.fillTriangle(x - dir * 40, y - 50, x - dir * 66, y - 62, x - dir * 52, y - 76);
  }

  /**
   * Chausse-trapes: iron caltrops. Online, a player sees those of its own houses, and all of them
   * while its sapper plays (GDD §3.2); everyone sees them all once the match is over, in a replay,
   * and in a trial match on one device. A ring while not armed.
   */
  private drawMines(g: Phaser.GameObjects.Graphics, time: number): void {
    const v = this.sim.view();
    const all = !this.online || v.turn.phase === 'gameOver' || this.replaying;
    const seen = all
      ? v.mines
      : v.teams.flatMap((team) => (this.mine(team.id) ? visibleMines(v, team.id) : []));
    for (const m of seen) {
      const x = m.x / SUBPX;
      const y = m.y / SUBPX;
      const f = FACTIONS[m.team];
      if (m.arm > 0) {
        g.lineStyle(2, f?.primary ?? COLORS.encre, 0.5 + 0.4 * Math.sin(time / 120));
        g.strokeCircle(x, y - 4, 12);
      }
      g.lineStyle(3, COLORS.encre, 1);
      for (const [dx, dy] of [
        [-8, 0],
        [8, 0],
        [-5, -7],
        [5, -7],
      ] as const) {
        g.lineBetween(x, y - 3, x + dx, y + dy - 1);
      }
      g.fillStyle(COLORS.roche, 1);
      g.fillCircle(x, y - 3, 3.5);
      g.strokeCircle(x, y - 3, 3.5);
      g.fillStyle(f?.primary ?? COLORS.encre, 1);
      g.fillCircle(x, y - 10, 2.5);
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
