// Generated test maps (tools/gen-test-maps.ts writes them to tests/fixtures/maps/<id>.png).
import { Material } from '../../../src/sim/terrain/material.ts';

export const TEST_MASK_WIDTH = 96;
export const TEST_MASK_HEIGHT = 64;

/** Material id for each pixel: air sky, wavy earth, a rock floor, a wall, a wooden plank, a ladder. */
export function testMaskMaterial(x: number, y: number): number {
  if (y >= 56) return Material.Rock;
  if (x >= 40 && x < 46 && y >= 20) return Material.BuiltStone;
  if (y === 30 && x >= 60 && x < 80) return Material.Wood;
  if (x === 85 && y >= 26) return Material.Ladder;
  const ground = 36 + ((x * 7) % 11) - 5;
  return y >= ground ? Material.Earth : Material.Air;
}

export function expectedTestMask(): Uint8Array {
  const data = new Uint8Array(TEST_MASK_WIDTH * TEST_MASK_HEIGHT);
  for (let y = 0; y < TEST_MASK_HEIGHT; y++) {
    for (let x = 0; x < TEST_MASK_WIDTH; x++)
      data[y * TEST_MASK_WIDTH + x] = testMaskMaterial(x, y);
  }
  return data;
}

/** FNV-1a of the mask bytes; a change means the fixture or the decoder changed. */
export const TEST_MASK_HASH = 4116456322;

/** A generated test map: size and a material for each pixel. */
export interface TestMapSpec {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly material: (x: number, y: number) => number;
}

/** Flat earth at y = 500 on a rock bed. */
const flat: TestMapSpec = {
  id: 'flat',
  width: 1200,
  height: 600,
  material: (_x, y) => (y >= 580 ? Material.Rock : y >= 500 ? Material.Earth : Material.Air),
};

/** Rolling hills, a stone wall in the valley and a ladder. Integer formulas only. */
const hills: TestMapSpec = {
  id: 'hills',
  width: 1600,
  height: 700,
  material: (x, y) => {
    if (y >= 680) return Material.Rock;
    // Triangle waves of period 400 and 130 make two hills and some bumps.
    const big = Math.abs((x % 400) - 200);
    const small = Math.abs((x % 130) - 65);
    const ground = 420 + Math.trunc(big / 2) + Math.trunc(small / 5);
    if (x >= 790 && x < 810 && y >= 440 && y < ground) return Material.BuiltStone;
    if (x >= 1180 && x < 1184 && y >= 380 && y < ground) return Material.Ladder;
    return y >= ground ? Material.Earth : Material.Air;
  },
};

/** Flat earth at y = 500 with a stone tower, x 560–640, rising to y = 260 (GDD §4.7). */
const tower: TestMapSpec = {
  id: 'tower',
  width: 1200,
  height: 600,
  material: (x, y) => {
    if (y >= 580) return Material.Rock;
    if (x >= 560 && x < 640 && y >= 260 && y < 500) return Material.BuiltStone;
    return y >= 500 ? Material.Earth : Material.Air;
  },
};

/** The structures of the tower map, as its map.json would declare them. */
export const TOWER_STRUCTURES = [{ id: 1, type: 'tower', rect: [560, 260, 80, 240] }] as const;

export const TEST_MAPS: readonly TestMapSpec[] = [
  {
    id: 'test-mask',
    width: TEST_MASK_WIDTH,
    height: TEST_MASK_HEIGHT,
    material: testMaskMaterial,
  },
  flat,
  hills,
  tower,
];
