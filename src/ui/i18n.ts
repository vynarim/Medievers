// Visible texts are i18n keys (TECH_SPEC §11). French only for now.
import fr from '../content/i18n/fr.json';

const STRINGS: Record<string, string> = fr;

/** Translates a key, replacing {name} placeholders. Unknown keys show as [key]. */
export function t(key: string, params: Record<string, string | number> = {}): string {
  const s = STRINGS[key];
  if (s === undefined) return `[${key}]`;
  return s.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? `{${k}}`));
}
