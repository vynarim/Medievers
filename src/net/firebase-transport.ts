// Online play over Firebase (TECH_SPEC §8.1, §8.2): anonymous sign-in, the match's room in the
// Realtime Database found by its code, and a mailbox per peer. The only module that knows the SDK.
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
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
  type Database,
} from 'firebase/database';
import {
  otherRole,
  parseMessage,
  PROTOCOL_VERSION,
  type NetMessage,
  type Role,
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

/** No 0/O, 1/I/L: a code read aloud or copied by hand stays right. */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

let signedIn: Promise<{ db: Database; uid: string }> | null = null;

/** The database and this device's anonymous user id (kept by the SDK across reloads). */
function connectFirebase(): Promise<{ db: Database; uid: string }> {
  signedIn ??= (async () => {
    const app = initializeApp(CONFIG, 'medieverse');
    const auth = getAuth(app);
    const db = getDatabase(app);
    // `pnpm run dev:emulators`: the local Firebase emulators instead of the real project.
    if (import.meta.env?.VITE_FIREBASE_EMULATOR === '1') {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      connectDatabaseEmulator(db, '127.0.0.1', 9000);
    }
    const cred = await signInAnonymously(auth);
    return { db, uid: cred.user.uid };
  })();
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
  for (let i = 0; i < 5; i++) {
    const code = newCode();
    const host = await get(ref(db, `${ROOT}/${code}/host`));
    if (host.exists()) continue;
    await set(ref(db, `${ROOT}/${code}`), {
      v: PROTOCOL_VERSION,
      host: uid,
      createdAt: serverTimestamp(),
    });
    return code;
  }
  throw new Error('offline' satisfies RoomError);
}

/**
 * Takes a seat in room `code`: the free guest seat, or the seat this device already had (a
 * reloaded page). Returns the role, or throws 'unknown' / 'full'.
 */
export async function joinRoom(code: string): Promise<Role> {
  const { db, uid } = await connectFirebase();
  const host = await get(ref(db, `${ROOT}/${code}/host`));
  if (!host.exists()) throw new Error('unknown' satisfies RoomError);
  if (host.val() === uid) return 'host';
  const seat = await runTransaction(ref(db, `${ROOT}/${code}/guest`), (guest: unknown) =>
    guest === null || guest === uid ? uid : undefined,
  );
  if (!seat.committed) throw new Error('full' satisfies RoomError);
  return 'guest';
}

/** Removes the room (the host, once the match is over or left). */
export async function deleteRoom(code: string): Promise<void> {
  const { db } = await connectFirebase();
  await remove(ref(db, `${ROOT}/${code}`)).catch(() => undefined);
}

/**
 * The mailboxes of room `code`: what this peer sends lands in the other's box; what lands in
 * its own box is handed over in order, then erased. Presence says whether the other is there.
 */
export class FirebaseTransport implements Transport {
  readonly code: string;
  readonly role: Role;
  private readonly db: Database;
  private handler: ((msg: NetMessage) => void) | null = null;
  private readonly early: NetMessage[] = [];
  private readonly unsubscribe: (() => void)[] = [];
  /** the other peer's presence: true while its page is open */
  otherOnline = false;

  private constructor(db: Database, code: string, role: Role) {
    this.db = db;
    this.code = code;
    this.role = role;
  }

  static async open(code: string, role: Role): Promise<FirebaseTransport> {
    const { db } = await connectFirebase();
    const tr = new FirebaseTransport(db, code, role);
    const room = `${ROOT}/${code}`;
    const me = ref(db, `${room}/online/${role}`);
    await set(me, true);
    await onDisconnect(me).set(false);
    tr.unsubscribe.push(
      onValue(ref(db, `${room}/online/${otherRole(role)}`), (s) => {
        tr.otherOnline = s.val() === true;
      }),
      onChildAdded(ref(db, `${room}/to/${role}`), (snap) => {
        let msg: NetMessage | null;
        try {
          msg = parseMessage(JSON.parse(String(snap.val())));
        } catch {
          msg = null;
        }
        void remove(snap.ref);
        if (!msg) return;
        if (tr.handler) tr.handler(msg);
        else tr.early.push(msg);
      }),
    );
    return tr;
  }

  send(msg: NetMessage): void {
    void push(ref(this.db, `${ROOT}/${this.code}/to/${otherRole(this.role)}`), JSON.stringify(msg));
  }

  onMessage(handler: (msg: NetMessage) => void): void {
    this.handler = handler;
    for (const msg of this.early.splice(0)) handler(msg);
  }

  close(): void {
    for (const off of this.unsubscribe.splice(0)) off();
    this.handler = null;
    void set(ref(this.db, `${ROOT}/${this.code}/online/${this.role}`), false).catch(
      () => undefined,
    );
  }
}
