// Title screen (BACKLOG 7.4): the game's name as an illuminated incipit, a gilt initial on lapis
// and the rest in textura, framed in vermilion and gold fillets. DOM over the canvas.
import { t } from './i18n.ts';
import { button, el, uiRoot } from './overlay.ts';
import { renderTutorial } from './tutorial.ts';

const STYLE = `
#ui .title-screen { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  pointer-events: auto; background:
    radial-gradient(ellipse at 50% 45%, rgba(233, 220, 192, 0.10) 0%, rgba(26, 20, 16, 0) 60%), #1a1410; }
#ui .title-screen .folio { position: relative; width: min(760px, calc(100vw - 32px)); padding: 44px 48px 36px;
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
#ui .title-screen .actions { justify-content: center; }
#ui .title-screen .actions button { min-width: 220px; font-size: 20px; }
#ui .title-screen .colophon { margin-top: 22px; font-size: 13px; color: var(--brun); }
#ui .title-screen .author { margin-top: 8px; text-align: right; font-family: var(--caps);
  font-size: 12px; color: var(--brun); }
#ui .title-screen .colophon a, #ui .title-screen .author a { color: var(--lapis); pointer-events: auto; user-select: text; }
`;

let styled = false;

const AUTHOR = 'vynarim';
const AUTHOR_URL = 'https://github.com/vynarim';
const YEAR = 2026;
const BIBLE_URL = 'https://fr.wikipedia.org/wiki/Bible_de_Maciejowski';

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
  const close = (then: () => void): void => {
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
  const colophon = el('div', 'colophon');
  const [before = '', after = ''] = t('title.colophon').split('{bible}');
  const bible = el('a', '', t('title.bible'));
  bible.href = BIBLE_URL;
  bible.target = '_blank';
  bible.rel = 'noopener';
  colophon.append(before, bible, after);
  // « Un jeu de vynarim », the name linking to the author's GitHub.
  const author = el('div', 'author');
  const link = el('a', '', AUTHOR);
  link.href = AUTHOR_URL;
  link.target = '_blank';
  link.rel = 'noopener';
  author.append(t('title.by'), ' ', link, `, ${YEAR}`);
  const actions = el('div', 'actions');
  const resume = choices.resume;
  if (resume) {
    const again = button(t('title.resume'), 'fire');
    again.addEventListener('click', () => close(resume));
    actions.append(again);
  }
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
  actions.append(enter, join, help);
  folio.append(
    title,
    el('div', 'rule'),
    el('div', 'sub', t('title.sub')),
    el('div', 'quip', t('title.quip')),
    actions,
    colophon,
    author,
  );
  screen.append(folio);
  root.append(screen);
}
