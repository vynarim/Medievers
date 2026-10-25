// Match setup screen (BACKLOG 3.6, greybox): rules scheme, Régicide, the houses and the class of
// each of their units (GDD §2.1, §3.2, §6). DOM over the canvas, like the rest of the UI.
import { CLASS_IDS, type ClassId } from '../content/classes.ts';
import { FACTIONS } from '../content/factions.ts';
import { MAX_HOUSES, MAX_UNITS, MIN_HOUSES, SCHEME_IDS } from '../content/schemes.ts';
import { MAP_THEMES } from '../content/maps.ts';
import {
  TURN_SECONDS,
  fixSetup,
  hasFriends,
  playersOf,
  DEFAULT_AI_LEVEL,
  type MatchSetup,
  type Player,
} from '../app/match-setup.ts';
import { AI_LEVEL_IDS, type AiLevelId } from '../content/ai.ts';
import { t } from './i18n.ts';
import { button, el, infoButton, shield, uiRoot } from './overlay.ts';
import { playerArt } from './player-art.ts';
import { icon, setIcon } from './icons.ts';
import { css } from './tokens.ts';

const STYLE = `
#ui .setup { width: min(1240px, calc(100vw - 32px)); max-width: calc(100vw - 32px); overflow-x: hidden; padding-top: 14px;
  padding-bottom: 16px; }
#ui .setup h2 { margin-bottom: 6px; }
#ui .setup h3 { margin: 10px 0 4px; }
#ui .setup .row { display: flex; gap: 8px; align-items: stretch; margin: 2px 0 4px; }
#ui .setup .scheme { text-align: left; flex: 1 1 0; min-width: 0; font-family: var(--text); font-size: 14px;
  line-height: 1.25; }
#ui .setup .scheme b { display: block; font-family: var(--caps); font-weight: normal; font-size: 18px;
  color: var(--lapis); }
/* The chosen one: a pale gilt and a vermilion frame, its text still easy to read. */
#ui .setup .scheme.on, #ui .setup .scheme.on:hover {
  background: color-mix(in srgb, var(--or) 35%, var(--ceruse));
  box-shadow: inset 0 0 0 2px var(--ceruse), inset 0 0 0 4px var(--vermillon); }
#ui .setup .scheme:hover { background: color-mix(in srgb, var(--or) 20%, var(--velin)); }
#ui .setup .scheme b .date { margin-left: 8px; font-family: var(--text); font-size: 14px;
  color: var(--vermillon); }
/* A heading with a small action beside it: « + Une maison ». */
#ui .setup .head { display: flex; align-items: center; gap: 12px; margin: 10px 0 4px; }
#ui .setup .head h3 { margin: 0; }
#ui .setup button.add-house { min-height: 32px; padding: 2px 10px; font-size: 14px; background: none;
  border: 2px dashed var(--brun); box-shadow: none; color: var(--brun); white-space: nowrap; }
#ui .setup button.add-house:hover:not(:disabled) { background: var(--velin); color: var(--encre); }
@media (pointer: coarse) { #ui .setup button.add-house { min-height: 48px; } }
/* A house: its name and who leads it, then its units, wrapping onto a second line when the
   screen is too narrow to hold them all. */
#ui .setup .house { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 5px 0;
  border-bottom: 1px solid var(--gilt); }
#ui .setup .house .name { font-family: var(--caps); font-size: 18px; flex: 0 1 230px; min-width: 0;
  display: flex; gap: 8px; align-items: center; white-space: nowrap; overflow: hidden; }
#ui .setup .house .units { display: flex; flex-wrap: wrap; gap: 6px; flex: 1 1 600px; min-width: 0; }
#ui .setup .house .unit { flex: 1 1 0; min-width: 88px; max-width: 200px; }
#ui .setup .house .unit select { width: 100%; min-width: 0; }
#ui .setup select { font: inherit; font-size: 16px; min-height: 48px; padding: 4px; pointer-events: auto;
  width: 118px; border: 2px solid var(--encre); border-radius: 4px; background: var(--ceruse);
  color: var(--encre); }
#ui .setup select.player { width: 196px; font-family: var(--caps); }
#ui .setup .player-pick { display: flex; align-items: center; gap: 6px; flex: none; }
#ui .setup .player-pick .face { flex: none; line-height: 0; position: relative; }
/* A friend's house: a mark on the face, an hourglass until they join, then a tick. */
#ui .setup .player-pick .face .seat { position: absolute; right: -6px; bottom: -4px; width: 20px;
  height: 20px; border-radius: 50%; border: 2px solid var(--encre); background: var(--ceruse);
  display: flex; align-items: center; justify-content: center; font-size: 12px; line-height: 1; }
#ui .setup .player-pick .face .seat.in { background: var(--vert); color: var(--ceruse); }
/* The match's code, top right, beside the title: whoever has it can join. */
#ui .setup .title { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 4px 16px; }
#ui .setup .title h2 { flex: 1 1 auto; }
#ui .setup .title .code { display: flex; align-items: center; gap: 8px; font-size: 15px;
  padding-top: 6px; }
#ui .setup .title .code b { font-family: var(--caps); font-weight: normal; font-size: 24px;
  letter-spacing: 3px; color: var(--lapis); user-select: text; -webkit-user-select: text; }
#ui .setup .title .code button { min-height: 32px; padding: 2px 10px; font-size: 14px; }
@media (pointer: coarse) { #ui .setup .title .code button { min-height: 48px; } }
#ui .error { color: var(--vermillon); font-weight: bold; }
/* A friend's house: what it is at, in place of its units. */
#ui .setup .house .units.friend { align-items: center; min-height: 48px; font-style: italic;
  font-size: 16px; }
#ui .setup .start .waiting { align-self: center; margin-right: auto; font-size: 15px; }
/* A unit: its class, and a small cross on the corner that takes it out. */
#ui .setup .unit { position: relative; flex: none; display: flex; }
#ui .setup button.unit-out { position: absolute; top: -7px; right: -7px; width: 22px; height: 22px;
  min-width: 22px; min-height: 22px; padding: 0; border-radius: 50%; color: var(--vermillon);
  background: var(--ceruse); border: 2px solid var(--vermillon); box-shadow: none; z-index: 1; }
#ui .setup button.unit-out .ico { width: 13px; height: 13px; }
#ui .setup button.unit-out::before { content: ''; position: absolute; inset: -12px; }
#ui .setup button.unit-out:hover { background: var(--vermillon); color: var(--ceruse); }
/* One more unit: an empty dashed slot. */
#ui .setup button.unit-add { flex: none; width: 48px; min-height: 48px; padding: 0; background: none;
  border: 2px dashed var(--brun); box-shadow: none; color: var(--brun); }
#ui .setup button.unit-add:hover { background: var(--velin); color: var(--encre); }
/* Régicide: a switch, its knob on the right when it is on. */
#ui .setup button.switch { display: inline-flex; align-items: center; gap: 10px; }
#ui .setup button.switch .track { position: relative; width: 40px; height: 22px; border-radius: 11px;
  border: 2px solid var(--encre); background: var(--ceruse); flex: none; }
#ui .setup button.switch .track i { position: absolute; top: 2px; left: 2px; width: 14px; height: 14px;
  border-radius: 50%; background: var(--brun); transition: left 0.15s; }
#ui .setup button.switch.on { background: var(--velin); }
#ui .setup button.switch.on .track { background: var(--vert); }
#ui .setup button.switch.on .track i { left: 20px; background: var(--ceruse); }
@media (pointer: coarse) {
  #ui .setup button.unit-out { width: 26px; height: 26px; min-width: 26px; min-height: 26px; }
}
#ui .setup .tools { display: flex; gap: 8px; align-items: center; margin-top: 8px; }
#ui .setup .tools button, #ui .setup .start button { white-space: nowrap; flex: none; }
#ui .setup .tools .note { flex: 1 1 auto; margin: 0 0 0 8px; font-size: 15px; }
#ui .setup > .note { margin: 6px 0 0; font-size: 15px; }
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
#ui.phone .setup .house { flex-wrap: wrap; padding: 8px 8px 8px 0; }
#ui.phone .setup .house > * { order: 2; }
#ui.phone .setup .house .name { order: 0; flex: 1 1 calc(100% - 60px); min-width: 0; }
#ui.phone .setup .house button.drop { order: 1; }
#ui.phone .setup .house .units { flex: 1 1 100%; flex-wrap: wrap; }
#ui.phone .setup .unit, #ui.phone .setup button.unit-add { flex: 1 1 30%; min-width: 0; }
#ui.phone .setup .unit select { flex: 1 1 auto; }
#ui.phone .setup select { flex: 1 1 30%; min-width: 0; width: auto; }
#ui.phone .setup .player-pick { flex: 1 1 100%; }
#ui.phone .setup select.player { flex: 1 1 auto; min-width: 0; width: auto; }
#ui.phone .setup .head { flex-wrap: wrap; }
#ui.phone .setup .title .code { flex: 1 1 100%; }
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
 * The room of a match (GDD §6), opened with the setup screen: its code to pass on to whoever
 * wants to join, the friends' seats and units as they come, then the start.
 */
export interface SetupLobby {
  /** the code to pass on; rejects when the room cannot be opened */
  readonly code: Promise<string>;
  /** `fn` hears of the seats taken (1 = the first friend's house, and so on) */
  onJoin(fn: (seats: ReadonlySet<number>) => void): void;
  /** `fn` hears of the units each friend chose for its house, by seat */
  onLineup(fn: (lineups: ReadonlyMap<number, readonly ClassId[]>) => void): void;
  /** starts the match with this setup */
  launch(setup: MatchSetup): void;
  /** the match will not be played here: the room goes */
  close(): void;
}

/**
 * Shows the setup screen, starting from `initial`; `onStart` receives the chosen setup and the
 * screen closes. Returns a function that closes it without starting.
 */
export function showSetupScreen(
  initial: MatchSetup,
  onStart: (setup: MatchSetup) => void,
  onCancel?: () => void,
  /** online matches (GDD §6): open a room for friends, or join one by its code */
  online?: { lobby: () => SetupLobby; join: () => void },
  /** i18n key of the button that calls onCancel: back to the match, or to the title */
  cancelKey = 'setup.cancel',
): () => void {
  const root = uiRoot();
  setupStyles();
  let setup = fixSetup(initial);
  const veil = el('div', 'veil');
  const panel = el('div', 'modal panel setup');
  // The room for friends: opened with the screen, kept while it is open; unused, it goes.
  let lobby: SetupLobby | null = null;
  let code: string | null = null;
  let codeFailed = false;
  let seated: ReadonlySet<number> = new Set();
  let friendLineups: ReadonlyMap<number, readonly ClassId[]> = new Map();
  const openLobby = (): void => {
    if (lobby || !online) return;
    const l = online.lobby();
    lobby = l;
    l.code.then(
      (c) => {
        code = c;
        render();
      },
      () => {
        codeFailed = true;
        render();
      },
    );
    l.onJoin((seats) => {
      seated = new Set(seats);
      // A friend who came with the code gets a house: the first of the AI's, else a new one.
      let next = setup;
      while (friendCountOf(next) < Math.max(0, ...seated)) {
        const players = playersOf(next);
        const ai = players.findIndex((p) => p !== 'human' && p !== 'friend');
        if (ai >= 0) {
          next = { ...next, players: players.map((p, k) => (k === ai ? 'friend' : p)) };
        } else if (next.lineups.length < MAX_HOUSES) {
          next = {
            ...next,
            lineups: [...next.lineups, next.lineups[0] ?? ['knight']],
            players: [...players, 'friend'],
          };
        } else {
          break;
        }
      }
      if (next !== setup) setup = withFriendLineups(fixSetup(next));
      render();
    });
    l.onLineup((chosen) => {
      friendLineups = new Map(chosen);
      setup = withFriendLineups(setup);
      render();
    });
  };
  /** The setup with each friend's house given the units its friend chose. */
  const withFriendLineups = (s: MatchSetup): MatchSetup => {
    // The k-th friend's house is seat k's (net/protocol.ts houseSeats).
    let seat = 0;
    const players = playersOf(s);
    const lineups = s.lineups.map((l, h) => {
      const chosen = players[h] === 'friend' ? friendLineups.get(++seat) : undefined;
      return chosen ? [...chosen] : [...l];
    });
    return fixSetup({ ...s, lineups });
  };
  const close = (): void => {
    veil.remove();
    panel.remove();
  };
  /** Leaves the screen without playing with friends: their room goes. */
  const dropLobby = (): void => {
    lobby?.close();
    lobby = null;
  };
  const update = (next: MatchSetup): void => {
    setup = withFriendLineups(fixSetup(next));
    render();
  };

  const render = (): void => {
    const friends = hasFriends(setup);
    openLobby();
    // The match's code, top right, always: whoever has it can join.
    const title = el('div', 'title');
    title.append(el('h2', '', t('setup.title')));
    if (online) {
      const box = el('div', 'code');
      if (code) {
        const shown = formatCode(code);
        const copy = button(t('online.copy'));
        copy.addEventListener('click', () => {
          void navigator.clipboard?.writeText(shown).then(() => {
            copy.textContent = t('pause.copied');
          });
        });
        box.append(el('span', '', t('setup.code')), el('b', '', shown), copy);
      } else if (codeFailed) {
        box.append(el('span', 'error', t('online.error.offline')));
      } else {
        box.append(el('span', '', t('online.creating')));
      }
      title.append(box);
    }
    panel.replaceChildren(title);

    // The map: a theme; its land, towers and rocks are drawn anew for each match.
    panel.append(el('h3', '', t('setup.map')));
    const maps = el('div', 'row');
    for (const theme of MAP_THEMES) {
      const b = button('', `scheme${setup.map === theme ? ' on' : ''}`);
      // The battle it recalls: its name and date, then a line of its story and its ground.
      const title = el('b', '', t(`maps.${theme}`));
      title.append(el('small', 'date', t(`maps.${theme}.date`)));
      b.append(
        title,
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

    // The houses, and beside their heading, a small « + Une maison ».
    const head = el('div', 'head');
    const addHouse = button(t('setup.houseMore'), 'add-house');
    addHouse.disabled = setup.lineups.length >= MAX_HOUSES;
    addHouse.addEventListener('click', () =>
      update({ ...setup, lineups: [...setup.lineups, setup.lineups[0] ?? ['knight']] }),
    );
    head.append(
      el('h3', '', t('setup.houses')),
      addHouse,
      infoButton(() => [t('setup.note.houses')]),
    );
    panel.append(head);
    let friend = 0;
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
      // A friend only where online play is offered.
      const choices: Player[] = online ? ['human', 'friend', ...AI_LEVEL_IDS] : ['human', ...AI_LEVEL_IDS];
      for (const id of choices) {
        // The AI's levels go from the easiest to the hardest: one to three stars.
        const k = AI_LEVEL_IDS.indexOf(id as AiLevelId);
        const stars =
          k < 0 ? '' : ` ${'★'.repeat(k + 1)}${'☆'.repeat(AI_LEVEL_IDS.length - k - 1)}`;
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
      // Beside it, who that is: the village idiot (you, or a friend) or a helm of rivets (the AI).
      const face = el('span', 'face');
      const person = players[h] === 'human' || players[h] === 'friend';
      face.innerHTML = playerArt(person ? 'human' : 'ai');
      if (players[h] === 'friend') {
        // A friend's house: an hourglass until they have joined, then a tick.
        const isIn = seated.has(++friend);
        const mark = el('span', isIn ? 'seat in' : 'seat', isIn ? '✓' : '⌛');
        face.title = t(isIn ? 'setup.friendIn' : 'setup.friendWaited');
        face.append(mark);
      }
      const pick = el('div', 'player-pick');
      pick.append(face, who);
      row.append(pick);
      const setLineup = (next: ClassId[]): void => {
        const lineups = setup.lineups.map((l, k) => (k === h ? next : [...l]));
        update({ ...setup, lineups });
      };
      if (players[h] === 'friend') {
        // A friend's house: the friend chooses its units on its own device.
        row.append(friendUnits(friendLineups.get(friend) ?? null, seated.has(friend), code));
      } else {
        row.append(lineupPicker(lineup, setLineup));
      }
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
    // Régicide, yes or no: a switch, read at a glance.
    const regicide = button('', setup.regicide ? 'switch on' : 'switch');
    regicide.setAttribute('role', 'switch');
    regicide.setAttribute('aria-checked', String(setup.regicide));
    const knob = el('span', 'track');
    knob.append(el('i'));
    regicide.append(knob, el('span', 'label', t('setup.regicide')));
    regicide.title = t('setup.regicide.tip');
    regicide.addEventListener('click', () => update({ ...setup, regicide: !setup.regicide }));
    // The turn's length: each click offers the next one.
    const seconds = setup.turnSeconds ?? TURN_SECONDS[0] ?? 45;
    const turnLength = setIcon(button(''), 'hourglass', t('setup.turnSeconds', { s: seconds }));
    turnLength.append(icon('next'));
    turnLength.title = t('setup.turnSeconds.tip');
    turnLength.addEventListener('click', () => {
      const i = TURN_SECONDS.indexOf(seconds);
      update({ ...setup, turnSeconds: TURN_SECONDS[(i + 1) % TURN_SECONDS.length] ?? seconds });
    });
    panel.append(el('p', 'note ambient', t('setup.note.houses')));

    // How the match runs, apart from who fights it.
    panel.append(el('h3', '', t('setup.options')));
    const options = el('div', 'tools');
    options.append(
      regicide,
      turnLength,
      el('p', 'note ambient', t('setup.note.regicide')),
      infoButton(() => [t('setup.note.regicide')]),
    );
    panel.append(options);

    // The other way to play: online.
    // The other way in: a friend's match, by its code. (Inviting friends is done above, by
    // giving them a house.)
    const others = el('div', 'start others');
    if (online) {
      const join = button(t('setup.onlineJoin'));
      join.title = t('setup.onlineJoinTip');
      join.addEventListener('click', () => {
        dropLobby();
        close();
        online.join();
      });
      others.append(join, el('p', 'note ambient', t('setup.note.friends')));
    }
    if (others.childElementCount > 0) panel.append(el('h3', '', t('setup.others')), others);
    const start = el('div', 'start');
    const go = button(t('setup.start'), 'fire');
    // With friends, the battle waits until each has joined.
    const awaited = friends ? Math.max(0, friendCountOf(setup) - countSeated(seated, setup)) : 0;
    go.disabled = friends && (!code || awaited > 0);
    if (friends && code && awaited > 0) {
      start.append(el('span', 'waiting', t('setup.awaiting', { n: awaited })));
    }
    go.addEventListener('click', () => {
      close();
      if (friends && lobby) {
        const l = lobby;
        lobby = null;
        l.launch(setup);
        return;
      }
      dropLobby();
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
        dropLobby();
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
  return () => {
    dropLobby();
    close();
  };
}

/** The houses given to friends. */
const friendCountOf = (s: MatchSetup): number => playersOf(s).filter((p) => p === 'friend').length;

/** The friends' houses whose friend has joined: seats 1 to their number. */
function countSeated(seated: ReadonlySet<number>, s: MatchSetup): number {
  let n = 0;
  for (let k = 1; k <= friendCountOf(s); k++) if (seated.has(k)) n++;
  return n;
}

/** The units of a house, each chosen in a list; a cross takes one out, a dashed slot adds one. */
export function lineupPicker(
  lineup: readonly ClassId[],
  setLineup: (next: ClassId[]) => void,
): HTMLElement {
  const units = el('div', 'units');
  lineup.forEach((cls, u) => {
    const slot = el('div', 'unit');
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
    slot.append(select);
    // This one leaves the house: a small cross on its corner, while it is not alone.
    if (lineup.length > 1) {
      const out = setIcon(button('', 'unit-out'), 'close');
      out.title = t('setup.unitOut', { n: u + 1 });
      out.addEventListener('click', () => setLineup(lineup.filter((_, k) => k !== u)));
      slot.append(out);
    }
    units.append(slot);
  });
  // One more: an empty dashed slot, while the house has room.
  if (lineup.length < MAX_UNITS) {
    const more = setIcon(button('', 'unit-add'), 'newMatch');
    more.title = t('setup.unitMore');
    more.addEventListener('click', () => setLineup([...lineup, 'knight']));
    units.append(more);
  }
  return units;
}

/**
 * A friend's house: not its units, which the friend chooses on its device, but where it is at:
 * the code to pass on while the friend is awaited, then the units it chose.
 */
function friendUnits(
  chosen: readonly ClassId[] | null,
  isIn: boolean,
  code: string | null,
): HTMLElement {
  const box = el('div', 'units friend');
  if (!isIn) {
    box.append(
      el('span', '', code ? t('setup.friendCode', { code: formatCode(code) }) : t('online.creating')),
    );
  } else if (!chosen) {
    box.append(el('span', '', t('setup.friendChoosing')));
  } else {
    box.append(el('span', '', chosen.map((c) => t(`classes.${c}`)).join(' · ')));
  }
  return box;
}

/** The code as shown: XXX-XXX. */
const formatCode = (code: string): string => `${code.slice(0, 3)}-${code.slice(3)}`;

/** Injects the setup screen's styles, also used by the friend's own choice of units. */
export function setupStyles(): void {
  if (styled) return;
  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.appendChild(style);
  styled = true;
}
