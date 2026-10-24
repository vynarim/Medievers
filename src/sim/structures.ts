// Structures with hit points (GDD §4.7, TECH_SPEC §5.4). Only with rules.structures and a map
// that declares structures. An ownership layer parallel to the mask tells which structure each
// pixel belongs to. Hits take HP off the structures they reach, once per structure per hit; at
// 0 HP the structure collapses: its pixels leave the mask as blocks that topple outward, fall,
// strike the units they cross, and settle as rubble.
import {
  StructureState,
  type StructurePlacement,
  type StructureRules,
} from '../content/structures.ts';
import type { WeaponId } from '../content/weapons.ts';
import type { SimEvent } from './events.ts';
import type { Explosion } from './explosions/explosion.ts';
import { SUBPX, idiv, subToPx } from './math/fixed.ts';
import type { Block, SimState, Structure } from './state.ts';
import { Material } from './terrain/material.ts';
import {
  isSolid,
  liftRect,
  markAllDirty,
  materialOf,
  stamp,
  type Terrain,
} from './terrain/terrain.ts';
import {
  GRAVITY,
  TERMINAL_VELOCITY,
  UNIT_HALF_WIDTH,
  UNIT_HEIGHT,
  bodyFree,
  launch,
} from './units/unit.ts';

/**
 * sub-px/tick of sideways speed per px a block lies above the structure's base: it topples over
 * away from the hit that felled it, the top flying furthest
 */
const TOPPLE = 4;
/** sub-px/tick: push a falling block gives the unit it strikes, sideways and up */
const CRUSH_PUSH = 3 * SUBPX;
/** px a unit buried by rubble may be lifted to get free */
const UNBURY = 48;

/** px: thickness of the wooden walk left on top of a tower as it burns down */
const BURNT_WALK = 10;
/** px: thickness of a built tower's solid parapet, the floor of its battlement */
const PARAPET = 14;
/** px: merlons on the parapet, high and wide, every MERLON_STEP px */
const MERLON_H = 18;
const MERLON_W = 16;
const MERLON_STEP = 32;
/** px: the stakes of a wooden tower's palisade, every STAKE_STEP px, pointed by STAKE_TAPER */
const STAKE_W = 7;
const STAKE_STEP = 10;
const STAKE_TAPER = 3;
/** px: battlement kept free of merlons on the ladder side, to step on from the ladder */
const LANDING = 40;
/** px: how deep a built tower goes under the lowest ground of its foot */
const FOOTING = 20;
/** px: gap between a tower's face and its ladder, and the ladder's width */
const LADDER_GAP = 6;
const LADDER_W = 4;

/** Highest solid row of column x, or the map height. */
function groundAt(t: Terrain, x: number): number {
  for (let y = 0; y < t.height; y++) if (isSolid(t, x, y)) return y;
  return t.height;
}

/**
 * Builds a tower on the ground (2026-10-25): a body of masonry seen behind the play (units and
 * shots pass in front of it), a solid parapet with merlons on top to stand on, and a ladder up
 * one face. Returns the rectangle it covers, ladder included.
 */
function buildTower(
  t: Terrain,
  x0: number,
  width: number,
  height: number,
  ladder: -1 | 1,
  wood: boolean,
): [number, number, number, number] {
  const floor = wood ? Material.Wood : Material.BuiltStone;
  const body = wood ? Material.Timber : Material.Backdrop;
  const x1 = x0 + width;
  let foot = 0;
  for (let x = x0; x < x1; x++) foot = Math.max(foot, groundAt(t, x));
  const top = Math.max(MERLON_H + 1, groundAt(t, x0 + (width >> 1)) - height);
  const bottom = Math.min(t.height, foot + FOOTING);
  const put = (x: number, y: number, m: number): void => {
    if (x < 0 || y < 0 || x >= t.width || y >= t.height) return;
    const i = y * t.width + x;
    if (t.data[i] === Material.Air) t.data[i] = m;
  };
  for (let x = x0; x < x1; x++) {
    const free = ladder < 0 ? x < x0 + LANDING : x >= x1 - LANDING;
    // Stone: square merlons. Wood: a palisade of pointed stakes.
    const k = (x - x0) % STAKE_STEP;
    const rise = wood
      ? !free && k < STAKE_W
        ? MERLON_H - STAKE_TAPER * Math.abs(k - (STAKE_W >> 1))
        : 0
      : !free && (x - x0) % MERLON_STEP < MERLON_W
        ? MERLON_H
        : 0;
    for (let y = top - rise; y < bottom; y++) {
      put(x, y, y < top + PARAPET ? floor : body);
    }
  }
  const lx = ladder < 0 ? x0 - LADDER_GAP - LADDER_W : x1 + LADDER_GAP;
  for (let x = lx; x < lx + LADDER_W; x++) {
    for (let y = top; y < groundAt(t, x); y++) put(x, y, Material.Ladder);
  }
  markAllDirty(t);
  const left = Math.min(x0, lx);
  const right = Math.max(x1, lx + LADDER_W);
  return [left, top - MERLON_H, right - left, bottom - top + MERLON_H];
}

