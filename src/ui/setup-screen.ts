// Match setup screen (BACKLOG 3.6, greybox): rules scheme, Régicide, the houses and the class of
// each of their units (GDD §2.1, §3.2, §6). DOM over the canvas, like the rest of the UI.
import { CLASS_IDS, type ClassId } from '../content/classes.ts';
import { FACTIONS } from '../content/factions.ts';
import { MAX_HOUSES, MAX_UNITS, MIN_HOUSES, SCHEME_IDS } from '../content/schemes.ts';
import { MAP_THEMES } from '../content/maps.ts';
import { fixSetup, type MatchSetup } from '../app/match-setup.ts';
import { loadLastReplay, parseLog } from '../app/autosave.ts';
import type { GameLog } from '../sim/log.ts';
import { t } from './i18n.ts';
import { button, el, shield, uiRoot } from './overlay.ts';
import { css } from './tokens.ts';

const STYLE = `
#ui .setup { width: min(1240px, calc(100vw - 32px)); max-width: calc(100vw - 32px); padding-top: 14px;
  padding-bottom: 16px; }
#ui .setup h2 { margin-bottom: 6px; }
#ui .setup h3 { margin: 10px 0 4px; }
#ui .setup .row { display: flex; gap: 8px; align-items: stretch; margin: 2px 0 4px; }
#ui .setup .scheme { text-align: left; flex: 1 1 0; min-width: 0; font-family: var(--text); font-size: 14px;
  line-height: 1.25; }
#ui .setup .scheme b { display: block; font-family: var(--caps); font-weight: normal; font-size: 18px;
  color: var(--lapis); }
#ui .setup .house { display: flex; gap: 6px; align-items: center; padding: 5px 0;
  border-bottom: 1px solid var(--gilt); }
#ui .setup .house .name { font-family: var(--caps); font-size: 18px; flex: 0 0 270px; display: flex;
  gap: 8px; align-items: center; white-space: nowrap; overflow: hidden; }
#ui .setup select { font: inherit; font-size: 16px; min-height: 48px; padding: 4px; pointer-events: auto;
  width: 118px; border: 2px solid var(--encre); border-radius: 4px; background: var(--ceruse);
  color: var(--encre); }
#ui .setup .tools { display: flex; gap: 8px; align-items: center; margin-top: 8px; }
#ui .setup .tools button, #ui .setup .start button { white-space: nowrap; flex: none; }
#ui .setup .tools .note { flex: 1 1 auto; margin: 0 0 0 8px; font-size: 15px; }
#ui .setup .start { margin-top: 12px; display: flex; justify-content: flex-end; gap: 8px; }
`;
let styled = false;

/**
 * Shows the setup screen, starting from `initial`; `onStart` receives the chosen setup and the
 * screen closes. Returns a function that closes it without starting.
 */
