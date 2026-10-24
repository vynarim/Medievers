// DOM layer above the game canvas: shared styles (palette tokens) and small element helpers.
// Buttons never take keyboard focus, so the keyboard keeps driving the game.
import { FONT_CAPS, FONT_TEXT, FONT_TITLE } from './fonts.ts';
import { COLORS, css } from './tokens.ts';
import { scalableCss, uiScale } from './ui-scale.ts';

const STYLE = `
:root {
  --u: 1px; /* set from the window size by uiRoot() */
  --lapis: ${css(COLORS.lapis)}; --vermillon: ${css(COLORS.vermillon)}; --or: ${css(COLORS.or)};
  --ceruse: ${css(COLORS.ceruse)}; --velin: ${css(COLORS.velin)}; --encre: ${css(COLORS.encre)};
  --ocre: ${css(COLORS.ocre)}; --vert: ${css(COLORS.vertDeGris)}; --brun: ${css(COLORS.terreOmbre)};
  --azur: ${css(COLORS.azur)};
  --title: ${FONT_TITLE}; --text: ${FONT_TEXT}; --caps: ${FONT_CAPS};
  --shade: rgba(42, 29, 20, 0.45); --gilt: rgba(212, 169, 60, 0.7);
  --frame: inset 0 0 0 3px var(--ceruse), inset 0 0 0 5px var(--or);
  --lift: 0 6px 18px var(--shade);
  /* every side panel has this width, so the columns line up */
  --col: 300px;
}
#ui, #ui * { box-sizing: border-box; }
#ui { position: fixed; inset: 0; pointer-events: none; font-family: var(--text);
  color: var(--encre); user-select: none; -webkit-user-select: none; z-index: 10; }
/* Parchment panel: vellum, ink border, gilt fillet inside (ASSETS §1.1: cernes, gold). */
#ui .panel { pointer-events: auto;
  background: radial-gradient(ellipse at 50% 40%, var(--ceruse) 55%, var(--velin) 100%);
  border: 3px solid var(--encre); border-radius: 3px; box-shadow: var(--frame), var(--lift); }
#ui button { pointer-events: auto; min-width: 48px; min-height: 48px; padding: 6px 12px;
  font-family: var(--caps); font-size: 18px; color: var(--encre); background: var(--velin);
  border: 2px solid var(--encre); border-radius: 4px; cursor: pointer; touch-action: none;
  box-shadow: inset 0 0 0 2px var(--ceruse), inset 0 0 0 3px var(--gilt); line-height: 1.1; }
#ui button:hover { background: var(--or); }
#ui button:active, #ui button.on { background: var(--or); transform: translateY(1px); }
#ui button:disabled { opacity: 0.4; cursor: default; background: var(--velin); transform: none; }
/* Speech bubble over a map object: anchored by its tail, which points at the object. */
#ui .bubble { position: absolute; transform: translate(-50%, calc(-100% - 18px)); width: max-content;
  max-width: min(320px, calc(100vw - 24px)); padding: 8px 14px 10px; font-size: 16px; line-height: 1.35;
  border-radius: 14px; text-align: center; cursor: pointer; }
#ui .bubble b { display: block; font-family: var(--caps); font-weight: normal; font-size: 19px;
  color: var(--vermillon); margin-bottom: 2px; }
#ui .bubble::after { content: ''; position: absolute; left: 50%; bottom: -16px; margin-left: -10px;
  border: 10px solid transparent; border-top: 16px solid var(--encre); border-bottom: 0; }
/* Replay viewer: its own bar replaces the action bar. */
#ui.replaying .bar:not(.replay-bar), #ui.replaying .hud-weapon { display: none; }
#ui .replay-bar .replay-title { font-family: var(--caps); font-size: 18px; color: var(--vermillon);
  padding: 0 8px; }
/* Tiny help bubble over a unit that cannot take the turn (selected but resting). */
#ui .tip { position: absolute; transform: translate(-50%, calc(-100% - 10px)); width: max-content;
  max-width: min(220px, calc(100vw - 24px)); padding: 3px 9px 4px; font-size: 13px; line-height: 1.25;
  border-radius: 9px; text-align: center; pointer-events: none; }
#ui .tip::after { content: ''; position: absolute; left: 50%; bottom: -9px; margin-left: -6px;
  border: 6px solid transparent; border-top: 9px solid var(--encre); border-bottom: 0; }
#ui .tabs { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 12px; }
#ui .tabs button { min-height: 40px; font-size: 16px; }
#ui button.icon { font-family: var(--text); font-size: 26px; min-width: 52px; padding: 2px 8px; }
#ui button.fire { background: var(--vermillon); color: var(--ceruse); min-width: 96px; font-size: 20px; }
#ui button.fire:hover, #ui button.fire.on { background: var(--vermillon); filter: brightness(1.15); }
#ui .bar { position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%); display: flex;
  gap: 10px; align-items: center; padding: 8px 10px; width: max-content; max-width: calc(100vw - 24px);
  flex-wrap: wrap; justify-content: center; }
#ui .bar .group { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; justify-content: center; }
#ui .bar .sep { width: 2px; align-self: stretch; background: var(--or); box-shadow: 1px 0 0 var(--encre); }
#ui button:disabled { filter: grayscale(1); }
#ui .fuses { display: flex; gap: 4px; align-items: center; font-family: var(--caps); }
#ui .sys { position: absolute; top: 12px; right: 12px; display: flex; gap: 6px; }
#ui .pause-code { display: flex; align-items: center; justify-content: center; gap: 12px;
  margin: 0 0 12px; font-size: 18px; }
#ui .pause-code b { font-family: var(--caps); font-size: 26px; letter-spacing: 2px; }

/* HUD */
#ui .shield { flex: none; width: 40px; height: 48px; border: 3px solid var(--encre);
  border-radius: 0 0 50% 50% / 0 0 62% 62%; position: relative; overflow: hidden; background: var(--p); }
#ui .shield::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 32%;
  background: var(--s); border-bottom: 2px solid var(--encre); }
#ui .shield.small { width: 22px; height: 27px; border-width: 2px; }
/* The bands grow to the longest house name, all to the same width. */
#ui .hud-teams { position: absolute; top: 12px; left: 12px; display: flex; flex-direction: column; gap: 6px;
  width: max-content; max-width: 46vw; }
#ui .team { display: flex; align-items: center; gap: 8px; padding: 4px 12px 4px 6px;
  font-family: var(--caps); font-size: 16px; min-width: calc(var(--col) + 40px); }
#ui .team .name { flex: 1 1 auto; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#ui .team .hp { flex: none; width: 64px; height: 10px; border: 2px solid var(--encre); background: var(--velin); }
#ui .team .hp i { display: block; height: 100%; background: var(--p); }
#ui .team.out { opacity: 0.45; text-decoration: line-through; }
/* The house whose turn it is: its frame glows in its colour, pulsing. */
#ui .team.playing { border-color: var(--p); animation: team-glow 1.6s ease-in-out infinite; }
@keyframes team-glow {
  0%, 100% { box-shadow: var(--frame), var(--lift), 0 0 6px 2px var(--p); }
  50% { box-shadow: var(--frame), var(--lift), 0 0 22px 9px var(--p); }
}
/* Without animations (a system setting), the glow stays, at its brightest. */
@media (prefers-reduced-motion: reduce) {
  #ui .team.playing { animation: none; box-shadow: var(--frame), var(--lift), 0 0 18px 7px var(--p); }
}
/* Title cartouche: the game's name, with a compact wind gauge under it. */
/* The game's title, large, with the wind on its right in the same frame. */
#ui .hud-wind { position: absolute; top: 12px; left: 50%; transform: translateX(-50%);
  padding: 4px 18px 6px; display: flex; align-items: center; gap: 18px; }
#ui .hud-wind .game-title { font-family: var(--title); font-size: 46px; line-height: 1;
  color: var(--vermillon); white-space: nowrap; }
#ui .hud-wind .game-title::first-letter, #ui .hud-wind .game-title .last { color: var(--lapis); }
#ui .hud-wind .wind-row, #ui .hud-wind .turn-row { display: flex; flex-direction: column;
  align-items: stretch; gap: 4px; width: 132px; padding-left: 16px; border-left: 2px solid var(--gilt); }
#ui .hud-wind .turn-row { width: auto; min-width: 110px; justify-content: center; }
#ui .hud-wind .turn { font-family: var(--title); font-size: 34px; line-height: 1; white-space: nowrap; }
#ui .hud-wind .label { font-family: var(--caps); font-size: 15px; white-space: nowrap;
  text-align: left; }
#ui .hud-wind .track { position: relative; height: 9px; border: 2px solid var(--encre);
  background: var(--velin); }
#ui .hud-wind .track::after { content: ''; position: absolute; left: 50%; top: -4px; bottom: -4px;
  width: 2px; background: var(--encre); }
#ui .hud-wind .fill { position: absolute; top: 0; bottom: 0; background: var(--azur); }
#ui .hud-timer { position: absolute; top: 76px; right: 12px; width: 92px; height: 92px;
  border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; }
#ui .hud-timer .glass { font-size: 18px; line-height: 1; }
#ui .hud-timer .secs { font-family: var(--title); font-size: 38px; line-height: 1; }
#ui .hud-timer.hurry .secs { color: var(--vermillon); }
#ui .hud-timer.idle { opacity: 0.5; }
#ui .hud-weapon { position: absolute; right: 12px; bottom: 96px; padding: 6px 16px 8px; width: var(--col);
  text-align: center; }
#ui .hud-weapon .name { font-family: var(--caps); font-size: 19px; }
#ui .hud-weapon .power { height: 12px; margin: 4px 0 2px; border: 2px solid var(--encre); background: var(--velin); }
#ui .hud-weapon .power i { display: block; height: 100%; background: var(--vermillon); }
#ui .hud-weapon .hint { font-size: 14px; }
/* Phylactery, the speech scroll of the marginal figures: the running commentary. */
#ui .chronicles { position: absolute; top: 96px; left: 50%; transform: translateX(-50%);
  display: flex; flex-direction: column; align-items: center; gap: 6px; pointer-events: none; }
#ui .chronicle { width: max-content; max-width: min(620px, calc(100vw - 620px)); min-width: 240px; padding: 6px 26px;
  text-align: center; font-size: 19px; line-height: 1.3; background: var(--ceruse);
  border: 2px solid var(--encre); border-radius: 18px / 50%;
  box-shadow: inset 0 0 0 3px var(--ceruse), inset 0 0 0 4px var(--or), var(--lift);
  transition: opacity 0.6s; }
#ui .faded { opacity: 0; }
#ui .banner { position: absolute; left: 50%; top: 32%; transform: translate(-50%, -50%);
  padding: 18px 36px 20px; text-align: center; width: max-content; max-width: min(760px, calc(100vw - 48px));
  transition: opacity 0.5s; pointer-events: none; }
#ui .banner .big { font-family: var(--title); font-size: 54px; line-height: 1.1; }
#ui .banner .sub { font-family: var(--caps); font-size: 22px; margin-top: 4px; }
#ui .banner .quip { font-size: 20px; margin-top: 10px; }
#ui .banner button { margin-top: 14px; pointer-events: auto; }

/* Modals */
#ui .veil { position: absolute; inset: 0; background: var(--shade); pointer-events: auto; }
#ui .modal { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  max-width: min(780px, calc(100vw - 32px)); max-height: calc(100vh - 48px); overflow: auto;
  padding: 20px 28px 22px; }
#ui h2 { margin: 0 0 12px; padding-bottom: 6px; color: var(--lapis); font-family: var(--title);
  font-weight: normal; font-size: 36px; line-height: 1.1;
  border-bottom: 2px solid var(--vermillon); box-shadow: 0 3px 0 -1px var(--or); }
#ui h2::first-letter { color: var(--vermillon); font-size: 1.35em; }
#ui h3 { margin: 16px 0 6px; color: var(--vermillon); font-family: var(--caps); font-weight: normal;
  font-size: 20px; }
#ui .close { float: right; margin-left: 12px; }
#ui .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 10px; }
#ui .weapon { text-align: left; display: block; width: 100%; padding: 10px 12px; font-family: var(--text); }
#ui .weapon b { display: block; font-family: var(--caps); font-weight: normal; font-size: 20px;
  margin-bottom: 4px; color: var(--lapis); }
#ui .weapon small { display: block; font-size: 15px; line-height: 1.35; }
#ui .weapon.on { box-shadow: inset 0 0 0 3px var(--vermillon); }
#ui .weapon .art { float: right; margin: 0 0 4px 8px; line-height: 0; }
#ui .weapon:disabled .art { filter: grayscale(1); }
#ui .card { position: absolute; right: 12px; top: 182px; width: var(--col);
  max-height: calc(100vh - 290px); overflow: auto; padding: 14px 18px; font-size: 16px; line-height: 1.4; }
#ui .card.left { right: auto; left: 12px; top: 250px; max-height: calc(100vh - 358px); }
#ui .card h2 { font-size: 30px; margin-bottom: 4px; }
#ui .card .house { font-family: var(--caps); font-size: 18px; margin-bottom: 8px; display: flex;
  gap: 8px; align-items: center; }
#ui .card .hpbar { height: 12px; border: 2px solid var(--encre); background: var(--velin); margin: 2px 0 8px; }
#ui .card .hpbar i { display: block; height: 100%; background: var(--vert); }
#ui .card ul { margin: 4px 0; padding-left: 18px; }
#ui .card h3 { margin-top: 10px; font-size: 18px; }
#ui table { border-collapse: collapse; width: 100%; font-size: 16px; table-layout: fixed; }
#ui td:nth-child(1) { width: 52%; } #ui td:nth-child(2) { width: 100px; } #ui td:nth-child(3) { width: 22%; }
#ui td { padding: 3px 4px; border-bottom: 1px solid var(--gilt); vertical-align: middle; }
#ui td input { width: 84px; font: inherit; padding: 4px; border: 2px solid var(--encre); border-radius: 3px;
  background: var(--ceruse); }
#ui td.unit, #ui td.def { color: var(--brun); font-size: 13px; white-space: nowrap; }
#ui .note { font-size: 16px; margin: 0 0 6px; }
#ui .actions { display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
/* The help keeps one size on every page, so its buttons never move under the finger. */
#ui .help { width: min(640px, calc(100vw - 32px)); height: min(680px, calc(100vh - 48px));
  display: flex; flex-direction: column; overflow: hidden; }
#ui .help .tuto-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; }
#ui .help .tuto-body p:last-child { margin-bottom: 0; }
#ui .help .close { position: absolute; top: 18px; right: 24px; margin: 0; }
#ui .help h2 { padding-right: 64px; flex: none; }
#ui .help .tuto-pic { flex: none; }
#ui .tuto-pic svg { display: block; width: 100%; max-height: 32vh; margin: 0 auto 10px;
  border: 2px solid var(--encre); box-shadow: inset 0 0 0 2px var(--or); }
#ui .tuto-nav { display: flex; justify-content: space-between; align-items: center; margin-top: 12px;
  flex: none; }
#ui .tuto-count { font-family: var(--caps); font-size: 16px; }
#ui .help p, #ui .pause p { font-size: 17px; line-height: 1.5; margin: 0 0 10px; }
#ui .pause { min-width: 360px; text-align: center; }
#ui .pause .actions { flex-direction: column; align-items: stretch; }
#ui .net-status { position: absolute; left: 50%; bottom: 96px; transform: translateX(-50%);
  padding: 6px 16px; font-family: var(--caps); font-size: 18px; color: var(--lapis); pointer-events: none; }
#ui button.arsenal { display: inline-flex; align-items: center; gap: 6px; padding-right: 6px; }
#ui button.arsenal .art { line-height: 0; }
#ui .hidden { display: none !important; }
`;