/** Builds the ownership layer and the structures of a new match. */
export function initStructures(
  terrain: Terrain,
  rules: StructureRules | undefined,
  placements: readonly StructurePlacement[] | undefined,
): { owners: Uint8Array | null; structures: Structure[] } {
  if (!rules || !placements || placements.length === 0) return { owners: null, structures: [] };
  const owners = new Uint8Array(terrain.width * terrain.height);
  const structures: Structure[] = [];
  for (const p of [...placements].sort((a, b) => a.id - b.id)) {
    const rect =
      'build' in p
        ? buildTower(
            terrain,
            p.build.x,
            p.build.width,
            p.type === 'woodTower'
              ? (rules.woodTowerHeight ?? rules.towerHeight)
              : rules.towerHeight,
            p.build.ladder,
            p.type === 'woodTower',
          )
        : p.rect;
    const [x0, y0, w, h] = rect;
    for (let y = Math.max(0, y0); y < Math.min(terrain.height, y0 + h); y++) {
      for (let x = Math.max(0, x0); x < Math.min(terrain.width, x0 + w); x++) {
        // Masonry, timber and ladders belong to a structure, never the ground it stands on.
        const m = materialOf(terrain, x, y);
        if (
          m === Material.BuiltStone ||
          m === Material.Backdrop ||
          m === Material.Timber ||
          m === Material.Wood ||
          m === Material.Ladder
        ) {
          owners[y * terrain.width + x] = p.id;
        }
      }
    }
    structures.push({
      id: p.id,
      type: p.type,
      rect,
      hp: rules.defs[p.type].hp,
      state: StructureState.Intact,
      struck: [],
    });
  }
  return { owners, structures };
}

/** Percent of `weapon`'s damage structure st takes (no weapon: another blast). */
function pctFor(r: StructureRules, st: Structure, weapon: WeaponId | undefined): number {
  const def = r.defs[st.type];
  return (weapon !== undefined ? def.weaponPct[weapon] : undefined) ?? def.defaultPct;
}

/** Takes `damage` HP (before the structure's percentage) off structure st. */
function hitStructure(
  s: SimState,
  st: Structure,
  damage: number,
  weapon: WeaponId | undefined,
  fromX: number,
  events: SimEvent[],
): void {
  const r = s.rules.structures;
  if (!r || st.state === StructureState.Fallen) return;
  const dealt = idiv(damage * pctFor(r, st, weapon) + 50, 100);
  if (dealt <= 0) return;
  st.hp = Math.max(0, st.hp - dealt);
  const max = r.defs[st.type].hp;
  st.state =
    st.hp === 0
      ? StructureState.Fallen
      : st.hp * 100 <= max * r.ruinPct
        ? StructureState.Ruin
        : st.hp * 100 <= max * r.crackedPct
          ? StructureState.Cracked
          : StructureState.Intact;
  events.push({ e: 'structureHit', id: st.id, damage: dealt, state: st.state });
  if (st.state === StructureState.Fallen) collapse(s, st, r, fromX, events);
}

/** A wooden tower reached by a fire weapon (`flames`) catches fire (rules.structures.burnTurns). */
function setAlight(s: SimState, st: Structure, weapon: WeaponId | undefined, events: SimEvent[]) {
  const turns = s.rules.structures?.burnTurns;
  if (turns === undefined || st.type !== 'woodTower' || st.fire !== undefined) return;
  if (st.state === StructureState.Fallen || weapon === undefined) return;
  if (!s.rules.weapons.find((w) => w.id === weapon)?.flames) return;
  st.fire = turns;
  events.push({ e: 'towerAlight', id: st.id });
}

/**
 * End of a turn: every burning tower burns down from the top, by an equal share of what is left
 * for each turn of fire left, its top becoming a new wooden walk; on its last turn it is gone,
 * and whoever still stands on it dies.
 */
