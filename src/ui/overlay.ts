// DOM layer above the game canvas: shared styles (palette tokens) and small element helpers.
// Buttons never take keyboard focus, so the keyboard keeps driving the game.
import { COLORS, css } from './tokens.ts';

const STYLE = `
:root {
  --lapis: ${css(COLORS.lapis)}; --vermillon: ${css(COLORS.vermillon)}; --or: ${css(COLORS.or)};
  --ceruse: ${css(COLORS.ceruse)}; --velin: ${css(COLORS.velin)}; --encre: ${css(COLORS.encre)};
  --ocre: ${css(COLORS.ocre)}; --vert: ${css(COLORS.vertDeGris)}; --brun: ${css(COLORS.terreOmbre)};
}
#ui { position: fixed; inset: 0; pointer-events: none; font-family: Georgia, 'Book Antiqua', serif;
  color: var(--encre); user-select: none; -webkit-user-select: none; z-index: 10; }
#ui .panel { pointer-events: auto; background: var(--ceruse); border: 2px solid var(--encre);
  border-radius: 6px; box-shadow: 0 4px 14px rgba(42, 29, 20, 0.35); }
#ui button { pointer-events: auto; min-width: 48px; min-height: 48px; padding: 6px 10px;
  font: inherit; font-size: 16px; color: var(--encre); background: var(--velin);
  border: 2px solid var(--encre); border-radius: 6px; cursor: pointer; touch-action: none; }
#ui button:hover { background: var(--or); }
#ui button.on { background: var(--or); }
#ui button:disabled { opacity: 0.45; cursor: default; background: var(--velin); }
#ui .bar { position: absolute; left: 50%; bottom: 10px; transform: translateX(-50%);
  display: flex; gap: 4px; flex-wrap: wrap; justify-content: center; padding: 6px;
  width: max-content; max-width: calc(100vw - 32px); }
#ui .bar .fire { background: var(--vermillon); color: var(--ceruse); }
#ui .bar .fire:hover { background: var(--vermillon); filter: brightness(1.1); }
#ui .fuses { display: flex; gap: 4px; align-items: center; }
#ui .modal { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  max-width: min(760px, calc(100vw - 32px)); max-height: calc(100vh - 140px); overflow: auto;
  padding: 16px 20px; }
#ui h2 { margin: 0 0 8px; color: var(--lapis); font-size: 24px; }
#ui h3 { margin: 14px 0 6px; color: var(--vermillon); font-size: 17px; }
#ui .close { float: right; }
#ui .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; }
#ui .weapon { text-align: left; display: block; width: 100%; }
#ui .weapon b { display: block; font-size: 17px; margin-bottom: 2px; }
#ui .weapon small { display: block; font-size: 13px; line-height: 1.35; }
#ui .card { position: absolute; left: 16px; top: 120px; width: min(330px, calc(100vw - 32px));
  padding: 12px 14px; font-size: 14px; line-height: 1.4; }
#ui .card h2 { font-size: 21px; margin-bottom: 2px; }
#ui .card .house { font-weight: bold; margin-bottom: 8px; }
#ui .card .hpbar { height: 10px; border: 1px solid var(--encre); background: var(--velin); margin: 2px 0 8px; }
#ui .card .hpbar i { display: block; height: 100%; background: var(--vert); }
#ui .card ul { margin: 4px 0; padding-left: 18px; }
#ui table { border-collapse: collapse; width: 100%; font-size: 14px; table-layout: fixed; }
#ui td:nth-child(1) { width: 52%; } #ui td:nth-child(2) { width: 100px; } #ui td:nth-child(3) { width: 22%; }
#ui td { padding: 3px 4px; border-bottom: 1px solid var(--velin); vertical-align: middle; }
#ui td input { width: 84px; font: inherit; padding: 4px; border: 1px solid var(--encre); border-radius: 4px; }
#ui td.unit, #ui td.def { color: var(--brun); font-size: 12px; white-space: nowrap; }
#ui .note { font-size: 13px; font-style: italic; margin: 0 0 6px; }
#ui .actions { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
#ui .help p { white-space: pre-line; font-size: 15px; line-height: 1.5; }
#ui .hidden { display: none !important; }
`;

let root: HTMLElement | null = null;

/** The overlay root, created once. */
export function uiRoot(): HTMLElement {
  if (root) return root;
  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.appendChild(style);
  root = document.createElement('div');
  root.id = 'ui';
  document.body.appendChild(root);
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
