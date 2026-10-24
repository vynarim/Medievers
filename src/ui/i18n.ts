// Visible texts are i18n keys (TECH_SPEC §11). French only for now.
import fr from '../content/i18n/fr.json';

const STRINGS: Record<string, string> = fr;

/** Translates a key, replacing {name} placeholders. Unknown keys show as [key]. */
export function t(key: string, params: Record<string, string | number> = {}): string {
  const s = STRINGS[key];
  if (s === undefined) return `[${key}]`;
  return s.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? `{${k}}`));
}

/** Number of variants `prefix.1`, `prefix.2`… defined for a key prefix. */
export function variantCount(prefix: string): number {
  let n = 0;
  while (STRINGS[`${prefix}.${n + 1}`] !== undefined) n++;
  return n;
}

/** One variant of `prefix.N`, drawn at random (cosmetic only, never from the sim PRNG). */
export function pick(prefix: string, params: Record<string, string | number> = {}): string {
  const n = variantCount(prefix);
  return n === 0 ? `[${prefix}]` : t(`${prefix}.${1 + Math.floor(Math.random() * n)}`, params);
}
