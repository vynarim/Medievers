// Weapon behaviours (CLAUDE.md: one WeaponDef in content + one behaviour here).
//  - directHit: arrow, bolt or stone; damages and pushes the unit it hits, chips the ground.
//  - fusedBouncer: pot that bounces until its fuse runs out, then explodes.
//  - cluster: a fusedBouncer that bursts into fragments, each exploding where it lands.
//  - melee: no projectile; strikes what stands within reach along the aim.
import { weaponDefIn } from '../../content/rules.ts';
import type { WeaponDef } from '../../content/weapons.ts';
import type { ExplosionRules } from '../../content/world.ts';
import { cosQ14, sinQ14 } from '../math/angle.ts';
import { SUBPX, idiv, mulQ14, subToPx } from '../math/fixed.ts';
import { isqrt } from '../math/isqrt.ts';
import { queueExplosion } from '../explosions/explosion.ts';
import { barrelOnSegment, igniteBarrel } from '../barrels.ts';
import { beastOnSegment, killBeast } from '../beasts.ts';
import { crateOnSegment, burstCrate } from '../crates.ts';
import { segmentTouchesKitchen, useKitchen } from '../kitchen.ts';
import { carveCircle } from '../terrain/terrain.ts';
import {
  bounce,
  createProjectile,
  stepProjectile,
  touchesUnit,
} from '../projectiles/projectile.ts';
import type { SimEvent } from '../events.ts';
import type { FlyingShot, SimState } from '../state.ts';
import { UNIT_HEIGHT, launch, type Unit } from '../units/unit.ts';
import { MAX_POWER } from '../commands.ts';

/** px from the hitbox centre to the muzzle */
const MUZZLE_DISTANCE = 20;
/** px: radius of the melee strike around the point at reach */
const STRIKE_RADIUS = 14;
/** BAM: fragments fly out over this fan, centred straight up */
const FRAGMENT_FAN = 1536;

/** Launches the selected weapon from unit u at the given power (0..1024). */
export function fire(state: SimState, u: Unit, power: number, events: SimEvent[]): void {
  const def = weaponDefIn(state.rules, state.turn.weapon);
  const angle = state.turn.aim;
  const id = state.nextEntityId++;
  if (def.behavior === 'melee') {
    events.push({ e: 'shotFired', shotId: id, weapon: def.id });
    strike(state, u, def, angle, events);
    events.push({ e: 'shotEnded', shotId: id });
    return;
  }
  const p = def.fixedPower ? MAX_POWER : Math.max(0, Math.min(power, MAX_POWER));
  const speed = idiv(def.maxSpeed * p, MAX_POWER);
  const cx = u.x;
  const cy = u.y - (UNIT_HEIGHT * SUBPX) / 2;
  const projectile = createProjectile(
    id,
    u.id,
    cx + mulQ14(MUZZLE_DISTANCE * SUBPX, cosQ14(angle)),
    cy + mulQ14(MUZZLE_DISTANCE * SUBPX, sinQ14(angle)),
    mulQ14(speed, cosQ14(angle)),
    mulQ14(speed, sinQ14(angle)),
    { radius: def.projectileRadius, windPct: def.windPct, gravityPct: 100 },
  );
  const fused = def.behavior === 'fusedBouncer' || def.behavior === 'cluster';
  state.shots.push({ projectile, weapon: def.id, fuse: fused ? state.turn.fuse : 0 });
  events.push({ e: 'shotFired', shotId: id, weapon: def.id });
}

/**
 * Melee blow: every other unit touching the point at `reach` along the aim takes the damage and
 * is thrown along the aim; a barrel there goes up, the kitchen there is used, the ground chips.
 */
function strike(state: SimState, u: Unit, def: WeaponDef, angle: number, events: SimEvent[]) {
  const reach = (def.reach ?? 0) * SUBPX;
  const dx = cosQ14(angle);
  const dy = sinQ14(angle);
  const cy = u.y - (UNIT_HEIGHT * SUBPX) / 2;
  const x = u.x + mulQ14(reach, dx);
  const y = cy + mulQ14(reach, dy);
  for (const other of state.units) {
    if (!other.alive || other.id === u.id || !touchesUnit(other, x, y, STRIKE_RADIUS)) continue;
    directHit(other, def, state.rules.explosion, dx, dy, events);
  }
  const barrel = barrelOnSegment(state, u.x, cy, x, y);
  if (barrel !== null) igniteBarrel(state, barrel, 1);
  const crate = crateOnSegment(state, u.x, cy, x, y);
  if (crate !== null) burstCrate(state, crate, events);
  if (segmentTouchesKitchen(state, u.x, cy, x, y)) useKitchen(state, events);
  if (beastOnSegment(state, u.x, cy, x, y)) killBeast(state, events);
  if (def.chipRadius) carveCircle(state.terrain, subToPx(x), subToPx(y), def.chipRadius);
}

/** Damages unit `u` by `damage` and pushes it along (vx, vy) scaled by the weapon. */
function directHit(
  u: Unit,
  def: WeaponDef,
  rules: ExplosionRules,
  vx: number,
  vy: number,
  events: SimEvent[],
): void {
  u.hp = Math.max(0, u.hp - def.damage);
  events.push({ e: 'unitDamaged', unitId: u.id, damage: def.damage });
  const speed = idiv(def.damage * rules.knockbackPerHp * def.knockbackPct, 100);
  const len = isqrt(vx * vx + vy * vy);
  if (len > 0) {
    u.vx += idiv(vx * speed, len);
    u.vy += idiv(vy * speed, len);
  }
  u.vy -= idiv(speed * rules.liftPct, 100);
  launch(u);
}

