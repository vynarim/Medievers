// Tools of the arsenal (GDD §4.2, §4.4): the pick and the sap that dig, the chausse-trape left on
// the ground, the stone wall set where the unit points, and the trebuchet volley called down on a
// point. One WeaponDef each in content/weapons.ts; their behaviours live here.
import { weaponDefIn } from '../content/rules.ts';
import type { WallDef, WeaponDef } from '../content/weapons.ts';
import { MAX_POWER } from './commands.ts';
import { digPctOf } from './classes.ts';
import type { SimEvent } from './events.ts';
import { queueExplosion, type Explosion } from './explosions/explosion.ts';
import { ANGLE_MASK, cosQ14, sinQ14 } from './math/angle.ts';
import { SUBPX, idiv, mulQ14, subToPx } from './math/fixed.ts';
import { isqrt } from './math/isqrt.ts';
import { createProjectile, touchesUnit } from './projectiles/projectile.ts';
import type { Mine, SimState } from './state.ts';
import { Material } from './terrain/material.ts';
import {
  carveCircle,
  isSolid,
  materialOf,
  stamp,
  type StampShape,
  type Terrain,
} from './terrain/terrain.ts';
import { GRAVITY, UNIT_HALF_WIDTH, UNIT_HEIGHT, walk, type Unit } from './units/unit.ts';

/** Q14 sine of 22.5°: the sap cuts level unless the aim is steeper than this */
const SIN_22 = 6270;
/** px a mine drops per tick when the ground under it is gone (a plain drop, like the barrels) */
const MINE_FALL_PX = 4;
/** px a mine is left ahead of the unit's side */
const MINE_AHEAD = 10;
/** px above its base where a mine is touched and where it goes off */
const MINE_TOP = 3;

/** What the targeting helpers read (a SimView fits). */
interface TargetView {
  readonly terrain: Terrain;
  readonly turn: { readonly aim: number; readonly fuse: number };
}

// ---------------------------------------------------------------------------------------------
// Pick and sap
// ---------------------------------------------------------------------------------------------

/** BAM of the sap's cut for an aim: level, or 45° up or down, on the aimed side. */
export function sapAngle(aim: number): number {
  const right = cosQ14(aim) >= 0;
  const s = sinQ14(aim);
  if (s < -SIN_22) return right ? 3584 : 2560;
  if (s > SIN_22) return right ? 512 : 1536;
  return right ? 0 : 2048;
}

/** The unit starts digging with the pick (straight down) or the sap (along the aim). */
export function startDig(s: SimState, u: Unit, def: WeaponDef, id: number): void {
  const d = def.dig;
  if (!d) return;
  const angle = d.along === 'down' ? 1024 : sapAngle(s.turn.aim);
  s.dig = {
    id,
    unitId: u.id,
    weapon: def.id,
    dx: cosQ14(angle),
    dy: sinQ14(angle),
    x: u.x,
    y: u.y,
    speed: idiv(d.speed * digPctOf(s, u), 100),
    ticksLeft: d.ticks,
  };
}

/** percent the cut slows down in material m: earth 100; 0 when it cannot be cut at all */
function digResistance(t: Terrain, m: number): number {
  if (m === Material.Air) return 100;
  if (!t.rules.destructible[m]) return 0;
  return Math.max(100, t.rules.resistancePct[m] ?? 100);
}

/**
 * One tick of digging: the head advances (slower in stone, not at all in rock) and cuts a disc
 * (pick) or a column of discs as tall as a unit (sap); the sapper walks after the head. Ends
 * when the time is up, the unit falls, or the turn is over.
 */
