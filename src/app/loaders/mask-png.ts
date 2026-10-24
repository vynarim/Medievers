// Decodes a mask PNG into a collision mask. Same pure-JS decoder in Node and in the browser,
// so the mask is byte-identical everywhere (no canvas colour management or premultiplied alpha).
import { decode } from 'fast-png';
import { MASK_PALETTE } from '../../content/materials.ts';
import { maskFromRgba, type Mask } from '../../sim/terrain/mask.ts';

export function decodeMaskPng(png: Uint8Array): Mask {
  const img = decode(png);
  if (img.depth !== 8) throw new Error(`mask PNG must be 8-bit, got ${img.depth}-bit`);
  if (img.palette) throw new Error('mask PNG must be RGB or RGBA, not indexed');
  const pixels = img.width * img.height;
  const rgba = new Uint8Array(pixels * 4);
  const src = img.data;
  if (img.channels === 4) {
    rgba.set(src);
  } else if (img.channels === 3) {
    for (let i = 0; i < pixels; i++) {
      rgba[i * 4] = src[i * 3] ?? 0;
      rgba[i * 4 + 1] = src[i * 3 + 1] ?? 0;
      rgba[i * 4 + 2] = src[i * 3 + 2] ?? 0;
      rgba[i * 4 + 3] = 255;
    }
  } else {
    throw new Error(`mask PNG must have 3 or 4 channels, got ${img.channels}`);
  }
  return maskFromRgba(rgba, img.width, img.height, MASK_PALETTE);
}
