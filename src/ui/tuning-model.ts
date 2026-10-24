// Playtest tuning: which match rules can be edited in game, in readable units, and how
// overrides apply to a rules scheme. Pure, so it is tested in Node.
import type { MatchRules } from '../content/rules.ts';
import type { WeaponDef } from '../content/weapons.ts';

export interface TuningField {
  /** dotted path in MatchRules; weapons are addressed as weapons.<id>.<field> */
  readonly path: string;
  /** i18n key of the label */
  readonly labelKey: string;
  /** i18n key of the displayed unit */
  readonly unitKey: string;
  /** stored value = round(displayed value × scale) */
  readonly scale: number;
  /** displayed step */
  readonly step: number;
  readonly min: number;
  readonly max: number;
}

export interface TuningGroup {
  /** i18n key of the group title */
  readonly titleKey: string;
  readonly fields: readonly TuningField[];
}

const SUB = 256;
const TPS = 60;

const field = (
  path: string,
  labelKey: string,
  unitKey: string,
  scale: number,
  step: number,
  min: number,
  max: number,
): TuningField => ({ path, labelKey, unitKey, scale, step, min, max });

function weaponFields(w: WeaponDef): TuningField[] {
  const p = `weapons.${w.id}`;
  const fields = [
    field(`${p}.damage`, 'tuning.damage', 'units.hp', 1, 1, 0, 200),
    field(`${p}.maxSpeed`, 'tuning.maxSpeed', 'units.pxPerTick', SUB, 0.5, 1, 60),
    field(`${p}.windPct`, 'tuning.windPct', 'units.percent', 1, 5, 0, 300),
    field(`${p}.knockbackPct`, 'tuning.knockbackPct', 'units.percent', 1, 10, 0, 1000),
    field(`${p}.ammo`, 'tuning.ammo', 'units.ammo', 1, 1, -1, 99),
  ];
  if (w.chipRadius !== undefined) {
    fields.push(field(`${p}.chipRadius`, 'tuning.chipRadius', 'units.px', 1, 1, 0, 30));
  }
  if (w.behavior === 'fusedBouncer') {
    fields.push(
      field(`${p}.explosionRadius`, 'tuning.explosionRadius', 'units.px', 1, 1, 1, 300),
      field(`${p}.bouncePct`, 'tuning.bouncePct', 'units.percent', 1, 5, 0, 100),
      field(`${p}.defaultFuse`, 'tuning.defaultFuse', 'units.seconds', TPS, 1, 1, 5),
    );
  }
  return fields;
}

/** Every editable value, grouped as shown in the panel. */
export function tuningGroups(rules: MatchRules): TuningGroup[] {
  return [
    {
      titleKey: 'tuning.group.turn',
      fields: [
        field('turn.actionTicks', 'tuning.actionTime', 'units.seconds', TPS, 1, 5, 180),
        field('turn.retreatTicks', 'tuning.retreatTime', 'units.seconds', TPS, 0.5, 0, 15),
        field('turn.settleTicks', 'tuning.settleTime', 'units.seconds', TPS, 0.5, 0, 10),
        field('startHp', 'tuning.startHp', 'units.hp', 1, 10, 10, 500),
      ],
    },
    {
      titleKey: 'tuning.group.unit',
      fields: [
        field('unit.walkSpeed', 'tuning.walkSpeed', 'units.pxPerTick', SUB, 0.1, 0.2, 6),
        field('unit.maxStep', 'tuning.maxStep', 'units.px', 1, 1, 0, 40),
        field('unit.moveBudget', 'tuning.moveBudget', 'units.px', 1, 50, 0, 5000),
        field('unit.jumpForward.vx', 'tuning.jumpForwardX', 'units.pxPerTick', SUB, 0.25, 0, 15),
        field('unit.jumpForward.vy', 'tuning.jumpForwardY', 'units.pxPerTick', SUB, 0.25, -20, 0),
        field('unit.jumpBack.vx', 'tuning.jumpBackX', 'units.pxPerTick', SUB, 0.25, 0, 15),
        field('unit.jumpBack.vy', 'tuning.jumpBackY', 'units.pxPerTick', SUB, 0.25, -20, 0),
        field('unit.fallSafeHeight', 'tuning.fallSafeHeight', 'units.px', 1, 10, 0, 1000),
        field('unit.fallPxPerHp', 'tuning.fallPxPerHp', 'units.px', 1, 1, 1, 100),
        field('unit.fallMaxDamage', 'tuning.fallMaxDamage', 'units.hp', 1, 1, 0, 200),
      ],
    },
    {
      titleKey: 'tuning.group.world',
      fields: [
        field('wind.max', 'tuning.windMax', 'units.windPoints', 1, 1, 0, 30),
        field('wind.accelPerUnit', 'tuning.windAccel', 'units.subPxPerTick2', 1, 1, 0, 20),
        field(
          'explosion.knockbackPerHp',
          'tuning.knockbackPerHp',
          'units.subPxPerTickPerHp',
          1,
          1,
          0,
          200,
        ),
        field('explosion.liftPct', 'tuning.liftPct', 'units.percent', 1, 5, 0, 200),
      ],
    },
    ...rules.weapons.map((w) => ({ titleKey: `weapons.${w.id}`, fields: weaponFields(w) })),
  ];
}

/** Stored (integer) value at a path, or undefined if the path does not exist. */
export function readValue(rules: MatchRules, path: string): number | undefined {
  let node: unknown = rules;
  for (const part of path.split('.')) {
    if (Array.isArray(node)) node = (node as WeaponDef[]).find((w) => w.id === part);
    else if (node && typeof node === 'object') node = (node as Record<string, unknown>)[part];
    else return undefined;
  }
  return typeof node === 'number' ? node : undefined;
}

/** Overrides: stored integer values by path. */
export type TuningOverrides = Readonly<Record<string, number>>;

/** A copy of `base` with the overrides applied; unknown paths and non-integers are ignored. */
export function applyOverrides(base: MatchRules, overrides: TuningOverrides): MatchRules {
  const rules = structuredClone(base) as MatchRules;
  for (const [path, value] of Object.entries(overrides)) {
    if (!Number.isInteger(value) || readValue(rules, path) === undefined) continue;
    const parts = path.split('.');
    const last = parts.pop();
    let node: unknown = rules;
    for (const part of parts) {
      node = Array.isArray(node)
        ? (node as WeaponDef[]).find((w) => w.id === part)
        : (node as Record<string, unknown>)[part];
    }
    if (last && node && typeof node === 'object') (node as Record<string, number>)[last] = value;
  }
  return rules;
}

export const toDisplay = (f: TuningField, stored: number): number =>
  Math.round((stored / f.scale) * 1000) / 1000;

export const toStored = (f: TuningField, displayed: number): number => {
  const clamped = Math.min(f.max, Math.max(f.min, displayed));
  return Math.round(clamped * f.scale);
};
