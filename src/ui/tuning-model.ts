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
  const ammo = field(`${p}.ammo`, 'tuning.ammo', 'units.ammo', 1, 1, -1, 99);
  if (w.dig) {
    return [
      ammo,
      field(`${p}.dig.ticks`, 'tuning.digTime', 'units.seconds', TPS, 0.5, 0.5, 15),
      field(`${p}.dig.speed`, 'tuning.digSpeed', 'units.pxPerTick', SUB, 0.05, 0.05, 5),
      field(`${p}.dig.radius`, 'tuning.digRadius', 'units.px', 1, 1, 15, 40),
    ];
  }
  if (w.wall) {
    return [
      ammo,
      field(`${p}.wall.short`, 'tuning.wallShort', 'units.px', 1, 4, 8, 400),
      field(`${p}.wall.medium`, 'tuning.wallMedium', 'units.px', 1, 4, 8, 400),
      field(`${p}.wall.long`, 'tuning.wallLong', 'units.px', 1, 4, 8, 400),
      field(`${p}.wall.thickness`, 'tuning.wallThickness', 'units.px', 1, 1, 4, 60),
      field(`${p}.wall.reach`, 'tuning.wallReach', 'units.px', 1, 10, 40, 2000),
    ];
  }
  if (w.mine) {
    return [
      ammo,
      field(`${p}.damage`, 'tuning.damage', 'units.hp', 1, 1, 0, 200),
      field(`${p}.explosionRadius`, 'tuning.explosionRadius', 'units.px', 1, 1, 1, 300),
      field(`${p}.mine.armTicks`, 'tuning.mineArm', 'units.seconds', TPS, 0.5, 0, 10),
    ];
  }
  if (w.strike) {
    return [
      ammo,
      field(`${p}.damage`, 'tuning.damage', 'units.hp', 1, 1, 0, 200),
      field(`${p}.explosionRadius`, 'tuning.explosionRadius', 'units.px', 1, 1, 1, 300),
      field(`${p}.strike.count`, 'tuning.strikeCount', 'units.stones', 1, 1, 1, 20),
      field(`${p}.windPct`, 'tuning.windPct', 'units.percent', 1, 5, 0, 300),
    ];
  }
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
  if (w.behavior === 'fusedBouncer' || w.behavior === 'cluster') {
    fields.push(
      field(`${p}.explosionRadius`, 'tuning.explosionRadius', 'units.px', 1, 1, 1, 300),
      field(`${p}.bouncePct`, 'tuning.bouncePct', 'units.percent', 1, 5, 0, 100),
      w.fuseTurns === undefined
        ? field(`${p}.defaultFuse`, 'tuning.defaultFuse', 'units.seconds', TPS, 1, 1, 5)
        : field(`${p}.defaultFuse`, 'tuning.defaultFuse', 'units.turns', TPS, 1, 1, 3),
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
        field('turn.retreatMaxTicks', 'tuning.retreatMax', 'units.seconds', TPS, 0.5, 0, 60),
        field('turn.settleTicks', 'tuning.settleTime', 'units.seconds', TPS, 0.5, 0, 10),
        field('startHp', 'tuning.startHp', 'units.hp', 1, 10, 10, 500),
      ],
    },
    {
      titleKey: 'tuning.group.unit',
      fields: [
        field('unit.walkSpeed', 'tuning.walkSpeed', 'units.pxPerTick', SUB, 0.1, 0.2, 6),
        field('unit.maxStep', 'tuning.maxStep', 'units.px', 1, 1, 0, 40),
        field('unit.turnTicks', 'tuning.turnTime', 'units.seconds', TPS, 0.05, 0, 1),
        field('unit.moveBudget', 'tuning.moveBudget', 'units.px', 1, 50, 0, 5000),
        field('unit.ladderReach', 'tuning.ladderReach', 'units.px', 1, 2, 0, 100),
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
    ...(rules.burn
      ? [
          {
            titleKey: 'tuning.group.burn',
            fields: [
              field('burn.startRound', 'tuning.burnStart', 'units.rounds', 1, 1, 0, 50),
              field('burn.advancePx', 'tuning.burnAdvance', 'units.px', 1, 10, 0, 1000),
              field('burn.damage', 'tuning.burnDamage', 'units.hp', 1, 5, 0, 200),
            ],
          },
        ]
      : []),
    ...(rules.barrels
      ? [
          {
            titleKey: 'tuning.group.barrels',
            fields: [
              field('barrels.count', 'tuning.barrelCount', 'units.barrels', 1, 1, 0, 20),
              field('barrels.damage', 'tuning.damage', 'units.hp', 1, 5, 0, 200),
              field('barrels.radius', 'tuning.explosionRadius', 'units.px', 1, 5, 10, 300),
            ],
          },
        ]
      : []),
    ...(rules.beasts
      ? [
          {
            titleKey: 'tuning.group.beasts',
            fields: [
              field('beasts.spawnPermille', 'tuning.beastChance', 'units.percent', 10, 1, 0, 100),
              field('beasts.hareStep', 'tuning.hareStep', 'units.px', 1, 10, 0, 2000),
              field('beasts.snailStep', 'tuning.snailStep', 'units.px', 1, 10, 0, 1000),
              field('beasts.kickDamage', 'tuning.kickDamage', 'units.hp', 1, 1, 0, 100),
              field('beasts.biteDamage', 'tuning.biteDamage', 'units.hp', 1, 1, 0, 50),
            ],
          },
        ]
      : []),
    ...(rules.structures
      ? [
          {
            titleKey: 'tuning.group.structures',
            fields: [
              field('structures.towerHeight', 'tuning.towerHeight', 'units.px', 1, 10, 60, 900),
              field(
                'structures.woodTowerHeight',
                'tuning.woodTowerHeight',
                'units.px',
                1,
                10,
                60,
                900,
              ),
              field('structures.defs.tower.hp', 'tuning.towerHp', 'units.hp', 1, 10, 1, 2000),
              field(
                'structures.defs.woodTower.hp',
                'tuning.woodTowerHp',
                'units.hp',
                1,
                10,
                1,
                2000,
              ),
              field('structures.defs.wall.hp', 'tuning.wallHp', 'units.hp', 1, 10, 1, 2000),
              field('structures.defs.bridge.hp', 'tuning.bridgeHp', 'units.hp', 1, 10, 1, 2000),
              field('structures.crushMax', 'tuning.crushMax', 'units.hp', 1, 5, 0, 200),
            ],
          },
        ]
      : []),
    ...(rules.flames
      ? [
          {
            titleKey: 'tuning.group.flames',
            fields: [
              field('flames.count', 'tuning.flameCount', 'units.flames', 1, 1, 0, 20),
              field('flames.turns', 'tuning.flameTurns', 'units.turns', 1, 1, 1, 10),
              field('flames.damagePerTick', 'tuning.flameDamage', 'units.hp', 1, 1, 0, 20),
              field('flames.maxPerTurn', 'tuning.flameMax', 'units.hp', 1, 1, 0, 100),
            ],
          },
        ]
      : []),
    ...(rules.weather
      ? [
          {
            titleKey: 'tuning.group.weather',
            fields: [
              field('weather.rainPermille', 'tuning.rainChance', 'units.percent', 10, 1, 0, 100),
              field('weather.rainTurnsMin', 'tuning.rainMin', 'units.turns', 1, 1, 1, 20),
              field('weather.rainTurnsMax', 'tuning.rainMax', 'units.turns', 1, 1, 1, 20),
              field(
                'weather.lightningPermille',
                'tuning.lightningChance',
                'units.percent',
                10,
                1,
                0,
                100,
              ),
              field('weather.damage', 'tuning.damage', 'units.hp', 1, 1, 0, 200),
              field('weather.radius', 'tuning.explosionRadius', 'units.px', 1, 1, 0, 200),
            ],
          },
        ]
      : []),
    ...(rules.deluge
      ? [
          {
            titleKey: 'tuning.group.deluge',
            fields: [
              field('deluge.startTurn', 'tuning.delugeTurn', 'units.turns', 1, 1, 1, 200),
              field('deluge.startTicks', 'tuning.delugeTime', 'units.minutes', 3600, 1, 1, 120),
              field('deluge.risePx', 'tuning.delugeRise', 'units.px', 1, 4, 0, 400),
              field('deluge.damage', 'tuning.delugeDamage', 'units.hp', 1, 1, 0, 100),
            ],
          },
        ]
      : []),
    ...(rules.classes
      ? [
          {
            titleKey: 'tuning.group.classes',
            fields: [
              field(
                'classes.knight.blastTakenPct',
                'tuning.knightBlast',
                'units.percent',
                1,
                5,
                0,
                100,
              ),
              field('classes.knight.jumpPct', 'tuning.knightJump', 'units.percent', 1, 1, 30, 150),
              field(
                'classes.archer.previewPct',
                'tuning.archerPreview',
                'units.percent',
                1,
                10,
                100,
                500,
              ),
              field(
                'classes.slinger.throwPct',
                'tuning.slingerThrow',
                'units.percent',
                1,
                1,
                100,
                200,
              ),
              field('classes.slinger.hpDelta', 'tuning.slingerHp', 'units.hp', 1, 5, -90, 100),
              field('classes.cleric.blessHp', 'tuning.clericHeal', 'units.hp', 1, 1, 0, 100),
              field(
                'classes.cleric.blessRadius',
                'tuning.clericRadius',
                'units.px',
                1,
                10,
                0,
                1000,
              ),
              field('classes.king.auraPct', 'tuning.kingAura', 'units.percent', 1, 1, 100, 200),
              field('classes.king.auraRadius', 'tuning.kingRadius', 'units.px', 1, 10, 0, 1000),
              field('classes.king.hpDelta', 'tuning.kingHp', 'units.hp', 1, 5, -90, 100),
            ],
          },
        ]
      : []),
    ...(rules.kitchen
      ? [
          {
            titleKey: 'tuning.group.kitchen',
            fields: [
              field('kitchen.healHp', 'tuning.kitchenHeal', 'units.hp', 1, 5, 0, 200),
              // Stored per mille, shown in percent.
              field(
                'kitchen.chanceStartPermille',
                'tuning.kitchenChance',
                'units.percent',
                10,
                1,
                0,
                100,
              ),
              field('kitchen.chanceDecayPct', 'tuning.kitchenDecay', 'units.percent', 1, 5, 0, 100),
              field(
                'kitchen.chanceFloorPermille',
                'tuning.kitchenFloor',
                'units.percent',
                10,
                0.5,
                0,
                100,
              ),
              field('kitchen.lifeRounds', 'tuning.kitchenLife', 'units.rounds', 1, 1, 1, 10),
            ],
          },
        ]
      : []),
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
