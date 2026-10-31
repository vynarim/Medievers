// A tablet is played held sideways only (GDD §8): the installed app locks the screen in
// landscape, and wherever the lock is refused (a browser tab), held upright it is asked to turn.
import { t } from '../ui/i18n.ts';
import { el, uiRoot } from '../ui/overlay.ts';

/** Shortest side (CSS px) of a touch screen from which it is taken for a tablet, not a phone. */
const TABLET_MIN_SIDE = 600;

function isTablet(): boolean {
  return (
    window.matchMedia('(pointer: coarse)').matches &&
    Math.min(window.screen.width, window.screen.height) >= TABLET_MIN_SIDE
  );
}

function lockLandscape(): void {
  const o = window.screen.orientation as ScreenOrientation & {
    lock?: (o: 'landscape') => Promise<void>;
  };
  // Refused outside full screen or an installed app: the veil below then asks for it.
  o.lock?.('landscape').catch(() => undefined);
}

export function watchOrientation(): void {
  if (!isTablet()) return;
  lockLandscape();
  // Entering full screen makes the lock possible in a browser tab too.
  document.addEventListener('fullscreenchange', lockLandscape);
  const veil = el('div', 'rotate panel hidden');
  veil.append(el('h2', '', t('rotate.title')), el('p', '', t('rotate.text')));
  uiRoot().append(veil);
  const fit = (): void => {
    veil.classList.toggle('hidden', window.innerWidth >= window.innerHeight);
  };
  fit();
  window.addEventListener('resize', fit);
}
