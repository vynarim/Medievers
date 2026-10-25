// Online play over Firebase (TECH_SPEC §8.1, §8.2): anonymous sign-in, the match's room in the
// Realtime Database found by its code, and a mailbox per seat. The friends write to the creator
// only, who passes on what is for the others. The only module that knows the SDK.
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously, type Auth } from 'firebase/auth';
import {
  connectDatabaseEmulator,
  get,
  getDatabase,
  onChildAdded,
  onDisconnect,
  onValue,
  push,
  ref,
  remove,
  runTransaction,
  serverTimestamp,
  set,
  update,
  type Database,
} from 'firebase/database';
import {
  HOST_SEAT,
  MAX_SEAT,
  parseMessage,
  PROTOCOL_VERSION,
  type NetMessage,
  type Seat,
} from './protocol.ts';
import type { Transport } from './transport.ts';

const CONFIG = {
  apiKey: 'AIzaSyBsIKRUPJsMZBxHD3E5skODl1F-6qZKMCA',
  authDomain: 'videogames-06.firebaseapp.com',
  databaseURL: 'https://videogames-06-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'videogames-06',
  appId: '1:1019229620182:web:464d1a0a45d5753a880677',
};

/** Medieverse's corner of the shared project's database (TECH_SPEC §8.1). */
const ROOT = 'medieverse/rooms';
/**
 * The rooms by the half-day they were opened in, `expiry/{start of the half-day, ms, 13 digits}/
 * {code}`: what finds the abandoned rooms without reading anybody's room (database.rules.json).
 */
const EXPIRY = 'medieverse/expiry';
const BUCKET_MS = 12 * 3600 * 1000;
/** ms after which a room is abandoned and any player may wipe it */
const ROOM_LIFETIME_MS = 48 * 3600 * 1000;
/** half-days looked back over by a sweep: a month */
const SWEEP_BUCKETS = 60;

/** The half-day bucket of time `ms`, as its key. */
const bucketOf = (ms: number): string =>
  String(Math.floor(ms / BUCKET_MS) * BUCKET_MS).padStart(13, '0');

/** No 0/O, 1/I/L: a code read aloud or copied by hand stays right. */
export const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

let signedIn: Promise<{ db: Database; uid: string }> | null = null;
let services: { auth: Auth; db: Database } | null = null;

/** The app, its sign-in and its database, made once for the page. */
function firebaseServices(): { auth: Auth; db: Database } {
  if (services) return services;
  const app = initializeApp(CONFIG, 'medieverse');
  const auth = getAuth(app);
  const db = getDatabase(app);
  // `pnpm run dev:emulators`: the local Firebase emulators instead of the real project.
  if (import.meta.env?.VITE_FIREBASE_EMULATOR === '1') {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectDatabaseEmulator(db, '127.0.0.1', 9000);
  }
  services = { auth, db };
  return services;
}

/** The database and this device's anonymous user id (kept by the SDK across reloads). */
function connectFirebase(): Promise<{ db: Database; uid: string }> {
  signedIn ??= (async () => {
    const { auth, db } = firebaseServices();
    const cred = await signInAnonymously(auth);
    return { db, uid: cred.user.uid };
  })();
  // A failed sign-in (offline for a moment, a blocked request) is tried again next time,
  // instead of failing every room until the page is reloaded.
  signedIn.catch((e: unknown) => {
    console.error('[medieverse] Firebase sign-in failed', e);
    signedIn = null;
  });
  return signedIn;
}

/** The code as shown: XXX-XXX. */
export const formatCode = (code: string): string => `${code.slice(0, 3)}-${code.slice(3)}`;

/** A typed code made canonical: upper case, the dash and spaces out; null if it cannot be one. */
export function normalizeCode(typed: string): string | null {
  const code = typed.toUpperCase().replace(/[^0-9A-Z]/g, '');
  return code.length === 6 && [...code].every((c) => ALPHABET.includes(c)) ? code : null;
}

function newCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
}

export type RoomError = 'unknown' | 'full' | 'offline';

/** Creates a room for a new match; this device is its host. */
export async function createRoom(): Promise<string> {
  const { db, uid } = await connectFirebase();
  try {
    return await openRoom(db, uid);
  } catch (e) {
    console.error('[medieverse] the room could not be opened', e);
    throw e;
  }
}

