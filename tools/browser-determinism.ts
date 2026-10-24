// Cross-browser determinism (BACKLOG 1.10): runs tests/browser/checks.ts in Node, Chromium and
// Firefox and fails unless every result is identical. Usage: pnpm run test:browser
import { readFileSync } from 'node:fs';
import { chromium, firefox, type BrowserType } from 'playwright';
import { createServer } from 'vite';
import { runChecks, type CheckResults } from '../tests/browser/checks.ts';

const root = new URL('..', import.meta.url);
const maskPng = new Uint8Array(readFileSync(new URL('tests/fixtures/maps/test-mask.png', root)));
const engines: Record<string, BrowserType> = { chromium, firefox };

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

  const results: Record<string, CheckResults> = { node: runChecks(maskPng) };
  for (const [name, engine] of Object.entries(engines)) {
    const browser = await engine.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(url);
      await page.waitForFunction(() => typeof window.medieversChecks === 'function');
      results[`${name} ${browser.version()}`] = await page.evaluate(() => window.medieversChecks());
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
    console.log(`${same ? 'OK  ' : 'DIFF'} ${env.padEnd(20)} ${hashes}`);
  }
} finally {
  await server.close();
}

if (failed) {
  console.error('cross-browser determinism FAILED');
  process.exit(1);
}
console.log('cross-browser determinism OK');
