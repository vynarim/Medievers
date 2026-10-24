// Writes tests/fixtures/maps/test-mask.png, a small mask using every material.
// Usage: node tools/gen-test-mask.ts
import { writeFileSync } from 'node:fs';
import { encode } from 'fast-png';
import { MASK_PALETTE } from '../src/content/materials.ts';
import {
  TEST_MASK_HEIGHT,
  TEST_MASK_WIDTH,
  testMaskMaterial,
} from '../tests/fixtures/maps/test-mask.ts';

export function buildTestMaskPng(): Uint8Array {
  const data = new Uint8Array(TEST_MASK_WIDTH * TEST_MASK_HEIGHT * 4);
  for (let y = 0; y < TEST_MASK_HEIGHT; y++) {
    for (let x = 0; x < TEST_MASK_WIDTH; x++) {
      const color = MASK_PALETTE.find((c) => c.material === testMaskMaterial(x, y));
      if (!color) continue; // air stays fully transparent
      data.set([color.r, color.g, color.b, 255], (y * TEST_MASK_WIDTH + x) * 4);
    }
  }
  return encode({ width: TEST_MASK_WIDTH, height: TEST_MASK_HEIGHT, data, channels: 4, depth: 8 });
}

if (import.meta.main) {
  writeFileSync(
    new URL('../tests/fixtures/maps/test-mask.png', import.meta.url),
    buildTestMaskPng(),
  );
  console.log('wrote tests/fixtures/maps/test-mask.png');
}
