// Rain and lightning (GDD §5 bis). Only with rules.weather (absent from older logs). At the end
// of each turn: the rain may begin, or, while it rains, lightning may strike a column of the
// field drawn at random, and the rain counts down.
import type { SimEvent } from './events.ts';
import { queueExplosion } from './explosions/explosion.ts';
import { SUBPX } from './math/fixed.ts';
import { nextInt, nextRange } from './math/prng.ts';
import type { SimState } from './state.ts';
import { isSolid } from './terrain/terrain.ts';

/** percent of the map width at each end where lightning never strikes */
const EDGE_PCT = 5;

/** Highest solid row of column x, or the map height. */
function groundAt(s: SimState, x: number): number {
  for (let y = 0; y < s.terrain.height; y++) if (isSolid(s.terrain, x, y)) return y;
  return s.terrain.height;
}

export function weatherTurnEnd(s: SimState, events: SimEvent[]): void {
  const r = s.rules.weather;
  if (!r) return;
  if (s.rain === 0) {
    if (nextInt(s.prng, 1000) < r.rainPermille) {
      s.rain = nextRange(s.prng, r.rainTurnsMin, Math.max(r.rainTurnsMin, r.rainTurnsMax));
      events.push({ e: 'rainStarted' });
    }
    return;
  }
  if (nextInt(s.prng, 1000) < r.lightningPermille) {
    const w = s.terrain.width;
    const edge = Math.trunc((w * EDGE_PCT) / 100);
    const x = nextRange(s.prng, edge, w - 1 - edge);
    const y = Math.min(groundAt(s, x), s.waterY);
    queueExplosion(s.explosions, s.tick + 1, {
      x: x * SUBPX + SUBPX / 2,
      y: y * SUBPX,
      radius: r.radius,
      carveRadius: r.radius,
      maxDamage: r.damage,
      sourceId: s.nextEntityId++,
    });
    events.push({ e: 'lightning', x, y });
  }
  s.rain--;
  if (s.rain === 0) events.push({ e: 'rainStopped' });
}