export function burnTowersTurnEnd(s: SimState, events: SimEvent[]): void {
  const owners = s.owners;
  if (!owners || s.rules.structures?.burnTurns === undefined) return;
  const t = s.terrain;
  const w = t.width;
  for (const st of s.structures) {
    if (st.fire === undefined || st.state === StructureState.Fallen) continue;
    st.fire--;
    const [rx, ry, rw, rh] = st.rect;
    const x0 = Math.max(0, rx);
    const x1 = Math.min(w, rx + rw);
    const y1 = Math.min(t.height, ry + rh);
    const mine = (x: number, y: number): boolean =>
      owners[y * w + x] === st.id && materialOf(t, x, y) !== Material.Air;
    if (st.fire <= 0) {
      // Burnt away: those still up there go with it.
      for (const u of s.units) {
        if (!u.alive) continue;
        const ux = subToPx(u.x);
        const uy = subToPx(u.y);
        if (
          uy < y1 &&
          [-UNIT_HALF_WIDTH + 1, 0, UNIT_HALF_WIDTH - 1].some((d) => {
            const px = ux + d;
            return px >= x0 && px < x1 && uy >= 0 && mine(px, uy);
          })
        ) {
          u.alive = false;
          u.hp = 0;
          events.push({ e: 'unitDied', unitId: u.id, cause: 'burnt' });
        }
      }
      for (let y = Math.max(0, ry); y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          if (owners[y * w + x] !== st.id) continue;
          owners[y * w + x] = 0;
          t.data[y * w + x] = Material.Air;
        }
      }
      st.hp = 0;
      st.state = StructureState.Fallen;
      delete st.fire;
      markAllDirty(t);
      events.push({ e: 'terrainChanged', x: rx, y: ry, w: rw, h: rh });
      events.push({ e: 'towerBurnt', id: st.id });
      continue;
    }
    // Its top and its foot as they stand.
    let top = y1;
    for (let y = Math.max(0, ry); y < y1 && top === y1; y++) {
      for (let x = x0; x < x1; x++) {
        if (mine(x, y)) {
          top = y;
          break;
        }
      }
    }
    let foot = top;
    for (let x = x0; x < x1; x++) {
      for (let y = y1 - 1; y > foot; y--) {
        if (mine(x, y)) {
          foot = y;
          break;
        }
      }
    }
    const slice = Math.ceil((foot - top) / (st.fire + 1));
    const newTop = top + slice;
    for (let y = top; y < newTop; y++) {
      for (let x = x0; x < x1; x++) {
        if (!mine(x, y)) continue;
        owners[y * w + x] = 0;
        t.data[y * w + x] = Material.Air;
      }
    }
    // The charred top is a walk of solid wood again.
    for (let y = newTop; y < Math.min(y1, newTop + BURNT_WALK); y++) {
      for (let x = x0; x < x1; x++) {
        if (owners[y * w + x] === st.id && materialOf(t, x, y) === Material.Timber) {
          t.data[y * w + x] = Material.Wood;
        }
      }
    }
    markAllDirty(t);
    events.push({ e: 'terrainChanged', x: rx, y: ry, w: rw, h: rh });
  }
}

/** A blast reaches every structure whose footprint lies within its radius. */
export function blastHitsStructures(s: SimState, e: Explosion, events: SimEvent[]): void {
  const owners = s.owners;
  if (!owners || !s.rules.structures || e.maxDamage <= 0) return;
  const w = s.terrain.width;
  const cx = subToPx(e.x);
  const cy = subToPx(e.y);
  const r = e.radius;
  for (const st of s.structures) {
    if (st.state === StructureState.Fallen) continue;
    const [rx, ry, rw, rh] = st.rect;
    if (cx + r < rx || cx - r >= rx + rw || cy + r < ry || cy - r >= ry + rh) continue;
    let reached = false;
    for (let y = Math.max(ry, cy - r); y < Math.min(ry + rh, cy + r + 1) && !reached; y += 2) {
      for (let x = Math.max(rx, cx - r); x < Math.min(rx + rw, cx + r + 1); x += 2) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= r * r && owners[y * w + x] === st.id) {
          reached = true;
          break;
        }
      }
    }
    if (reached) {
      hitStructure(s, st, e.maxDamage, e.weapon, cx, events);
      setAlight(s, st, e.weapon, events);
    }
  }
}

/** px around a shot's impact searched for the structure it struck */
const IMPACT_REACH = 2;

