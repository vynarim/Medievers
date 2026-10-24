import { describe, expect, it } from 'vitest';
import { CLASSIC_RULES, type MatchRules } from '../../src/content/rules.ts';
import {
  Material,
  Sim,
  type Mask,
  type MatchConfig,
  SUBPX,
} from '../../src/sim/index.ts';

const WALL_X = 600;
const WALL_THICKNESS = 20;

/** Flat earth at y = 500 with a built stone wall 20 px thick, 120 px tall. */
function wallMask(): Mask {
  const width = 1200;
  const height = 600;
  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const wall = x >= WALL_X && x < WALL_X + WALL_THICKNESS && y >= 380;
      data[y * width + x] = wall ? Material.BuiltStone : y >= 500 ? Material.Earth : Material.Air;
    }
  }
  return { width, height, data };
}

// No wind, no field kitchen, no fire: every arrow follows the same path.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { kitchen, burn, ...NO_KITCHEN } = CLASSIC_RULES;
const CALM: MatchRules = { ...NO_KITCHEN, wind: { ...CLASSIC_RULES.wind, max: 0 } };

/**
 * Team 0 shoots level arrows at the wall each of its turns, team 1 passes. Returns the number
 * of the first arrow that lands beyond the wall, or null.
 */
function arrowsToPierce(rules: MatchRules, maxShots: number): number | null {
  const config: MatchConfig = { rules, teams: [{ spawns: [500] }, { spawns: [1100] }] };
  const sim = new Sim(config, 5, wallMask());
  const until = (phase: string): void => {
    for (let i = 0; i < 20000 && sim.view().turn.phase !== phase; i++) sim.step();
  };
  for (let shot = 1; shot <= maxShots; shot++) {
    until('action');
    sim.step([
      { t: 'aim', angle: 0 },
      { t: 'fire', power: 1024 },
    ]);
    // Follow the arrow to where it stops.
    let lastX = 0;
    while (sim.view().shots.length > 0) {
      lastX = sim.view().shots[0]?.projectile.x ?? lastX;
      sim.step();
    }
    if (lastX / SUBPX >= WALL_X + WALL_THICKNESS) return shot;
    until('transition');
    until('action');
    sim.step([{ t: 'skip' }]);
  }
  return null;
}

describe('terrain wear (GDD §4.7)', () => {
  it('lets enough arrows go through a built stone wall', () => {
    // Each arrow digs about 4 px into 20 px of stone (radius 3 px, resistance 150 %):
    // five arrows dig the hole, the sixth goes through.
    expect(arrowsToPierce(CALM, 40)).toBe(6);
  });

  it('leaves the ground untouched for weapons without wear (older logs)', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const weapons = CALM.weapons.map(({ chipRadius, ...w }) => w);
    expect(arrowsToPierce({ ...CALM, weapons }, 6)).toBeNull();
  });
});
