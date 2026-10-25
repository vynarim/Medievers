// Title screen (BACKLOG 7.4): the game's name as an illuminated incipit, a gilt initial on lapis
// and the rest in textura, framed in vermilion and gold fillets. DOM over the canvas.
import { t } from './i18n.ts';
import { button, el, infoButton, uiRoot } from './overlay.ts';
import { renderTutorial } from './tutorial.ts';
import { declineInstall, installOffer, onInstallable, promptInstall } from '../app/install.ts';

/** share of the window's width the title page takes, and how far it may grow */
const TITLE_SHARE = 0.42;
const TITLE_MAX_SCALE = 1.26;

const STYLE = `
#ui .title-screen { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  pointer-events: auto; background:
    radial-gradient(ellipse at 50% 45%, rgba(233, 220, 192, 0.10) 0%, rgba(26, 20, 16, 0) 60%), #1a1410; }
#ui .title-screen .folio { position: relative; width: min(760px, calc(100vw - 32px)); padding: 44px 48px 64px;
  text-align: center; background: radial-gradient(ellipse at 50% 40%, var(--ceruse) 50%, var(--velin) 100%);
  border: 3px solid var(--encre); box-shadow: inset 0 0 0 6px var(--ceruse), inset 0 0 0 9px var(--or),
  inset 0 0 0 12px var(--ceruse), inset 0 0 0 14px var(--vermillon), 0 10px 40px rgba(0, 0, 0, 0.6); }
#ui .title-screen .name { display: flex; align-items: flex-end; justify-content: center; gap: 4px;
  font-family: var(--title); font-size: clamp(54px, 11vw, 112px); line-height: 0.9; color: var(--vermillon); }
#ui .title-screen .initial { display: inline-flex; align-items: center; justify-content: center;
  width: 1.3em; height: 1.22em; color: var(--or); background: var(--lapis); border: 3px solid var(--encre);
  box-shadow: inset 0 0 0 3px var(--or), inset 0 0 0 5px var(--lapis), inset 0 0 0 6px var(--ceruse);
  font-size: 1em; line-height: 1; padding-top: 0.08em; margin-right: 0.08em; }
#ui .title-screen .last { color: var(--lapis); }
#ui .title-screen .rule { height: 0; margin: 18px auto 14px; width: 70%; border-top: 2px solid var(--vermillon);
  box-shadow: 0 3px 0 -1px var(--or); }
#ui .title-screen .sub { font-family: var(--caps); font-size: clamp(18px, 3vw, 26px); color: var(--lapis); }
#ui .title-screen .quip { font-size: 17px; font-style: italic; margin: 10px 0 24px; color: var(--brun); }
#ui .title-screen .actions { flex-direction: column; align-items: center; gap: 8px; }
#ui .title-screen .actions-row { display: flex; gap: 8px; justify-content: center; }
#ui .title-screen .actions button { width: 260px; font-size: 20px; }
#ui .title-screen .colophon { margin-top: 22px; font-size: 15px; color: var(--brun); }
#ui .title-screen .author, #ui .title-screen .version { position: absolute; bottom: 26px;
  font-family: var(--caps); font-size: 14px; color: var(--brun); }
#ui .title-screen .author { right: 34px; }
#ui .title-screen .version { left: 34px; user-select: text; pointer-events: auto; }
#ui .title-screen .colophon a, #ui .title-screen .author a { color: var(--lapis); pointer-events: auto; user-select: text; }
/* On a phone held upright: one button per row, the quip and the colophon behind a « ? ». */
/* The name on top, the buttons in the middle, the credits at the foot. */
#ui .title-screen .install { margin: 8px auto 0; padding: 12px 16px 14px; max-width: 420px;
  text-align: center; }
#ui .title-screen .install b { font-family: var(--caps); font-weight: normal; font-size: 20px;
  color: var(--lapis); }
#ui .title-screen .install p { margin: 6px 0 0; font-size: 16px; line-height: 1.35; }
#ui .title-screen .install .actions { margin-top: 10px; flex-direction: row; gap: 8px; }
#ui .title-screen .install .actions button { width: auto; min-width: 120px; min-height: 48px; }
#ui.phone .title-screen .folio { width: 100%; height: 100%; padding: 56px 26px 34px; display: flex;
  flex-direction: column; overflow-y: auto; }
#ui.phone .title-screen .name { font-size: min(54px, 12vw); }
#ui.phone .title-screen .initial { flex: none; width: 1.5em; }
#ui.phone .title-screen .actions { margin: auto 0; padding: 24px 0; gap: 16px; }
#ui.phone .title-screen .actions-row { flex-direction: column; gap: 16px; }
#ui.phone .title-screen .actions button { width: min(280px, calc(100vw - 96px)); min-height: 58px; }
#ui.phone .title-screen .author, #ui.phone .title-screen .version { position: static; margin-top: 14px; }
#ui.phone .title-screen .version { margin-top: 4px; }
`;

let styled = false;

const AUTHOR = 'vynarim';
const AUTHOR_URL = 'https://github.com/vynarim';
const YEAR = 2026;
const BIBLE_URL = 'https://fr.wikipedia.org/wiki/Bible_de_Maciejowski';
const BAYEUX_URL = 'https://fr.wikipedia.org/wiki/Tapisserie_de_Bayeux';

export interface TitleChoices {
  /** a match in progress (saved, online, or the one paused behind): take it up again */
  readonly resume?: () => void;
  /** to the setup screen, for a new match */
  readonly enter: () => void;
  /** to the code of a match created by someone else */
  readonly join: () => void;
}

