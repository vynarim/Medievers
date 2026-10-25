// The sound button (GDD §11): one press for the next of the four modes — music and effects,
// music alone, effects alone, silence. Its face follows the mode, whoever changes it.
import { audio, type SoundMode } from '../render/audio.ts';
import { t } from './i18n.ts';
import type { IconName } from './icons.ts';
import { setIcon } from './icons.ts';
import { button } from './overlay.ts';

/** The button's face for each sound mode. */
export const SOUND_ICON: Readonly<Record<SoundMode, IconName>> = {
  all: 'soundAll',
  music: 'musicOn',
  sfx: 'sfxOnly',
  none: 'soundOff',
};

/** A sound button of class `className`; it keeps its face up to date by itself. */
export function soundButton(className = 'icon'): HTMLButtonElement {
  const b = button('', className);
  let shown: SoundMode | null = null;
  const show = (): void => {
    const mode = audio.current.mode;
    if (mode === shown) return;
    shown = mode;
    setIcon(b, SOUND_ICON[mode]);
    b.title = t('sound.tip', { now: t(`sound.mode.${mode}`) });
  };
  b.addEventListener('click', () => {
    audio.cycle();
    show();
  });
  audio.onChange(show);
  show();
  return b;
}
