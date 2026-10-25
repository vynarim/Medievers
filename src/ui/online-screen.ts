// Online match screens (GDD §6): the code to type to join, the wait until the creator starts the
// match, and the wait while a reloaded page takes its seat again. DOM over the canvas. (The
// creator's code shows on the setup screen.)
import { defaultLineup, type ClassId } from '../content/classes.ts';
import { DEFAULT_UNITS } from '../content/schemes.ts';
import { t } from './i18n.ts';
import { button, el, uiRoot } from './overlay.ts';
import { FACTIONS } from '../content/factions.ts';
import type { LobbyTable } from '../net/protocol.ts';
import { lineupPicker, setupStyles } from './setup-screen.ts';
import { shield } from './overlay.ts';
import { soundButton } from './sound-button.ts';
import { COLORS, css } from './tokens.ts';

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
#ui .online .sound-corner { position: absolute; top: 14px; right: 16px; }
#ui .online .table { text-align: left; margin: 14px 0 4px; }
#ui .online .table .rules { font-size: 15px; margin: 0 0 6px; }
#ui .online .table-house { display: flex; align-items: center; gap: 8px; padding: 3px 0;
  border-bottom: 1px solid var(--gilt); font-size: 16px; }
#ui .online .table-house .name { font-family: var(--caps); flex: 1 1 auto; }
#ui .online .table-house .who.ready { color: var(--vert); }
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
  // The sound, at hand while waiting too.
  box.append(soundButton('icon sound-corner'));
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
  // Firebase's own refusals, told for what they are rather than as a lost connection.
  const code = String((e as { code?: unknown } | null)?.code ?? '');
  const text = e instanceof Error ? e.message : '';
  if (/referer|unauthorized-domain|api-key/i.test(code + text)) {
    return t('online.error.address', { host: location.host });
  }
  if (/permission[_ ]denied/i.test(code + text)) return t('online.error.denied');
  const key = text;
  if (['unknown', 'full', 'version', 'offline'].includes(key)) return t(`online.error.${key}`);
  // Anything else: the lost connection, with the server's own word for it, to look up.
  return code ? `${t('online.error.offline')} (${code})` : t('online.error.offline');
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
    seated: (
      leave: () => void,
      chooseLineup: (classes: readonly ClassId[], ready: boolean) => void,
      seat: number,
    ) => void,
    onTable: (table: LobbyTable) => void,
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
    // Seated: the friend's own units, as many as the others field, kept secret from them, then
    // confirmed; and the table as the creator prepares it, nobody's units shown.
    let table: LobbyTable | null = null;
    let lineup: ClassId[] = defaultLineup(DEFAULT_UNITS, false);
    let ready = false;
    let mySeat = 0;
    let send: (classes: readonly ClassId[], ready: boolean) => void = () => undefined;
    const units = el('div', 'setup');
    units.style.display = 'contents';
    const renderSeated = (): void => {
      const count = table?.units ?? lineup.length;
      if (lineup.length !== count) {
        lineup = Array.from({ length: count }, (_, k): ClassId => lineup[k] ?? 'knight');
        ready = false;
        send(lineup, ready);
      }
      const row = el('div', 'house');
      row.append(
        lineupPicker(
          lineup,
          (next) => {
            lineup = next;
            ready = false;
            send(lineup, ready);
            renderSeated();
          },
          true,
        ),
      );
      const confirm = button(
        t(ready ? 'online.unitsChange' : 'online.unitsReady'),
        ready ? '' : 'fire',
      );
      confirm.addEventListener('click', () => {
        ready = !ready;
        send(lineup, ready);
        renderSeated();
      });
      row.querySelectorAll('select').forEach((sel) => (sel.disabled = ready));
      const parts: HTMLElement[] = [
        el('h3', '', t('online.yourUnits', { n: count })),
        row,
        confirm,
      ];
      if (table) parts.push(tableView(table, mySeat));
      units.replaceChildren(...parts);
      error.classList.add('ok');
      error.textContent = t(ready ? 'online.seatedReady' : 'online.seated');
    };
    const seated = (
      l: () => void,
      chooseLineup: (classes: readonly ClassId[], ready: boolean) => void,
      seat: number,
    ): void => {
      // Cancelled while the seat was being taken: it is given back at once.
      if (gone) {
        l();
        return;
      }
      leave = l;
      mySeat = seat;
      send = chooseLineup;
      body.textContent = t('online.seatedBody');
      input.remove();
      setupStyles();
      box.classList.add('seated');
      renderSeated();
      send(lineup, ready);
      error.before(units);
    };
    const onTable = (next: LobbyTable): void => {
      table = next;
      if (leave) renderSeated();
    };
    onJoin(code, seated, onTable).then(close, (e: unknown) => {
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

/**
 * The creator's table as a friend sees it: the field and the rules, then each house and who
 * plays it (the creator, you, a friend and where it stands, the AI), nobody's units.
 */
function tableView(table: LobbyTable, mySeat: number): HTMLElement {
  const view = el('div', 'table');
  const rules = [
    t(`maps.${table.map}`),
    t(`setup.scheme.${table.scheme}`),
    ...(table.regicide ? [t('setup.regicide')] : []),
    t('setup.turnSeconds', { s: table.turnSeconds }),
  ];
  view.append(el('h3', '', t('online.table')), el('p', 'rules', rules.join(' · ')));
  const mine = table.houses.some((h) => h.player === 'friend' && h.seat === mySeat);
  if (!mine) view.append(el('p', 'error', t('online.table.dropped')));
  table.houses.forEach((h, k) => {
    const f = FACTIONS[k];
    const row = el('div', 'table-house');
    const name = el('span', 'name', f ? t(f.nameKey) : '');
    name.style.color = css(f?.ink ?? COLORS.encre);
    const who =
      h.player === 'host'
        ? t('online.table.host')
        : h.player === 'ai'
          ? t(`setup.player.${h.level ?? 'knight'}`)
          : h.seat === mySeat
            ? t('online.table.you')
            : t(`online.table.friend.${h.status ?? 'absent'}`);
    const mark =
      h.player === 'friend'
        ? h.status === 'ready'
          ? ' ✓'
          : h.status === 'choosing'
            ? ' ✎'
            : ' ⌛'
        : '';
    row.append(
      shield(f?.primary ?? COLORS.encre, f?.secondary ?? COLORS.or, true),
      name,
      el('span', h.status === 'ready' ? 'who ready' : 'who', who + mark),
    );
    view.append(row);
  });
  return view;
}
