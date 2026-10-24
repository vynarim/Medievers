// The way into an online match (GDD §6): create it and give the code, join it with a code, or
// take this device's seat again after a reload. `onReady` gets the match once both are in.
import type { MatchRules } from '../content/rules.ts';
import { deleteRoom, normalizeCode } from '../net/firebase-transport.ts';
import { onlineError, showConnecting, showHostWait, showJoin } from '../ui/online-screen.ts';
import type { MatchSetup } from './match-setup.ts';
import {
  ONLINE_DELAY,
  clearOnlineCode,
  hostMatch,
  joinMatch,
  leaveMatch,
  type OnlineMatch,
} from './online.ts';

export function hostFlow(
  setup: MatchSetup,
  rules: MatchRules,
  seed: number,
  onReady: (m: OnlineMatch) => void,
  onBack: () => void,
): void {
  let cancelled = false;
  const screen = showHostWait((code) => {
    cancelled = true;
    clearOnlineCode();
    if (code) void deleteRoom(code);
    onBack();
  });
  hostMatch({ setup, rules, seed, delay: ONLINE_DELAY }, (code) => screen.setCode(code)).then(
    (m) => {
      if (cancelled) {
        leaveMatch(m, true);
        return;
      }
      screen.close();
      onReady(m);
    },
    (e: unknown) => screen.fail(onlineError(e)),
  );
}

export function joinFlow(onReady: (m: OnlineMatch) => void, onBack: () => void): void {
  showJoin(
    normalizeCode,
    async (code) => {
      onReady(await joinMatch(code));
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
