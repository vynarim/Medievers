// Match setup screen (BACKLOG 3.6, greybox): rules scheme, Régicide, the houses and the class of
// each of their units (GDD §2.1, §3.2, §6). DOM over the canvas, like the rest of the UI.
import { CLASS_IDS, type ClassId } from '../content/classes.ts';
import { FACTIONS } from '../content/factions.ts';
import { MAX_HOUSES, MAX_UNITS, MIN_HOUSES, SCHEME_IDS } from '../content/schemes.ts';
import { MAP_THEMES } from '../content/maps.ts';
import {
  TURN_SECONDS,
  fixSetup,
  playersOf,
  DEFAULT_AI_LEVEL,
  type MatchSetup,
  type Player,
} from '../app/match-setup.ts';
import { AI_LEVEL_IDS, type AiLevelId } from '../content/ai.ts';
import { t } from './i18n.ts';
import { button, el, infoButton, shield, uiRoot } from './overlay.ts';
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
#ui .setup select.player { width: 196px; font-family: var(--caps); }
#ui .setup .tools { display: flex; gap: 8px; align-items: center; margin-top: 8px; }
#ui .setup .tools button, #ui .setup .start button { white-space: nowrap; flex: none; }
#ui .setup .tools .note { flex: 1 1 auto; margin: 0 0 0 8px; font-size: 15px; }
#ui .setup .start { margin-top: 12px; display: flex; justify-content: flex-end; gap: 8px; }
#ui .setup .start.others { margin-top: 4px; justify-content: flex-start; flex-wrap: wrap; }
/* A house leaves the match: a small round « − », at the end of its row. */
#ui .setup .house button.drop { margin-left: auto; width: 40px; height: 40px; min-width: 40px;
  min-height: 40px; padding: 0; display: flex; align-items: center; justify-content: center;
  background: none; border: 0; box-shadow: none; }
#ui .setup .house button.drop i { display: block; width: 22px; height: 22px; border-radius: 50%;
  border: 2px solid var(--vermillon); position: relative; }
#ui .setup .house button.drop i::after { content: ''; position: absolute; left: 4px; right: 4px; top: 50%;
  height: 2px; margin-top: -1px; background: var(--vermillon); }
#ui .setup .house button.drop:hover i { background: var(--velin); }
#ui .setup .house button.drop.hidden { display: flex !important; visibility: hidden; }
@media (pointer: coarse) { #ui .setup .house button.drop { width: 48px; height: 48px; } }
/* On a phone held upright: the choices wrap, their descriptions behind a « ? ». */
#ui.phone .setup { padding-left: 14px; padding-right: 14px; }
#ui.phone .setup .row { flex-wrap: wrap; gap: 6px; }
#ui.phone .setup .scheme { flex: 1 1 40%; display: flex; align-items: center; justify-content: space-between;
  min-height: 48px; }
#ui.phone .setup .scheme b { font-size: 16px; }
#ui.phone .setup .house { flex-wrap: wrap; padding: 8px 0; }
#ui.phone .setup .house > * { order: 2; }
#ui.phone .setup .house .name { order: 0; flex: 1 1 calc(100% - 60px); min-width: 0; }
#ui.phone .setup .house button.drop { order: 1; }
#ui.phone .setup select { flex: 1 1 30%; min-width: 0; width: auto; }
#ui.phone .setup select.player { flex: 1 1 100%; width: auto; }
#ui.phone .setup .tools { flex-wrap: wrap; justify-content: center; }
#ui.phone .setup .tools button { flex: 1 1 40%; }
#ui.phone .setup .start { flex-wrap: wrap; justify-content: center; }
#ui.phone .setup .start button { flex: 1 1 40%; white-space: normal; }
#ui .setup .back .arrow, #ui .setup .back .short, #ui.phone .setup .back .long { display: none; }
#ui.phone .setup .back .arrow, #ui.phone .setup .back .short { display: inline; }
/* The way out and the way in stay in view, floating at the foot of the page. */
#ui.phone .setup .start:not(.others) { position: sticky; bottom: -18px; z-index: 1; flex-wrap: nowrap;
  margin: 12px -14px -18px; padding: 10px 14px 14px; background: var(--ceruse);
  border-top: 2px solid var(--gilt); box-shadow: 0 -4px 10px var(--shade); }
