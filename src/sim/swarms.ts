// La ruche (GDD §4.1): where the thrown hive breaks, a swarm comes out and flies after the
// nearest living unit, whoever's it is, over the ground and through it, stinging the unit it is
// on every few ticks, until it scatters.
import { weaponDefIn } from '../content/rules.ts';
import type { SimEvent } from './events.ts';
import { cosQ14, sinQ14, atan2Bam } from './math/angle.ts';
import { SUBPX, idiv, mulQ14, subToPx } from './math/fixed.ts';
import { isqrt } from './math/isqrt.ts';
import { touchesUnit } from './projectiles/projectile.ts';
import type { FlyingShot, SimState } from './state.ts';
import { UNIT_HEIGHT, type Unit } from './units/unit.ts';

/** The hive breaks where shot `shot` struck: its swarm comes out there. */
export function breakHive(s: SimState, shot: FlyingShot, events: SimEvent[]): void {
  const def = weaponDefIn(s.rules, shot.weapon);
  if (!def.hive) return;
  const p = shot.projectile;
  s.swarms.push({
    id: p.id,
    weapon: def.id,
    x: p.x,
    y: p.y,
    ticks: def.hive.ticks,
    sting: 0,
    damagePct: shot.damagePct ?? 100,
  });
  s.swarms.sort((a, b) => a.id - b.id);
  events.push({ e: 'swarmOut', id: p.id, x: subToPx(p.x), y: subToPx(p.y) });
}

/** sub-px: the middle of a unit's body */
const middle = (u: Unit): number => u.y - (UNIT_HEIGHT * SUBPX) / 2;

/** The living unit nearest to (x, y), sub-px; ties go to the lower id. */
function nearest(s: SimState, x: number, y: number): Unit | null {
  let best: Unit | null = null;
  let bestD = 0;
  for (const u of s.units) {
    if (!u.alive) continue;
    const dx = subToPx(u.x - x);
    const dy = subToPx(middle(u) - y);
    const d = dx * dx + dy * dy;
    if (!best || d < bestD) {
      best = u;
      bestD = d;
    }
  }
  return best;
}

/** Each tick: every swarm flies after the nearest unit and stings it, until it scatters. */
export function stepSwarms(s: SimState, events: SimEvent[]): void {
  if (s.swarms.length === 0) return;
  const left = [];
  for (const w of s.swarms) {
    const def = weaponDefIn(s.rules, w.weapon);
    const h = def.hive;
    if (!h || --w.ticks <= 0) {
      events.push({ e: 'swarmGone', id: w.id });
      events.push({ e: 'shotEnded', shotId: w.id });
      continue;
    }
    if (w.sting > 0) w.sting--;
    const u = nearest(s, w.x, w.y);
    if (u) {
      const dx = u.x - w.x;
      const dy = middle(u) - w.y;
      const dist = isqrt(subToPx(dx) * subToPx(dx) + subToPx(dy) * subToPx(dy)) * SUBPX;
      if (dist <= h.speed) {
        w.x = u.x;
        w.y = middle(u);
      } else {
        const a = atan2Bam(dy, dx);
        w.x += mulQ14(h.speed, cosQ14(a));
        w.y += mulQ14(h.speed, sinQ14(a));
      }
      if (w.sting === 0 && touchesUnit(u, w.x, w.y, h.reach)) {
        const damage = Math.min(u.hp, idiv(def.damage * w.damagePct + 50, 100));
        u.hp -= damage;
        w.sting = h.every;
        events.push({ e: 'stung', unitId: u.id });
        events.push({ e: 'unitDamaged', unitId: u.id, damage });
      }
    }
    left.push(w);
  }
  s.swarms = left;
}
