// Online match screens (GDD §6): the creator's code while the other player comes, the code to
// type to join, and the wait while a reloaded page takes its seat again. DOM over the canvas.
import { t } from './i18n.ts';
import { button, el, uiRoot } from './overlay.ts';

const STYLE = `
#ui .online { width: min(520px, calc(100vw - 32px)); text-align: center; }
#ui .online p { font-size: 17px; line-height: 1.45; margin: 0 0 10px; }
#ui .online .code { font-family: var(--caps); font-size: 52px; letter-spacing: 6px; color: var(--lapis);
  margin: 8px 0 12px; user-select: text; -webkit-user-select: text; }
#ui .online input { font-family: var(--caps); font-size: 34px; letter-spacing: 4px; text-align: center;
  width: 9em; max-width: 100%; padding: 6px; border: 2px solid var(--encre); border-radius: 4px;
  background: var(--ceruse); color: var(--encre); pointer-events: auto; text-transform: uppercase; }
#ui .online .error { color: var(--vermillon); min-height: 1.4em; }
#ui .online .actions { justify-content: center; }
`;

let styled = false;

/** A modal panel with its veil; returns it and a function that removes both. */
function panel(): { box: HTMLElement; close: () => void } {
  const root = uiRoot();
  if (!styled) {
    const style = document.createElement('style');
    style.textContent = STYLE;
    document.head.appendChild(style);
    styled = true;
  }
  const veil = el('div', 'veil');
  const box = el('div', 'modal panel online');
  root.append(veil, box);
  return {
    box,
    close: () => {
      veil.remove();
      box.remove();
    },
  };
}

/** The message for an error thrown while meeting (room, network, version). */
export function onlineError(e: unknown): string {
  const key = e instanceof Error ? e.message : '';
  return ['unknown', 'full', 'version', 'offline'].includes(key)
    ? t(`online.error.${key}`)
    : t('online.error.offline');
}

export interface WaitScreen {
  setCode(code: string): void;
  fail(message: string): void;
  close(): void;
}

/** The creator's screen: the code to give, then the wait. Cancel calls `onCancel`. */
export function showHostWait(onCancel: (code: string | null) => void): WaitScreen {
  const { box, close } = panel();
  let code: string | null = null;
  const shown = el('div', 'code', '…');
  const status = el('p', '', t('online.creating'));
  const error = el('p', 'error');
  const copy = button(t('online.copy'));
  copy.disabled = true;
  copy.addEventListener('click', () => {
    if (code) void navigator.clipboard?.writeText(shown.textContent ?? code);
  });
  const cancel = button(t('online.cancel'));
  cancel.addEventListener('click', () => {
    close();
    onCancel(code);
  });
  const actions = el('div', 'actions');
  actions.append(copy, cancel);
  box.append(
    el('h2', '', t('online.hostTitle')),
    el('p', '', t('online.hostBody')),
    shown,
    status,
    error,
    actions,
  );
  return {
    setCode: (c) => {
      code = c;
      shown.textContent = `${c.slice(0, 3)}-${c.slice(3)}`;
      status.textContent = t('online.waiting');
      copy.disabled = false;
    },
    fail: (message) => {
      error.textContent = message;
      status.textContent = '';
    },
    close,
  };
}

/** The joining player's screen: a code to type; `onJoin` resolves or throws (message shown). */
export function showJoin(
  normalize: (typed: string) => string | null,
  onJoin: (code: string) => Promise<void>,
  onCancel: () => void,
): () => void {
  const { box, close } = panel();
  const input = el('input');
  input.type = 'text';
  input.maxLength = 7;
  input.placeholder = 'XXX-XXX';
  input.autocomplete = 'off';
  input.spellcheck = false;
  // Typing a code must not move the unit behind.
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') go.click();
  });
  const error = el('p', 'error');
  const go = button(t('online.join'), 'fire');
  go.addEventListener('click', () => {
    const code = normalize(input.value);
    if (!code) {
      error.textContent = t('online.error.format');
      return;
    }
    go.disabled = true;
    error.textContent = t('online.joining');
    onJoin(code).then(close, (e: unknown) => {
      go.disabled = false;
      error.textContent = onlineError(e);
    });
  });
  const cancel = button(t('online.cancel'));
  cancel.addEventListener('click', () => {
    close();
    onCancel();
  });
  const actions = el('div', 'actions');
  actions.append(cancel, go);
  box.append(
    el('h2', '', t('online.joinTitle')),
    el('p', '', t('online.joinBody')),
    input,
    error,
    actions,
  );
  setTimeout(() => input.focus(), 0);
  return close;
}

/** A short wait (a reloaded page taking its seat again); returns the function that closes it. */
export function showConnecting(code: string, onCancel: () => void): WaitScreen {
  const { box, close } = panel();
  const error = el('p', 'error');
  const cancel = button(t('online.leave'));
  cancel.addEventListener('click', () => {
    close();
    onCancel();
  });
  const actions = el('div', 'actions');
  actions.append(cancel);
  box.append(
    el('h2', '', t('online.rejoinTitle')),
    el('div', 'code', `${code.slice(0, 3)}-${code.slice(3)}`),
    el('p', '', t('online.rejoinBody')),
    error,
    actions,
  );
  return {
    setCode: () => undefined,
    fail: (message) => (error.textContent = message),
    close,
  };
}