#ui.phone .setup .start:not(.others) button.back { flex: none; }
#ui.phone .setup .start:not(.others) button.fire { flex: 1 1 auto; }
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
      b.append(
        el('b', '', t(`maps.${theme}`)),
        el('span', 'ambient', t(`maps.${theme}.text`)),
        infoButton(() => [t(`maps.${theme}.text`)]),
      );
      b.addEventListener('click', () => update({ ...setup, map: theme }));
      maps.append(b);
    }
    panel.append(maps);

    panel.append(el('h3', '', t('setup.scheme')));
    const schemes = el('div', 'row');
    for (const id of SCHEME_IDS) {
      const b = button('', `scheme${setup.scheme === id ? ' on' : ''}`);
      b.append(
        el('b', '', t(`setup.scheme.${id}`)),
        el('span', 'ambient', t(`setup.scheme.${id}.text`)),
        infoButton(() => [t(`setup.scheme.${id}.text`)]),
      );
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
      // Who plays it: you, or the AI at a level (one house at most is yours).
      const players = playersOf(setup);
      const who = el('select', 'player');
      who.title = t('setup.player');
      for (const id of ['human', ...AI_LEVEL_IDS] as Player[]) {
        // The AI's levels go from the easiest to the hardest: one to three stars.
        const k = AI_LEVEL_IDS.indexOf(id as AiLevelId);
        const stars = k < 0 ? '' : ` ${'★'.repeat(k + 1)}${'☆'.repeat(AI_LEVEL_IDS.length - k - 1)}`;
        const o = el('option', '', `${t(`setup.player.${id}`)}${stars}`);
        o.value = id;
        o.selected = id === players[h];
        who.append(o);
      }
      who.addEventListener('keydown', (e) => e.stopPropagation());
      who.addEventListener('change', () => {
        const chosen = who.value as Player;
        const next = players.map((p, k): Player => {
          if (k === h) return chosen;
          return chosen === 'human' && p === 'human' ? DEFAULT_AI_LEVEL : p;
        });
        update({ ...setup, players: next });
      });
      row.append(who);
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
      // This house leaves the match: a small round « − » at the end of its row.
      // Hidden, its place kept, while the match has no house to spare.
      const drop = button('', setup.lineups.length <= MIN_HOUSES ? 'drop hidden' : 'drop');
      drop.append(el('i'));
      drop.title = t('setup.houseDrop');
      drop.addEventListener('click', () => {
        const players = playersOf(setup).filter((_, k) => k !== h);
        const lineups = setup.lineups.filter((_, k) => k !== h);
        update({ ...setup, lineups, players });
      });
      row.append(drop);
      panel.append(row);
    });
    const regicide = button(
      t(setup.regicide ? 'setup.regicide.on' : 'setup.regicide.off'),
      setup.regicide ? 'on' : '',
    );
    regicide.title = t('setup.regicide.tip');
    regicide.addEventListener('click', () => update({ ...setup, regicide: !setup.regicide }));
    // The turn's length: each click offers the next one.
    const seconds = setup.turnSeconds ?? TURN_SECONDS[0] ?? 45;
    const turnLength = button(t('setup.turnSeconds', { s: seconds }));
    turnLength.title = t('setup.turnSeconds.tip');
    turnLength.addEventListener('click', () => {
      const i = TURN_SECONDS.indexOf(seconds);
      update({ ...setup, turnSeconds: TURN_SECONDS[(i + 1) % TURN_SECONDS.length] ?? seconds });
    });
    const houses = el('div', 'tools');
    const addHouse = button(t('setup.houseMore'));
    addHouse.disabled = setup.lineups.length >= MAX_HOUSES;
    addHouse.addEventListener('click', () =>
      update({ ...setup, lineups: [...setup.lineups, setup.lineups[0] ?? ['knight']] }),
    );
    houses.append(addHouse, el('p', 'note ambient', t('setup.note')));
    panel.append(houses);

    // How the match runs, apart from who fights it.
    panel.append(el('h3', '', t('setup.options')));
    const options = el('div', 'tools');
    options.append(regicide, turnLength, infoButton(() => [t('setup.note')]));
    panel.append(options);

    // The other way to play: online.
    const others = el('div', 'start others');
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
      others.append(host, join);
    }
    if (others.childElementCount > 0) panel.append(el('h3', '', t('setup.others')), others);
    const start = el('div', 'start');
    const go = button(t('setup.start'), 'fire');
    go.addEventListener('click', () => {
      close();
      onStart(setup);
    });
    if (onCancel) {
      // On a phone held upright: an arrow back and a word (« ← Accueil »).
      const back = button('', 'back');
      back.title = t(cancelKey);
      back.append(
        el('span', 'arrow', '← '),
        el('span', 'long', t(cancelKey)),
        el('span', 'short', t(`${cancelKey}.short`)),
      );
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
