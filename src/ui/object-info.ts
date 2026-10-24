// What a click on a map object shows in its bubble (barrel, reliquary, field kitchen, beast,
// resting pot): which object is under a point, and its name and description, with the values of
// the match rules. Pure: reads the sim view only.
import { BARREL_HEIGHT, BARREL_WIDTH } from '../content/barrels.ts';
import { BEAST_HEIGHT, BEAST_WIDTH, BeastKind } from '../content/beasts.ts';
import { CRATE_HEIGHT, CRATE_WIDTH } from '../content/crates.ts';
import { KITCHEN_HEIGHT, KITCHEN_WIDTH } from '../content/kitchen.ts';
import { SUBPX } from '../sim/math/fixed.ts';
import type { SimView } from '../sim/sim.ts';
import { t, variantCount } from './i18n.ts';
import { StructureState } from '../content/structures.ts';
import { classOf, maxHpOf } from '../sim/classes.ts';
import { FACTIONS, unitName } from '../content/factions.ts';
import { UNIT_HEIGHT } from '../sim/units/unit.ts';

export type ObjectRef =
  | { readonly kind: 'barrel'; readonly id: number }
  | { readonly kind: 'crate'; readonly id: number }
  | { readonly kind: 'pot'; readonly id: number }
  | { readonly kind: 'kitchen' }
  | { readonly kind: 'beast' }
  | { readonly kind: 'structure'; readonly id: number }
  /** the tombstone of a fallen unit, by the unit's id */
  | { readonly kind: 'grave'; readonly id: number };

export interface ObjectInfo {
  readonly title: string;
  readonly text: string;
  /** world px: top centre of the object, where the bubble points */
  readonly x: number;
  readonly y: number;
}

/** px: a tombstone, standing where its unit fell */
export const GRAVE_WIDTH = 24;
export const GRAVE_HEIGHT = 34;

/** The fallen unit whose tombstone stands under world point (x, y), if any. */
export function graveAt(v: SimView, x: number, y: number, slop: number): ObjectRef | null {
  for (const u of v.units) {
    if (!u.alive && inBox(x, y, u.x / SUBPX, u.y / SUBPX, GRAVE_WIDTH, GRAVE_HEIGHT, slop)) {
      return { kind: 'grave', id: u.id };
    }
  }
  return null;
}

/** px around a pot that still counts as clicking it */
const POT_RADIUS = 10;

/** True when (x, y) lies in a box of w × h standing on (bx, by), widened by `slop`. */
function inBox(x: number, y: number, bx: number, by: number, w: number, h: number, slop: number) {
  return Math.abs(x - bx) <= w / 2 + slop && y <= by + slop && y >= by - h - slop;
}

/** The map object under world point (x, y), if any; `slop` widens every box (world px). */
export function objectAt(v: SimView, x: number, y: number, slop: number): ObjectRef | null {
  for (const p of v.pots) {
    if (Math.hypot(x - p.x / SUBPX, y - p.y / SUBPX) <= POT_RADIUS + slop) {
      return { kind: 'pot', id: p.id };
    }
  }
  for (const b of v.barrels) {
    if (inBox(x, y, b.x / SUBPX, b.y / SUBPX, BARREL_WIDTH, BARREL_HEIGHT, slop)) {
      return { kind: 'barrel', id: b.id };
    }
  }
  for (const c of v.crates) {
    // A coffer coming down hangs under its angel: the wings count too.
    const h = c.landed ? CRATE_HEIGHT : CRATE_HEIGHT + 40;
    if (inBox(x, y, c.x / SUBPX, c.y / SUBPX, CRATE_WIDTH, h, slop)) {
      return { kind: 'crate', id: c.id };
    }
  }
  const k = v.kitchen;
  if (k && inBox(x, y, k.x / SUBPX, k.y / SUBPX, KITCHEN_WIDTH, KITCHEN_HEIGHT + 10, slop)) {
    return { kind: 'kitchen' };
  }
  const b = v.beast;
  if (b && inBox(x, y, b.x / SUBPX, b.y / SUBPX, BEAST_WIDTH, BEAST_HEIGHT + 20, slop)) {
    return { kind: 'beast' };
  }
  const grave = graveAt(v, x, y, slop);
  if (grave) return grave;
  // A tower, a wall: the pixel clicked belongs to a standing structure.
  const px = Math.floor(x);
  const py = Math.floor(y);
  if (v.owners && px >= 0 && py >= 0 && px < v.terrain.width && py < v.terrain.height) {
    const id = v.owners[py * v.terrain.width + px] ?? 0;
    const st = v.structures.find((c) => c.id === id && c.state !== StructureState.Fallen);
    if (st && v.terrain.data[py * v.terrain.width + px] !== 0) return { kind: 'structure', id };
  }
  return null;
}

