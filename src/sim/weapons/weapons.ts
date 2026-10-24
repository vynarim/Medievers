// Weapon behaviours (CLAUDE.md: one WeaponDef in content + one behaviour here).
//  - directHit: arrow or stone; damages and pushes the unit it hits, vanishes on terrain.
//  - fusedBouncer: pot that bounces until its fuse runs out, then explodes.
import { weaponDefIn } from '../../content/rules.ts';
import type { WeaponDef } from '../../content/weapons.ts';
import type { ExplosionRules } from '../../content/world.ts';
import { cosQ14, sinQ14 } from '../math/angle.ts';
import { SUBPX, idiv, mulQ14 } from '../math/fixed.ts';
import { isqrt } from '../math/isqrt.ts';
import { queueExplosion } from '../explosions/explosion.ts';
import { bounce, createProjectile, stepProjectile } from '../projectiles/projectile.ts';
import type { SimEvent } from '../events.ts';
import type { FlyingShot, SimState } from '../state.ts';
import { UNIT_HEIGHT, launch, type Unit } from '../units/unit.ts';
import { MAX_POWER } from '../commands.ts';

/** px from the hitbox centre to the muzzle */
const MUZZLE_DISTANCE = 20;

/** Launches the selected weapon from unit u at the given power (0..1024). */
export function fire(state: SimState, u: Unit, power: number, events: SimEvent[]): void {
  const def = weaponDefIn(state.rules, state.turn.weapon);
  const angle = state.turn.aim;
  const speed = idiv(def.maxSpeed * Math.max(0, Math.min(power, MAX_POWER)), MAX_POWER);
  const cx = u.x;
  const cy = u.y - (UNIT_HEIGHT * SUBPX) / 2;
  const id = state.nextEntityId++;
  const projectile = createProjectile(
    id,
    u.id,
    cx + mulQ14(MUZZLE_DISTANCE * SUBPX, cosQ14(angle)),
    cy + mulQ14(MUZZLE_DISTANCE * SUBPX, sinQ14(angle)),
    mulQ14(speed, cosQ14(angle)),
    mulQ14(speed, sinQ14(angle)),
    { radius: def.projectileRadius, windPct: def.windPct, gravityPct: 100 },
  );
  state.shots.push({
    projectile,
    weapon: def.id,
    fuse: def.behavior === 'fusedBouncer' ? state.turn.fuse : 0,
  });
  events.push({ e: 'shotFired', shotId: id, weapon: def.id });
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

/** Advances every flying shot by one tick, resolving impacts and fuses. */
export function stepShots(state: SimState, events: SimEvent[]): void {
  const remaining: FlyingShot[] = [];
  for (const shot of state.shots) {
    const p = shot.projectile;
    const def = weaponDefIn(state.rules, shot.weapon);
    const impact = stepProjectile(
      p,
      state.terrain,
      state.units,
      state.turn.wind,
      state.rules.wind.accelPerUnit,
    );
    let ended = false;

    if (def.behavior === 'directHit') {
      if (impact?.kind === 'unit') {
        const u = state.units.find((x) => x.id === impact.unitId);
        if (u) directHit(u, def, state.rules.explosion, p.vx, p.vy, events);
      }
      ended = impact !== null;
    } else {
      if (impact?.kind === 'outOfMap') ended = true;
      else if (impact) bounce(p, state.terrain, def.bouncePct);
      if (!ended && shot.fuse > 0) {
        shot.fuse--;
        if (shot.fuse === 0) {
          queueExplosion(state.explosions, state.tick, {
            x: p.x,
            y: p.y,
            radius: def.explosionRadius,
            carveRadius: def.explosionRadius,
            maxDamage: def.damage,
            sourceId: p.id,
          });
          ended = true;
        }
      }
    }

    if (ended) events.push({ e: 'shotEnded', shotId: p.id });
    else remaining.push(shot);
  }
  state.shots = remaining;
}
