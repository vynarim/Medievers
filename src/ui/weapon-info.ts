// Readable weapon statistics, shared by the arsenal and the character card.
import type { WeaponDef } from '../content/weapons.ts';
import { t } from './i18n.ts';

export function weaponLines(w: WeaponDef): string[] {
  const ammo = `${t('weapon.ammo')} : ${w.ammo < 0 ? t('weapon.unlimited') : w.ammo}`;
  // Tools: what they do, then their own figures.
  if (w.dig) {
    const px = Math.round((w.dig.speed * w.dig.ticks) / 256);
    return [
      t(`weapons.${w.id}.desc`),
      t('weapon.dig', { s: w.dig.ticks / 60, px }),
      t('weapon.digSapper'),
      ammo,
    ];
  }
  if (w.wall) {
    return [
      t(`weapons.${w.id}.desc`),
      t('weapon.wall', { a: w.wall.short, b: w.wall.medium, c: w.wall.long }),
      t('weapon.wallReach', { px: w.wall.reach }),
      ammo,
    ];
  }
  if (w.mine) {
    return [
      t(`weapons.${w.id}.desc`),
      `${t('weapon.damage')} : ${w.damage}`,
      `${t('weapon.radius')} : ${w.explosionRadius} px`,
      t('weapon.mineArm', { s: w.mine.armTicks / 60 }),
      ammo,
    ];
  }
  const wind =
    w.windPct === 0
      ? t('weapon.wind.none')
      : w.windPct < 100
        ? t('weapon.wind.weak')
        : t('weapon.wind.full');
  const lines = [
    t(`weapons.${w.id}.desc`),
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
  if (w.charge) lines.push(t('weapon.charge', { px: w.charge.distance }));
  if (w.strike) {
    lines.push(
      t(w.explosionRadius > 0 ? 'weapon.strike' : 'weapon.strikeArrows', { n: w.strike.count }),
    );
  }
  return lines;
}
