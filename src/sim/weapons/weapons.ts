// Weapon behaviours (CLAUDE.md: one WeaponDef in content + one behaviour here).
//  - directHit: arrow, bolt or stone; damages and pushes the unit it hits, chips the ground.
//  - fusedBouncer: pot that bounces until its fuse runs out, then explodes.
//  - cluster: a fusedBouncer that bursts into fragments, each exploding where it lands.
//  - melee: no projectile; strikes what stands within reach along the aim (level, for the sword).
//  - charge: the shield charge; the unit runs along its facing side, throwing over what it meets.
//  - dig, mine, build, strike: the pick and sap, the chausse-trape, the stone wall and the
//    trebuchet volley (src/sim/tools.ts).
import { weaponDefIn } from '../../content/rules.ts';
import type { HomingDef, WeaponDef } from '../../content/weapons.ts';
import type { ExplosionRules } from '../../content/world.ts';
import { ANGLE_MASK, angleDelta, atan2Bam, cosQ14, sinQ14 } from '../math/angle.ts';
import { SUBPX, idiv, mulQ14, subToPx } from '../math/fixed.ts';
import { isqrt } from '../math/isqrt.ts';
import { queueExplosion } from '../explosions/explosion.ts';
import { barrelOnSegment, igniteBarrel } from '../barrels.ts';
import { beastOnSegment, killBeast } from '../beasts.ts';
import { dragonOnSegment, enrageDragon } from '../dragon.ts';
import { touchUnicorn, unicornOnSegment } from '../unicorn.ts';
import { angelOnSegment, burstCrate, crateOnSegment, shootAngel } from '../crates.ts';
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
import { UNIT_HALF_WIDTH, UNIT_HEIGHT, launch, walk, type Unit } from '../units/unit.ts';
import { MAX_POWER } from '../commands.ts';
import { damageDealtPct, throwPct, type ClassView } from '../classes.ts';
import { igniteStructureAt, shotHitsStructure } from '../structures.ts';
import { flameAt } from '../flames.ts';
import { letLoose } from '../walkers.ts';
import { engineFor, engineMuzzle, engineOnSegment, engineShot, hitEngine } from '../engines.ts';
import type { SimView } from '../sim.ts';
import { breakHive } from '../swarms.ts';
import { shootHook } from '../rope.ts';
import {
  buildWall,
  launchStrike,
  placeLadder,
  placeMine,
  startDig,
  targetFor,
  teleport,
} from '../tools.ts';

