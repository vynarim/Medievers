// Persistent flames (GDD §4.1, §4.6). Only with rules.flames (absent from older logs). A blast
// marked `flames` leaves burning patches on the ground over its radius; they burn whoever stands
// in them, a few HP per tick up to a cap per turn, set powder barrels off, drop when the ground
// goes, and go out after a few turns or in the water.
import { UNIT_HALF_WIDTH, UNIT_HEIGHT } from './units/unit.ts';
import type { SimEvent } from './events.ts';
import type { Explosion } from './explosions/explosion.ts';
import { SUBPX, idiv, subToPx } from './math/fixed.ts';
import type { SimState } from './state.ts';
import { Material } from './terrain/material.ts';
import { isSolid, materialOf } from './terrain/terrain.ts';
import { barrelOnSegment, igniteBarrel } from './barrels.ts';

/** px per tick a flame drops when its ground is gone */
const FALL_PX = 4;

/** Ground row at column x, searching down from y0 to y1; null if none. */
function groundBelow(s: SimState, x: number, y0: number, y1: number): number | null {
  for (let y = Math.max(0, y0); y <= y1 && y < s.terrain.height; y++) {
    if (isSolid(s.terrain, x, y) && !isSolid(s.terrain, x, y - 1)) return y;
  }
  return null;
}

/** A blast marked `flames` leaves its flames on the ground under it, evenly spread. */
export function spawnFlames(s: SimState, e: Explosion): void {
  const r = s.rules.flames;
  if (!r || !e.flames || r.count <= 0) return;
  const cx = subToPx(e.x);
  const cy = subToPx(e.y);
  const span = idiv(e.radius * 4, 5);
  for (let i = 0; i < r.count; i++) {
    const x = r.count > 1 ? cx - span + idiv(2 * span * i, r.count - 1) : cx;
    if (x < 0 || x >= s.terrain.width) continue;
    const y = groundBelow(s, x, cy - e.radius, cy + 2 * e.radius);
    if (y === null || (s.waterY < s.terrain.height && y > s.waterY)) continue;
    s.flames.push({ id: s.nextEntityId++, x: x * SUBPX + SUBPX / 2, y: y * SUBPX, turns: r.turns });
  }
}

/**
 * A fire arrow struck the ground at px (x, y): one flame there, unless the ground is stone (rock,
 * dressed stone) or under water.
 */
export function flameAt(s: SimState, x: number, y: number): void {
  const r = s.rules.flames;
  if (!r || x < 0 || x >= s.terrain.width) return;
  const ground = groundBelow(s, x, y - 6, y + 12);
  if (ground === null || (s.waterY < s.terrain.height && ground > s.waterY)) return;
  const m = materialOf(s.terrain, x, ground);
  if (m === Material.Rock || m === Material.BuiltStone) return;
  s.flames.push({
    id: s.nextEntityId++,
    x: x * SUBPX + SUBPX / 2,
    y: ground * SUBPX,
    turns: r.turns,
  });
  s.flames.sort((a, b) => a.id - b.id);
}

/** Each tick: flames drop where the ground went, burn the units touching them, light barrels. */
export function stepFlames(s: SimState, events: SimEvent[]): void {
  const r = s.rules.flames;
  if (!r || s.flames.length === 0) return;
  const half = UNIT_HALF_WIDTH + r.radius;
  for (let i = s.flames.length - 1; i >= 0; i--) {
    const f = s.flames[i];
    if (!f) continue;
    const x = subToPx(f.x);
    for (let k = 0; k < FALL_PX && !isSolid(s.terrain, x, subToPx(f.y)); k++) f.y += SUBPX;
    if (subToPx(f.y) >= s.terrain.height) {
      s.flames.splice(i, 1);
      continue;
    }
    const top = f.y - r.radius * SUBPX;
    const barrel = barrelOnSegment(s, f.x, top, f.x, f.y);
    if (barrel !== null) igniteBarrel(s, barrel, 1);
  }
  for (const u of s.units) {
    if (!u.alive || u.hp <= 0) continue;
    const touching = s.flames.some(
      (f) =>
        Math.abs(f.x - u.x) <= half * SUBPX &&
        f.y >= u.y - (UNIT_HEIGHT + r.radius) * SUBPX &&
        f.y <= u.y + r.radius * SUBPX,
    );
    if (!touching) continue;
    let scorch = s.scorched.find((c) => c.unitId === u.id);
    if (!scorch) {
      scorch = { unitId: u.id, hp: 0 };
      s.scorched.push(scorch);
      s.scorched.sort((a, b) => a.unitId - b.unitId);
    }
    const damage = Math.min(r.damagePerTick, r.maxPerTurn - scorch.hp, u.hp);
    if (damage <= 0) continue;
    scorch.hp += damage;
    u.hp -= damage;
    events.push({ e: 'unitDamaged', unitId: u.id, damage });
  }
}

/** Start of a turn: the burns of the last turn are forgotten (the cap is per turn). */
export function flamesTurnStart(s: SimState): void {
  if (s.scorched.length > 0) s.scorched = [];
}

/** End of a turn: every flame burns down by one turn; the spent ones go out. */
export function flamesTurnEnd(s: SimState): void {
  if (s.flames.length === 0) return;
  for (const f of s.flames) f.turns--;
  s.flames = s.flames.filter((f) => f.turns > 0);
}

/** Flames under the water go out. */
export function drownFlames(s: SimState): void {
  if (s.flames.length === 0 || s.waterY >= s.terrain.height) return;
  s.flames = s.flames.filter((f) => subToPx(f.y) <= s.waterY);
}
