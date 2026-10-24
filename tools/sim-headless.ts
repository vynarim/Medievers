// Runs a replay without rendering and prints the final state summary.
// Usage: pnpm run sim:headless <replay.json>
import { readFileSync } from 'node:fs';
import { formatHash, replay, type ReplayFile } from '../src/sim/index.ts';
import { loadMask } from './lib/maps-node.ts';

const path = process.argv[2];
if (!path) {
  console.error('usage: pnpm run sim:headless <replay.json>');
  process.exit(2);
}
const file = JSON.parse(readFileSync(path, 'utf8')) as ReplayFile;
const started = process.hrtime.bigint();
const sim = replay(file, loadMask(file.mapId));
const ms = Number(process.hrtime.bigint() - started) / 1e6;
const v = sim.view();
const hash = formatHash(sim.hash());

console.log(`replay   ${path}`);
console.log(
  `map      ${file.mapId}   seed ${file.seed}   ticks ${v.tick}   turns ${v.turn.number}`,
);
console.log(
  `winner   ${v.winner === null ? 'none (game not over)' : v.winner === -1 ? 'draw' : `team ${v.winner}`}`,
);
for (const u of v.units) {
  console.log(
    `unit ${u.id}   team ${u.team}   hp ${String(u.hp).padStart(3)}   ${u.alive ? 'alive' : 'dead'}`,
  );
}
console.log(
  `time     ${ms.toFixed(1)} ms (${((ms * 1000) / Math.max(1, v.tick)).toFixed(1)} µs/tick)`,
);
console.log(`hash     ${hash}${file.expectedHash ? `   expected ${file.expectedHash}` : ''}`);
if (file.expectedHash && file.expectedHash !== hash) {
  console.error('HASH MISMATCH');
  process.exit(1);
}
