// Tools of the arsenal (GDD §4.2, §4.4): the pick and the sap that dig, the chausse-trape left on
// the ground, the stone wall set where the unit points, and the trebuchet volley called down on a
// point. One WeaponDef each in content/weapons.ts; their behaviours live here.
import { weaponDefIn } from '../content/rules.ts';
import type { WallDef, WeaponDef } from '../content/weapons.ts';
import { MAX_POWER } from './commands.ts';
import { digPctOf } from './classes.ts';
import type { UnitRules } from '../content/units.ts';
import { ladderReach } from './units/climb.ts';
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
  rectShape,
  stamp,
  type StampShape,
  type Terrain,
} from './terrain/terrain.ts';
import {
  GRAVITY,
  UNIT_HALF_WIDTH,
  UNIT_HEIGHT,
  bodyFree,
  supported,
  walk,
  type Unit,
} from './units/unit.ts';

/** Q14 sine of 22.5°: the sap cuts level unless the aim is steeper than this */
const SIN_22 = 6270;
/** px a mine drops per tick when the ground under it is gone (a plain drop, like the barrels) */
const MINE_FALL_PX = 4;
/** px a mine is left ahead of the unit's side */
const MINE_AHEAD = 10;
/** px a slope ahead may rise above the unit's feet and still take the mine */
const MINE_CLIMB = 24;
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

/**
 * Whether there is anything to cut in the sap's tunnel front at column x: some solid pixel
 * between the tunnel's floor and its roof (every 4 px).
 */
function frontHasMatter(t: Terrain, x: number, floor: number, r: number): boolean {
  for (let y = floor - 1; y >= floor - UNIT_HEIGHT - 6; y -= 4) {
    if (materialOf(t, x, y) !== Material.Air) return true;
  }
  return materialOf(t, x, floor - r - 1) !== Material.Air;
}

/**
 * The unit starts digging with the pick (straight down) or the sap (along the aim). False when
 * the sap is aimed at open air (rules: dig.needsMatter): nothing is dug, the action is kept.
 */
