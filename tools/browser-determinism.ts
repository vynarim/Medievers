// Cross-browser determinism (BACKLOG 1.10): runs tests/browser/checks.ts in Node, Chromium (V8),
// Firefox (SpiderMonkey) and WebKit (JavaScriptCore, as on iPad); fails unless all results match.
// Usage: pnpm run test:browser
import { readFileSync, readdirSync } from 'node:fs';
import { chromium, firefox, webkit, type BrowserType } from 'playwright';
import { createServer } from 'vite';
import type { ReplayFile } from '../src/sim/index.ts';
import { runChecks, type CheckResults } from '../tests/browser/checks.ts';
import { maskPathFor } from './lib/maps-node.ts';

const root = new URL('..', import.meta.url);
const maskPng = new Uint8Array(readFileSync(new URL('tests/fixtures/maps/test-mask.png', root)));
const engines: Record<string, BrowserType> = { chromium, firefox, webkit };

const replayDir = new URL('tests/replays/', root);
const replays = readdirSync(replayDir)
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((name) => {
    const file = JSON.parse(readFileSync(new URL(name, replayDir), 'utf8')) as ReplayFile;
    return { name, file, mapPng: new Uint8Array(readFileSync(maskPathFor(file.mapId))) };
  });

const server = await createServer({
  root: new URL('tests/browser/', root).pathname.replace(/^\/([A-Za-z]:)/, '$1'),
  server: { port: 0, fs: { allow: [new URL('.', root).pathname.replace(/^\/([A-Za-z]:)/, '$1')] } },
  logLevel: 'error',
});

let failed = false;
try {
  await server.listen();
  const url = server.resolvedUrls?.local[0];
  if (!url) throw new Error('vite did not report a local URL');

  const results: Record<string, CheckResults> = { node: runChecks({ maskPng, replays }) };
  for (const [name, engine] of Object.entries(engines)) {
    const browser = await engine.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(url);
      await page.waitForFunction(() => typeof window.medieverseChecks === 'function');
      results[`${name} ${browser.version()}`] = await page.evaluate(() =>
        window.medieverseChecks(),
      );
    } finally {
      await browser.close();
    }
  }

  const reference = JSON.stringify(results.node);
  for (const [env, r] of Object.entries(results)) {
    const same = JSON.stringify(r) === reference;
    if (!same) failed = true;
    const hashes = Object.entries(r)
      .map(([k, v]) => `${k}=${v.toString(16).padStart(8, '0')}`)
      .join(' ');
    console.log(`${same ? 'OK  ' : 'DIFF'} ${env.padEnd(22)} ${hashes}`);
  }
} finally {
  await server.close();
}

if (failed) {
  console.error('cross-browser determinism FAILED');
  process.exit(1);
}
console.log('cross-browser determinism OK');
