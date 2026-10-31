// Local player input through Phaser: keyboard, mouse and touch (drag-to-aim, dragging the aim
// arrowhead, one-finger pan, two-finger pinch and pan, double tap to recentre) feed
// LocalControls (GDD §8).
import Phaser from 'phaser';
import type { GameCommand } from '../sim/commands.ts';
import type { SimView } from '../sim/sim.ts';
import type { InputSource } from './InputSource.ts';
import { LocalControls, emptyInput, type RawInput } from './local-controls.ts';
import { UiIntents } from './ui-intents.ts';

/** px around the active unit's body centre where a press starts drag-to-aim */
const DRAG_GRAB_RADIUS = 70;
/** game px from the canvas border where the mouse scrolls the camera (GDD §8.1) */
const EDGE_PX = 24;
/** ms the mouse must rest at a side before the camera scrolls, so crossing it does nothing */
const EDGE_DWELL_MS = 350;
/** screen px around the aim arrowhead where a press grabs it to re-aim */
const TIP_GRAB_RADIUS = 36;
/** same, for a finger, which hides what it touches */
const TIP_GRAB_RADIUS_TOUCH = 64;
/** px a press may move and still count as a click, with a mouse and with a finger */
const CLICK_SLOP = 6;
const CLICK_SLOP_TOUCH = 18;
/**
 * Screen px a slingshot pull must reach before it aims or can fire. A click on the unit, even
 * a shaky one, never shoots; bringing the pointer back inside this distance cancels the shot.
 */
const SLING_ARM_PX = 48;
/** ms and px between two taps of a double tap (recentre the camera, GDD §8.2) */
const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_SLOP = 40;

const TOUCH_EVENTS = ['touchstart', 'touchmove', 'touchend', 'touchcancel'] as const;

type Keys = Record<
  'left' | 'right' | 'a' | 'd' | 'up' | 'down' | 'enter' | 'space' | 'tab' | 't' | 'g',
  Phaser.Input.Keyboard.Key
>;