export function startDig(s: SimState, u: Unit, def: WeaponDef, id: number): boolean {
  const d = def.dig;
  if (!d) return false;
  const angle = d.along === 'down' ? 1024 : sapAngle(s.turn.aim);
  if (d.needsMatter) {
    const r = d.radius;
    const fx = subToPx(u.x) + subToPx(mulQ14((r + 4) * SUBPX, cosQ14(angle)));
    const floor = subToPx(u.y) + subToPx(mulQ14((r + 4) * SUBPX, sinQ14(angle)));
    if (!frontHasMatter(s.terrain, fx, floor, r)) return false;
  }
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
  return true;
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
  // Out of the hill into the open: the sap stops there (rules: dig.needsMatter).
  if (d.needsMatter && !frontHasMatter(t, fx, subToPx(g.y) + subToPx(mulQ14(r * SUBPX, g.dy)), r)) {
    g.ticksLeft = 0;
    return;
  }
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

/** px: row where a mine can be left in column x, up a slope as high as MINE_CLIMB; null if walled. */
function mineRow(t: Terrain, x: number, feet: number): number | null {
  if (x < 0 || x >= t.width) return null;
  for (let y = feet - 4; y >= feet - 4 - MINE_CLIMB; y--) {
    if (!isSolid(t, x - 3, y) && !isSolid(t, x, y) && !isSolid(t, x + 3, y)) return y;
  }
  return null;
}

/**
 * The unit leaves a chausse-trape just ahead of it, up or down the slope; behind it when a wall
 * stands ahead; at its feet only when walled in on both sides.
 */
export function placeMine(s: SimState, u: Unit, def: WeaponDef, id: number, events: SimEvent[]) {
  if (!def.mine) return;
  const ux = subToPx(u.x);
  const feet = subToPx(u.y);
  const off = UNIT_HALF_WIDTH + MINE_AHEAD;
  let x = ux + u.facing * off;
  let y = mineRow(s.terrain, x, feet);
  if (y === null) {
    x = ux - u.facing * off;
    y = mineRow(s.terrain, x, feet);
  }
  if (y === null) {
    x = ux;
    y = feet - 8;
  }
  s.mines.push({
    id,
    team: u.team,
    x: x * SUBPX + SUBPX / 2,
    y: y * SUBPX,
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
  const reach = def.wall?.reach ?? def.teleport?.reach ?? def.homing?.reach ?? 0;
  const d = idiv(reach * p, MAX_POWER);
  return {
    x: cx + subToPx(mulQ14(d * SUBPX, cosQ14(aim))),
    y: cy + subToPx(mulQ14(d * SUBPX, sinQ14(aim))),
  };
}

/**
 * px: the row the middle of a wall set at (x, y) comes to rest at: stone is heavy, so it drops
 * straight down until it stands on the ground (2026-10-25: walls no longer hang in the air).
 * A wall set into the ground stays where it is (and is refused).
 */
export function wallLanding(v: TargetView, def: WeaponDef, x: number, y: number): number {
  const w = def.wall;
  if (!w) return y;
  const { shape, ox, oy } = wallShape(
    w,
    wallLength(w, wallSize(v.turn.fuse)),
    wallAngle(v.turn.aim),
  );
  const t = v.terrain;
  let drop = t.height;
  for (let i = 0; i < shape.width; i++) {
    // The lowest stone of this column, and the free fall under it.
    let bottom = -1;
    for (let j = shape.height - 1; j >= 0; j--) {
      if (shape.data[j * shape.width + i] !== 0) {
        bottom = j;
        break;
      }
    }
    if (bottom < 0) continue;
    const px = x + ox + i;
    if (px < 0 || px >= t.width) continue;
    let gap = 0;
    for (let py = y + oy + bottom + 1; py < t.height && !isSolid(t, px, py); py++) gap++;
    drop = Math.min(drop, gap);
  }
  return drop >= t.height ? y : y + drop;
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
  // Where it comes to rest: neither on a unit nor in the ground there.
  if (w.fall) y = wallLanding(v, def, x, y);
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
  if (w.fall) y = wallLanding(s, def, x, y);
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

// ---------------------------------------------------------------------------------------------
// Miracle, ladder
// ---------------------------------------------------------------------------------------------

/** What the miracle's landing reads (a SimView fits). */
interface LandingView extends TargetView {
  readonly units: readonly Readonly<Unit>[];
  readonly waterY: number;
  readonly burnPx: number;
}

/**
 * px: where a unit sent by the miracle to (x, y) — its body's middle — comes to stand: the
 * body must be free there, and it drops straight down onto the ground below. Null where it
 * cannot go: in the ground, over the void, into the water or the burnt ends, onto another unit.
 */
export function teleportLanding(
  v: LandingView,
  self: number,
  x: number,
  y: number,
): { x: number; y: number } | null {
  const t = v.terrain;
  const feet = y + (UNIT_HEIGHT >> 1);
  if (x < v.burnPx + UNIT_HALF_WIDTH || x >= t.width - v.burnPx - UNIT_HALF_WIDTH) return null;
  if (feet < UNIT_HEIGHT || !bodyFree(t, x, feet)) return null;
  let ground = feet;
  while (ground < t.height && !supported(t, x, ground)) {
    if (!bodyFree(t, x, ground + 1)) return null;
    ground++;
  }
  if (ground >= t.height || ground > v.waterY) return null;
  for (const o of v.units) {
    if (!o.alive || o.id === self) continue;
    if (
      Math.abs(subToPx(o.x) - x) < 2 * UNIT_HALF_WIDTH &&
      Math.abs(subToPx(o.y) - ground) < UNIT_HEIGHT
    )
      return null;
  }
  return { x, y: ground };
}

/** The miracle: the unit stands at once where teleportLanding says; false where it cannot go. */
export function teleport(s: SimState, u: Unit, x: number, y: number, events: SimEvent[]): boolean {
  const to = teleportLanding(s, u.id, x, y);
  if (!to) return false;
  const from = { x: subToPx(u.x), y: subToPx(u.y) };
  u.x = to.x * SUBPX + SUBPX / 2;
  u.y = to.y * SUBPX;
  u.vx = 0;
  u.vy = 0;
  u.grounded = true;
  u.knocked = false;
  if (u.climbing) u.climbing = false;
  u.airPeakY = to.y;
  if (u.airFromY !== undefined) u.airFromY = to.y;
  u.stillTicks = 0;
  events.push({ e: 'teleported', unitId: u.id, fromX: from.x, fromY: from.y, x: to.x, y: to.y });
  return true;
}

/** px: gap between a wall's face and a ladder set against it, and the ladder's width */
const LADDER_GAP = 6;
const LADDER_W = 4;
/** px under the feet the ladder's foot may be found */
const LADDER_FOOT = 40;

/** px from the unit's middle to the farthest wall a ladder is set against: within its grab. */
export const ladderLook = (rules: UnitRules): number =>
  ladderReach(rules) + LADDER_GAP + LADDER_W - 1;

/**
 * Column of the ladder's left edge, and the row of the top of the wall it leans on: against the
 * wall in front within LADDER_LOOK px, or just past the unit's flank on open ground (no wall: -1).
 */
function ladderColumn(
  t: Terrain,
  ux: number,
  feet: number,
  dir: -1 | 1,
  look: number,
): { x: number; wallTop: number } {
  for (let d = UNIT_HALF_WIDTH + 1; d <= look; d++) {
    const x = ux + dir * d;
    const low = feet - 20;
    if (isSolid(t, x, low) || isSolid(t, x, feet - 60)) {
      let top = isSolid(t, x, low) ? low : feet - 60;
      while (top > 0 && isSolid(t, x, top - 1)) top--;
      const near = x - dir * LADDER_GAP;
      return { x: dir > 0 ? near - LADDER_W + 1 : near, wallTop: top };
    }
  }
  const near = ux + dir * (UNIT_HALF_WIDTH + 4);
  return { x: dir > 0 ? near : near - LADDER_W + 1, wallTop: -1 };
}

/**
 * The ladder: a strip of ladder from the ground in front of the unit up to `height` px, through
 * the air only, stopped by a ceiling. False (nothing done) with no ground under its foot.
 */
export function placeLadder(s: SimState, u: Unit, def: WeaponDef, events: SimEvent[]): boolean {
  const l = def.ladder;
  if (!l) return false;
  const t = s.terrain;
  const feet = subToPx(u.y);
  // A wall farther than the unit could reach the ladder against it is not leant on.
  const look = ladderLook(s.rules.unit);
  const { x: x0, wallTop } = ladderColumn(t, subToPx(u.x), feet, u.facing, look);
  if (x0 < 0 || x0 + LADDER_W > t.width) return false;
  // Its foot: the highest ground under the strip, from the unit's waist down.
  let foot = -1;
  for (let y = feet - (UNIT_HEIGHT >> 1); y <= feet + LADDER_FOOT && foot < 0; y++) {
    for (let x = x0; x < x0 + LADDER_W; x++) if (isSolid(t, x, y)) foot = y;
  }
  if (foot < 0) return false;
  // Up to the top of the wall it leans on (a rung above it), or its full height.
  const highest = Math.max(foot - l.height, wallTop < 0 ? 0 : wallTop - 2);
  let top = foot;
  while (top > highest) {
    let blocked = false;
    for (let x = x0; x < x0 + LADDER_W; x++) if (isSolid(t, x, top - 1)) blocked = true;
    if (blocked) break;
    top--;
  }
  if (foot - top < UNIT_HEIGHT >> 1) return false;
  stamp(t, x0, top, rectShape(LADDER_W, foot - top), Material.Ladder);
  events.push({ e: 'terrainChanged', x: x0, y: top, w: LADDER_W, h: foot - top });
  events.push({ e: 'ladderPlaced', x: x0, y: top, h: foot - top });
  return true;
}