async function openRoom(db: Database, uid: string): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = newCode();
    const host = await get(ref(db, `${ROOT}/${code}/host`));
    if (host.exists()) continue;
    await set(ref(db, `${ROOT}/${code}`), {
      v: PROTOCOL_VERSION,
      host: uid,
      createdAt: serverTimestamp(),
    });
    // Filed by the half-day it was opened in, then the rooms left behind are wiped, unawaited.
    const at = (await get(ref(db, `${ROOT}/${code}/createdAt`))).val() as number | null;
    if (typeof at === 'number') {
      await set(ref(db, `${EXPIRY}/${bucketOf(at)}/${code}`), true).catch(() => undefined);
    }
    void sweepRooms(db, at ?? Date.now());
    return code;
  }
  throw new Error('offline' satisfies RoomError);
}

/**
 * Wipes the rooms opened more than 48 h before `now` (server time, ms), which matches nobody
 * ended left behind: each new room sweeps them (no scheduled task on the free plan). A half-day
 * is swept once its last room is 48 h old. Best effort: failures are ignored.
 */
async function sweepRooms(db: Database, now: number): Promise<void> {
  const newest = Math.floor((now - ROOM_LIFETIME_MS) / BUCKET_MS) * BUCKET_MS - BUCKET_MS;
  const buckets: string[] = [];
  for (let k = 0; k < SWEEP_BUCKETS; k++) buckets.push(bucketOf(newest - k * BUCKET_MS));
  await Promise.all(
    buckets.map(async (bucket) => {
      try {
        const rooms = await get(ref(db, `${EXPIRY}/${bucket}`));
        const codes: string[] = [];
        rooms.forEach((room) => {
          if (room.key) codes.push(room.key);
        });
        for (const code of codes) {
          await update(ref(db), {
            [`${ROOT}/${code}`]: null,
            [`${EXPIRY}/${bucket}/${code}`]: null,
          }).catch(() => remove(ref(db, `${EXPIRY}/${bucket}/${code}`)));
        }
      } catch {
        // Not yet old enough by the server's clock, or offline: the next room will see to it.
      }
    }),
  );
}

/**
 * Takes a seat in room `code`: the seat this device already had (a reloaded page), else the first
 * free one. Returns the seat (0 for the creator), or throws 'unknown' / 'full'.
 */
export async function joinRoom(code: string): Promise<Seat> {
  const { db, uid } = await connectFirebase();
  const room = `${ROOT}/${code}`;
  const host = await get(ref(db, `${room}/host`));
  if (!host.exists()) throw new Error('unknown' satisfies RoomError);
  if (host.val() === uid) return HOST_SEAT;
  for (let seat = 1; seat <= MAX_SEAT; seat++) {
    if ((await get(ref(db, `${room}/seats/${seat}`))).val() === uid) return seat;
  }
  for (let seat = 1; seat <= MAX_SEAT; seat++) {
    const taken = await runTransaction(ref(db, `${room}/seats/${seat}`), (cur: unknown) =>
      cur === null || cur === uid ? uid : undefined,
    );
    if (taken.committed) return seat;
  }
  throw new Error('full' satisfies RoomError);
}

/** Removes the room (the host, once the match is over or left). */
export async function deleteRoom(code: string): Promise<void> {
  const { db } = await connectFirebase();
  const at = (await get(ref(db, `${ROOT}/${code}/createdAt`)).catch(() => null))?.val() as
    number | null | undefined;
  if (typeof at === 'number') {
    await remove(ref(db, `${EXPIRY}/${bucketOf(at)}/${code}`)).catch(() => undefined);
  }
  await remove(ref(db, `${ROOT}/${code}`)).catch(() => undefined);
}

/** What lies in a mailbox: the message, who sent it, and for whom (absent: everyone). */
interface Envelope {
  readonly f: Seat;
  readonly t?: Seat;
  readonly d: unknown;
}

/**
 * The mailboxes of room `code`: what lands in this seat's box is handed over in order, then
 * erased. A friend posts everything in the creator's box; the creator reads it and passes on to
 * the other friends what is for them. Presence says whose page is open.
 */
