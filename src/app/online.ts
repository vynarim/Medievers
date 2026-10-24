// Online matches (GDD §6, TECH_SPEC §8): create one and wait with its code, or join one by its
// code; the match in progress is remembered by its code, so a reloaded page takes its seat again.
import { FirebaseTransport, createRoom, deleteRoom, joinRoom } from '../net/firebase-transport.ts';
import type { Lockstep } from '../net/lockstep.ts';
import type { MatchStart, Role } from '../net/protocol.ts';
import { connect } from '../net/session.ts';

const KEY = 'medieverse.online.v1';

/** ticks between deciding a tick's commands and playing them, on both peers (TECH_SPEC §8.4) */
export const ONLINE_DELAY = 30;

/** The build both peers must share; the dev server says 'dev'. */
export const BUILD_HASH: string = import.meta.env?.VITE_BUILD ?? 'dev';

export interface OnlineMatch {
  readonly code: string;
  readonly role: Role;
  readonly transport: FirebaseTransport;
  readonly lockstep: Lockstep;
  /** the match was under way: the battle catches up before it shows */
  readonly resumed: boolean;
}

/** The code of the online match this device takes part in, if any. */
export function loadOnlineCode(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function saveOnlineCode(code: string): void {
  try {
    localStorage.setItem(KEY, code);
  } catch {
    // Blocked storage: a reload will not find the match again.
  }
}

export function clearOnlineCode(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing was kept either.
  }
}

/** Creates a match: `onCode` gets its code at once; resolves when the other player is in. */
export async function hostMatch(
  start: MatchStart,
  onCode: (code: string) => void,
): Promise<OnlineMatch> {
  const code = await createRoom();
  saveOnlineCode(code);
  onCode(code);
  const transport = await FirebaseTransport.open(code, 'host');
  const joined = await connect(transport, 'host', BUILD_HASH, start);
  return { code, role: 'host', transport, ...joined };
}

/** Joins match `code`, or takes this device's seat in it again; resolves with the match. */
export async function joinMatch(code: string): Promise<OnlineMatch> {
  const role = await joinRoom(code);
  saveOnlineCode(code);
  const transport = await FirebaseTransport.open(code, role);
  const joined = await connect(transport, role, BUILD_HASH, null);
  return { code, role, transport, ...joined };
}

/** Leaves the match: the other peer is told, the code forgotten, the host's room removed. */
export function leaveMatch(m: OnlineMatch, resign: boolean): void {
  if (resign) m.lockstep.resign();
  clearOnlineCode();
  m.transport.close();
  // The host removes the room a little later, so what was sent last still arrives.
  if (m.role === 'host') setTimeout(() => void deleteRoom(m.code), 20000);
}
