// Local player input through Phaser: keyboard, mouse and touch feed LocalControls (GDD §8).
import Phaser from 'phaser';
import type { GameCommand } from '../sim/commands.ts';
import type { SimView } from '../sim/sim.ts';
import type { InputSource } from './InputSource.ts';
import { LocalControls, emptyInput, type RawInput } from './local-controls.ts';

/** px around the active unit's body centre where a press starts drag-to-aim */
const DRAG_GRAB_RADIUS = 70;
/** px a press may move and still count as a click */
const CLICK_SLOP = 6;

type Keys = Record<
  'left' | 'right' | 'a' | 'd' | 'up' | 'down' | 'enter' | 'space' | 'tab',
  Phaser.Input.Keyboard.Key
>;

export class PhaserLocalInput implements InputSource {
  readonly kind = 'local' as const;
  readonly controls = new LocalControls();
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
  private pressed = { jump: false, weapon: false, fuse: null as number | null };
  /** camera pan requested by a drag on empty ground, consumed by the scene */
  pan = { dx: 0, dy: 0 };
  private panFrom: { x: number; y: number } | null = null;

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
    }) as Keys;
    this.fuseKeys = [K.ONE, K.TWO, K.THREE, K.FOUR, K.FIVE].map((k) => kb.addKey(k));
    this.keys.enter.on('down', () => (this.pressed.jump = true));
    this.keys.tab.on('down', () => (this.pressed.weapon = true));
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

  private onDown(p: Phaser.Input.Pointer): void {
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
    if (this.drag && this.unitCentre) {
      const w = this.world(p);
      this.drag = { pullX: w.x - this.unitCentre.x, pullY: w.y - this.unitCentre.y };
    } else if (this.panFrom && p.isDown) {
      this.pan.dx += this.panFrom.x - p.x;
      this.pan.dy += this.panFrom.y - p.y;
      this.panFrom = { x: p.x, y: p.y };
    }
  }

  private onUp(): void {
    if (this.drag) {
      const len = Math.hypot(this.drag.pullX, this.drag.pullY);
      if (len > CLICK_SLOP) this.dragReleased = true;
      else this.drag = null;
    }
    this.panFrom = null;
  }

  poll(tick: number, view: SimView): GameCommand[] {
    const k = this.keys;
    const input: RawInput = emptyInput();
    input.left = k.left.isDown || k.a.isDown;
    input.right = k.right.isDown || k.d.isDown;
    input.up = k.up.isDown;
    input.down = k.down.isDown;
    input.charge = k.space.isDown;
    input.jumpPressed = this.pressed.jump;
    input.nextWeaponPressed = this.pressed.weapon || this.weaponClick;
    input.fusePressed = this.pressed.fuse;
    this.pressed = { jump: false, weapon: false, fuse: null };
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