export class FirebaseTransport implements Transport {
  readonly code: string;
  readonly seat: Seat;
  private readonly db: Database;
  private handler: ((msg: NetMessage, from: Seat) => void) | null = null;
  private readonly early: { msg: NetMessage; from: Seat }[] = [];
  private readonly unsubscribe: (() => void)[] = [];
  /** the creator: the friends seated in the room */
  private friends: Seat[] = [];
  /** whose page is open, by seat */
  private present: Record<string, boolean> = {};
  /** the creator: a friend's page closed */
  onLeave: ((seat: Seat) => void) | null = null;

  private constructor(db: Database, code: string, seat: Seat) {
    this.db = db;
    this.code = code;
    this.seat = seat;
  }

  static async open(code: string, seat: Seat): Promise<FirebaseTransport> {
    const { db } = await connectFirebase();
    const tr = new FirebaseTransport(db, code, seat);
    const room = `${ROOT}/${code}`;
    const me = ref(db, `${room}/online/${seat}`);
    await set(me, true);
    await onDisconnect(me).set(false);
    tr.unsubscribe.push(
      onValue(ref(db, `${room}/online`), (s) => {
        const was = tr.present;
        tr.present = (s.val() as Record<string, boolean> | null) ?? {};
        for (const k of Object.keys(was)) {
          if (was[k] && !tr.present[k]) tr.onLeave?.(Number(k));
        }
      }),
      onChildAdded(ref(db, `${room}/to/${seat}`), (snap) => {
        let env: Envelope | null;
        try {
          env = JSON.parse(String(snap.val())) as Envelope;
        } catch {
          env = null;
        }
        void remove(snap.ref);
        const msg = env ? parseMessage(env.d) : null;
        if (!env || !msg) return;
        // The creator passes on what a friend sent to the others.
        if (tr.seat === HOST_SEAT && env.t !== HOST_SEAT) {
          for (const k of tr.friends) {
            if (k !== env.f && (env.t === undefined || env.t === k)) tr.post(k, env);
          }
          if (env.t !== undefined) return;
        }
        if (tr.handler) tr.handler(msg, env.f);
        else tr.early.push({ msg, from: env.f });
      }),
    );
    if (seat === HOST_SEAT) {
      tr.unsubscribe.push(
        onValue(ref(db, `${room}/seats`), (s) => {
          // Numbered keys may come back as an array, holes included.
          const seats = (s.val() as Record<string, string | null> | null) ?? {};
          const was = tr.friends;
          tr.friends = Object.entries(seats)
            .filter(([, uid]) => typeof uid === 'string')
            .map(([k]) => Number(k));
          // A seat given back: its friend has left.
          for (const k of was) if (!tr.friends.includes(k)) tr.onLeave?.(k);
        }),
      );
    }
    return tr;
  }

  /** Gives seat `seat` back (one's own, or the creator's lobby forgetting a friend gone). */
  freeSeat(seat: Seat): void {
    void remove(ref(this.db, `${ROOT}/${this.code}/seats/${seat}`)).catch(() => undefined);
  }

  /** The page of seat `seat` is open. */
  online(seat: Seat): boolean {
    return this.present[seat] === true;
  }

  private post(to: Seat, env: Envelope): void {
    void push(ref(this.db, `${ROOT}/${this.code}/to/${to}`), JSON.stringify(env));
  }

  send(msg: NetMessage, to?: Seat): void {
    const env: Envelope =
      to === undefined ? { f: this.seat, d: msg } : { f: this.seat, t: to, d: msg };
    if (this.seat !== HOST_SEAT) this.post(HOST_SEAT, env);
    else if (to !== undefined) this.post(to, env);
    else for (const k of this.friends) this.post(k, env);
  }

  onMessage(handler: (msg: NetMessage, from: Seat) => void): void {
    this.handler = handler;
    for (const q of this.early.splice(0)) handler(q.msg, q.from);
  }

  close(): void {
    for (const off of this.unsubscribe.splice(0)) off();
    this.handler = null;
    this.onLeave = null;
    void set(ref(this.db, `${ROOT}/${this.code}/online/${this.seat}`), false).catch(
      () => undefined,
    );
  }
}
