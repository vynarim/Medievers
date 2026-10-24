import { readFileSync } from 'node:fs';
import { encode } from 'fast-png';
import { describe, expect, it } from 'vitest';
import { decodeMaskPng } from '../../../src/app/loaders/mask-png.ts';
import { MASK_PALETTE } from '../../../src/content/materials.ts';
import { FNV_OFFSET, hashBytes } from '../../../src/sim/math/index.ts';
import {
  Material,
  MaskColorError,
  maskFromRgba,
  materialAt,
} from '../../../src/sim/terrain/index.ts';
import {
  TEST_MASK_HASH,
  TEST_MASK_HEIGHT,
  TEST_MASK_WIDTH,
  expectedTestMask,
} from '../../fixtures/maps/test-maps.ts';

const fixture = (): Uint8Array =>
  new Uint8Array(readFileSync(new URL('../../fixtures/maps/test-mask.png', import.meta.url)));

const earth = MASK_PALETTE.find((c) => c.material === Material.Earth);

describe('mask PNG loading (Node)', () => {
  it('decodes the test mask to the expected materials', () => {
    const mask = decodeMaskPng(fixture());
    expect([mask.width, mask.height]).toEqual([TEST_MASK_WIDTH, TEST_MASK_HEIGHT]);
    expect(mask.data).toEqual(expectedTestMask());
    expect(hashBytes(FNV_OFFSET, mask.data)).toBe(TEST_MASK_HASH);
  });

  it('uses every material', () => {
    const used = new Set(decodeMaskPng(fixture()).data);
    expect([...used].sort()).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('accepts RGB PNGs', () => {
    const rgb = new Uint8Array([earth?.r ?? 0, earth?.g ?? 0, earth?.b ?? 0, 255, 0, 255]);
    const png = encode({ width: 2, height: 1, data: rgb, channels: 3, depth: 8 });
    expect(Array.from(decodeMaskPng(png).data)).toEqual([Material.Earth, Material.Ladder]);
  });

  it('rejects unknown colours and partial alpha, reporting where', () => {
    const rgba = new Uint8Array([0, 0, 0, 0, 1, 2, 3, 255, 139, 94, 52, 128]);
    try {
      maskFromRgba(rgba, 3, 1, MASK_PALETTE);
      expect.fail('expected MaskColorError');
    } catch (e) {
      expect(e).toBeInstanceOf(MaskColorError);
      const err = e as MaskColorError;
      expect(err.count).toBe(2);
      expect(err.first).toEqual([
        { x: 1, y: 0, rgba: 0x010203ff },
        { x: 2, y: 0, rgba: 0x8b5e3480 },
      ]);
    }
  });

  it('rejects a buffer of the wrong size', () => {
    expect(() => maskFromRgba(new Uint8Array(4), 2, 1, MASK_PALETTE)).toThrow(RangeError);
  });

  it('reads materials with air outside the map', () => {
    const mask = decodeMaskPng(fixture());
    expect(materialAt(mask, 0, 60)).toBe(Material.Rock);
    expect(materialAt(mask, 42, 25)).toBe(Material.BuiltStone);
    expect(materialAt(mask, -1, 60)).toBe(Material.Air);
    expect(materialAt(mask, 0, TEST_MASK_HEIGHT)).toBe(Material.Air);
  });
});