export function showSetupScreen(
  initial: MatchSetup,
  onStart: (setup: MatchSetup) => void,
  onCancel?: () => void,
  /** « Revoir la dernière partie » and « Importer un replay »: watch that log */
  onWatch?: (log: GameLog) => void,
  /** online matches (GDD §6): create one with this setup, or join one by its code */
  online?: { host: (setup: MatchSetup) => void; join: () => void },
  /** i18n key of the button that calls onCancel: back to the match, or to the title */
  cancelKey = 'setup.cancel',
): () => void {
  const root = uiRoot();
  if (!styled) {
    const style = document.createElement('style');
    style.textContent = STYLE;
    document.head.appendChild(style);
    styled = true;
  }
  let setup = fixSetup(initial);
  const veil = el('div', 'veil');
  const panel = el('div', 'modal panel setup');
  const close = (): void => {
    veil.remove();
    panel.remove();
  };
  const update = (next: MatchSetup): void => {
    setup = fixSetup(next);
    render();
  };

  const render = (): void => {
    panel.replaceChildren(el('h2', '', t('setup.title')));

    // The map: a theme; its land, towers and rocks are drawn anew for each match.
    panel.append(el('h3', '', t('setup.map')));
    const maps = el('div', 'row');
    for (const theme of MAP_THEMES) {
      const b = button('', `scheme${setup.map === theme ? ' on' : ''}`);
      b.append(el('b', '', t(`maps.${theme}`)), el('span', '', t(`maps.${theme}.text`)));
      b.addEventListener('click', () => update({ ...setup, map: theme }));
      maps.append(b);
    }
    panel.append(maps);

    panel.append(el('h3', '', t('setup.scheme')));
    const schemes = el('div', 'row');
    for (const id of SCHEME_IDS) {
      const b = button('', `scheme${setup.scheme === id ? ' on' : ''}`);
      b.append(el('b', '', t(`setup.scheme.${id}`)), el('span', '', t(`setup.scheme.${id}.text`)));
      b.addEventListener('click', () => update({ ...setup, scheme: id }));
      schemes.append(b);
    }
    panel.append(schemes);

    panel.append(el('h3', '', t('setup.houses')));
    setup.lineups.forEach((lineup, h) => {
      const f = FACTIONS[h];
      const row = el('div', 'house');
      const name = el('div', 'name');
      if (f) name.append(shield(f.primary, f.secondary, true));
      name.append(el('span', '', f ? t(f.nameKey) : ''));
      name.style.color = css(f?.ink ?? 0);
      row.append(name);
      const setLineup = (next: ClassId[]): void => {
        const lineups = setup.lineups.map((l, k) => (k === h ? next : [...l]));
        update({ ...setup, lineups });
      };
      lineup.forEach((cls, u) => {
        const select = el('select');
        select.title = t('setup.unit', { n: u + 1 });
        for (const id of CLASS_IDS) {
          const o = el('option', '', t(`classes.${id}`));
          o.value = id;
          o.selected = id === cls;
          select.append(o);
        }
        select.addEventListener('keydown', (e) => e.stopPropagation());
        select.addEventListener('change', () => {
          const next = [...lineup];
          next[u] = select.value as ClassId;
          setLineup(next);
        });
        row.append(select);
      });
      const less = button('−', 'icon');
      less.title = t('setup.unitLess');
      less.disabled = lineup.length <= 1;
      less.addEventListener('click', () => setLineup(lineup.slice(0, -1)));
      const more = button('+', 'icon');
      more.title = t('setup.unitMore');
      more.disabled = lineup.length >= MAX_UNITS;
      more.addEventListener('click', () => setLineup([...lineup, 'knight']));
      row.append(less, more);
      panel.append(row);
    });
    const regicide = button(
      t(setup.regicide ? 'setup.regicide.on' : 'setup.regicide.off'),
      setup.regicide ? 'on' : '',
    );
    regicide.title = t('setup.regicide.tip');
    regicide.addEventListener('click', () => update({ ...setup, regicide: !setup.regicide }));
    const houses = el('div', 'tools');
    const addHouse = button(t('setup.houseMore'));
    addHouse.disabled = setup.lineups.length >= MAX_HOUSES;
    addHouse.addEventListener('click', () =>
      update({ ...setup, lineups: [...setup.lineups, setup.lineups[0] ?? ['knight']] }),
    );
    const removeHouse = button(t('setup.houseLess'));
    removeHouse.disabled = setup.lineups.length <= MIN_HOUSES;
    removeHouse.addEventListener('click', () =>
      update({ ...setup, lineups: setup.lineups.slice(0, -1) }),
    );
    houses.append(addHouse, removeHouse, regicide, el('p', 'note', t('setup.note')));
    panel.append(houses);

    const start = el('div', 'start');
    if (onWatch) {
      // The replays (GDD §6): the last match played to its end, or one saved as a JSON file.
      const last = loadLastReplay();
      if (last) {
        const watch = button(t('setup.watchLast'));
        watch.addEventListener('click', () => {
          close();
          onWatch(last);
        });
        start.append(watch);
      }
      const file = el('input');
      file.type = 'file';
      file.accept = 'application/json,.json';
      file.classList.add('hidden');
      file.addEventListener('change', () => {
        const f = file.files?.[0];
        if (!f) return;
        void f.text().then((text) => {
          const log = parseLog(text);
          if (!log) {
            window.alert(t('setup.importBad'));
            return;
          }
          close();
          onWatch(log);
        });
      });
      const load = button(t('setup.import'));
      load.addEventListener('click', () => file.click());
      start.append(file, load);
    }
    if (online) {
      const host = button(t('setup.onlineHost'));
      host.title = t('setup.onlineHostTip');
      host.addEventListener('click', () => {
        close();
        online.host(setup);
      });
      const join = button(t('setup.onlineJoin'));
      join.title = t('setup.onlineJoinTip');
      join.addEventListener('click', () => {
        close();
        online.join();
      });
      start.append(host, join);
    }
    const go = button(t('setup.start'), 'fire');
    go.addEventListener('click', () => {
      close();
      onStart(setup);
    });
    if (onCancel) {
      const back = button(t(cancelKey));
      back.addEventListener('click', () => {
        close();
        onCancel();
      });
      start.append(back);
    }
    start.append(go);
    panel.append(start);
  };

  render();
  root.append(veil, panel);
  return close;
}
