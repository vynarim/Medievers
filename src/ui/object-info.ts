// What a click on a map object shows in its bubble (barrel, reliquary, field kitchen, beast,
// resting pot): which object is under a point, and its name and description, with the values of
// the match rules. Pure: reads the sim view only.
import { BARREL_HEIGHT, BARREL_WIDTH } from '../content/barrels.ts';
import { BEAST_HEIGHT, BEAST_WIDTH, BeastKind } from '../content/beasts.ts';
import { CRATE_HEIGHT, CRATE_WIDTH } from '../content/crates.ts';
import { KITCHEN_HEIGHT, KITCHEN_WIDTH } from '../content/kitchen.ts';
import { SUBPX } from '../sim/math/fixed.ts';
import type { SimView } from '../sim/sim.ts';
import { t } from './i18n.ts';

export type ObjectRef =
  | { readonly kind: 'barrel'; readonly id: number }
  | { readonly kind: 'crate'; readonly id: number }
  | { readonly kind: 'pot'; readonly id: number }
  | { readonly kind: 'kitchen' }
  | { readonly kind: 'beast' };

export interface ObjectInfo {
  readonly title: string;
  readonly text: string;
  /** world px: top centre of the object, where the bubble points */
  readonly x: number;
  readonly y: number;
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
  return null;
}

/** Name, description and anchor of an object, or null once it has left the map. */
export function objectInfo(v: SimView, ref: ObjectRef): ObjectInfo | null {
  const r = v.rules;
  switch (ref.kind) {
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
