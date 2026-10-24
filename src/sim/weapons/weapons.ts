// Weapon behaviours (CLAUDE.md: one WeaponDef in content + one behaviour here).
//  - directHit: arrow, bolt or stone; damages and pushes the unit it hits, chips the ground.
//  - fusedBouncer: pot that bounces until its fuse runs out, then explodes.
//  - cluster: a fusedBouncer that bursts into fragments, each exploding where it lands.
//  - melee: no projectile; strikes what stands within reach along the aim.
//  - dig, mine, build, strike: the pick and sap, the chausse-trape, the stone wall and the
//    trebuchet volley (src/sim/tools.ts).
import { weaponDefIn } from '../../content/rules.ts';
import type { WeaponDef } from '../../content/weapons.ts';
import type { ExplosionRules } from '../../content/world.ts';
import { cosQ14, sinQ14 } from '../math/angle.ts';
import { SUBPX, idiv, mulQ14, subToPx } from '../math/fixed.ts';
import { isqrt } from '../math/isqrt.ts';
import { queueExplosion } from '../explosions/explosion.ts';
import { barrelOnSegment, igniteBarrel } from '../barrels.ts';
import { beastOnSegment, killBeast } from '../beasts.ts';
import { dragonOnSegment, enrageDragon } from '../dragon.ts';
import { touchUnicorn, unicornOnSegment } from '../unicorn.ts';
import { crateOnSegment, burstCrate } from '../crates.ts';
import { segmentTouchesKitchen, useKitchen } from '../kitchen.ts';
import { fuseTurnsOf, maybeRest } from '../pots.ts';
import { carveCircle, isSolid } from '../terrain/terrain.ts';
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
import { damageDealtPct, throwPct, type ClassView } from '../classes.ts';
import { shotHitsStructure } from '../structures.ts';
import { buildWall, launchStrike, placeMine, startDig, targetFor } from '../tools.ts';

/** px from the hitbox centre to the muzzle */
const MUZZLE_DISTANCE = 20;
/** px: radius of the melee strike around the point at reach */
const STRIKE_RADIUS = 14;
/** BAM: fragments fly out over this fan, centred straight up */
const FRAGMENT_FAN = 1536;

/**
 * Launches the selected weapon from unit u at the given power (0..1024); a targeted weapon goes
 * to `at` (px) when given, else as far as the power says. Returns false, having done nothing,
 * when the weapon cannot be used there (a stone wall too far, on a unit, in the ground).
 */
export function fire(
  state: SimState,
  u: Unit,
  power: number,
  events: SimEvent[],
  at: { readonly x: number; readonly y: number } | null = null,
): boolean {
  const def = weaponDefIn(state.rules, state.turn.weapon);
  const angle = state.turn.aim;
  if (def.behavior === 'build') {
    const p = at ?? targetFor(state, u, def, power);
    if (!buildWall(state, u, def, p.x, p.y, events)) return false;
    const id = state.nextEntityId++;
    events.push({ e: 'shotFired', shotId: id, weapon: def.id });
    events.push({ e: 'shotEnded', shotId: id });
    return true;
  }
  const id = state.nextEntityId++;
  // Majesté: the king's aura raises the damage of the shot (GDD §3.2); stored only when it does.
  const pct = damageDealtPct(state, u);
  const damagePct = pct !== 100 ? { damagePct: pct } : {};
  if (def.behavior === 'melee') {
    events.push({ e: 'shotFired', shotId: id, weapon: def.id });
    strike(state, u, def, angle, pct, power, events);
    events.push({ e: 'shotEnded', shotId: id });
    return true;
  }
  if (def.behavior === 'dig') {
    startDig(state, u, def, id);
    events.push({ e: 'shotFired', shotId: id, weapon: def.id });
    return true;
  }
  if (def.behavior === 'mine') {
    events.push({ e: 'shotFired', shotId: id, weapon: def.id });
    placeMine(state, u, def, id, events);
    events.push({ e: 'shotEnded', shotId: id });
    return true;
  }
  if (def.behavior === 'strike') {
    const x = at?.x ?? targetFor(state, u, def, power).x;
    launchStrike(state, u, def, x, id, pct);
    events.push({ e: 'shotFired', shotId: id, weapon: def.id });
    return true;
  }
  const speed = shotSpeed(state, u, def, power);
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
  if (def.fuseTurns !== undefined) {
    // Fuse in turns: 1 goes off during this throw, 2 and 3 rest on the map and wait.
    const turns = fuseTurnsOf(def, state.turn.fuse);
    state.shots.push({
      projectile,
      weapon: def.id,
      fuse: turns === 0 ? def.fuseTurns : 0,
      ...(turns > 0 ? { turns } : {}),
      ...damagePct,
    });
  } else {
    state.shots.push({
      projectile,
      weapon: def.id,
      fuse: fused ? state.turn.fuse : 0,
      ...damagePct,
    });
  }
  events.push({ e: 'shotFired', shotId: id, weapon: def.id });
  return true;
}

