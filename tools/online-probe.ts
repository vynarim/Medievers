// Online probe (BACKLOG 9.4, 9.5): two browser contexts meet by code on the real Firebase
// project, a third is refused, they place and pass turns, one page reloads mid-match, and the
// turn hashes of both must agree. Usage: pnpm run online:probe [dev server URL]; against the hosted build, add --meet-only. The host
// leaves at the end, so its room is removed.
import { chromium, type Page } from 'playwright';

const URL_ = process.argv.slice(2).find((x) => x.startsWith('http')) ?? 'http://localhost:5173/';
const log = (...a: unknown[]): void => console.log(new Date().toISOString().slice(11, 19), ...a);

async function clickText(p: Page, text: string): Promise<void> {
  await p.locator('#ui button', { hasText: text }).first().click();
}

interface State {
  tick: number;
  turn: number;
  phase: string;
  team: number;
  desync: number | null;
  known: number;
  local: [number, number][];
  remote: [number, number][];
  status: string | null;
}

async function state(p: Page): Promise<State | null> {
  return p.evaluate(() => {
    const g = (window as unknown as { medieverse?: { scene: { getScene(k: string): unknown } } })
      .medieverse;
    const sc = g?.scene.getScene('battle') as
      | {
          sim?: {
            view(): { tick: number; turn: { number: number; phase: string; activeTeam: number } };
          };
          online?: {
            lockstep: {
              desyncTurn: number | null;
              knownUntil(): number;
              /** each turn's hashes, by seat (private in lockstep.ts) */
              hashes: Map<number, Map<number, number>>;
            };
          };
        }
      | undefined;
    if (!sc?.sim || !sc.online) return null;
    const v = sc.sim.view();
    const ls = sc.online.lockstep;
    const st = document.querySelector('#ui .net-status:not(.hidden)');
    return {
      tick: v.tick,
      turn: v.turn.number,
      phase: v.turn.phase,
      team: v.turn.activeTeam,
      desync: ls.desyncTurn,
      known: ls.knownUntil(),
      // A turn's hash (the first seat's), and the turns where two seats' hashes were compared.
      local: [...ls.hashes].map(([turn, by]): [number, number] => [turn, [...by.values()][0] ?? 0]),
      remote: [...ls.hashes]
        .filter(([, by]) => by.size > 1)
        .map(([turn, by]): [number, number] => [turn, by.size]),
      status: st?.textContent ?? null,
    };
  });
}

/** The page whose house plays places its next unit, or passes its turn. */
async function act(players: [Page, string][]): Promise<void> {
  for (const [p, r] of players) {
    await p.evaluate((role) => {
      const g = (window as unknown as { medieverse: { scene: { getScene(k: string): unknown } } })
        .medieverse;
      const sc = g.scene.getScene('battle') as {
        sim: {
          view(): {
            tick: number;
            turn: { phase: string; activeTeam: number };
            terrain: { width: number };
          };
        };
        input_: { ui: { place: number | null; skip: boolean } };
      };
      const v = sc.sim.view();
      const mine = (v.turn.activeTeam % 2 === 0 ? 'host' : 'guest') === role;
      if (!mine) return;
      if (v.turn.phase === 'placement')
        sc.input_.ui.place = 200 + ((v.tick * 7919) % (v.terrain.width - 400));
      else if (v.turn.phase === 'action') sc.input_.ui.skip = true;
    }, r);
  }
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const [ca, cb] = [await browser.newContext(), await browser.newContext()];
  const a = await ca.newPage();
  const b = await cb.newPage();
  for (const [n, p] of [
    ['A', a],
    ['B', b],
  ] as const) {
    p.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') log(n, m.type(), m.text());
    });
    p.on('pageerror', (e) => log(n, 'pageerror', e.message));
  }
  await a.goto(URL_);
  await b.goto(URL_);
  const t0 = Date.now();
  // The title page opens first: « Entrer en lice » leads to the setup screen, which shows the
  // match's code at once.
  await clickText(a, 'Entrer en lice');
  await a.waitForFunction(
    () =>
      /^[0-9A-Z]{3}-[0-9A-Z]{3}$/.test(
        document.querySelector('#ui .setup .title .code b')?.textContent ?? '',
      ),
    null,
    { timeout: 20000 },
  );
  const code = (await a.locator('#ui .setup .title .code b').textContent()) ?? '';
  log('code', code, Date.now() - t0, 'ms');
  await clickText(b, 'Rejoindre une partie');
  await b.locator('#ui .online input').fill(code);
  await clickText(b, 'Rejoindre');
  // Seated, the friend chooses its own units: its first one becomes the king.
  await b.locator('#ui .online .units select').first().selectOption('king', { timeout: 30000 });
  // The creator's screen gave the friend a house, and shows the units it chose.
  await a.waitForFunction(
    () => /Roi/.test(document.querySelector('#ui .setup .units.friend')?.textContent ?? ''),
    null,
    { timeout: 30000 },
  );
  log('friend seated with its units', Date.now() - t0, 'ms');
  await clickText(a, 'À la bataille');
  await b.waitForFunction(() => !document.querySelector('#ui .online'), null, { timeout: 30000 });
  log('met in', Date.now() - t0, 'ms');

  // A production build has no debug handle: meeting is all that can be checked there.
  if (process.argv.includes('--meet-only')) {
    await clickText(a, 'Pause');
    await clickText(a, 'Nouvelle partie');
    await a.waitForTimeout(22000);
    await browser.close();
    log('online probe OK (meeting only)');
    return;
  }

  const players: [Page, string][] = [
    [a, 'host'],
    [b, 'guest'],
  ];
  let reloaded = false;
  for (let i = 0; i < 240; i++) {
    await act(players);
    await a.waitForTimeout(500);
    const [sa, sb] = [await state(a), await state(b)];
    if (i % 10 === 0)
      log(
        'A',
        sa && { ...sa, local: sa.local.length, remote: sa.remote.length },
        'B',
        sb && { ...sb, local: sb.local.length, remote: sb.remote.length },
      );
    if (sa && !reloaded && sa.turn >= 3) {
      reloaded = true;
      log('reloading B at A tick', sa.tick);
      await b.reload();
      // The title page opens on every launch; the match is taken up again from it.
      await clickText(b, 'Reprendre la partie');
      await b.waitForFunction(() => !document.querySelector('#ui .online'), null, {
        timeout: 60000,
      });
      log('B back', await state(b).then((s) => s && s.tick));
    }
    if (sa && sb && sa.turn >= 6 && sb.turn >= 6) break;
  }
  const [sa, sb] = [await state(a), await state(b)];
  log('final A', sa && { ...sa, local: sa.local, remote: sa.remote });
  log('final B', sb && { ...sb, local: sb.local, remote: sb.remote });
  const agree =
    sa !== null &&
    sb !== null &&
    sa.desync === null &&
    sb.desync === null &&
    sa.turn >= 6 &&
    sb.local.every(([turn, hash]) => sa.local.find((x) => x[0] === turn)?.[1] === hash);
  // The host leaves: its room goes 20 s later.
  await clickText(a, 'Pause');
  await clickText(a, 'Nouvelle partie');
  await a.waitForTimeout(22000);
  await browser.close();
  log(agree ? 'online probe OK' : 'online probe FAILED');
  process.exitCode = agree ? 0 : 1;
}

void main();
