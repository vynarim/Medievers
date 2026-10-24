// Local player input through Phaser: keyboard, mouse and touch (drag-to-aim, one-finger pan,
// pinch zoom, double tap to recentre) feed LocalControls (GDD §8).
import Phaser from 'phaser';
import type { GameCommand } from '../sim/commands.ts';
import type { SimView } from '../sim/sim.ts';
import type { InputSource } from './InputSource.ts';
import { LocalControls, emptyInput, type RawInput } from './local-controls.ts';
import { UiIntents } from './ui-intents.ts';

/** px around the active unit's body centre where a press starts drag-to-aim */
const DRAG_GRAB_RADIUS = 70;
/** px a press may move and still count as a click */
const CLICK_SLOP = 6;
/** ms and px between two taps of a double tap (recentre the camera, GDD §8.2) */
const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_SLOP = 40;

type Keys = Record<
  'left' | 'right' | 'a' | 'd' | 'up' | 'down' | 'enter' | 'space' | 'tab' | 't',
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
  /** current drag pull vector, for the scene's aim preview */
  drag: { pullX: number; pullY: number } | null = null;
  private dragReleased = false;
  private weaponClick = false;
  /** presses latched from key events, so a tap shorter than a frame is never lost */
  private pressed = { jump: false, weapon: false, flip: false, fuse: null as number | null };
  /** camera pan requested by a drag on empty ground, consumed by the scene */
  pan = { dx: 0, dy: 0 };
  /** zoom factor requested by a pinch since the last frame, consumed by the scene */
  zoom = 1;
  /** set by a double tap: the scene recentres the camera */
  recenter = false;
  private panFrom: { x: number; y: number } | null = null;
  private pinchDistance = 0;
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
    }) as Keys;
    this.fuseKeys = [K.ONE, K.TWO, K.THREE, K.FOUR, K.FIVE].map((k) => kb.addKey(k));
    this.keys.enter.on('down', () => (this.pressed.jump = true));
    this.keys.tab.on('down', () => (this.pressed.weapon = true));
    this.keys.t.on('down', () => (this.pressed.flip = true));
    this.fuseKeys.forEach((key, i) => key.on('down', () => (this.pressed.fuse = i + 1)));
    scene.input.mouse?.disableContextMenu();
    scene.input.on('pointerdown', this.onDown, this);
    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
  }

  /** Pointer position in world px, through the main (world) camera. */
  private world(p: Phaser.Input.Pointer): { x: number; y: number } {
    const w = this.scene.cameras.main.getWorldPoint(p.x, p.y);
    return { x: w.x, y: w.y };
  }

  /** Distance between the two first touches, or 0 when fewer than two are down. */
  private touchSpread(): number {
    const a = this.scene.input.pointer1;
    const b = this.scene.input.pointer2;
    return a.isDown && b.isDown ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  private onDown(p: Phaser.Input.Pointer): void {
    // A second finger turns the gesture into a pinch: cancel any aim or pan in progress.
    const spread = this.touchSpread();
    if (spread > 0) {
      this.pinchDistance = spread;
      this.drag = null;
      this.panFrom = null;
      this.downAt = null;
      return;
    }
    this.downAt = { x: p.x, y: p.y };
    if (p.rightButtonDown()) {
      this.weaponClick = true;
      return;
    }
    const c = this.unitCentre;
    const w = this.world(p);
    if (c && Math.hypot(w.x - c.x, w.y - c.y) <= DRAG_GRAB_RADIUS) {
      this.drag = { pullX: 0, pullY: 0 };
      return;
    }
    this.panFrom = { x: p.x, y: p.y };
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (this.pinchDistance > 0) {
      const spread = this.touchSpread();
      if (spread > 0) {
        this.zoom *= spread / this.pinchDistance;
        this.pinchDistance = spread;
      }
      return;
    }
    if (this.drag && this.unitCentre) {
      const w = this.world(p);
      this.drag = { pullX: w.x - this.unitCentre.x, pullY: w.y - this.unitCentre.y };
    } else if (this.panFrom && p.isDown) {
      this.pan.dx += this.panFrom.x - p.x;
      this.pan.dy += this.panFrom.y - p.y;
      this.panFrom = { x: p.x, y: p.y };
    }
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (this.pinchDistance > 0) {
      if (this.touchSpread() === 0) this.pinchDistance = 0;
      return;
    }
    if (this.downAt && Math.hypot(p.x - this.downAt.x, p.y - this.downAt.y) <= CLICK_SLOP) {
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
    if (this.drag) {
      const len = Math.hypot(this.drag.pullX, this.drag.pullY);
      if (len > CLICK_SLOP) this.dragReleased = true;
      else this.drag = null;
    }
    this.panFrom = null;
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
    input.up = k.up.isDown || this.ui.aim > 0;
    input.down = k.down.isDown || this.ui.aim < 0;
    input.charge = k.space.isDown || this.ui.charge;
    input.jumpKind = ui.jump;
    input.selectWeapon = ui.selectWeapon;
    input.skipPressed = ui.skip;
    input.jumpPressed = this.pressed.jump;
    input.nextWeaponPressed = this.pressed.weapon || this.weaponClick;
    input.flipPressed = this.pressed.flip || ui.flip;
    input.fusePressed = this.pressed.fuse ?? ui.fuse;
    this.pressed = { jump: false, weapon: false, flip: false, fuse: null };
    this.weaponClick = false;
    if (this.drag) {
      input.drag = { ...this.drag, released: this.dragReleased };
      if (this.dragReleased) {
        this.drag = null;
        this.dragReleased = false;
      }
    }
    return this.controls.update(tick, input, view);
  }

  dispose(): void {
    this.scene.input.off('pointerdown', this.onDown, this);
    this.scene.input.off('pointermove', this.onMove, this);
    this.scene.input.off('pointerup', this.onUp, this);
  }
}
