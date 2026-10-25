// Browser entry of the determinism harness: exposes the probes to Playwright.
import type { ReplayFile } from '../../src/sim/index.ts';
import { parseMapId } from '../../src/content/maps.ts';
import maskUrl from '../fixtures/maps/test-mask.png?url';
import { runChecks, type CheckResults } from './checks.ts';

declare global {
  interface Window {
    medieverseChecks: () => Promise<CheckResults>;
  }
}

const replayFiles = import.meta.glob<ReplayFile>('../replays/*.json', {
  eager: true,
  import: 'default',
});
const mapUrls = import.meta.glob<string>('../fixtures/maps/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

const bytes = async (url: string): Promise<Uint8Array> =>
  new Uint8Array(await (await fetch(url)).arrayBuffer());

window.medieverseChecks = async () => {
  const replays = [];
  for (const [path, file] of Object.entries(replayFiles).sort(([a], [b]) => (a < b ? -1 : 1))) {
    const name = path.split('/').pop() ?? path;
    // A generated map is drawn again from its id, in the browser itself.
    if (parseMapId(file.mapId)) {
      replays.push({ name, file });
      continue;
    }
    const mapUrl = mapUrls[`../fixtures/maps/${file.mapId}.png`];
    if (!mapUrl) throw new Error(`no map ${file.mapId} for ${path}`);
    replays.push({ name, file, mapPng: await bytes(mapUrl) });
  }
  return runChecks({ maskPng: await bytes(maskUrl), replays });
};
