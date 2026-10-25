// A copy button as on a desktop: two sheets, one over the other. Pressed, it puts `text` on the
// clipboard and shows a tick for a moment.
import { t } from './i18n.ts';
import { setIcon } from './icons.ts';
import { button } from './overlay.ts';

/** ms the tick stays after a copy */
const COPIED_MS = 1500;

export function copyButton(text: string): HTMLButtonElement {
  const b = setIcon(button('', 'icon copy'), 'copy');
  b.title = t('online.copy');
  b.setAttribute('aria-label', t('online.copy'));
  b.addEventListener('click', () => {
    void navigator.clipboard?.writeText(text).then(() => {
      setIcon(b, 'check');
      b.title = t('pause.copied');
      window.setTimeout(() => {
        setIcon(b, 'copy');
        b.title = t('online.copy');
      }, COPIED_MS);
    });
  });
  return b;
}