/** Unscaled rules: touch targets stay 48 px whatever the overlay scale (rules/render.md). */
const TOUCH_STYLE = `
@media (pointer: coarse) { #ui button { min-width: 48px; min-height: 48px; } }
`;

let root: HTMLElement | null = null;

/** The overlay root, created once. */
export function uiRoot(): HTMLElement {
  if (root) return root;
  const style = document.createElement('style');
  style.textContent = scalableCss(STYLE) + TOUCH_STYLE;
  document.head.appendChild(style);
  root = document.createElement('div');
  root.id = 'ui';
  document.body.appendChild(root);
  const fit = (): void => {
    const u = uiScale(window.innerWidth, window.innerHeight);
    document.documentElement.style.setProperty('--u', `${u}px`);
  };
  fit();
  window.addEventListener('resize', fit);
  return root;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  text = '',
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text) e.textContent = text;
  return e;
}

/** A heraldic shield in a house's tinctures (placeholder until the painted blazons). */
export function shield(primary: number, secondary: number, small = false): HTMLElement {
  const s = el('div', small ? 'shield small' : 'shield');
  s.style.setProperty('--p', css(primary));
  s.style.setProperty('--s', css(secondary));
  return s;
}

/** A button that never steals keyboard focus from the game. */
export function button(label: string, className = ''): HTMLButtonElement {
  const b = el('button', className, label);
  b.type = 'button';
  b.tabIndex = -1;
  b.addEventListener('mousedown', (e) => e.preventDefault());
  return b;
}

/** Calls onHold(true) while the button is pressed (mouse or touch), onHold(false) on release. */
export function holdButton(
  label: string,
  onHold: (held: boolean) => void,
  className = '',
): HTMLButtonElement {
  const b = button(label, className);
  b.addEventListener('pointerdown', (e) => {
    b.setPointerCapture(e.pointerId);
    b.classList.add('on');
    onHold(true);
  });
  const release = (): void => {
    b.classList.remove('on');
    onHold(false);
  };
  b.addEventListener('pointerup', release);
  b.addEventListener('pointercancel', release);
  b.addEventListener('lostpointercapture', release);
  return b;
}
