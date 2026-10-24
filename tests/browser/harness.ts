// Browser entry of the determinism harness: exposes the probes to Playwright.
import maskUrl from '../fixtures/maps/test-mask.png?url';
import { runChecks, type CheckResults } from './checks.ts';

declare global {
  interface Window {
    medieversChecks: () => Promise<CheckResults>;
  }
}

window.medieversChecks = async () => {
  const png = new Uint8Array(await (await fetch(maskUrl)).arrayBuffer());
  return runChecks(png);
};