/** The burst of a cluster pot: its own blast, plus fragments fanned out upwards. */
function burst(state: SimState, shot: FlyingShot, def: WeaponDef, queue: FlyingShot[]): void {
  const p = shot.projectile;
  queueExplosion(state.explosions, state.tick, {
    x: p.x,
    y: p.y,
    radius: def.explosionRadius,
    carveRadius: def.explosionRadius,
    maxDamage: def.damage,
    sourceId: p.id,
  });
  const f = def.fragments;
  if (!f || f.count <= 0) return;
  const first = 3072 - (FRAGMENT_FAN >> 1);
  const step = f.count > 1 ? idiv(FRAGMENT_FAN, f.count - 1) : 0;
  for (let i = 0; i < f.count; i++) {
    const a = f.count > 1 ? first + i * step : 3072;
    const child = createProjectile(
      state.nextEntityId++,
      p.ownerId,
      p.x,
      p.y - 4 * SUBPX,
      mulQ14(f.speed, cosQ14(a)),
      mulQ14(f.speed, sinQ14(a)),
      { radius: 2, windPct: 0, gravityPct: 100 },
    );
    child.clearOfOwner = true;
    queue.push({ projectile: child, weapon: def.id, fuse: 0, fragment: true });
  }
}

/** Advances every flying shot by one tick, resolving impacts and fuses. */
export function stepShots(state: SimState, events: SimEvent[]): void {
  const remaining: FlyingShot[] = [];
  const spawned: FlyingShot[] = [];
  for (const shot of state.shots) {
    const p = shot.projectile;
    const def = weaponDefIn(state.rules, shot.weapon);
    const fromX = p.x;
    const fromY = p.y;
    let impact = stepProjectile(
      p,
      state.terrain,
      state.units,
      state.turn.wind,
      state.rules.wind.accelPerUnit,
    );
    let ended = false;
    // Things that stop an arrow, a bolt, a stone or a fragment: they count as an impact.
    const stops = def.behavior === 'directHit' || shot.fragment === true;
    // Any shot touching the field kitchen heals the shooter (GDD §4.9).
    if (segmentTouchesKitchen(state, fromX, fromY, p.x, p.y)) {
      useKitchen(state, events);
      if (stops) impact = { kind: 'outOfMap', x: p.x, y: p.y };
    }
    // A shot that touches a powder barrel sets it off (GDD §4.6).
    const barrel = barrelOnSegment(state, fromX, fromY, p.x, p.y);
    if (barrel !== null) {
      igniteBarrel(state, barrel, 1);
      if (stops) impact = { kind: 'outOfMap', x: p.x, y: p.y };
    }
    // A shot that touches a beast of the margins puts it down (GDD §4.10).
    if (beastOnSegment(state, fromX, fromY, p.x, p.y)) {
      killBeast(state, events);
      if (stops) impact = { kind: 'outOfMap', x: p.x, y: p.y };
    }
    // A shot that touches a reliquary bursts it (GDD §4.5).
    const crate = crateOnSegment(state, fromX, fromY, p.x, p.y);
    if (crate !== null) {
      burstCrate(state, crate, events);
      if (stops) impact = { kind: 'outOfMap', x: p.x, y: p.y };
    }

    if (shot.fragment) {
      // A fragment explodes wherever it lands, on the ground or on a unit.
      if (impact && impact.kind !== 'outOfMap') {
        const f = def.fragments;
        queueExplosion(state.explosions, state.tick, {
          x: p.x,
          y: p.y,
          radius: f?.radius ?? 0,
          carveRadius: f?.radius ?? 0,
          maxDamage: f?.damage ?? 0,
          sourceId: p.id,
        });
      }
      ended = impact !== null;
    } else if (def.behavior === 'directHit') {
      if (impact?.kind === 'unit') {
        const u = state.units.find((x) => x.id === impact.unitId);
        if (u) directHit(u, def, state.rules.explosion, p.vx, p.vy, events);
      } else if (impact?.kind === 'terrain' && def.chipRadius) {
        // Every shot wears the ground down: enough arrows go through a wall (GDD §4.7).
        const x = subToPx(impact.x);
        const y = subToPx(impact.y);
        if (carveCircle(state.terrain, x, y, def.chipRadius) > 0) {
          events.push({ e: 'terrainCarved', x, y, radius: def.chipRadius });
        }
      }
      ended = impact !== null;
    } else {
      if (impact?.kind === 'outOfMap') ended = true;
      else if (impact) bounce(p, state.terrain, def.bouncePct);
      if (!ended && shot.fuse > 0) {
        shot.fuse--;
        if (shot.fuse === 0) {
          if (def.behavior === 'cluster') burst(state, shot, def, spawned);
          else {
            queueExplosion(state.explosions, state.tick, {
              x: p.x,
              y: p.y,
              radius: def.explosionRadius,
              carveRadius: def.explosionRadius,
              maxDamage: def.damage,
              sourceId: p.id,
            });
          }
          ended = true;
        }
      }
    }

    if (ended) events.push({ e: 'shotEnded', shotId: p.id });
    else remaining.push(shot);
  }
  // Fragments start flying on the next tick, after the shots that existed before them.
  for (const s of spawned) remaining.push(s);
  state.shots = remaining;
}