/** Shows the title; each choice closes it first. Enter picks the first button. */
export function showTitleScreen(choices: TitleChoices): void {
  if (!styled) {
    const style = document.createElement('style');
    style.textContent = STYLE;
    document.head.appendChild(style);
    styled = true;
  }
  const root = uiRoot();
  const screen = el('div', 'title-screen');
  const folio = el('div', 'folio');
  const name = t('game.title');
  const title = el('div', 'name');
  title.append(el('span', 'initial', name.slice(0, 1)), el('span', '', name.slice(1, -1)));
  title.append(el('span', 'last', name.slice(-1)));
  // About half the screen: the folio grows with the window, up to half again its size.
  const fit = (): void => {
    folio.style.transform = '';
    const w = folio.offsetWidth;
    const h = folio.offsetHeight;
    if (w === 0 || h === 0) return;
    const k = Math.min(
      TITLE_MAX_SCALE,
      Math.max(1, Math.min((TITLE_SHARE * window.innerWidth) / w, (0.85 * window.innerHeight) / h)),
    );
    folio.style.transform = k > 1 ? `scale(${k.toFixed(3)})` : '';
  };
  const close = (then: () => void): void => {
    stopInstall();
    window.removeEventListener('resize', fit);
    window.removeEventListener('keydown', onKey, true);
    screen.remove();
    then();
  };
  const first = choices.resume ?? choices.enter;
  let helpOpen = false;
  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Enter' || helpOpen) return;
    e.stopPropagation();
    close(first);
  };
  window.addEventListener('keydown', onKey, true);
  // The manuscript named in the colophon links to its Wikipedia article.
  const colophon = el('div', 'colophon ambient');
  // The two works the art follows, each linked to its Wikipedia page.
  const links: Record<string, [string, string]> = {
    bible: [t('title.bible'), BIBLE_URL],
    bayeux: [t('title.bayeux'), BAYEUX_URL],
  };
  for (const part of t('title.colophon').split(/(\{\w+\})/)) {
    const link = links[part.slice(1, -1)];
    if (!link) {
      colophon.append(part);
      continue;
    }
    const a = el('a', '', link[0]);
    a.href = link[1];
    a.target = '_blank';
    a.rel = 'noopener';
    colophon.append(a);
  }
  // « Un jeu de vynarim », the name linking to the author's GitHub.
  const author = el('div', 'author');
  const link = el('a', '', AUTHOR);
  link.href = AUTHOR_URL;
  link.target = '_blank';
  link.rel = 'noopener';
  author.append(t('title.by'), ' ', link, `, ${YEAR}`);
  author.append(infoButton(() => [...colophon.cloneNode(true).childNodes]));
  // The version built: its commit and day, « dev » on the local server.
  const env = import.meta.env as Record<string, string | boolean | undefined> | undefined;
  const commit = String(env?.VITE_COMMIT ?? '');
  const day = String(env?.VITE_COMMIT_DATE ?? '');
  const version = el(
    'div',
    'version',
    commit === ''
      ? t('title.versionUnknown')
      : t(env?.VITE_DEV === true ? 'title.versionDev' : 'title.version', { v: commit, day }),
  );
  // Two rows: a new match and the help on the first, the match in progress and joining one
  // under them.
  const sub = el('div', 'sub', t('title.sub'));
  sub.append(infoButton(() => [t('title.quip')]));
  const actions = el('div', 'actions');
  const top = el('div', 'actions-row');
  const bottom = el('div', 'actions-row');
  const resume = choices.resume;
  const enter = button(t('title.enter'), resume ? '' : 'fire');
  enter.addEventListener('click', () => close(choices.enter));
  const join = button(t('setup.onlineJoin'));
  join.addEventListener('click', () => close(choices.join));
  // The illustrated tutorial, straight from the title, over it.
  const help = button(t('title.help'));
  help.addEventListener('click', () => {
    const veil = el('div', 'veil');
    const panel = el('div', 'modal panel help');
    helpOpen = true;
    const shut = (): void => {
      helpOpen = false;
      veil.remove();
      panel.remove();
    };
    veil.addEventListener('pointerdown', shut);
    renderTutorial(panel, shut);
    root.append(veil, panel);
  });
  top.append(enter, help);
  if (resume) {
    const again = button(t('title.resume'), 'fire');
    again.addEventListener('click', () => close(resume));
    bottom.append(again);
  }
  bottom.append(join);
  actions.append(top, bottom);
  folio.append(
    title,
    el('div', 'rule'),
    sub,
    el('div', 'quip ambient', t('title.quip')),
    actions,
    colophon,
    author,
    version,
  );
  // The first time on a phone: install the game as an app (PWA).
  let card: HTMLElement | null = null;
  const offer = (): void => {
    const kind = installOffer();
    if (!kind || card) return;
    card = el('div', 'install panel');
    const shut = (): void => {
      card?.remove();
      fit();
    };
    const buttons = el('div', 'actions');
    if (kind === 'prompt') {
      const yes = button(t('install.yes'), 'fire');
      yes.addEventListener('click', () => {
        shut();
        void promptInstall();
      });
      const later = button(t('install.later'));
      later.addEventListener('click', () => {
        declineInstall();
        shut();
      });
      buttons.append(yes, later);
    } else {
      const ok = button(t('install.ok'));
      ok.addEventListener('click', () => {
        declineInstall();
        shut();
      });
      buttons.append(ok);
    }
    card.append(
      el('b', '', t('install.title')),
      el('p', '', t(kind === 'prompt' ? 'install.text' : 'install.ios')),
      buttons,
    );
    actions.after(card);
    fit();
  };
  const stopInstall = onInstallable(offer);
  offer();
  screen.append(folio);
  root.append(screen);
  fit();
  window.addEventListener('resize', fit);
}