/** A direct hit (arrow, stone, blow) at px (x, y) damages the structure there, if any. */
export function shotHitsStructure(
  s: SimState,
  x: number,
  y: number,
  damage: number,
  weapon: WeaponId,
  events: SimEvent[],
): void {
  const owners = s.owners;
  if (!owners || !s.rules.structures) return;
  const w = s.terrain.width;
  for (let dy = -IMPACT_REACH; dy <= IMPACT_REACH; dy++) {
    for (let dx = -IMPACT_REACH; dx <= IMPACT_REACH; dx++) {
      const px = x + dx;
      const py = y + dy;
      if (px < 0 || py < 0 || px >= w || py >= s.terrain.height) continue;
      const id = owners[py * w + px] ?? 0;
      const st = id > 0 ? s.structures.find((c) => c.id === id) : undefined;
      if (st) {
        hitStructure(s, st, damage, weapon, x, events);
        return;
      }
    }
  }
}

/** The structure falls: its pixels leave the mask as blocks that topple away from its middle. */
function collapse(
  s: SimState,
  st: Structure,
  r: StructureRules,
  fromX: number,
  events: SimEvent[],
): void {
  const owners = s.owners;
  if (!owners) return;
  const [rx, ry, rw, rh] = st.rect;
  const width = s.terrain.width;
  const dir = rx + (rw >> 1) >= fromX ? 1 : -1;
  const base = ry + rh;
  const size = Math.max(4, r.blockSize);
  for (let by = ry; by < ry + rh; by += size) {
    for (let bx = rx; bx < rx + rw; bx += size) {
      const w = Math.min(size, rx + rw - bx);
      const h = Math.min(size, ry + rh - by);
      const data = liftRect(s.terrain, bx, by, w, h, (k) => owners[k] === st.id);
      if (!data.some((m) => m !== 0)) continue;
      s.blocks.push({
        id: s.nextEntityId++,
        x: bx * SUBPX,
        y: by * SUBPX,
        vx: dir * (base - by - (h >> 1)) * TOPPLE,
        vy: 0,
        w,
        h,
        data,
        fallen: 0,
        from: st.id,
      });
    }
  }
  for (let y = Math.max(0, ry); y < Math.min(s.terrain.height, ry + rh); y++) {
    for (let x = Math.max(0, rx); x < Math.min(width, rx + rw); x++) {
      if (owners[y * width + x] === st.id) owners[y * width + x] = 0;
    }
  }
  events.push({ e: 'structureFell', id: st.id });
  events.push({ e: 'terrainChanged', x: rx, y: ry, w: rw, h: rh });
}

/**
 * After the ground has been dug: a tower or a wall with too few of its columns still standing on
 * the ground (rules.structures.supportPct) collapses, toppling away from the ground it has left.
 * A column stands when the pixel under its lowest one is solid; a column dug out entirely does
 * not.
 */
export function undermineStructures(s: SimState, events: SimEvent[]): void {
  const r = s.rules.structures;
  const owners = s.owners;
  if (!r || !owners || r.supportPct === undefined) return;
  const t = s.terrain;
  const width = t.width;
  for (const st of s.structures) {
    if (st.state === StructureState.Fallen) continue;
    if (st.type !== 'tower' && st.type !== 'woodTower' && st.type !== 'wall') continue;
    const [rx, ry, rw, rh] = st.rect;
    let columns = 0;
    let standing = 0;
    let sumX = 0;
    for (let x = Math.max(0, rx); x < Math.min(width, rx + rw); x++) {
      // Its lowest pixel still there; dug-out pixels keep their owner in the layer.
      let owned = false;
      let lowest = -1;
      for (let y = Math.min(t.height, ry + rh) - 1; y >= Math.max(0, ry); y--) {
        if (owners[y * width + x] !== st.id) continue;
        owned = true;
        if (materialOf(t, x, y) !== Material.Air) {
          lowest = y;
          break;
        }
      }
      // Columns it never had (the gap beside a ladder) do not count; dug-out ones do.
      if (!owned) continue;
      columns++;
      if (lowest >= 0 && isSolid(t, x, lowest + 1) && owners[(lowest + 1) * width + x] !== st.id) {
        standing++;
        sumX += x;
      }
    }
    if (columns === 0 || standing * 100 >= columns * r.supportPct) continue;
    st.hp = 0;
    st.state = StructureState.Fallen;
    events.push({ e: 'structureUndermined', id: st.id });
    // It topples away from what still holds it: from the middle of its standing columns.
    collapse(s, st, r, standing > 0 ? idiv(sumX, standing) : rx + (rw >> 1), events);
  }
}

