// Class passives (GDD §3.2). Only active when the match rules have `classes` (absent from older
// logs); a unit's class comes from its house's line-up.
import { AIM_PREVIEW_TICKS, type ClassId } from '../content/classes.ts';
import type { MatchRules } from '../content/rules.ts';
import type { UnitRules } from '../content/units.ts';
import type { WeaponDef } from '../content/weapons.ts';
import type { SimEvent } from './events.ts';
import { idiv, subToPx } from './math/fixed.ts';
import { isqrt } from './math/isqrt.ts';
import type { SimState } from './state.ts';
import type { Unit } from './units/unit.ts';

/** What the class helpers read: the rules and the houses' line-ups (a SimView fits). */
export interface ClassView {
  readonly rules: MatchRules;
  readonly teams: readonly {
    readonly unitIds: readonly number[];
    readonly classes?: readonly ClassId[];
  }[];
}

/** Class of a unit, or null without classes. */
export function classOf(s: ClassView, u: Pick<Unit, 'id' | 'team'>): ClassId | null {
  if (!s.rules.classes) return null;
  const team = s.teams[u.team];
  const i = team?.unitIds.indexOf(u.id) ?? -1;
  return team?.classes?.[i] ?? null;
}

/** What visibleMines reads: a SimView fits. */
export interface MineView extends ClassView {
  readonly units: readonly Pick<Unit, 'id' | 'team'>[];
  readonly turn: { readonly activeUnitId: number; readonly activeTeam: number };
  readonly mines: readonly { readonly team: number }[];
}

/**
 * The caltrops house `team` sees (GDD §3.2, §4.6): its own, and every one while a sapper of
 * that house plays (Maître d'œuvre). The render and the AI both ask here.
 */
export function visibleMines<V extends MineView>(s: V, team: number): V['mines'][number][] {
  const active = s.units.find((u) => u.id === s.turn.activeUnitId);
  const sapper =
    active !== undefined &&
    active.team === team &&
    s.turn.activeTeam === team &&
    classOf(s, active) === 'sapper';
  return s.mines.filter((m) => sapper || m.team === team);
}

/** Starting HP of a unit of class cls (GDD §3.2: slinger −10, king −20). */
export function hpForClass(rules: MatchRules, cls: ClassId | null): number {
  const c = rules.classes;
  const delta =
    cls === 'slinger' ? (c?.slinger.hpDelta ?? 0) : cls === 'king' ? (c?.king.hpDelta ?? 0) : 0;
  return Math.max(1, rules.startHp + delta);
}

/** HP a unit starts with, and that heals cannot exceed. */
export function maxHpOf(s: ClassView, u: Pick<Unit, 'id' | 'team'>): number {
  return hpForClass(s.rules, classOf(s, u));
}

/** Haubert: percent of explosion damage the unit takes. */
export function blastTakenPct(s: ClassView, u: Unit): number {
  return classOf(s, u) === 'knight' ? (s.rules.classes?.knight.blastTakenPct ?? 100) : 100;
}

/** The unit's movement rules: a knight jumps shorter. */
export function unitRulesOf(s: ClassView, u: Unit): UnitRules {
  const r = s.rules.unit;
  if (classOf(s, u) !== 'knight') return r;
  const pct = s.rules.classes?.knight.jumpPct ?? 100;
  const scale = (v: { vx: number; vy: number }) => ({
    vx: idiv(v.vx * pct, 100),
    vy: idiv(v.vy * pct, 100),
  });
  return { ...r, jumpForward: scale(r.jumpForward), jumpBack: scale(r.jumpBack) };
}

/** Bras souple: percent of a weapon's top speed when this unit throws it. */
export function throwPct(s: ClassView, u: Unit, def: WeaponDef): number {
  if (!def.thrown || classOf(s, u) !== 'slinger') return 100;
  return s.rules.classes?.slinger.throwPct ?? 100;
}

/** ticks of flight the aim preview shows for this unit and weapon (archer: longer, GDD §3.2) */
export function aimPreviewTicks(s: ClassView, u: Unit, def: WeaponDef): number {
  const archer =
    classOf(s, u) === 'archer' &&
    (def.id === 'bow' || def.id === 'crossbow' || def.id === 'fireArrow');
  return archer
    ? idiv(AIM_PREVIEW_TICKS * (s.rules.classes?.archer.previewPct ?? 100), 100)
    : AIM_PREVIEW_TICKS;
}

/** Maître d'œuvre: percent of the digging speed (used by the pick and the sap, BACKLOG M4). */
export function digPctOf(s: ClassView, u: Unit): number {
  return classOf(s, u) === 'sapper' ? (s.rules.classes?.sapper.digPct ?? 100) : 100;
}

/** A cleric may not use melee weapons, the shield charge among them (GDD §3.2). */
export function mayUse(s: ClassView, u: Unit, def: WeaponDef): boolean {
  const melee = def.behavior === 'melee' || def.behavior === 'charge';
  return !(melee && classOf(s, u) === 'cleric');
}

const distPx = (a: Unit, b: Unit): number => {
  const dx = subToPx(a.x) - subToPx(b.x);
  const dy = subToPx(a.y) - subToPx(b.y);
  return isqrt(dx * dx + dy * dy);
};

/** Majesté: percent of damage the unit deals, with its living king close by (not the king). */
export function damageDealtPct(s: SimState, u: Unit): number {
  const k = s.rules.classes?.king;
  if (!k || classOf(s, u) === 'king') return 100;
  const near = s.units.some(
    (o) =>
      o.alive &&
      o.team === u.team &&
      o.id !== u.id &&
      classOf(s, o) === 'king' &&
      distPx(o, u) <= k.auraRadius,
  );
  return near ? k.auraPct : 100;
}

/** End of a cleric's own turn: the allies in reach (not the cleric) are healed. */
export function blessAtTurnEnd(s: SimState, events: SimEvent[]): void {
  const c = s.rules.classes?.cleric;
  const cleric = s.units.find((x) => x.id === s.turn.activeUnitId);
  if (!c || !cleric?.alive || classOf(s, cleric) !== 'cleric') return;
  for (const u of s.units) {
    if (!u.alive || u.hp <= 0 || u.team !== cleric.team || u.id === cleric.id) continue;
    if (distPx(u, cleric) > c.blessRadius) continue;
    const heal = Math.max(0, Math.min(c.blessHp, maxHpOf(s, u) - u.hp));
    if (heal === 0) continue;
    u.hp += heal;
    events.push({ e: 'unitHealed', unitId: u.id, heal });
  }
}

/** Régicide: the house's king, or null when the rule is off or the house has none. */
export function kingOf(s: ClassView & Pick<SimState, 'units'>, team: number): Unit | null {
  if (!s.rules.regicide) return null;
  return s.units.find((u) => u.team === team && classOf(s, u) === 'king') ?? null;
}
