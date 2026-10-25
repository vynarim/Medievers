// Online match screens (GDD §6): the code to type to join, the wait until the creator starts the
// match, and the wait while a reloaded page takes its seat again. DOM over the canvas. (The
// creator's code shows on the setup screen.)
import { defaultLineup, type ClassId } from '../content/classes.ts';
import { DEFAULT_UNITS } from '../content/schemes.ts';
import { t } from './i18n.ts';
import { button, el, uiRoot } from './overlay.ts';
import { lineupPicker, setupStyles } from './setup-screen.ts';

const STYLE = `
#ui .online { width: min(520px, calc(100vw - 32px)); text-align: center; }
#ui .online p { font-size: 17px; line-height: 1.45; margin: 0 0 10px; }
#ui .online .code { font-family: var(--caps); font-size: 52px; letter-spacing: 6px; color: var(--lapis);
  margin: 8px 0 12px; user-select: text; -webkit-user-select: text; }
#ui .online input { font-family: var(--caps); font-size: 34px; letter-spacing: 4px; text-align: center;
  width: 9em; max-width: 100%; padding: 6px; border: 2px solid var(--encre); border-radius: 4px;
  background: var(--ceruse); color: var(--encre); pointer-events: auto; text-transform: uppercase; }
#ui .online .error { color: var(--vermillon); min-height: 1.4em; }
#ui .online .error.ok { color: var(--encre); }
#ui .online .actions { justify-content: center; }
#ui .online.seated { width: min(980px, calc(100vw - 32px)); }
#ui .online .setup .house { justify-content: center; border: 0; margin: 0 0 10px; }
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
  fail(message: string): void;
  close(): void;
}

/**
 * The joining player's screen: a code to type; `onJoin` resolves once the match starts, or
 * throws (message shown). Seated, the player waits for the creator to start it.
 */
export function showJoin(
  normalize: (typed: string) => string | null,
  /** the signs a code is made of */
  alphabet: string,
  onJoin: (
    code: string,
    seated: (leave: () => void, chooseLineup: (classes: readonly ClassId[]) => void) => void,
  ) => Promise<void>,
  onCancel: () => void,
): () => void {
  const { box, close } = panel();
  let leave: (() => void) | null = null;
  let gone = false;
  const body = el('p', '', t('online.joinBody'));
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
  // As it is typed: upper case, the dash put in after three signs, and a word at once for a
  // sign no code has (0, 1, I, L, O: too easily mistaken).
  input.addEventListener('input', () => {
    const signs = [...input.value.toUpperCase().replace(/[^0-9A-Z]/g, '')];
    const wrong = [...new Set(signs.filter((c) => !alphabet.includes(c)))];
    const kept = signs
      .filter((c) => alphabet.includes(c))
      .slice(0, 6)
      .join('');
    input.value = kept.length > 3 ? `${kept.slice(0, 3)}-${kept.slice(3)}` : kept;
    error.classList.remove('ok');
    error.textContent =
      wrong.length > 0 ? t('online.error.signs', { signs: wrong.join(', ') }) : '';
  });
  const go = button(t('online.join'), 'fire');
  go.addEventListener('click', () => {
    const code = normalize(input.value);
    if (!code) {
      error.textContent = t('online.error.format');
      return;
    }
    go.disabled = true;
    error.textContent = t('online.joining');
    const seated = (l: () => void, chooseLineup: (classes: readonly ClassId[]) => void): void => {
      // Cancelled while the seat was being taken: it is given back at once.
      if (gone) {
        l();
        return;
      }
      leave = l;
      body.textContent = t('online.seatedBody');
      input.remove();
      error.classList.add('ok');
      error.textContent = t('online.seated');
      // The friend's own units, sent to the creator at once and on each change.
      setupStyles();
      box.classList.add('seated');
      const units = el('div', 'setup');
      units.style.display = 'contents';
      let lineup: ClassId[] = defaultLineup(DEFAULT_UNITS, false);
      const renderUnits = (): void => {
        const row = el('div', 'house');
        row.append(
          lineupPicker(lineup, (next) => {
            lineup = next;
            chooseLineup(lineup);
            renderUnits();
          }),
        );
        units.replaceChildren(el('h3', '', t('online.yourUnits')), row);
      };
      renderUnits();
      chooseLineup(lineup);
      error.before(units);
    };
    onJoin(code, seated).then(close, (e: unknown) => {
      leave = null;
      error.classList.remove('ok');
      go.disabled = false;
      input.disabled = false;
      body.textContent = t('online.joinBody');
      if (!input.isConnected) body.after(input);
      error.textContent = onlineError(e);
    });
  });
  const cancel = button(t('online.cancel'));
  cancel.addEventListener('click', () => {
    gone = true;
    leave?.();
    close();
    onCancel();
  });
  const actions = el('div', 'actions');
  actions.append(cancel, go);
  box.append(el('h2', '', t('online.joinTitle')), body, input, error, actions);
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
    fail: (message) => (error.textContent = message),
    close,
  };
}