/** True when block b, with its top-left at px (x, y), overlaps solid terrain. */
function blockHits(t: Terrain, b: Block, x: number, y: number): boolean {
  for (let j = 0; j < b.h; j++) {
    for (let i = 0; i < b.w; i++) {
      if (b.data[j * b.w + i] !== 0 && isSolid(t, x + i, y + j)) return true;
    }
  }
  return false;
}

/** The block comes to rest at its place: it becomes rubble (earth), and buried units get out. */
function settleBlock(s: SimState, b: Block, r: StructureRules, events: SimEvent[]): void {
  // Only its lower part stays, as a heap: a fallen tower is a mound, not a tower of earth.
  const keep = Math.max(1, idiv(b.h * r.rubblePct, 100));
  const x = subToPx(b.x);
  const y = subToPx(b.y) + b.h - keep;
  const shape = { width: b.w, height: keep, data: b.data.subarray((b.h - keep) * b.w) };
  if (stamp(s.terrain, x, y, shape, Material.Earth) > 0) {
    events.push({ e: 'terrainChanged', x, y, w: b.w, h: keep });
  }
  for (const u of s.units) {
    if (!u.alive) continue;
    const px = subToPx(u.x);
    const py = subToPx(u.y);
    if (bodyFree(s.terrain, px, py)) continue;
    for (let d = 1; d <= UNBURY; d++) {
      if (bodyFree(s.terrain, px, py - d)) {
        u.y = (py - d) * SUBPX;
        break;
      }
    }
  }
}

/** A falling block strikes the units it crosses, once each. */
function crush(s: SimState, b: Block, r: StructureRules, events: SimEvent[]): void {
  const x0 = subToPx(b.x);
  const y0 = subToPx(b.y);
  const st = s.structures.find((c) => c.id === b.from);
  if (!st) return;
  for (const u of s.units) {
    if (!u.alive || st.struck.includes(u.id)) continue;
    const ux = subToPx(u.x);
    const uy = subToPx(u.y);
    if (ux + UNIT_HALF_WIDTH < x0 || ux - UNIT_HALF_WIDTH >= x0 + b.w) continue;
    if (uy < y0 || uy - UNIT_HEIGHT >= y0 + b.h) continue;
    const damage = Math.min(
      u.hp,
      Math.max(r.crushMin, Math.min(r.crushMax, idiv(b.fallen, r.crushPxPerHp))),
    );
    st.struck.push(u.id);
    st.struck.sort((a, c) => a - c);
    u.hp -= damage;
    events.push({ e: 'unitDamaged', unitId: u.id, damage });
    events.push({ e: 'crushed', unitId: u.id });
    u.vx = (ux >= x0 + (b.w >> 1) ? 1 : -1) * CRUSH_PUSH;
    u.vy = -CRUSH_PUSH;
    launch(u);
  }
}

/** Each tick: blocks fall, slide off what stops them sideways, strike units, and settle. */
export function stepBlocks(s: SimState, events: SimEvent[]): void {
  const r = s.rules.structures;
  if (!r || s.blocks.length === 0) return;
  const t = s.terrain;
  const remaining: Block[] = [];
  for (const b of s.blocks) {
    b.vy = Math.min(b.vy + GRAVITY, TERMINAL_VELOCITY);
    // Sideways first: a block stopped by a wall keeps falling straight.
    if (b.vx !== 0) {
      const nx = b.x + b.vx;
      if (blockHits(t, b, subToPx(nx), subToPx(b.y))) b.vx = 0;
      else b.x = nx;
    }
    // Then down, a pixel at a time.
    const from = subToPx(b.y);
    const to = subToPx(b.y + b.vy);
    let y = from;
    let landed = false;
    while (y < to) {
      if (blockHits(t, b, subToPx(b.x), y + 1)) {
        landed = true;
        break;
      }
      y++;
    }
    b.fallen += y - from;
    b.y = landed ? y * SUBPX : b.y + b.vy;
    crush(s, b, r, events);
    if (subToPx(b.y) >= t.height || subToPx(b.x) + b.w < 0 || subToPx(b.x) >= t.width) continue;
    if (landed) {
      settleBlock(s, b, r, events);
      continue;
    }
    remaining.push(b);
  }
  s.blocks = remaining;
}
