// The few drawing calls the placeholder figures make, answered alike by a Phaser Graphics, the SVG
// recorder of the help (figure-svg.ts) and a canvas 2D context (the rig's placeholder textures).
import { COLORS } from '../../ui/tokens.ts';

export type Pt = { readonly x: number; readonly y: number };

/** The house's tinctures a piece is drawn in. */
export interface Tinctures {
  readonly primary: number;
  readonly secondary: number;
}

/** Draws one piece of a rig in the figure's frame. */
export type PieceDrawer = (F: Frame, t: Tinctures) => void;

export interface Pen {
  fillStyle(color: number, alpha?: number): unknown;
  lineStyle(width: number, color: number, alpha?: number): unknown;
  fillPoints(points: readonly Pt[], closeShape?: boolean): unknown;
  strokePoints(points: readonly Pt[], closeShape?: boolean): unknown;
  fillCircle(x: number, y: number, r: number): unknown;
  strokeCircle(x: number, y: number, r: number): unknown;
}

/**
 * A figure's frame on a pen, origin between its feet: local x grows towards where it faces,
 * y downward.
 */
export class Frame {
  readonly pen: Pen;
  readonly x: number;
  readonly y: number;
  readonly f: number;

  constructor(pen: Pen, x: number, y: number, f: number) {
    this.pen = pen;
    this.x = x;
    this.y = y;
    this.f = f;
  }

  private map(points: readonly Pt[]): Pt[] {
    return points.map((q) => ({ x: this.x + this.f * q.x, y: this.y + q.y }));
  }

  /** A filled shape outlined in ink. */
  shape(points: readonly Pt[], fill: number, line = 2.5): void {
    const p = this.map(points);
    this.pen.fillStyle(fill, 1);
    this.pen.fillPoints(p, true);
    if (line > 0) {
      this.pen.lineStyle(line, COLORS.encre, 1);
      this.pen.strokePoints(p, true);
    }
  }

  /** A stroke along the points, in ink unless told otherwise. */
  stroke(points: readonly Pt[], width: number, colour: number = COLORS.encre, alpha = 1): void {
    this.pen.lineStyle(width, colour, alpha);
    this.pen.strokePoints(this.map(points), false);
  }

  circle(dx: number, dy: number, r: number, fill: number, line = 0): void {
    const cx = this.x + this.f * dx;
    const cy = this.y + dy;
    this.pen.fillStyle(fill, 1);
    this.pen.fillCircle(cx, cy, r);
    if (line > 0) {
      this.pen.lineStyle(line, COLORS.encre, 1);
      this.pen.strokeCircle(cx, cy, r);
    }
  }
}

const rgba = (c: number, a: number): string =>
  `rgba(${(c >> 16) & 0xff},${(c >> 8) & 0xff},${c & 0xff},${a})`;

/** A Pen on a canvas 2D context (its current transform applies). */
export class CanvasPen implements Pen {
  private readonly ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
  }

  fillStyle(color: number, alpha = 1): this {
    this.ctx.fillStyle = rgba(color, alpha);
    return this;
  }

  lineStyle(width: number, color: number, alpha = 1): this {
    this.ctx.lineWidth = width;
    this.ctx.strokeStyle = rgba(color, alpha);
    return this;
  }

  private trace(points: readonly Pt[], close: boolean): void {
    const c = this.ctx;
    c.beginPath();
    points.forEach((p, i) => (i === 0 ? c.moveTo(p.x, p.y) : c.lineTo(p.x, p.y)));
    if (close) c.closePath();
  }

  fillPoints(points: readonly Pt[]): this {
    this.trace(points, true);
    this.ctx.fill();
    return this;
  }

  strokePoints(points: readonly Pt[], closeShape = false): this {
    this.trace(points, closeShape);
    this.ctx.stroke();
    return this;
  }

  fillCircle(x: number, y: number, r: number): this {
    this.ctx.beginPath();
    this.ctx.arc(x, y, r, 0, Math.PI * 2);
    this.ctx.fill();
    return this;
  }

  strokeCircle(x: number, y: number, r: number): this {
    this.ctx.beginPath();
    this.ctx.arc(x, y, r, 0, Math.PI * 2);
    this.ctx.stroke();
    return this;
  }
}

/** A Pen that only measures: the bounds of everything drawn, line widths included. */
export class BoundsPen implements Pen {
  minX = Infinity;
  minY = Infinity;
  maxX = -Infinity;
  maxY = -Infinity;
  private width = 0;

  private add(x: number, y: number, r: number): void {
    this.minX = Math.min(this.minX, x - r);
    this.minY = Math.min(this.minY, y - r);
    this.maxX = Math.max(this.maxX, x + r);
    this.maxY = Math.max(this.maxY, y + r);
  }

  fillStyle(): this {
    return this;
  }

  lineStyle(width: number): this {
    this.width = width;
    return this;
  }

  fillPoints(points: readonly Pt[]): this {
    for (const p of points) this.add(p.x, p.y, 0);
    return this;
  }

  strokePoints(points: readonly Pt[]): this {
    for (const p of points) this.add(p.x, p.y, this.width / 2);
    return this;
  }

  fillCircle(x: number, y: number, r: number): this {
    this.add(x, y, r);
    return this;
  }

  strokeCircle(x: number, y: number, r: number): this {
    this.add(x, y, r + this.width / 2);
    return this;
  }
}
