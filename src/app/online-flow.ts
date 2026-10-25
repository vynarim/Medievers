// The ways into an online match (GDD §6): the room the setup screen opens for friends, joining
// one with a code, or taking this device's seat again after a reload. `onReady` gets the match
// once it starts.
import type { MatchRules } from '../content/rules.ts';
import { ALPHABET, normalizeCode } from '../net/firebase-transport.ts';
import { onlineError, showConnecting, showJoin } from '../ui/online-screen.ts';
import type { SetupLobby } from '../ui/setup-screen.ts';
import { saveSetup, type MatchSetup } from './match-setup.ts';
import {
  ONLINE_DELAY,
  clearOnlineCode,
  closeLobby,
  joinMatch,
  launchMatch,
  openLobby,
  type HostLobby,
  type OnlineMatch,
} from './online.ts';

/**
 * The room of the setup screen, for a match with friends: opened at once; `launch` starts the
 * match with the setup's rules and `seed`, and hands it to `onReady`.
 */
export function setupLobby(
  rulesOf: (setup: MatchSetup) => MatchRules,
  seed: number,
  onReady: (m: OnlineMatch) => void,
): SetupLobby {
  const opening = openLobby();
  let closed = false;
  // A room opened after the screen closed is not wanted.
  void opening.then((h) => closed && closeLobby(h), () => undefined);
  return {
    code: opening.then((h: HostLobby) => h.code),
    onJoin: (fn) => void opening.then((h) => h.lobby.onJoin(fn), () => undefined),
    onLineup: (fn) => void opening.then((h) => h.lobby.onLineup(fn), () => undefined),
    launch: (setup) => {
      saveSetup(setup);
      void opening.then((h) =>
        onReady(launchMatch(h, { setup, rules: rulesOf(setup), seed, delay: ONLINE_DELAY })),
      );
    },
    close: () => {
      closed = true;
      void opening.then(closeLobby, () => undefined);
    },
  };
}

export function joinFlow(onReady: (m: OnlineMatch) => void, onBack: () => void): void {
  showJoin(
    normalizeCode,
    ALPHABET,
    async (code, seated) => {
      onReady(await joinMatch(code, seated));
    },
    onBack,
  );
}

/** A reloaded page: its match, by the code it kept. `onFail` when it is gone or left. */
export function rejoinFlow(
  code: string,
  onReady: (m: OnlineMatch) => void,
  onFail: () => void,
): void {
  let cancelled = false;
  const screen = showConnecting(code, () => {
    cancelled = true;
    clearOnlineCode();
    onFail();
  });
  joinMatch(code).then(
    (m) => {
      if (cancelled) return;
      screen.close();
      onReady(m);
    },
    (e: unknown) => {
      clearOnlineCode();
      screen.fail(onlineError(e));
    },
  );
}