export function stepDig(s: SimState, events: SimEvent[]): void {
  const g = s.dig;
  if (!g) return;
  const u = s.units.find((x) => x.id === g.unitId);
  const phase = s.turn.phase;
  const d = weaponDefIn(s.rules, g.weapon).dig;
  if (!d || !u?.alive || g.ticksLeft <= 0 || (phase !== 'action' && phase !== 'retreat')) {
    s.dig = null;
    events.push({ e: 'shotEnded', shotId: g.id });
    return;
  }
  g.ticksLeft--;
  const r = d.radius;
  const t = s.terrain;
  // The material at the front of the lowest disc sets the pace.
  const fx = subToPx(g.x) + subToPx(mulQ14(r * SUBPX, g.dx));
  const fy = subToPx(g.y) - r - 1 + subToPx(mulQ14(r * SUBPX, g.dy));
  const res = digResistance(t, materialOf(t, fx, fy));
  if (res > 0) {
    const step = idiv(g.speed * 100, res);
    g.x += mulQ14(step, g.dx);
    g.y += mulQ14(step, g.dy);
  }
  const x = subToPx(g.x);
  const floor = subToPx(g.y);
  // The pick only needs its disc; the sap cuts a tunnel the unit stands up in.
  const top = d.along === 'down' ? floor - 2 * r : floor - UNIT_HEIGHT - 6;
  for (let cy = floor - r - 1; cy + r >= top; cy -= r) {
    if (carveCircle(t, x, cy, r, true) > 0)
      events.push({ e: 'terrainCarved', x, y: cy, radius: r });
    if (d.along === 'down') break;
  }
  if (d.along === 'aim' && u.grounded) {
    const dir: -1 | 1 = g.dx >= 0 ? 1 : -1;
    if ((g.x - u.x) * dir > 2 * SUBPX) walk(u, t, dir, s.rules.unit);
  }
}

// ---------------------------------------------------------------------------------------------
// Chausse-trape
// ---------------------------------------------------------------------------------------------

/** The unit leaves a chausse-trape just ahead of it (at its feet against a wall). */
export function placeMine(s: SimState, u: Unit, def: WeaponDef, id: number, events: SimEvent[]) {
  if (!def.mine) return;
  let x = subToPx(u.x) + u.facing * (UNIT_HALF_WIDTH + MINE_AHEAD);
  if (isSolid(s.terrain, x, subToPx(u.y) - 4)) x = subToPx(u.x);
  s.mines.push({
    id,
    team: u.team,
    x: x * SUBPX + SUBPX / 2,
    y: u.y - 8 * SUBPX,
    arm: def.mine.armTicks,
    weapon: def.id,
  });
  s.mines.sort((a, b) => a.id - b.id);
  events.push({ e: 'minePlaced', id, team: u.team });
}

/** Removes mine `index` and queues its blast `delay` ticks from now. */
function setOff(s: SimState, index: number, delay: number, events: SimEvent[]): void {
  const mine = s.mines[index];
  if (!mine) return;
  s.mines.splice(index, 1);
  const def = weaponDefIn(s.rules, mine.weapon);
  // The blast is taken at a standing unit's middle, so whoever steps on it takes it in full.
  queueExplosion(s.explosions, s.tick + delay, {
    x: mine.x,
    y: mine.y - (UNIT_HEIGHT >> 1) * SUBPX,
    radius: def.explosionRadius,
    carveRadius: def.explosionRadius,
    maxDamage: def.damage,
    sourceId: mine.id,
    ...(s.rules.structures ? { weapon: def.id } : {}),
  });
  events.push({ e: 'mineSprung', id: mine.id, team: mine.team });
}

/** Each tick: mines drop when their ground goes, arm, and go off under any unit. */
export function stepMines(s: SimState, events: SimEvent[]): void {
  const t = s.terrain;
  for (let k = s.mines.length - 1; k >= 0; k--) {
    const mine: Mine | undefined = s.mines[k];
    if (!mine) continue;
    const x = subToPx(mine.x);
    let lost = false;
    for (let i = 0; i < MINE_FALL_PX; i++) {
      const y = subToPx(mine.y);
      if (isSolid(t, x - 3, y) || isSolid(t, x, y) || isSolid(t, x + 3, y)) break;
      if (y >= t.height) {
        lost = true;
        break;
      }
      mine.y += SUBPX;
    }
    if (lost) {
      s.mines.splice(k, 1);
      continue;
    }
    if (mine.arm > 0) {
      mine.arm--;
      continue;
    }
    const reach = weaponDefIn(s.rules, mine.weapon).mine?.triggerRadius ?? 0;
    const y = mine.y - MINE_TOP * SUBPX;
    if (s.units.some((u) => u.alive && touchesUnit(u, mine.x, y, reach))) setOff(s, k, 0, events);
  }
}

