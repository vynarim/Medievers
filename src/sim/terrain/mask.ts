// Collision mask: one material id per pixel, row-major (TECH_SPEC §4.2).
import { Material, type MaskColor } from './material.ts';

export interface Mask {
  /** px */
  readonly width: number;
  /** px */
  readonly height: number;
  /** width * height material ids */
  readonly data: Uint8Array;
}

export interface UnknownMaskColor {
  /** px */
  readonly x: number;
  /** px */
  readonly y: number;
  /** 0xRRGGBBAA */
  readonly rgba: number;
}

export class MaskColorError extends Error {
  readonly count: number;
  readonly first: readonly UnknownMaskColor[];

  constructor(count: number, first: readonly UnknownMaskColor[]) {
    super(`mask has ${count} pixel(s) with an unknown colour`);
    this.name = 'MaskColorError';
    this.count = count;
    this.first = first;
  }
}

/** Unknown pixels reported in a MaskColorError, beyond the total count. */
const REPORTED_UNKNOWN = 8;

/**
 * Converts decoded RGBA pixels to a mask. A fully transparent pixel is air; every opaque pixel
 * must match a palette colour exactly; partial alpha is rejected (antialiasing would corrupt it).
 */
export function maskFromRgba(
  rgba: Uint8Array,
  width: number,
  height: number,
  palette: readonly MaskColor[],
): Mask {
  if (rgba.length !== width * height * 4) {
    throw new RangeError(`expected ${width * height * 4} RGBA bytes, got ${rgba.length}`);
  }
  const lookup = new Map<number, number>();
  for (const c of palette) lookup.set((c.r << 16) | (c.g << 8) | c.b, c.material);

  const data = new Uint8Array(width * height);
  const first: UnknownMaskColor[] = [];
  let unknown = 0;
  for (let i = 0; i < data.length; i++) {
    const o = i * 4;
    const a = rgba[o + 3] ?? 0;
    if (a === 0) {
      data[i] = Material.Air;
      continue;
    }
    const key = ((rgba[o] ?? 0) << 16) | ((rgba[o + 1] ?? 0) << 8) | (rgba[o + 2] ?? 0);
    const material = a === 255 ? lookup.get(key) : undefined;
    if (material === undefined) {
      unknown++;
      if (first.length < REPORTED_UNKNOWN) {
        first.push({ x: i % width, y: Math.trunc(i / width), rgba: ((key << 8) | a) >>> 0 });
      }
      continue;
    }
    data[i] = material;
  }
  if (unknown > 0) throw new MaskColorError(unknown, first);
  return { width, height, data };
}

/** Material at (x, y) in px; outside the map is air. */
export function materialAt(mask: Mask, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= mask.width || y >= mask.height) return Material.Air;
  return mask.data[y * mask.width + x] ?? Material.Air;
}
