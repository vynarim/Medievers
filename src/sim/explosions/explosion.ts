// Explosions (TECH_SPEC §5.3): carve a disc, deal damage falling linearly from the centre to
// the radius, push units radially. Chain reactions are queued for the next tick.
import type { ExplosionRules } from '../../content/world.ts';
import type { WeaponId } from '../../content/weapons.ts';
import { SUBPX, idiv, subToPx } from '../math/fixed.ts';
import { isqrt } from '../math/isqrt.ts';
import { carveCircle, type Terrain } from '../terrain/terrain.ts';
import { UNIT_HEIGHT, launch, type Unit } from '../units/unit.ts';

export interface Explosion {
  /** sub-px */
  readonly x: number;
  /** sub-px */
  readonly y: number;
  /** px: damage radius */
  readonly radius: number;
  /** px: carve radius, usually the damage radius */
  readonly carveRadius: number;
  /** HP at the centre */
  readonly maxDamage: number;
  /** entity that caused it, for ordering and credit */
  readonly sourceId: number;
  /** it leaves burning flames on the ground (rules.flames) */
  readonly flames?: boolean;
  /** weapon that caused it, for the damage to structures (rules.structures); absent: other */
  readonly weapon?: WeaponId;
}

export interface UnitHit {
  readonly unitId: number;
  readonly damage: number;
}

export interface ExplosionResult {
  readonly carved: number;
  /** units hit, in unit id order */
  readonly hits: readonly UnitHit[];
}

/** Percent of damage a unit actually takes (class passives); 100 by default. */
export type DamageTakenPct = (u: Unit) => number;

/**
 * Linear damage falloff: max at distance 0, 0 at the radius, rounded half up.
 * Distances in sub-px.
 */
export function damageAt(maxDamage: number, radiusSub: number, distSub: number): number {
  if (distSub >= radiusSub) return 0;
  return idiv(maxDamage * (radiusSub - distSub) * 2 + radiusSub, 2 * radiusSub);
}

/** sub-px: centre of a unit's hitbox, used for damage distance (TECH_SPEC §5.3). */
export function hitboxCentreY(u: Unit): number {
  return u.y - (UNIT_HEIGHT * SUBPX) / 2;
}

export function explode(
  e: Explosion,
  t: Terrain,
  units: readonly Unit[],
  rules: ExplosionRules,
  takenPct: DamageTakenPct = () => 100,
): ExplosionResult {
  const carved = carveCircle(t, subToPx(e.x), subToPx(e.y), e.carveRadius);
  const radiusSub = e.radius * SUBPX;
  const hits: UnitHit[] = [];
  for (const u of units) {
    if (!u.alive) continue;
    const dx = u.x - e.x;
    const dy = hitboxCentreY(u) - e.y;
    const dist = isqrt(dx * dx + dy * dy);
    const base = damageAt(e.maxDamage, radiusSub, dist);
    if (base === 0) continue;
    const damage = idiv(base * takenPct(u) + 50, 100);
    u.hp = Math.max(0, u.hp - damage);
    hits.push({ unitId: u.id, damage });
    knock(u, dx, dy, dist, base * rules.knockbackPerHp, rules.liftPct);
  }
  return { carved, hits };
}

/** Pushes a unit away from the blast at `speed` sub-px/tick, plus a lift. */
function knock(u: Unit, dx: number, dy: number, dist: number, speed: number, liftPct: number) {
  if (dist === 0) {
    u.vx = 0;
    u.vy = -speed;
  } else {
    u.vx += idiv(dx * speed, dist);
    u.vy += idiv(dy * speed, dist);
  }
  u.vy -= idiv(speed * liftPct, 100);
  launch(u);
}

/** An explosion waiting for its tick (chain reactions resolve on the following tick). */
export interface QueuedExplosion {
  readonly tick: number;
  /** insertion order, the final tie-breaker */
  readonly seq: number;
  readonly explosion: Explosion;
}

export interface ExplosionQueue {
  items: QueuedExplosion[];
  nextSeq: number;
}

export function createExplosionQueue(): ExplosionQueue {
  return { items: [], nextSeq: 0 };
}

export function queueExplosion(q: ExplosionQueue, tick: number, explosion: Explosion): void {
  q.items.push({ tick, seq: q.nextSeq++, explosion });
}

/** Removes and returns the explosions due at `tick`, ordered by source entity id then seq. */
export function takeDueExplosions(q: ExplosionQueue, tick: number): Explosion[] {
  const due = q.items.filter((i) => i.tick <= tick);
  q.items = q.items.filter((i) => i.tick > tick);
  due.sort((a, b) => a.explosion.sourceId - b.explosion.sourceId || a.seq - b.seq);
  return due.map((i) => i.explosion);
}