/** A blast sets off every mine it reaches, after the chain delay. */
export function blastReachesMines(s: SimState, e: Explosion, events: SimEvent[]): void {
  for (let k = s.mines.length - 1; k >= 0; k--) {
    const mine = s.mines[k];
    if (!mine) continue;
    const dx = mine.x - e.x;
    const dy = mine.y - MINE_TOP * SUBPX - e.y;
    if (isqrt(dx * dx + dy * dy) > e.radius * SUBPX) continue;
    setOff(s, k, weaponDefIn(s.rules, mine.weapon).mine?.chainDelay ?? 0, events);
  }
}

// ---------------------------------------------------------------------------------------------
// Targeted weapons: stone wall, trebuchet volley
// ---------------------------------------------------------------------------------------------

/** Wall length 1 to 3, from the fuse buttons. */
export function wallSize(fuseTicks: number): 1 | 2 | 3 {
  const n = idiv(fuseTicks + 30, 60);
  return n <= 1 ? 1 : n >= 3 ? 3 : 2;
}

export function wallLength(w: WallDef, size: 1 | 2 | 3): number {
  return size === 1 ? w.short : size === 2 ? w.medium : w.long;
}

/** BAM: the wall lies along the aim, turned by steps of 22.5° (GDD §4.4). */
export function wallAngle(aim: number): number {
  return (((aim + 128) >> 8) << 8) & ANGLE_MASK;
}

/** The wall's pixels as a shape centred on its middle; (ox, oy) is its top-left from there. */
export function wallShape(
  w: WallDef,
  length: number,
  angle: number,
): { shape: StampShape; ox: number; oy: number } {
  const hl = length >> 1;
  const ht = w.thickness >> 1;
  const r = hl + ht;
  const size = 2 * r + 1;
  const data = new Uint8Array(size * size);
  const c = cosQ14(angle);
  const sn = sinQ14(angle);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const along = dx * c + dy * sn;
      const across = dy * c - dx * sn;
      if (Math.abs(along) <= hl << 14 && Math.abs(across) <= ht << 14) {
        data[(dy + r) * size + dx + r] = 1;
      }
    }
  }
  return { shape: { width: size, height: size, data }, ox: -r, oy: -r };
}

/** Highest solid row of column x, or the map height. */
function groundAt(t: Terrain, x: number): number {
  for (let y = 0; y < t.height; y++) if (isSolid(t, x, y)) return y;
  return t.height;
}

/**
 * px: the point a targeted weapon aims at when fired with the gauge or a drag: along the aim, as
 * far as the power says (the wall), or on the ground ahead at that range (the volley).
 */
export function targetFor(
  v: TargetView,
  u: Pick<Unit, 'x' | 'y'>,
  def: WeaponDef,
  power: number,
): { x: number; y: number } {
  const p = Math.max(0, Math.min(power, MAX_POWER));
  const cx = subToPx(u.x);
  const cy = subToPx(u.y) - (UNIT_HEIGHT >> 1);
  const aim = v.turn.aim;
  if (def.strike) {
    const dir = cosQ14(aim) >= 0 ? 1 : -1;
    const x = Math.max(
      0,
      Math.min(v.terrain.width - 1, cx + dir * idiv(def.strike.range * p, MAX_POWER)),
    );
    return { x, y: groundAt(v.terrain, x) };
  }
  const d = idiv((def.wall?.reach ?? 0) * p, MAX_POWER);
  return {
    x: cx + subToPx(mulQ14(d * SUBPX, cosQ14(aim))),
    y: cy + subToPx(mulQ14(d * SUBPX, sinQ14(aim))),
  };
}

