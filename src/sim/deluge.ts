// Water and le Déluge (GDD §2.4, §3.1). The water drowns any unit whose feet go under its
// surface, puts out what falls in, and, once the Déluge has begun, rises at every turn end.
// Without water above the bottom of the map (older logs) nothing here does anything.
import type { SimEvent } from './events.ts';
import { SUBPX, subToPx } from './math/fixed.ts';
import type { SimState } from './state.ts';
import { bodyFree, supported, type Unit } from './units/unit.ts';

/** px between two columns tried when looking for dry ground */
const SHORE_STEP = 4;

/** There is water on the map: its top is above the bottom edge. */
export function hasWater(s: SimState): boolean {
  return s.waterY < s.terrain.height;
}

/** px row y is under the water. */
export function underWater(s: SimState, y: number): boolean {
  return hasWater(s) && y > s.waterY;
}

/**
 * px: the nearest place out of the water where unit u can stand, its feet on the highest ground
 * of a column, searching outwards from its own column; null when the water covers everything.
 */
function dryGround(s: SimState, u: Unit): { x: number; y: number } | null {
  const t = s.terrain;
  const x0 = subToPx(u.x);
  for (let d = 0; d < t.width; d += SHORE_STEP) {
    for (const x of d === 0 ? [x0] : [x0 - d, x0 + d]) {
      if (x < 0 || x >= t.width) continue;
      for (let y = 0; y <= s.waterY && y < t.height; y++) {
        if (supported(t, x, y) && bodyFree(t, x, y)) return { x, y };
      }
    }
  }
  return null;
}

/**
 * Units whose feet are under the water (GDD §3.1): with rules.deluge.wetDamage they lose that
 * many HP and are washed up on the nearest dry ground, drowning only if none is left or the HP
 * run out; without it (older logs), they drown at once.
 */
export function drownUnits(s: SimState, events: SimEvent[]): void {
  if (!hasWater(s)) return;
  const wet = s.rules.deluge?.wetDamage;
  for (const u of s.units) {
    if (!u.alive || !underWater(s, subToPx(u.y))) continue;
    const shore = wet !== undefined ? dryGround(s, u) : null;
    if (shore) {
      const damage = Math.min(u.hp, wet ?? 0);
      u.hp -= damage;
      events.push({ e: 'unitDamaged', unitId: u.id, damage, source: 'water' });
      u.x = shore.x * SUBPX + SUBPX / 2;
      u.y = shore.y * SUBPX;
      u.vx = 0;
      u.vy = 0;
      u.grounded = true;
      u.knocked = false;
      u.climbing = false;
      u.airPeakY = shore.y;
      events.push({ e: 'washedUp', unitId: u.id, x: shore.x, y: shore.y });
      if (u.hp > 0) continue;
    }
    u.alive = false;
    u.hp = 0;
    events.push({ e: 'unitDied', unitId: u.id, cause: 'drowned' });
  }
}

/**
 * What falls into the water is lost: flying shots end (a pot fizzles out), reliquaries, barrels,
 * resting pots, the kitchen and the beast go under.
 */
export function drownThings(s: SimState, events: SimEvent[]): void {
  if (!hasWater(s)) return;
  const wet = (y: number): boolean => underWater(s, subToPx(y));
  const shots = s.shots.filter((shot) => wet(shot.projectile.y));
  if (shots.length > 0) {
    s.shots = s.shots.filter((shot) => !wet(shot.projectile.y));
    for (const shot of shots) events.push({ e: 'shotEnded', shotId: shot.projectile.id });
  }
  for (let i = s.crates.length - 1; i >= 0; i--) {
    const c = s.crates[i];
    if (!c || !wet(c.y)) continue;
    s.crates.splice(i, 1);
    events.push({ e: 'crateBurst', id: c.id, trap: false });
  }
  const barrels = s.barrels.filter((b) => wet(b.y));
  if (barrels.length > 0) {
    s.barrels = s.barrels.filter((b) => !wet(b.y));
    for (const b of barrels) events.push({ e: 'barrelLost', id: b.id });
  }
  for (let i = s.pots.length - 1; i >= 0; i--) {
    const p = s.pots[i];
    if (p && wet(p.y)) s.pots.splice(i, 1);
  }
  if (s.kitchen && wet(s.kitchen.y)) {
    s.kitchen = null;
    events.push({ e: 'kitchenGone' });
  }
  if (s.beast && wet(s.beast.y)) {
    s.beast = null;
    events.push({ e: 'beastGone' });
  }
}

/**
 * End of a turn with rules.deluge: the Déluge begins after enough turns or ticks; from then on
 * the water rises and every unit loses some HP (GDD §2.4).
 */
export function delugeTurnEnd(s: SimState, events: SimEvent[]): void {
  const r = s.rules.deluge;
  if (!r) return;
  if (!s.deluge && (s.turn.number >= r.startTurn || s.tick >= r.startTicks)) {
    s.deluge = true;
    events.push({ e: 'delugeStarted' });
  }
  if (!s.deluge) return;
  s.waterY = Math.max(0, Math.min(s.waterY, s.terrain.height) - r.risePx);
  events.push({ e: 'waterRose', y: s.waterY });
  if (r.damage > 0) {
    for (const u of s.units) {
      if (!u.alive || u.hp <= 0) continue;
      const damage = Math.min(u.hp, r.damage);
      u.hp -= damage;
      events.push({ e: 'unitDamaged', unitId: u.id, damage, source: 'deluge' });
    }
  }
  drownUnits(s, events);
  drownThings(s, events);
}
