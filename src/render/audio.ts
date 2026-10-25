// The game's sound (GDD §11): one Web Audio context for the whole page, a bus for the music
// (render/music.ts) and one for the sound effects (render/sfx.ts), each with its own loudness.
// What plays is chosen by a mode, cycled by the ♪ button: music and effects, music alone, effects
// alone, or silence. The context opens at the player's first gesture (browsers keep audio silent
// until then) and sleeps while the page is hidden. Settings are kept per device.
import { DEFAULT_MUSIC_VOLUME, DEFAULT_SFX_VOLUME } from '../content/music.ts';

export type SoundMode = 'all' | 'music' | 'sfx' | 'none';

/** The ♪ button's round: each press goes to the next. */
export const SOUND_MODES: readonly SoundMode[] = ['all', 'music', 'sfx', 'none'];

export interface SoundSettings {
  readonly mode: SoundMode;
  /** 0 to 100 */
  readonly musicVolume: number;
  /** 0 to 100 */
  readonly sfxVolume: number;
}

const KEY = 'medieverse.sound.v1';
/** The music's own settings before the effects came (2026-10-25): on/off and its volume. */
const MUSIC_KEY = 'medieverse.music.v2';
/** The very first ones: only their on/off is kept, their volume was the old default. */
const MUSIC_V1_KEY = 'medieverse.music.v1';

const clamp = (v: unknown, def: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : def;

function read(key: string): Record<string, unknown> | null {
  const raw: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
}

export function loadSoundSettings(): SoundSettings {
  const defaults: SoundSettings = {
    mode: 'all',
    musicVolume: DEFAULT_MUSIC_VOLUME,
    sfxVolume: DEFAULT_SFX_VOLUME,
  };
  try {
    const s = read(KEY);
    if (s) {
      const mode = SOUND_MODES.find((m) => m === s.mode) ?? 'all';
      return {
        mode,
        musicVolume: clamp(s.musicVolume, DEFAULT_MUSIC_VOLUME),
        sfxVolume: clamp(s.sfxVolume, DEFAULT_SFX_VOLUME),
      };
    }
    // Music switched off before the effects came: the effects play, the music stays silent.
    const old = read(MUSIC_KEY) ?? read(MUSIC_V1_KEY);
    if (old) {
      return {
        ...defaults,
        mode: old.on === false ? 'sfx' : 'all',
        musicVolume: read(MUSIC_KEY)
          ? clamp(old.volume, DEFAULT_MUSIC_VOLUME)
          : DEFAULT_MUSIC_VOLUME,
      };
    }
  } catch {
    // Blocked storage: the defaults.
  }
  return defaults;
}

function saveSoundSettings(s: SoundSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Blocked storage: the choice lasts for this page only.
  }
}

/** Loudness grows faster than the slider, so its low end stays usable. */
const gainOf = (volume: number, top: number): number => top * (volume / 100) ** 1.5;

class Audio {
  private settings = loadSoundSettings();
  private context: AudioContext | null = null;
  private unlocked = false;
  /** the music's bus and the effects' bus, into the speakers */
  music: GainNode | null = null;
  sfx: GainNode | null = null;
  private readonly listeners: (() => void)[] = [];

  get current(): SoundSettings {
    return this.settings;
  }

  get musicOn(): boolean {
    const s = this.settings;
    return (s.mode === 'all' || s.mode === 'music') && s.musicVolume > 0;
  }

  get sfxOn(): boolean {
    const s = this.settings;
    return (s.mode === 'all' || s.mode === 'sfx') && s.sfxVolume > 0;
  }

  /** The context, once the player's first gesture has opened it and while the page shows. */
  get ctx(): AudioContext | null {
    return this.context && this.context.state === 'running' ? this.context : null;
  }

  /** `fn` hears of every change of settings, or of the page waking or sleeping. */
  onChange(fn: () => void): void {
    this.listeners.push(fn);
  }

  /** Waits for the first gesture, then follows the page's visibility. */
  install(): void {
    const unlock = (): void => {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
      this.unlocked = true;
      this.apply();
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    document.addEventListener('visibilitychange', () => this.apply());
  }

  set(next: Partial<SoundSettings>): void {
    this.settings = { ...this.settings, ...next };
    saveSoundSettings(this.settings);
    this.apply();
  }

  /** The ♪ button: the next mode of the round. */
  cycle(): SoundMode {
    const k = SOUND_MODES.indexOf(this.settings.mode);
    const mode = SOUND_MODES[(k + 1) % SOUND_MODES.length] ?? 'all';
    this.set({ mode });
    return mode;
  }

  private apply(): void {
    const awake = this.unlocked && !document.hidden && (this.musicOn || this.sfxOn);
    if (awake && !this.context) {
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        const ctx = new Ctx();
        this.context = ctx;
        this.music = ctx.createGain();
        this.sfx = ctx.createGain();
        this.music.gain.value = 0;
        this.sfx.gain.value = 0;
        this.music.connect(ctx.destination);
        // The effects through a soft limiter: a big blast does not crush everything else.
        const limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = -14;
        limiter.ratio.value = 6;
        limiter.attack.value = 0.004;
        limiter.release.value = 0.25;
        this.sfx.connect(limiter);
        limiter.connect(ctx.destination);
      }
    }
    const ctx = this.context;
    if (ctx) {
      const now = ctx.currentTime;
      const s = this.settings;
      this.music?.gain.setTargetAtTime(this.musicOn ? gainOf(s.musicVolume, 0.9) : 0, now, 0.2);
      this.sfx?.gain.setTargetAtTime(this.sfxOn ? gainOf(s.sfxVolume, 2.2) : 0, now, 0.05);
      if (awake) {
        void ctx.resume().then(() => this.tell());
      } else {
        // A short fade, then the context sleeps: no sound costs nothing.
        window.setTimeout(() => {
          if (!(this.unlocked && !document.hidden && (this.musicOn || this.sfxOn))) {
            void ctx.suspend().then(() => this.tell());
          }
        }, 400);
      }
    }
    this.tell();
  }

  private tell(): void {
    for (const fn of this.listeners) fn();
  }
}

export const audio = new Audio();
