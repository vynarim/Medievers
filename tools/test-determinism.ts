// Replays every reference replay of tests/replays/ and checks its final hash.
// Usage: pnpm run test:determinism
import { readdirSync, readFileSync } from 'node:fs';
import { formatHash, replay, type ReplayFile } from '../src/sim/index.ts';
import { loadMask } from './lib/maps-node.ts';

const dir = new URL('../tests/replays/', import.meta.url);
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .sort();
if (files.length === 0) {
  console.error('NOT ASSESSED: no reference replay in tests/replays/');
  process.exit(2);
}
let failed = 0;
for (const name of files) {
  const file = JSON.parse(readFileSync(new URL(name, dir), 'utf8')) as ReplayFile;
  const hash = formatHash(replay(file, loadMask(file.mapId)).hash());
  const ok = hash === file.expectedHash;
  if (!ok) failed++;
  console.log(
    `${ok ? 'OK  ' : 'FAIL'} ${name.padEnd(28)} expected ${file.expectedHash}  got ${hash}`,
  );
}
if (failed > 0) {
  console.error(`${failed} replay(s) diverged`);
  process.exit(1);
}
console.log(`determinism OK (${files.length} replays)`);