/**
 * sub-px/tick: launch speed of `def` thrown by u at power 0..1024 (crossbow: always full), with
 * the slinger's stronger arm. The renderer uses it for the aim preview.
 */
export function shotSpeed(state: ClassView, u: Unit, def: WeaponDef, power: number): number {
  const p = def.fixedPower ? MAX_POWER : Math.max(0, Math.min(power, MAX_POWER));
  return idiv(idiv(def.maxSpeed * p, MAX_POWER) * throwPct(state, u, def), 100);
}

/** The weapon of a blast, recorded for the structures it reaches (only with rules.structures). */
const tagged = (state: SimState, def: WeaponDef): { weapon?: WeaponDef['id'] } =>
  state.rules.structures ? { weapon: def.id } : {};

/** Solid terrain at or right around px (x, y): a blow there strikes the ground. */
function isSolidNear(state: SimState, x: number, y: number): boolean {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) if (isSolid(state.terrain, x + dx, y + dy)) return true;
  }
  return false;
}

/** Damage of a hit or blast at `pct` percent of `damage` (100: unchanged). */
const scaled = (damage: number, pct: number | undefined): number =>
  pct === undefined || pct === 100 ? damage : idiv(damage * pct + 50, 100);

/**
 * Melee blow: every other unit touching the point at `reach` along the aim takes the damage and
 * is thrown along the aim; a barrel there goes up, the kitchen there is used, the ground chips.
 */
function strike(
  state: SimState,
  u: Unit,
  def: WeaponDef,
  angle: number,
  pct: number,
  power: number,
  events: SimEvent[],
) {
  const reach = (def.reach ?? 0) * SUBPX;
  // Charged like a shot: the power sets how far the blow throws (knockbackMinPct..100).
  const min = def.knockbackMinPct;
  const p = Math.max(0, Math.min(power, MAX_POWER));
  const knock = min === undefined ? 100 : min + idiv((100 - min) * p, MAX_POWER);
  const dx = cosQ14(angle);
  const dy = sinQ14(angle);
  const cy = u.y - (UNIT_HEIGHT * SUBPX) / 2;
  const x = u.x + mulQ14(reach, dx);
  const y = cy + mulQ14(reach, dy);
  for (const other of state.units) {
    if (!other.alive || other.id === u.id || !touchesUnit(other, x, y, STRIKE_RADIUS)) continue;
    directHit(other, def, scaled(def.damage, pct), state.rules.explosion, dx, dy, events, knock);
  }
  const barrel = barrelOnSegment(state, u.x, cy, x, y);
  if (barrel !== null) igniteBarrel(state, barrel, 1);
  const crate = crateOnSegment(state, u.x, cy, x, y);
  if (crate !== null) burstCrate(state, crate, events);
  if (segmentTouchesKitchen(state, u.x, cy, x, y)) useKitchen(state, events);
  if (beastOnSegment(state, u.x, cy, x, y)) killBeast(state, events);
  if (unicornOnSegment(state, u.x, cy, x, y)) touchUnicorn(state, u.id, events);
  if (isSolidNear(state, subToPx(x), subToPx(y))) {
    shotHitsStructure(state, subToPx(x), subToPx(y), scaled(def.damage, pct), def.id, events);
  }
  if (def.chipRadius) carveCircle(state.terrain, subToPx(x), subToPx(y), def.chipRadius);
}

