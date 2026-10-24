// Readable weapon statistics, shared by the arsenal and the character card.
import type { WeaponDef } from '../content/weapons.ts';
import { t } from './i18n.ts';

export function weaponLines(w: WeaponDef): string[] {
  const wind =
    w.windPct === 0
      ? t('weapon.wind.none')
      : w.windPct < 100
        ? t('weapon.wind.weak')
        : t('weapon.wind.full');
  const lines = [
    `${t('weapon.damage')} : ${w.damage}`,
    `${t('weapon.radius')} : ${w.explosionRadius > 0 ? `${w.explosionRadius} px` : '—'}`,
    `${t('weapon.wind')} : ${wind}`,
    `${t('weapon.ammo')} : ${w.ammo < 0 ? t('weapon.unlimited') : w.ammo}`,
  ];
  if (w.fixedPower) lines.push(t('weapon.fixedPower'));
  if (w.fragments) {
    lines.push(t('weapon.fragments', { n: w.fragments.count, damage: w.fragments.damage }));
  }
  if (w.reach) lines.push(t('weapon.reach', { px: w.reach }));
  return lines;
}