/** px from the hitbox centre to the muzzle */
const MUZZLE_DISTANCE = 20;
/** px: radius of the melee strike around the point at reach */
const STRIKE_RADIUS = 14;
/** ticks a siege engine's shot spares the unit serving the machine */
const ENGINE_SPARE_TICKS = 30;
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
  const angle = heldAim(def, blowAngle(def, u, state.turn.aim));
  if (def.behavior === 'build') {
    const p = at ?? targetFor(state, u, def, power);
    if (!buildWall(state, u, def, p.x, p.y, events)) return false;
    const id = state.nextEntityId++;
    events.push({ e: 'shotFired', shotId: id, weapon: def.id });
    events.push({ e: 'shotEnded', shotId: id });
    return true;
  }
  if (def.behavior === 'teleport' || def.behavior === 'ladder' || def.behavior === 'banner') {
    if (def.behavior === 'teleport') {
      const p = at ?? targetFor(state, u, def, power);
      if (!teleport(state, u, p.x, p.y, events)) return false;
    } else if (def.behavior === 'ladder') {
      if (!placeLadder(state, u, def, events)) return false;
    } else {
      u.banner = true;
      events.push({ e: 'bannerRaised', unitId: u.id });
    }
    const id = state.nextEntityId++;
    events.push({ e: 'shotFired', shotId: id, weapon: def.id });
    events.push({ e: 'shotEnded', shotId: id });
    return true;
  }
  // A blow at nothing is refused: the turn keeps its action (needsTarget).
  if (def.behavior === 'melee' && def.needsTarget && !strikeHasTarget(state, u, def, angle)) {
    return false;
  }
  const id = state.nextEntityId++;
  // Majesté: the king's aura raises the damage of the shot (GDD §3.2); stored only when it does.
  const pct = damageDealtPct(state, u);
  const damagePct = pct !== 100 ? { damagePct: pct } : {};
  if (def.behavior === 'melee') {
    // The ram is served like any siege engine.
    const ram = def.engine ? engineFor(state, u, def.engine) : null;
    if (def.engine && !ram) return false;
    events.push({ e: 'shotFired', shotId: id, weapon: def.id });
    strike(state, u, def, angle, pct, power, events, ram?.id ?? -1);
    if (ram) engineShot(state, ram, events);
    events.push({ e: 'shotEnded', shotId: id });
    return true;
  }
  if (def.behavior === 'charge') {
    if (!def.charge) return false;
    events.push({ e: 'shotFired', shotId: id, weapon: def.id });
    state.charge = {
      id,
      unitId: u.id,
      weapon: def.id,
      dir: u.facing,
      left: def.charge.distance * SUBPX,
      damagePct: pct,
      hit: [],
    };
    return true;
  }
  if (def.behavior === 'homing' && def.homing) {
    // The falcon rises from the unit's shoulder, then steers for the point.
    const p = at ?? targetFor(state, u, def, power);
    const cy = u.y - (UNIT_HEIGHT * SUBPX) / 2;
    const projectile = createProjectile(
      id,
      u.id,
      u.x,
      cy - MUZZLE_DISTANCE * SUBPX,
      0,
      -def.homing.speed,
      { radius: def.projectileRadius, windPct: 0, gravityPct: 0 },
    );
    state.shots.push({
      projectile,
      weapon: def.id,
      fuse: 0,
      homing: { x: p.x, y: p.y },
      ...damagePct,
    });
    events.push({ e: 'shotFired', shotId: id, weapon: def.id });
    return true;
  }
  if (def.behavior === 'rope') {
    if (!shootHook(state, u, def, events)) return false;
    events.push({ e: 'shotFired', shotId: id, weapon: def.id });
    events.push({ e: 'shotEnded', shotId: id });
    return true;
  }
  if (def.behavior === 'walker') {
    if (!letLoose(state, u, def, id, pct)) return false;
    events.push({ e: 'shotFired', shotId: id, weapon: def.id });
    return true;
  }
  if (def.behavior === 'dig') {
    if (!startDig(state, u, def, id)) return false;
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
  // A siege engine's shot leaves from the machine, which reloads (GDD §4.8).
  const engine = def.engine ? engineFor(state, u, def.engine) : null;
  if (def.engine && !engine) return false;
  const start = launchPoint(state, u, def, angle);
  if (engine) engineShot(state, engine, events);
  // The scorpion's bolts: the first one carries the shot's id, the others their own.
  const burst = def.burst?.count ?? 1;
  const half = (burst - 1) >> 1;
  for (let k = -half; k <= burst - 1 - half; k++) {
    if (k === 0) continue;
    const a = (angle + k * (def.burst?.spread ?? 0)) & ANGLE_MASK;
    const bolt = createProjectile(
      state.nextEntityId++,
      u.id,
      start.x,
      start.y,
      mulQ14(speed, cosQ14(a)),
      mulQ14(speed, sinQ14(a)),
      { radius: def.projectileRadius, windPct: def.windPct, gravityPct: 100 },
    );
    state.shots.push({ projectile: bolt, weapon: def.id, fuse: 0, ...damagePct });
  }
  const projectile = createProjectile(
    id,
    u.id,
    start.x,
    start.y,
    mulQ14(speed, cosQ14(angle)),
    mulQ14(speed, sinQ14(angle)),
    { radius: def.projectileRadius, windPct: def.windPct, gravityPct: 100 },
  );
  if (burst > 1) state.shots.sort((a, b) => a.projectile.id - b.projectile.id);
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
 * sub-px: where the shot of `def` along `angle` leaves from: the unit's hand, 20 px out, or the
 * top of the siege engine it serves. The AI and the aim preview use it too.
 */
export function launchPoint(
  state: SimState | SimView,
  u: Pick<Unit, 'x' | 'y'>,
  def: WeaponDef,
  angle: number,
): { x: number; y: number } {
  const engine = def.engine ? engineFor(state, u, def.engine) : null;
  if (engine) return engineMuzzle(state, engine);
  const cy = u.y - (UNIT_HEIGHT * SUBPX) / 2;
  return {
    x: u.x + mulQ14(MUZZLE_DISTANCE * SUBPX, cosQ14(angle)),
    y: cy + mulQ14(MUZZLE_DISTANCE * SUBPX, sinQ14(angle)),
  };
}

/**
 * BAM: the aim a weapon is fired along: as aimed, or held within its range above the horizon on
 * the aimed side (the trebuchet's 45° ± 15°).
 */
export function heldAim(def: WeaponDef, aim: number): number {
  const r = def.aimRange;
  if (!r) return aim;
  const right = cosQ14(aim) >= 0;
  // Elevation above the horizon on the aimed side, 0..2048 (below the horizon: negative).
  const up = right ? (4096 - aim) & ANGLE_MASK : (aim - 2048) & ANGLE_MASK;
  const elev = up > 2048 ? up - 4096 : up;
  const held = Math.max(r.min, Math.min(r.max, elev));
  return right ? (4096 - held) & ANGLE_MASK : (2048 + held) & ANGLE_MASK;
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

/** BAM a melee blow is struck along: the aim, or level on the facing side (frontal, the sword). */
export function blowAngle(def: WeaponDef, u: Pick<Unit, 'facing'>, aim: number): number {
  if (!def.frontal) return aim;
  return u.facing > 0 ? 0 : 2048;
}

/**
 * px: the first pixel from (x0, y0) to (x1, y1), sub-px, that is solid or built (the body of a
 * tower, seen behind the play, counts), or null.
 */
function firstSolid(
  state: SimState,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): { x: number; y: number } | null {
  const steps = Math.max(1, subToPx(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= steps; i++) {
    const x = subToPx(x0 + idiv((x1 - x0) * i, steps));
    const y = subToPx(y0 + idiv((y1 - y0) * i, steps));
    if (isSolid(state.terrain, x, y)) return { x, y };
    const o = state.owners;
    const t = state.terrain;
    if (o && x >= 0 && y >= 0 && x < t.width && y < t.height && (o[y * t.width + x] ?? 0) !== 0) {
      return { x, y };
    }
  }
  return null;
}

/** Point the blow of a melee weapon lands on, along the aim at its reach, in sub-px. */
function strikePoint(u: Unit, def: WeaponDef, angle: number): { x: number; y: number; cy: number } {
  const reach = (def.reach ?? 0) * SUBPX;
  const cy = u.y - (UNIT_HEIGHT * SUBPX) / 2;
  return { x: u.x + mulQ14(reach, cosQ14(angle)), y: cy + mulQ14(reach, sinQ14(angle)), cy };
}

/**
 * Something within the reach of a melee blow along the aim: another unit, a barrel, a coffer,
 * the kitchen, a beast, the unicorn, or a standing structure. The bare ground is no target.
 */
export function strikeHasTarget(state: SimState, u: Unit, def: WeaponDef, angle: number): boolean {
  const { x, y, cy } = strikePoint(u, def, angle);
  if (state.units.some((o) => o.alive && o.id !== u.id && touchesUnit(o, x, y, STRIKE_RADIUS))) {
    return true;
  }
  if (barrelOnSegment(state, u.x, cy, x, y) !== null) return true;
  if (crateOnSegment(state, u.x, cy, x, y) !== null) return true;
  if (segmentTouchesKitchen(state, u.x, cy, x, y)) return true;
  if (beastOnSegment(state, u.x, cy, x, y)) return true;
  if (unicornOnSegment(state, u.x, cy, x, y)) return true;
  if (engineOnSegment(state as SimState, u.x, cy, x, y) !== null) return true;
  const owners = state.owners;
  if (!owners) return false;
  const px = subToPx(x);
  const py = subToPx(y);
  const t = state.terrain;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const qx = px + dx;
      const qy = py + dy;
      if (qx < 0 || qy < 0 || qx >= t.width || qy >= t.height) continue;
      if ((owners[qy * t.width + qx] ?? 0) !== 0 && isSolid(t, qx, qy)) return true;
    }
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
  /** the siege engine being served, which the blow leaves alone (the ram) */
  served = -1,
) {
  // Charged like a shot: the power sets how far the blow throws (knockbackMinPct..100).
  const min = def.knockbackMinPct;
  const p = Math.max(0, Math.min(power, MAX_POWER));
  const knock = min === undefined ? 100 : min + idiv((100 - min) * p, MAX_POWER);
  const dx = cosQ14(angle);
  const dy = sinQ14(angle);
  const { x, y, cy } = strikePoint(u, def, angle);
  for (const other of state.units) {
    if (def.sparesUnits) break;
    if (!other.alive || other.id === u.id || !touchesUnit(other, x, y, STRIKE_RADIUS)) continue;
    directHit(other, def, scaled(def.damage, pct), state.rules.explosion, dx, dy, events, knock);
  }
  // A machine within reach takes the blow (the ram crushes it).
  const machine = engineOnSegment(state, u.x, cy, x, y, served);
  if (machine) hitEngine(state, machine, scaled(def.damage, pct), def.id, events);
  touchAlong(state, u, u.x, cy, x, y, events);
  if (def.sparesUnits) {
    // The ram strikes the first thing built along its swing.
    const hit = firstSolid(state, u.x, cy, x, y);
    if (hit) shotHitsStructure(state, hit.x, hit.y, scaled(def.damage, pct), def.id, events);
  } else if (isSolidNear(state, subToPx(x), subToPx(y))) {
    shotHitsStructure(state, subToPx(x), subToPx(y), scaled(def.damage, pct), def.id, events);
  }
  if (def.chipRadius) carveCircle(state.terrain, subToPx(x), subToPx(y), def.chipRadius);
}

/**
 * What a blow or a run from (x0, y0) to (x1, y1), sub-px, meets besides the units: a barrel goes
 * up, a coffer bursts, the kitchen is used, a beast is put down, the unicorn touched.
 */
function touchAlong(
  state: SimState,
  u: Unit,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  events: SimEvent[],
): void {
  const barrel = barrelOnSegment(state, x0, y0, x1, y1);
  if (barrel !== null) igniteBarrel(state, barrel, 1);
  const crate = crateOnSegment(state, x0, y0, x1, y1);
  if (crate !== null) burstCrate(state, crate, events);
  if (segmentTouchesKitchen(state, x0, y0, x1, y1)) useKitchen(state, events);
  if (beastOnSegment(state, x0, y0, x1, y1)) killBeast(state, events);
  if (unicornOnSegment(state, x0, y0, x1, y1)) touchUnicorn(state, u.id, events);
}

/**
 * One tick of the shield charge: the unit runs on over the ground (up steps, down slopes) on its
 * facing side; every unit its shield meets takes the damage once and is thrown ahead. The run
 * ends when covered, against a wall, or when the unit falls or dies.
 */
export function stepCharge(state: SimState, events: SimEvent[]): void {
  const c = state.charge;
  if (!c) return;
  const u = state.units.find((x) => x.id === c.unitId);
  const def = weaponDefIn(state.rules, c.weapon);
  const run = def.charge;
  if (!run || !u?.alive || !u.grounded || c.left <= 0) {
    state.charge = null;
    events.push({ e: 'shotEnded', shotId: c.id });
    return;
  }
  const x0 = u.x;
  const speed = Math.min(run.speed, c.left);
  const r = walk(u, state.terrain, c.dir, { ...state.rules.unit, walkSpeed: speed });
  c.left = r === 'moved' ? c.left - speed : 0;
  // The shield, at the front of the body, half way up.
  const cy = u.y - (UNIT_HEIGHT * SUBPX) / 2;
  const front = u.x + c.dir * UNIT_HALF_WIDTH * SUBPX;
  for (const o of state.units) {
    if (!o.alive || o.id === u.id || c.hit.includes(o.id)) continue;
    if (!touchesUnit(o, front, cy, STRIKE_RADIUS)) continue;
    c.hit.push(o.id);
    c.hit.sort((a, b) => a - b);
    directHit(o, def, scaled(def.damage, c.damagePct), state.rules.explosion, c.dir, 0, events);
  }
  touchAlong(state, u, x0 + c.dir * UNIT_HALF_WIDTH * SUBPX, cy, front, cy, events);
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

/** turns of its turn rate the falcon may veer by at once to fly round the ground */
const VEER_STEPS = 12;
/** px ahead the falcon looks for the ground */
const LOOK_AHEAD = [16, 32, 48];
/** px from its point within which the falcon no longer veers */
const LOOK_AHEAD_NEAR = 64;

/** No solid ground along BAM `a` from (x, y) sub-px, within the falcon's look ahead. */
function clearAhead(state: SimState, x: number, y: number, a: number): boolean {
  for (const d of LOOK_AHEAD) {
    const px = subToPx(x + mulQ14(d * SUBPX, cosQ14(a)));
    const py = subToPx(y + mulQ14(d * SUBPX, sinQ14(a)));
    // With room for its wings round the line.
    for (const [ox, oy] of CLEARANCE) if (isSolid(state.terrain, px + ox, py + oy)) return false;
  }
  return true;
}

/** px around a point of the falcon's way that must be free too */
const CLEARANCE = [
  [0, 0],
  [0, -8],
  [0, 8],
  [-8, 0],
  [8, 0],
] as const;

/**
 * The falcon turns towards its point by at most its turn rate, flies on at its speed, and the
 * wind pushes it sideways.
 */
function steer(state: SimState, shot: FlyingShot, h: HomingDef): void {
  const p = shot.projectile;
  const to = shot.homing;
  if (!to || p.age < h.rise) return;
  const want = atan2Bam(to.y * SUBPX + SUBPX / 2 - p.y, to.x * SUBPX + SUBPX / 2 - p.x);
  const now = atan2Bam(p.vy, p.vx);
  const d = angleDelta(now, want);
  let a = (now + Math.max(-h.turn, Math.min(h.turn, d))) & ANGLE_MASK;
  // Ground ahead: it veers off, the higher way first, to fly round it; not when it is upon its
  // point, which may be on the ground.
  const near =
    Math.abs(subToPx(p.x) - to.x) < LOOK_AHEAD_NEAR &&
    Math.abs(subToPx(p.y) - to.y) < LOOK_AHEAD_NEAR;
  if (!near && !clearAhead(state, p.x, p.y, a)) {
    const upward = sinQ14((a - h.turn) & ANGLE_MASK) <= sinQ14((a + h.turn) & ANGLE_MASK) ? -1 : 1;
    let veered = false;
    for (const side of [upward, -upward]) {
      for (let k = 1; k <= VEER_STEPS && !veered; k++) {
        const b = (a + side * k * h.turn) & ANGLE_MASK;
        if (clearAhead(state, p.x, p.y, b)) {
          a = b;
          veered = true;
        }
      }
    }
  }
  p.vx = mulQ14(h.speed, cosQ14(a)) + state.turn.wind * h.windDrift;
  p.vy = mulQ14(h.speed, sinQ14(a));
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
    if (shot.homing && def.homing) steer(state, shot, def.homing);
    let impact = stepProjectile(
      p,
      state.terrain,
      state.units,
      state.turn.wind,
      state.rules.wind.accelPerUnit,
      // A siege engine's shot leaves over its server's head: it spares the server at first.
      def.engine && p.age < ENGINE_SPARE_TICKS
        ? [...(shot.pierced ?? []), p.ownerId]
        : shot.pierced,
    );
    let ended = false;
    // Things that stop an arrow, a bolt, a stone or a fragment: they count as an impact.
    const stops =
      def.behavior === 'directHit' ||
      def.behavior === 'strike' ||
      def.behavior === 'hive' ||
      def.behavior === 'homing' ||
      def.behavior === 'shell' ||
      shot.fragment === true;
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
    // A shot that touches an angel bringing a coffer down: up goes the shooter (GDD §4.5).
    const angel = angelOnSegment(state, fromX, fromY, p.x, p.y);
    if (angel !== null) {
      shootAngel(state, angel, p.ownerId, events);
      if (stops) impact = { kind: 'outOfMap', x: p.x, y: p.y };
    }
    // A shot that touches a siege engine: an arrow or a bolt strikes it, a stone bursts on it.
    if (stops && state.engines.length > 0 && impact?.kind !== 'unit') {
      const eng = engineOnSegment(state, fromX, fromY, p.x, p.y);
      if (eng) {
        if (
          def.behavior === 'directHit' ||
          (def.behavior === 'strike' && def.explosionRadius === 0)
        ) {
          hitEngine(state, eng, scaled(def.damage, shot.damagePct), def.id, events);
          impact = { kind: 'outOfMap', x: p.x, y: p.y };
        } else impact = { kind: 'terrain', x: p.x, y: p.y };
      }
    }
    // A shot that touches a reliquary bursts it (GDD §4.5).
    const crate = crateOnSegment(state, fromX, fromY, p.x, p.y);
    if (crate !== null) {
      burstCrate(state, crate, events);
      if (stops) impact = { kind: 'outOfMap', x: p.x, y: p.y };
    }

    if (def.behavior === 'hive') {
      // The hive breaks where it lands, on the ground or on a unit: out comes the swarm.
      if (impact && impact.kind !== 'outOfMap') breakHive(state, shot, events);
      ended = impact !== null;
      // Its shot ends with the swarm (stepSwarms), so that the turn waits for it.
      if (ended && impact?.kind !== 'outOfMap' && def.hive) {
        continue;
      }
    } else if (def.behavior === 'homing') {
      // The falcon strikes what it meets, the point it was sent to, or wherever it is at the end.
      const h = def.homing;
      const there =
        shot.homing !== undefined &&
        Math.abs(subToPx(p.x) - shot.homing.x) <= 6 &&
        Math.abs(subToPx(p.y) - shot.homing.y) <= 6;
      const spent = h !== undefined && p.age >= h.ticks;
      if ((impact && impact.kind !== 'outOfMap') || there || spent) {
        // On a unit it strikes home: the blast is at the middle of its prey.
        const hit = impact;
        const prey = hit?.kind === 'unit' ? state.units.find((x) => x.id === hit.unitId) : null;
        queueExplosion(state.explosions, state.tick, {
          x: prey ? prey.x : p.x,
          y: prey ? prey.y - (UNIT_HEIGHT * SUBPX) / 2 : p.y,
          radius: def.explosionRadius,
          carveRadius: def.explosionRadius,
          maxDamage: scaled(def.damage, shot.damagePct),
          sourceId: p.id,
          ...tagged(state, def),
        });
        ended = true;
      } else ended = impact !== null;
    } else if ((def.behavior === 'strike' && def.explosionRadius > 0) || def.behavior === 'shell') {
      // A trebuchet stone (volley or engine) or a catapult's bursts wherever it lands, on the
      // ground or on a unit (GDD §4.2, §4.8).
      if (impact && impact.kind !== 'outOfMap') {
        queueExplosion(state.explosions, state.tick, {
          x: p.x,
          y: p.y,
          radius: def.explosionRadius,
          carveRadius: idiv(def.explosionRadius * (def.craterPct ?? 100), 100),
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
    } else if (def.behavior === 'directHit' || def.behavior === 'strike') {
      // An arrow, a bolt, a stone, or an arrow of the rain of arrows (a strike without a blast).
      if (impact?.kind === 'unit') {
        const hitId = impact.unitId;
        const u = state.units.find((x) => x.id === hitId);
        if (u) {
          const damage = scaled(def.damage, shot.damagePct);
          directHit(u, def, damage, state.rules.explosion, p.vx, p.vy, events);
          // A ballista's bolt goes on through the first units it strikes.
          if (def.pierce && (shot.pierced?.length ?? 0) < def.pierce) {
            shot.pierced = [...(shot.pierced ?? []), u.id].sort((a, b) => a - b);
            impact = null;
          }
        }
      } else if (impact?.kind === 'terrain' && def.chipRadius) {
        // Every shot wears the ground down: enough arrows go through a wall (GDD §4.7).
        const x = subToPx(impact.x);
        const y = subToPx(impact.y);
        shotHitsStructure(state, x, y, scaled(def.damage, shot.damagePct), def.id, events);
        // A fire arrow sets alight what it strikes: a wooden tower, or the ground but stone.
        if (def.flames && !igniteStructureAt(state, x, y, def.id, events)) flameAt(state, x, y);
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