/** Damages unit `u` by `damage` and pushes it along (vx, vy) scaled by the weapon. */
function directHit(
  u: Unit,
  def: WeaponDef,
  damage: number,
  rules: ExplosionRules,
  vx: number,
  vy: number,
  events: SimEvent[],
  knockPct = 100,
): void {
  u.hp = Math.max(0, u.hp - damage);
  events.push({ e: 'unitDamaged', unitId: u.id, damage });
  const speed = idiv(
    idiv(def.damage * rules.knockbackPerHp * def.knockbackPct, 100) * knockPct,
    100,
  );
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
    maxDamage: scaled(def.damage, shot.damagePct),
    sourceId: p.id,
    ...tagged(state, def),
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
    queue.push({
      projectile: child,
      weapon: def.id,
      fuse: 0,
      fragment: true,
      ...(shot.damagePct !== undefined ? { damagePct: shot.damagePct } : {}),
    });
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
    const stops =
      def.behavior === 'directHit' || def.behavior === 'strike' || shot.fragment === true;
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
    // A shot that touches the dragon enrages it, whatever the damage (GDD §4.11).
    if (dragonOnSegment(state, fromX, fromY, p.x, p.y)) {
      const shooter = state.units.find((x) => x.id === p.ownerId);
      enrageDragon(state, shooter?.team ?? state.turn.activeTeam, events);
      if (stops) impact = { kind: 'outOfMap', x: p.x, y: p.y };
    }
    // A shot that touches the unicorn gives the shooter back all its HP (GDD §4.12).
    if (unicornOnSegment(state, fromX, fromY, p.x, p.y)) {
      touchUnicorn(state, p.ownerId, events);
      if (stops) impact = { kind: 'outOfMap', x: p.x, y: p.y };
    }
    // A shot that touches a reliquary bursts it (GDD §4.5).
    const crate = crateOnSegment(state, fromX, fromY, p.x, p.y);
    if (crate !== null) {
      burstCrate(state, crate, events);
      if (stops) impact = { kind: 'outOfMap', x: p.x, y: p.y };
    }

    if (def.behavior === 'strike') {
      // A trebuchet stone bursts wherever it lands, on the ground or on a unit (GDD §4.2).
      if (impact && impact.kind !== 'outOfMap') {
        queueExplosion(state.explosions, state.tick, {
          x: p.x,
          y: p.y,
          radius: def.explosionRadius,
          carveRadius: def.explosionRadius,
          maxDamage: scaled(def.damage, shot.damagePct),
          sourceId: p.id,
          ...tagged(state, def),
        });
      }
      ended = impact !== null;
    } else if (shot.fragment) {
      // A fragment explodes wherever it lands, on the ground or on a unit.
      if (impact && impact.kind !== 'outOfMap') {
        const f = def.fragments;
        queueExplosion(state.explosions, state.tick, {
          x: p.x,
          y: p.y,
          radius: f?.radius ?? 0,
          carveRadius: f?.radius ?? 0,
          maxDamage: scaled(f?.damage ?? 0, shot.damagePct),
          sourceId: p.id,
          ...tagged(state, def),
        });
      }
      ended = impact !== null;
    } else if (def.behavior === 'directHit') {
      if (impact?.kind === 'unit') {
        const u = state.units.find((x) => x.id === impact.unitId);
        if (u) {
          const damage = scaled(def.damage, shot.damagePct);
          directHit(u, def, damage, state.rules.explosion, p.vx, p.vy, events);
        }
      } else if (impact?.kind === 'terrain' && def.chipRadius) {
        // Every shot wears the ground down: enough arrows go through a wall (GDD §4.7).
        const x = subToPx(impact.x);
        const y = subToPx(impact.y);
        shotHitsStructure(state, x, y, scaled(def.damage, shot.damagePct), def.id, events);
        if (carveCircle(state.terrain, x, y, def.chipRadius) > 0) {
          events.push({ e: 'terrainCarved', x, y, radius: def.chipRadius });
        }
      }
      ended = impact !== null;
    } else {
      if (impact?.kind === 'outOfMap') ended = true;
      else if (impact) bounce(p, state.terrain, def.bouncePct);
      // A pot set for a later turn comes to rest on the map (GDD §4.1).
      if (!ended && shot.turns !== undefined && maybeRest(state, shot, impact !== null, events)) {
        ended = true;
      }
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
              maxDamage: scaled(def.damage, shot.damagePct),
              sourceId: p.id,
              ...(def.flames && state.rules.flames ? { flames: true } : {}),
              ...tagged(state, def),
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