/** The hover bubble of a unit: name, class and HP; `above` px over its head (its label). */
export function unitInfo(v: SimView, unitId: number, above: number): ObjectInfo | null {
  const u = v.units.find((x) => x.id === unitId);
  if (!u?.alive) return null;
  const cls = classOf(v, u);
  const hp = t('object.unit.hp', { hp: u.hp, max: maxHpOf(v, u) });
  return {
    title: unitName(u.id),
    text: cls ? `${t(`classes.${cls}`)} · ${hp}` : hp,
    x: u.x / SUBPX,
    y: u.y / SUBPX - UNIT_HEIGHT - above,
  };
}

/** Name, description and anchor of an object, or null once it has left the map. */
export function objectInfo(v: SimView, ref: ObjectRef): ObjectInfo | null {
  const r = v.rules;
  switch (ref.kind) {
    case 'grave': {
      const u = v.units.find((x) => x.id === ref.id);
      if (!u || u.alive) return null;
      const f = FACTIONS[u.team];
      // Its own epitaph, the same each time one looks: chosen by its id, not at random.
      const n = variantCount('epitaph');
      const epitaph = n > 0 ? t(`epitaph.${1 + (u.id % n)}`, { name: unitName(u.id) }) : '';
      return {
        title: unitName(u.id),
        text: t('object.grave.text', { epitaph, house: f ? t(f.nameKey) : '' }),
        x: u.x / SUBPX,
        y: u.y / SUBPX - GRAVE_HEIGHT,
      };
    }
    case 'structure': {
      const st = v.structures.find((c) => c.id === ref.id);
      if (!st || st.state === StructureState.Fallen) return null;
      const [x, y, w] = st.rect;
      return {
        title: t(`object.structure.${st.type}`),
        text: t('object.structure.text', {
          hp: st.hp,
          max: r.structures?.defs[st.type].hp ?? st.hp,
        }),
        x: x + w / 2,
        y,
      };
    }
    case 'barrel': {
      const b = v.barrels.find((x) => x.id === ref.id);
      if (!b) return null;
      return {
        title: t('object.barrel'),
        text: t('object.barrel.text', {
          damage: r.barrels?.damage ?? 0,
          radius: r.barrels?.radius ?? 0,
        }),
        x: b.x / SUBPX,
        y: b.y / SUBPX - BARREL_HEIGHT,
      };
    }
    case 'crate': {
      const c = v.crates.find((x) => x.id === ref.id);
      if (!c) return null;
      return {
        title: t('object.crate'),
        text: t(c.landed ? 'object.crate.text' : 'object.crate.falling', {
          balm: r.crates?.balmHp ?? 0,
        }),
        x: c.x / SUBPX,
        y: c.y / SUBPX - CRATE_HEIGHT - (c.landed ? 0 : 40),
      };
    }
    case 'pot': {
      const p = v.pots.find((x) => x.id === ref.id);
      if (!p) return null;
      const def = r.weapons.find((w) => w.id === p.weapon);
      return {
        title: t(`weapons.${p.weapon}`),
        text: t('object.pot.text', {
          turns: p.turns,
          damage: def?.damage ?? 0,
          radius: def?.explosionRadius ?? 0,
        }),
        x: p.x / SUBPX,
        y: p.y / SUBPX - 14,
      };
    }
    case 'kitchen': {
      const k = v.kitchen;
      if (!k) return null;
      const roundsLeft = Math.max(1, Math.ceil((k.expiresTurn - v.turn.number) / v.teams.length));
      return {
        title: t('object.kitchen'),
        text: t('object.kitchen.text', { heal: r.kitchen?.healHp ?? 0, rounds: roundsLeft }),
        x: k.x / SUBPX,
        y: k.y / SUBPX - KITCHEN_HEIGHT,
      };
    }
    case 'beast': {
      const b = v.beast;
      if (!b) return null;
      const hare = b.kind === BeastKind.Hare;
      return {
        title: t(hare ? 'object.hare' : 'object.snail'),
        text: t(hare ? 'object.hare.text' : 'object.snail.text', {
          step: hare ? (r.beasts?.hareStep ?? 0) : (r.beasts?.snailStep ?? 0),
        }),
        x: b.x / SUBPX,
        y: b.y / SUBPX - BEAST_HEIGHT - 20,
      };
    }
  }
}
