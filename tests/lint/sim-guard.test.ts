import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../..', import.meta.url));
const fixture = (name: string): string =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

async function lintAs(code: string, filePath: string): Promise<ESLint.LintResult> {
  const eslint = new ESLint({ cwd: root });
  const [result] = await eslint.lintText(code, { filePath });
  if (!result) throw new Error('ESLint returned no result');
  return result;
}

describe('src/sim ESLint guard', () => {
  it('rejects every forbidden API in src/sim', async () => {
    const result = await lintAs(fixture('sim-violations.ts.txt'), 'src/sim/__probe__.ts');
    const hits = result.messages.map((m) => `${m.line}:${m.ruleId ?? 'fatal'}`);

    expect(result.errorCount).toBeGreaterThan(0);
    expect(hits).toEqual(
      expect.arrayContaining([
        '2:no-restricted-imports',
        '3:no-restricted-imports',
        '5:no-restricted-properties',
        '6:no-restricted-properties',
        '7:no-restricted-properties',
        '8:no-restricted-syntax',
        '9:no-restricted-syntax',
        '10:no-restricted-globals',
        '11:no-restricted-globals',
        '12:no-restricted-globals',
        '13:no-restricted-globals',
      ]),
    );
  });

  it('names Math.random explicitly', async () => {
    const result = await lintAs('export const r = Math.random();\n', 'src/sim/math/prng.ts');
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]?.message).toContain("'Math.random' is restricted");
  });

  it('accepts integer-only code in src/sim', async () => {
    const result = await lintAs(fixture('sim-clean.ts.txt'), 'src/sim/__probe__.ts');
    expect(result.messages).toEqual([]);
  });

  it('does not apply outside src/sim', async () => {
    const result = await lintAs('export const r = Math.random();\n', 'src/render/vfx.ts');
    expect(result.messages).toEqual([]);
  });
});
