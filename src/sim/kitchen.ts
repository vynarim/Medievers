// La cuisine de campagne (GDD §4.9): appears now and then between the two sides, heals the unit
// whose shot touches it. Only runs when the match rules have `kitchen` (absent from older logs).
import {
  KITCHEN_FLAT_TOLERANCE,
  KITCHEN_HEIGHT,
  KITCHEN_UNIT_CLEARANCE,
  KITCHEN_WIDTH,
  type KitchenRules,
} from '../content/kitchen.ts';
import type { SimEvent } from './events.ts';
import { SUBPX, idiv, subToPx } from './math/fixed.ts';
import { nextRange } from './math/prng.ts';
import type { SimState } from './state.ts';
import { isSolid } from './terrain/terrain.ts';

/** px per tick a kitchen falls when the ground under it is blown away (a plain drop, no physics) */
const FALL_PX = 4;

/** Per mille chance of an appearance during `round` (0-based): decays each round, floored. */
export function kitchenChance(r: KitchenRules, round: number): number {
  let c = r.chanceStartPermille;
  for (let i = 0; i < round && c > r.chanceFloorPermille; i++) c = idiv(c * r.chanceDecayPct, 100);
  return Math.max(r.chanceFloorPermille, c);
}

/**
 * Fairness: a team sees a kitchen appear on its turn only while it has not had more than any
 * other team still alive (GDD §4.9).
 */
export function kitchenAllowed(counts: readonly number[], team: number, alive: readonly number[]) {
  const mine = counts[team] ?? 0;
  return alive.every((t) => t === team || mine <= (counts[t] ?? 0));
}

/** Top of the ground in column x (px), or null. */
function surface(s: SimState, x: number): number | null {
  for (let y = 0; y < s.terrain.height; y++) if (isSolid(s.terrain, x, y)) return y;
  return null;
}

/** Ground level under the whole hearth at column x and empty air above it, or null. */
function flatSpot(s: SimState, x: number): number | null {
  const half = KITCHEN_WIDTH >> 1;
  const y = surface(s, x);
  if (y === null || y < KITCHEN_HEIGHT) return null;
  for (const dx of [-half, half]) {
    const g = surface(s, x + dx);
    if (g === null || Math.abs(g - y) > KITCHEN_FLAT_TOLERANCE) return null;
  }
  const near = s.units.some(
    (u) => u.alive && Math.abs(subToPx(u.x) - x) < KITCHEN_UNIT_CLEARANCE + half,
  );
  return near ? null : y;
}

/**
 * Called at each turn start, once the team is known: puts out an old kitchen, then maybe lights
 * a new one, halfway between the playing team and the closest enemy.
 */
export function kitchenTurn(s: SimState, events: SimEvent[]): void {
  const r = s.rules.kitchen;
  if (!r) return;
  const t = s.turn;
  if (s.kitchen && t.number >= s.kitchen.expiresTurn) {
    s.kitchen = null;
    events.push({ e: 'kitchenGone' });
  }
  if (s.kitchen) return;
  const alive = s.teams
    .filter((team) => team.unitIds.some((id) => s.units.some((u) => u.id === id && u.alive)))
    .map((team) => team.id);
  if (!kitchenAllowed(s.kitchenCounts, t.activeTeam, alive)) return;
  const round = idiv(t.number - 1, s.teams.length);
  if (nextRange(s.prng, 0, 999) >= kitchenChance(r, round)) return;

  // Closest pair (own unit, enemy unit) along x; the kitchen goes between them.
  let best: { a: number; b: number } | null = null;
  for (const u of s.units) {
    if (!u.alive || u.team !== t.activeTeam) continue;
    for (const e of s.units) {
      if (!e.alive || e.team === t.activeTeam) continue;
      const d = Math.abs(u.x - e.x);
      if (!best || d < Math.abs(best.a - best.b)) best = { a: u.x, b: e.x };
    }
  }
  if (!best) return;
  const mid = subToPx(idiv(best.a + best.b, 2));
  const span = Math.abs(subToPx(best.a) - subToPx(best.b));
  const reach = idiv(span * r.placeTolerancePct, 100);
  // Nearest flat spot to the midpoint, alternating sides: mid, mid+4, mid-4, mid+8…
  for (let off = 0; off <= reach; off += 4) {
    for (const x of off === 0 ? [mid] : [mid + off, mid - off]) {
      if (x < KITCHEN_WIDTH || x >= s.terrain.width - KITCHEN_WIDTH) continue;
      const y = flatSpot(s, x);
      if (y === null) continue;
      s.kitchen = {
        x: x * SUBPX,
        y: y * SUBPX,
        expiresTurn: t.number + r.lifeRounds * s.teams.length,
      };
      s.kitchenCounts[t.activeTeam] = (s.kitchenCounts[t.activeTeam] ?? 0) + 1;
      events.push({ e: 'kitchenAppeared', x, y });
      return;
    }
  }
}

/** True when the sub-px point lies in the kitchen's box. */
export function inKitchen(s: SimState, x: number, y: number, pad = 0): boolean {
  const k = s.kitchen;
  if (!k) return false;
  const half = (KITCHEN_WIDTH >> 1) * SUBPX + pad;
  return (
    x >= k.x - half && x <= k.x + half && y <= k.y + pad && y >= k.y - KITCHEN_HEIGHT * SUBPX - pad
  );
}

/** True when the segment between two sub-px points crosses the kitchen (2 px samples). */
export function segmentTouchesKitchen(
  s: SimState,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): boolean {
  if (!s.kitchen) return false;
  const steps = Math.max(1, idiv(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)), 2 * SUBPX));
  for (let i = 0; i <= steps; i++) {
    if (inKitchen(s, x0 + idiv((x1 - x0) * i, steps), y0 + idiv((y1 - y0) * i, steps))) {
      return true;
    }
  }
  return false;
}

/** The playing unit's shot touched the kitchen: it heals, the kitchen is gone. */
export function useKitchen(s: SimState, events: SimEvent[]): void {
  const r = s.rules.kitchen;
  if (!r || !s.kitchen) return;
  s.kitchen = null;
  const u = s.units.find((x) => x.id === s.turn.activeUnitId);
  const heal = u?.alive ? Math.max(0, Math.min(r.healHp, s.rules.startHp - u.hp)) : 0;
  if (u && heal > 0) u.hp += heal;
  events.push({ e: 'kitchenUsed', unitId: s.turn.activeUnitId, heal });
}

/** Each tick: the kitchen drops when the ground under it is gone, and is lost off the map. */
export function stepKitchen(s: SimState, events: SimEvent[]): void {
  const k = s.kitchen;
  if (!k) return;
  const x = subToPx(k.x);
  const half = KITCHEN_WIDTH >> 1;
  for (let i = 0; i < FALL_PX; i++) {
    const y = subToPx(k.y);
    if (
      isSolid(s.terrain, x, y) ||
      isSolid(s.terrain, x - half, y) ||
      isSolid(s.terrain, x + half, y)
    ) {
      return;
    }
    if (y >= s.terrain.height) {
      s.kitchen = null;
      events.push({ e: 'kitchenGone' });
      return;
    }
    k.y += SUBPX;
  }
}
