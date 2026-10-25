// Installing the game as an app (PWA): Chrome on Android offers it through an event kept here
// until the title screen proposes it; Safari on iOS has no such event, so the title screen tells
// how to do it by hand. Proposed once: « Plus tard » is remembered.

/** The event Chrome sends when the app can be installed (not in the DOM typings). */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ readonly outcome: 'accepted' | 'dismissed' }>;
}

const KEY = 'medieverse.install.v1';

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

/** Starts listening; to call before anything else, the event comes early. */
export function watchInstall(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    for (const l of listeners) l();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    remember();
  });
}

/** Already running as the installed app. */
function installed(): boolean {
  return (
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function asked(): boolean {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}

function remember(): void {
  try {
    localStorage.setItem(KEY, 'asked');
  } catch {
    // Blocked storage: it may be proposed again next time.
  }
}

/** A touch device running Safari on iOS, where installing is done from the Share menu. */
function iosSafari(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

/** What the title screen can propose now: install at a press, tell how (iOS), or nothing. */
export function installOffer(): 'prompt' | 'ios' | null {
  if (installed() || asked() || !window.matchMedia('(pointer: coarse)').matches) return null;
  if (deferred) return 'prompt';
  return iosSafari() ? 'ios' : null;
}

/** Calls `fn` when installing becomes possible later (the event came after the title). */
export function onInstallable(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Opens the browser's install dialog; asked once, whatever the answer. */
export async function promptInstall(): Promise<void> {
  const e = deferred;
  deferred = null;
  remember();
  if (!e) return;
  await e.prompt();
  await e.userChoice.catch(() => undefined);
}

/** « Plus tard »: not proposed again. */
export function declineInstall(): void {
  remember();
}
