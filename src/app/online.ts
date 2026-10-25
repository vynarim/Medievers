// Online matches (GDD §6, TECH_SPEC §8): open a lobby with its code while the friends join, then
// start; or join one by its code. The match in progress is remembered by its code, so a
// reloaded page takes its seat again.
import { FirebaseTransport, createRoom, deleteRoom, joinRoom } from '../net/firebase-transport.ts';
import type { Lockstep } from '../net/lockstep.ts';
import { HOST_SEAT, type MatchStart, type Seat } from '../net/protocol.ts';
import { Lobby, connect } from '../net/session.ts';

const KEY = 'medieverse.online.v1';

/** ticks between deciding a tick's commands and playing them, on every peer (TECH_SPEC §8.4) */
export const ONLINE_DELAY = 30;

/** The build every peer must share; the dev server says 'dev'. */
export const BUILD_HASH: string = import.meta.env?.VITE_BUILD ?? 'dev';

export interface OnlineMatch {
  readonly code: string;
  /** this device's seat: 0 for the creator */
  readonly seat: Seat;
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

/** The creator's room before the match: its code, and the friends who joined. */
export interface HostLobby {
  readonly code: string;
  readonly lobby: Lobby;
  readonly transport: FirebaseTransport;
}

/** Opens a room for a new match; friends can join it by its code until it starts. */
export async function openLobby(): Promise<HostLobby> {
  const code = await createRoom();
  const transport = await FirebaseTransport.open(code, HOST_SEAT);
  const lobby = new Lobby(transport, BUILD_HASH);
  // A friend gone before the start gives the seat back, for whoever comes instead.
  transport.onLeave = (seat) => {
    lobby.forget(seat);
    transport.freeSeat(seat);
  };
  return { code, lobby, transport };
}

/** Starts the match of an open lobby: the friends who joined get it. */
export function launchMatch(h: HostLobby, start: MatchStart): OnlineMatch {
  saveOnlineCode(h.code);
  h.transport.onLeave = null;
  const lockstep = h.lobby.start(start);
  return { code: h.code, seat: HOST_SEAT, transport: h.transport, lockstep, resumed: false };
}

/** Closes a lobby whose match will not be played: the room goes. */
export function closeLobby(h: HostLobby): void {
  h.transport.close();
  void deleteRoom(h.code);
}

/**
 * Joins match `code`, or takes this device's seat in it again. `onSeated` hears when the seat is
 * taken, the match maybe not started yet, with the way to give the seat back and stop waiting.
 * Resolves with the match.
 */
export async function joinMatch(
  code: string,
  onSeated?: (leave: () => void) => void,
): Promise<OnlineMatch> {
  const seat = await joinRoom(code);
  saveOnlineCode(code);
  const transport = await FirebaseTransport.open(code, seat);
  onSeated?.(() => {
    clearOnlineCode();
    // Gone from the room first, so the creator sees it, then the seat given back.
    transport.close();
    transport.freeSeat(seat);
  });
  const joined = await connect(transport, seat, BUILD_HASH);
  return { code, seat, transport, ...joined };
}

/** Leaves the match: the other peers are told, the code forgotten, the creator's room removed. */
export function leaveMatch(m: OnlineMatch, resign: boolean): void {
  if (resign) m.lockstep.resign();
  clearOnlineCode();
  m.transport.close();
  // The creator removes the room a little later, so what was sent last still arrives.
  if (m.seat === HOST_SEAT) setTimeout(() => void deleteRoom(m.code), 20000);
}
