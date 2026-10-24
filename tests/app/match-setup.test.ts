import { describe, expect, it } from 'vitest';
import { defaultSetup, fixLineup, fixSetup, rulesFor } from '../../src/app/match-setup.ts';
import { CLASSIC_RULES, weaponDefIn } from '../../src/content/rules.ts';

describe('match setup (BACKLOG 3.6)', () => {
  it('keeps one king at most, and always one in Régicide', () => {
    expect(fixLineup(['king', 'archer', 'king'], false)).toEqual(['king', 'archer', 'knight']);
    expect(fixLineup(['archer', 'cleric'], true)).toEqual(['king', 'cleric']);
    expect(fixLineup([], false)).toEqual(['knight']);
    expect(fixLineup(Array(9).fill('archer'), false)).toHaveLength(6);
  });

  it('keeps 2 to 4 houses', () => {
    const one = fixSetup({
      map: 'valley',
      scheme: 'classic',
      regicide: false,
      fog: true,
      lineups: [['knight']],
    });
    expect(one.lineups).toHaveLength(2);
    const five = fixSetup({ ...one, lineups: Array(5).fill(['knight']) });
    expect(five.lineups).toHaveLength(4);
  });

  it('keeps a known map, the valley otherwise (an old saved setup has none)', () => {
    const old = { scheme: 'classic', regicide: false, lineups: [['knight'], ['knight']] };
    expect(fixSetup(old as never).map).toBe('valley');
    expect(fixSetup({ ...defaultSetup(false), map: 'holyLand' }).map).toBe('holyLand');
  });

  it('keeps the caltrop fog on unless turned off (an old saved setup has no option)', () => {
    const old = { scheme: 'classic', regicide: false, lineups: [['knight'], ['knight']] };
    expect(fixSetup(old as never).fog).toBe(true);
    expect(fixSetup({ ...defaultSetup(false), fog: false }).fog).toBe(false);
  });

  it('gives each scheme its rules (GDD §6)', () => {
    const setup = defaultSetup(false);
    expect(rulesFor(setup, { startHp: 50 }).startHp).toBe(CLASSIC_RULES.startHp);
    expect(rulesFor({ ...setup, scheme: 'custom' }, { startHp: 50 }).startHp).toBe(50);
    const fortune = rulesFor({ ...setup, scheme: 'fortune' }, {});
    expect(weaponDefIn(fortune, 'greekFire').ammo).toBe(0);
    expect(weaponDefIn(fortune, 'bow').ammo).toBe(-1);
    const siege = rulesFor({ ...setup, scheme: 'siege' }, {});
    expect(siege.structures?.towerHeight).toBeGreaterThan(
      CLASSIC_RULES.structures?.towerHeight ?? 0,
    );
    expect(rulesFor({ ...setup, regicide: true }, {}).regicide).toBe(true);
  });
});