export class PhaserLocalInput implements InputSource {
  readonly kind = 'local' as const;
  readonly controls = new LocalControls();
  /** on-screen action bar */
  readonly ui = new UiIntents();
  /** world point of the last click (press and release without moving), for unit selection */
  private clickAt: { x: number; y: number } | null = null;
  private downAt: { x: number; y: number } | null = null;
  private readonly keys: Keys;
  private readonly fuseKeys: Phaser.Input.Keyboard.Key[];
  private readonly scene: Phaser.Scene;
  /** body centre of the active unit in world px, set by the scene each frame */
  unitCentre: { x: number; y: number } | null = null;
  /** aim arrowhead in world px while the unit can aim, set by the scene each frame */
  aimTip: { x: number; y: number } | null = null;
  /** pointer relative to the unit centre while the arrowhead is dragged */
  private aimAt: { x: number; y: number } | null = null;
  /** current drag pull vector, for the scene's aim preview */
  drag: { pullX: number; pullY: number } | null = null;
  /** true while the pull is long enough to aim and fire (see SLING_ARM_PX) */
  dragArmed = false;
  private dragReleased = false;
  private weaponClick = false;
  /** presses latched from key events, so a tap shorter than a frame is never lost */
  private pressed = {
    jump: false,
    weapon: false,
    flip: false,
    rope: false,
    fire: false,
    fuse: null as number | null,
  };
  /** camera pan requested by a drag on empty ground, consumed by the scene */
  pan = { dx: 0, dy: 0 };
  /** camera scroll direction while the mouse rests at a border of the canvas (-1, 0, 1) */
  edge = { x: 0, y: 0 };
  /** side the mouse rests at (-1, 0, 1) and since when, before it scrolls */
  private edgeSide = 0;
  private edgeSince = 0;
  /** zoom factor requested by a pinch since the last frame, consumed by the scene */
  zoom = 1;
  /** screen point the pinch zooms about (between the fingers), consumed with `zoom` */
  zoomAt: { x: number; y: number } | null = null;
  /** true during the placement, set by the scene each frame: a release puts the unit down */
  placing = false;
  /** a press of the placement in progress, released where the unit goes */
  private placeFrom = false;
  /** set by a double tap: the scene recentres the camera */
  recenter = false;
  private panFrom: { x: number; y: number } | null = null;
  /** the two fingers' spread and midpoint while they pinch, in game px */
  private pinch: { spread: number; mid: { x: number; y: number } } | null = null;
  /** a pinch happened since the first finger came down: lifting the fingers is no tap */
  private pinched = false;
  private lastTap = { time: -Infinity, x: 0, y: 0 };

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const kb = scene.input.keyboard;
    if (!kb) throw new Error('keyboard input unavailable');
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = kb.addKeys({
      left: K.LEFT,
      right: K.RIGHT,
      a: K.A,
      d: K.D,
      up: K.UP,
      down: K.DOWN,
      enter: K.ENTER,
      space: K.SPACE,
      tab: K.TAB,
      t: K.T,
      g: K.G,
    }) as Keys;
    this.fuseKeys = [K.ONE, K.TWO, K.THREE, K.FOUR, K.FIVE].map((k) => kb.addKey(k));
    this.keys.enter.on('down', () => (this.pressed.jump = true));
    this.keys.tab.on('down', () => (this.pressed.weapon = true));
    this.keys.t.on('down', () => (this.pressed.flip = true));
    this.keys.g.on('down', () => (this.pressed.rope = true));
    this.keys.space.on('down', () => (this.pressed.fire = true));
    this.fuseKeys.forEach((key, i) => key.on('down', () => (this.pressed.fuse = i + 1)));
    scene.input.mouse?.disableContextMenu();
    scene.input.on('pointerdown', this.onDown, this);
    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
    scene.input.on('gameout', this.onOut, this);
    // The pinch reads the browser's touches straight, before Phaser hears of them (capture):
    // every finger counts, even one that came down on the HUD, and none is ever missed.
    for (const type of TOUCH_EVENTS) window.addEventListener(type, this.onTouch, true);
  }

  private readonly onTouch = (e: TouchEvent): void => {
    const a = e.touches[0];
    const b = e.touches[1];
    if (!a || !b) {
      this.pinch = null;
      return;
    }
    const sc = this.scene.scale;
    const ax = sc.transformX(a.pageX);
    const ay = sc.transformY(a.pageY);
    const bx = sc.transformX(b.pageX);
    const by = sc.transformY(b.pageY);
    const spread = Math.max(1, Math.hypot(ax - bx, ay - by));
    const mid = { x: (ax + bx) / 2, y: (ay + by) / 2 };
    if (!this.pinch) {
      // Two fingers on a menu (a list to scroll) are not a pinch of the battlefield.
      const canvas = this.scene.game.canvas;
      if (![a, b].some((t) => t.target === canvas)) return;
      this.startPinch();
    } else {
      this.zoom *= spread / this.pinch.spread;
      this.zoomAt = mid;
      // Both fingers sliding together drag the map along.
      this.pan.dx += this.pinch.mid.x - mid.x;
      this.pan.dy += this.pinch.mid.y - mid.y;
    }
    this.pinch = { spread, mid };
  };

  /** A second finger turns the gesture into a pinch: cancel any aim, pan or placement. */
  private startPinch(): void {
    this.pinched = true;
    this.drag = null;
    this.dragArmed = false;
    this.aimAt = null;
    this.panFrom = null;
    this.downAt = null;
    this.placeFrom = false;
  }

  /** Pointer position in world px, through the main (world) camera. */
  private world(p: Phaser.Input.Pointer): { x: number; y: number } {
    const w = this.scene.cameras.main.getWorldPoint(p.x, p.y);
    return { x: w.x, y: w.y };
  }

  /** True while two touches are down (Phaser's own count, should a touch event be missed). */
  private twoFingers(): boolean {
    return this.scene.input.pointer1.isDown && this.scene.input.pointer2.isDown;
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (this.pinch || this.twoFingers()) {
      this.startPinch();
      return;
    }
    // The first finger of a new gesture.
    this.pinched = false;
    this.downAt = { x: p.x, y: p.y };
    if (p.rightButtonDown()) {
      this.weaponClick = true;
      return;
    }
    // During the placement, the press drags the unit about; its release puts it down.
    if (this.placing) {
      this.placeFrom = true;
      return;
    }
    const c = this.unitCentre;
    const w = this.world(p);
    if (c && this.overTip(w, p.wasTouch)) {
      this.aimAt = { x: w.x - c.x, y: w.y - c.y };
      return;
    }
    if (c && Math.hypot(w.x - c.x, w.y - c.y) <= DRAG_GRAB_RADIUS) {
      this.drag = { pullX: 0, pullY: 0 };
      return;
    }
    this.panFrom = { x: p.x, y: p.y };
  }

  /** True when a world point is on the aim arrowhead (radius in screen px). */
  private overTip(w: { x: number; y: number }, touch = false): boolean {
    const tip = this.aimTip;
    const zoom = this.scene.cameras.main.zoom;
    const radius = touch ? TIP_GRAB_RADIUS_TOUCH : TIP_GRAB_RADIUS;
    return !!tip && Math.hypot(w.x - tip.x, w.y - tip.y) * zoom <= radius;
  }

  /** The mouse left the canvas (or went over a DOM panel): stop edge scrolling. */
  private onOut(): void {
    this.edge = { x: 0, y: 0 };
    this.edgeSide = 0;
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (!p.wasTouch) {
      const { width } = this.scene.scale;
      const side = (v: number, max: number): number =>
        v < EDGE_PX ? -1 : v > max - EDGE_PX ? 1 : 0;
      // Left and right sides only: the top and bottom are crossed on the way to the browser's
      // bars and to the action bar, and the map is not much taller than the screen.
      const s = p.isDown ? 0 : side(p.x, width);
      if (s !== this.edgeSide) {
        this.edgeSide = s;
        this.edgeSince = this.scene.game.loop.time;
      }
    }
    if (this.aimAt && this.unitCentre) {
      const w = this.world(p);
      this.aimAt = { x: w.x - this.unitCentre.x, y: w.y - this.unitCentre.y };
      return;
    }
    if (!p.isDown) {
      this.scene.input.setDefaultCursor(this.overTip(this.world(p)) ? 'grab' : 'default');
    }
    if (this.pinch || this.pinched) return;
    if (this.drag && this.unitCentre) {
      const w = this.world(p);
      this.drag = { pullX: w.x - this.unitCentre.x, pullY: w.y - this.unitCentre.y };
      const zoom = this.scene.cameras.main.zoom;
      this.dragArmed = Math.hypot(this.drag.pullX, this.drag.pullY) * zoom >= SLING_ARM_PX;
    } else if (this.panFrom && p.isDown) {
      this.pan.dx += this.panFrom.x - p.x;
      this.pan.dy += this.panFrom.y - p.y;
      this.panFrom = { x: p.x, y: p.y };
    }
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (this.pinch || this.pinched) {
      this.downAt = null;
      return;
    }
    if (this.placeFrom) {
      this.placeFrom = false;
      this.downAt = null;
      this.clickAt = this.world(p);
      return;
    }
    const slop = p.wasTouch ? CLICK_SLOP_TOUCH : CLICK_SLOP;
    if (this.downAt && Math.hypot(p.x - this.downAt.x, p.y - this.downAt.y) <= slop) {
      this.clickAt = this.world(p);
      const tap = this.lastTap;
      if (
        p.upTime - tap.time <= DOUBLE_TAP_MS &&
        Math.hypot(p.x - tap.x, p.y - tap.y) <= DOUBLE_TAP_SLOP
      ) {
        this.recenter = true;
        tap.time = -Infinity;
      } else this.lastTap = { time: p.upTime, x: p.x, y: p.y };
    }
    this.downAt = null;
    this.aimAt = null;
    if (this.drag) {
      if (this.dragArmed) this.dragReleased = true;
      else this.drag = null;
    }
    this.panFrom = null;
  }

  /** Updates the edge scroll for this frame: only after the mouse has rested at a side. */
  updateEdge(now: number): void {
    const resting = this.edgeSide !== 0 && now - this.edgeSince >= EDGE_DWELL_MS;
    this.edge = { x: resting ? this.edgeSide : 0, y: 0 };
  }

  /** Returns and clears the last click, in world px. */
  takeClick(): { x: number; y: number } | null {
    const c = this.clickAt;
    this.clickAt = null;
    return c;
  }

  poll(tick: number, view: SimView): GameCommand[] {
    const k = this.keys;
    const input: RawInput = emptyInput();
    const ui = this.ui.take();
    input.left = k.left.isDown || k.a.isDown || this.ui.walk < 0;
    input.right = k.right.isDown || k.d.isDown || this.ui.walk > 0;
    input.up = k.up.isDown;
    input.down = k.down.isDown;
    input.climb = this.ui.climb;
    input.spin = this.ui.spin;
    input.charge = k.space.isDown || this.ui.charge;
    input.jumpKind = ui.jump;
    input.jumpDir = ui.jumpDir;
    input.selectWeapon = ui.selectWeapon;
    input.selectUnit = ui.selectUnit;
    input.place = ui.place;
    input.skipPressed = ui.skip;
    input.jumpPressed = this.pressed.jump;
    input.nextWeaponPressed = this.pressed.weapon || this.weaponClick;
    input.flipPressed = this.pressed.flip;
    input.ropePressed = this.pressed.rope || ui.rope;
    input.firePressed = this.pressed.fire || ui.firePressed;
    input.target = ui.target;
    input.fusePressed = this.pressed.fuse ?? ui.fuse;
    input.aimAt = this.aimAt;
    this.pressed = {
      jump: false,
      weapon: false,
      flip: false,
      rope: false,
      fire: false,
      fuse: null,
    };
    this.weaponClick = false;
    if (this.drag && this.dragArmed) {
      input.drag = { ...this.drag, released: this.dragReleased };
      if (this.dragReleased) {
        this.drag = null;
        this.dragArmed = false;
        this.dragReleased = false;
      }
    }
    return this.controls.update(tick, input, view);
  }

  dispose(): void {
    this.scene.input.off('pointerdown', this.onDown, this);
    this.scene.input.off('pointermove', this.onMove, this);
    this.scene.input.off('pointerup', this.onUp, this);
    this.scene.input.off('gameout', this.onOut, this);
    for (const type of TOUCH_EVENTS) window.removeEventListener(type, this.onTouch, true);
  }
}
