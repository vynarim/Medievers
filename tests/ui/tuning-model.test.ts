import { describe, expect, it } from 'vitest';
import { CLASSIC_RULES } from '../rules-fixture.ts';
import {
  applyOverrides,
  readValue,
  toDisplay,
  toStored,
  tuningGroups,
} from '../../src/ui/tuning-model.ts';

describe('tuning model', () => {
  it('reads every field of every group from the rules', () => {
    for (const g of tuningGroups(CLASSIC_RULES)) {
      for (const f of g.fields)
        expect(readValue(CLASSIC_RULES, f.path), f.path).toBeTypeOf('number');
    }
  });

  it('covers the values left to tune in playtest', () => {
    const paths = tuningGroups(CLASSIC_RULES).flatMap((g) => g.fields.map((f) => f.path));
    for (const p of [
      'unit.jumpForward.vy',
      'unit.jumpBack.vx',
      'explosion.knockbackPerHp',
      'wind.accelPerUnit',
      'weapons.bow.maxSpeed',
      'weapons.greekFire.defaultFuse',
    ]) {
      expect(paths).toContain(p);
    }
  });

  it('applies overrides to a copy, leaving the scheme untouched', () => {
    const rules = applyOverrides(CLASSIC_RULES, {
      'unit.walkSpeed': 512,
      'weapons.bow.damage': 50,
      'turn.actionTicks': 1800,
    });
    expect(rules.unit.walkSpeed).toBe(512);
    expect(rules.weapons.find((w) => w.id === 'bow')?.damage).toBe(50);
    expect(rules.turn.actionTicks).toBe(1800);
    expect(CLASSIC_RULES.unit.walkSpeed).toBe(384);
    expect(CLASSIC_RULES.weapons.find((w) => w.id === 'bow')?.damage).toBe(30);
  });

  it('ignores unknown paths and non-integer values', () => {
    const rules = applyOverrides(CLASSIC_RULES, { 'unit.nope': 3, 'unit.maxStep': 2.5 });
    expect(rules).toEqual(CLASSIC_RULES);
  });

  it('converts between readable and stored units', () => {
    const speed = tuningGroups(CLASSIC_RULES)
      .flatMap((g) => g.fields)
      .find((f) => f.path === 'unit.walkSpeed');
    if (!speed) throw new Error('missing field');
    expect(toDisplay(speed, 384)).toBe(1.5);
    expect(toStored(speed, 2)).toBe(512);
    expect(toStored(speed, 99)).toBe(6 * 256);
  });
});
