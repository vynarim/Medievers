// Writes tests/fixtures/maps/<id>.png for every map of TEST_MAPS.
// Usage: node tools/gen-test-maps.ts
import { writeFileSync } from 'node:fs';
import { encode } from 'fast-png';
import { MASK_PALETTE } from '../src/content/materials.ts';
import { TEST_MAPS, type TestMapSpec } from '../tests/fixtures/maps/test-maps.ts';

export function buildMaskPng(spec: TestMapSpec): Uint8Array {
  const data = new Uint8Array(spec.width * spec.height * 4);
  for (let y = 0; y < spec.height; y++) {
    for (let x = 0; x < spec.width; x++) {
      const color = MASK_PALETTE.find((c) => c.material === spec.material(x, y));
      if (!color) continue; // air stays fully transparent
      data.set([color.r, color.g, color.b, 255], (y * spec.width + x) * 4);
    }
  }
  return encode({ width: spec.width, height: spec.height, data, channels: 4, depth: 8 });
}

if (import.meta.main) {
  for (const spec of TEST_MAPS) {
    writeFileSync(
      new URL(`../tests/fixtures/maps/${spec.id}.png`, import.meta.url),
      buildMaskPng(spec),
    );
    console.log(`wrote tests/fixtures/maps/${spec.id}.png`);
  }
}