/** Why a wall cannot go at (x, y), or null when it can: too far, on a unit, or in the ground. */
export function wallRefusal(
  v: TargetView & { readonly units: readonly Readonly<Unit>[] },
  u: Pick<Unit, 'x' | 'y'>,
  def: WeaponDef,
  x: number,
  y: number,
): 'far' | 'unit' | 'solid' | null {
  const w = def.wall;
  if (!w) return 'solid';
  const dx = x - subToPx(u.x);
  const dy = y - (subToPx(u.y) - (UNIT_HEIGHT >> 1));
  if (isqrt(dx * dx + dy * dy) > w.reach) return 'far';
  const { shape, ox, oy } = wallShape(
    w,
    wallLength(w, wallSize(v.turn.fuse)),
    wallAngle(v.turn.aim),
  );
  let free = 0;
  for (let j = 0; j < shape.height; j++) {
    for (let i = 0; i < shape.width; i++) {
      if (shape.data[j * shape.width + i] === 0) continue;
      const px = x + ox + i;
      const py = y + oy + j;
      if (px < 0 || py < 0 || px >= v.terrain.width || py >= v.terrain.height) continue;
      for (const o of v.units) {
        if (!o.alive) continue;
        const ux = subToPx(o.x);
        const uy = subToPx(o.y);
        if (Math.abs(px - ux) <= UNIT_HALF_WIDTH && py < uy && py >= uy - UNIT_HEIGHT)
          return 'unit';
      }
      if (materialOf(v.terrain, px, py) === Material.Air) free++;
    }
  }
  return free === 0 ? 'solid' : null;
}

/** Sets a stone wall with its middle at (x, y) px; false (nothing done) where it cannot go. */
export function buildWall(
  s: SimState,
  u: Unit,
  def: WeaponDef,
  x: number,
  y: number,
  events: SimEvent[],
): boolean {
  const w = def.wall;
  if (!w || wallRefusal(s, u, def, x, y) !== null) return false;
  const { shape, ox, oy } = wallShape(
    w,
    wallLength(w, wallSize(s.turn.fuse)),
    wallAngle(s.turn.aim),
  );
  stamp(s.terrain, x + ox, y + oy, shape, Material.BuiltStone);
  events.push({ e: 'terrainChanged', x: x + ox, y: y + oy, w: shape.width, h: shape.height });
  events.push({ e: 'wallBuilt', x, y });
  return true;
}

/**
 * The trebuchet volley: its stones start above the map, from the side the unit aims away from,
 * so that they land around column x, `spacing` apart; each one bursts where it lands.
 */
export function launchStrike(
  s: SimState,
  u: Unit,
  def: WeaponDef,
  x: number,
  firstId: number,
  damagePct: number,
): void {
  const st = def.strike;
  if (!st) return;
  const t = s.terrain;
  const tx = Math.max(0, Math.min(t.width - 1, x));
  const fall = (groundAt(t, tx) + st.height) * SUBPX;
  const ticks = isqrt(idiv(2 * fall, GRAVITY));
  let dir = cosQ14(s.turn.aim) >= 0 ? 1 : -1;
  const lead = (st.speed * ticks) >> 8;
  // Thrown from off the map on that side: the other side if the stones would start outside it.
  if (tx - dir * lead < 0 || tx - dir * lead >= t.width) dir = -dir;
  const spread = idiv((st.count - 1) * st.spacing, 2);
  for (let i = 0; i < st.count; i++) {
    const lx = tx - spread + i * st.spacing;
    const projectile = createProjectile(
      i === 0 ? firstId : s.nextEntityId++,
      u.id,
      lx * SUBPX - dir * st.speed * ticks,
      -st.height * SUBPX,
      dir * st.speed,
      0,
      { radius: def.projectileRadius, windPct: def.windPct, gravityPct: 100 },
    );
    projectile.clearOfOwner = true;
    s.shots.push({
      projectile,
      weapon: def.id,
      fuse: 0,
      ...(damagePct !== 100 ? { damagePct } : {}),
    });
  }
  s.shots.sort((a, b) => a.projectile.id - b.projectile.id);
}
