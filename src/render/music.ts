// Ambient music (BACKLOG 7.8): the ritornello of content/music.ts played by a small band
// synthesised with the Web Audio API, no audio file: a recorder, a lute, a drone of fifths, a
// round bass, a tabor and a tambourine. Bars are scheduled a little ahead of the audio clock, so
// the loop runs on without a seam. It starts at the player's first gesture (browsers keep audio
// silent until then), keeps quiet while the page is hidden, and its settings are kept per device.
import {
  DEFAULT_MUSIC_VOLUME,
  EIGHTH_SECONDS,
  EIGHTHS_PER_BAR,
  RITORNELLO,
  type Chord,
} from '../content/music.ts';

const KEY = 'medieverse.music.v2';
/** The first settings (2026-10-25): their volume was the old default, only on/off is kept. */
const OLD_KEY = 'medieverse.music.v1';

export interface MusicSettings {
  /** the music plays */
  readonly on: boolean;
  /** 0 to 100 */
  readonly volume: number;
}

export function loadMusicSettings(): MusicSettings {
  try {
    const old: unknown = JSON.parse(localStorage.getItem(OLD_KEY) ?? 'null');
    const raw: unknown =
      JSON.parse(localStorage.getItem(KEY) ?? 'null') ??
      (old && typeof old === 'object' ? { on: (old as { on?: unknown }).on } : null);
    if (raw && typeof raw === 'object') {
      const r = raw as { on?: unknown; volume?: unknown };
      return {
        on: r.on !== false,
        volume:
          typeof r.volume === 'number'
            ? Math.max(0, Math.min(100, Math.round(r.volume)))
            : DEFAULT_MUSIC_VOLUME,
      };
    }
  } catch {
    // Blocked storage: the defaults.
  }
  return { on: true, volume: DEFAULT_MUSIC_VOLUME };
}

function saveMusicSettings(s: MusicSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Blocked storage: the choice lasts for this page only.
  }
}

/** Hz of MIDI note m. */
const hz = (m: number): number => 440 * 2 ** ((m - 69) / 12);

/** s scheduled ahead of the audio clock, and ms between two looks at it */
const AHEAD = 0.4;
const TICK_MS = 60;
/** Bars of the whole loop: the round twice, the second time with the lute on the tune. */
const ROUND_BARS = RITORNELLO.length * 4;
const LOOP_BARS = ROUND_BARS * 2;

class Band {
  private readonly ctx: AudioContext;
  private readonly out: GainNode;
  private readonly noise: AudioBuffer;
  private readonly drones: OscillatorNode[] = [];

  constructor(ctx: AudioContext, out: GainNode) {
    this.ctx = ctx;
    // A little room: a soft, dark echo behind the band, as in a stone hall.
    const dry = ctx.createGain();
    const echo = ctx.createDelay(1);
    echo.delayTime.value = 0.27;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.25;
    const dark = ctx.createBiquadFilter();
    dark.type = 'lowpass';
    dark.frequency.value = 1800;
    const wet = ctx.createGain();
    wet.gain.value = 0.22;
    dry.connect(out);
    dry.connect(echo);
    echo.connect(dark);
    dark.connect(feedback);
    feedback.connect(echo);
    dark.connect(wet);
    wet.connect(out);
    this.out = dry;
    // White noise for the tambourine's jingles.
    this.noise = ctx.createBuffer(1, ctx.sampleRate >> 2, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  /** The drone of the hurdy-gurdy: D and A, always there, very soft. */
  startDrone(): void {
    if (this.drones.length > 0) return;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(0.035, this.ctx.currentTime, 1.5);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 700;
    f.connect(g);
    g.connect(this.out);
    for (const m of [50, 57]) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = hz(m);
      o.connect(f);
      o.start();
      this.drones.push(o);
    }
  }

  stopDrone(): void {
    for (const o of this.drones) o.stop();
    this.drones.length = 0;
  }

  private env(t: number, peak: number, attack: number, hold: number, release: number): GainNode {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setValueAtTime(peak, t + attack + hold);
    g.gain.linearRampToValueAtTime(0, t + attack + hold + release);
    g.connect(this.out);
    return g;
  }

  /** A recorder: breathy and round, with a little vibrato that comes in late. */
  recorder(t: number, m: number, dur: number, vel: number): void {
    const g = this.env(t, 0.14 * vel, 0.03, Math.max(0, dur - 0.1), 0.08);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 2600;
    f.connect(g);
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = hz(m);
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 5.2;
    const depth = this.ctx.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(hz(m) * 0.006, t + Math.min(0.4, dur));
    lfo.connect(depth);
    depth.connect(o.frequency);
    o.connect(f);
    const end = t + dur + 0.1;
    for (const n of [o, lfo]) {
      n.start(t);
      n.stop(end);
    }
  }

  /** A lute: a bright pluck that darkens as it dies away. */
  lute(t: number, m: number, vel: number): void {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12 * vel, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.9);
    g.connect(this.out);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 2;
    f.frequency.setValueAtTime(3200, t);
    f.frequency.exponentialRampToValueAtTime(500, t + 0.35);
    f.connect(g);
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = hz(m);
    o.connect(f);
    o.start(t);
    o.stop(t + 0.95);
  }

  /** A round bass, the modern touch under the old tune. */
  bass(t: number, m: number, dur: number): void {
    const g = this.env(t, 0.2, 0.01, Math.max(0, dur - 0.12), 0.1);
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = hz(m);
    o.connect(g);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /** The tabor: a soft thump that drops in pitch. */
  tabor(t: number, vel: number): void {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.32 * vel, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    g.connect(this.out);
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.15);
    o.connect(g);
    o.start(t);
    o.stop(t + 0.25);
  }

  /** The tambourine's jingles: a short hiss, high up. */
  tambourine(t: number, vel: number): void {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.06 * vel, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    g.connect(this.out);
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 6500;
    f.connect(g);
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.connect(f);
    s.start(t);
    s.stop(t + 0.1);
  }
}

const third = (c: Chord): number => c.root + (c.minor ? 3 : 4);

/** The music of the whole page: one, started at the first gesture. */
class Music {
  private settings = loadMusicSettings();
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private band: Band | null = null;
  private timer: number | null = null;
  /** bar of the loop to schedule next, and when it starts on the audio clock */
  private bar = 0;
  private barTime = 0;
  /** bars played since the start: the very first four have no drums, an intro */
  private played = 0;

  get current(): MusicSettings {
    return this.settings;
  }

  /** Waits for the first gesture, which browsers ask for before any sound. */
  install(): void {
    const unlock = (): void => {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
      this.apply();
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    // Hidden, the page keeps quiet; back, the music goes on where it was.
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) {
        this.stopTimer();
        void this.ctx.suspend();
      } else {
        this.apply();
      }
    });
  }

  set(next: Partial<MusicSettings>): void {
    this.settings = { ...this.settings, ...next };
    saveMusicSettings(this.settings);
    this.apply();
  }

  private gainOf(volume: number): number {
    // Loudness grows faster than the slider: its low end stays usable. At 25, peaks near 0.07.
    return 0.9 * (volume / 100) ** 1.5;
  }

  private apply(): void {
    if (!this.settings.on || this.settings.volume === 0) {
      this.stopTimer();
      if (this.ctx) {
        this.master?.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
        const ctx = this.ctx;
        window.setTimeout(() => {
          if (!this.timer) {
            this.band?.stopDrone();
            void ctx.suspend();
          }
        }, 600);
      }
      return;
    }
    if (!this.ctx) {
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.ctx.destination);
      this.band = new Band(this.ctx, this.master);
    }
    const ctx = this.ctx;
    void ctx.resume();
    this.master?.gain.setTargetAtTime(this.gainOf(this.settings.volume), ctx.currentTime, 0.3);
    this.band?.startDrone();
    if (this.timer !== null) return;
    // Back from a pause: the next bar starts now, where the tune was.
    if (this.barTime < ctx.currentTime + 0.05) this.barTime = ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), TICK_MS);
    this.schedule();
  }

  private stopTimer(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  private schedule(): void {
    const ctx = this.ctx;
    const band = this.band;
    if (!ctx || !band) return;
    while (this.barTime < ctx.currentTime + AHEAD) {
      this.playBar(band, this.bar, this.barTime);
      this.barTime += EIGHTHS_PER_BAR * EIGHTH_SECONDS;
      this.bar = (this.bar + 1) % LOOP_BARS;
      this.played++;
    }
  }

  private playBar(band: Band, bar: number, t0: number): void {
    const e = EIGHTH_SECONDS;
    const inRound = bar % ROUND_BARS;
    const phrase = RITORNELLO[Math.floor(inRound / 4)];
    const notes = phrase?.bars[inRound % 4] ?? [];
    const chord = phrase?.chords[inRound % 4];
    if (!chord) return;
    const second = bar >= ROUND_BARS;
    // The tune: the recorder, then the lute the second time round.
    let at = 0;
    for (const [m, len] of notes) {
      if (m > 0) {
        if (second) band.lute(t0 + at * e, m, 1);
        else band.recorder(t0 + at * e, m, len * e * 0.95, 1);
      }
      at += len;
    }
    // Under it, the lute's chord, picked out; the second time, the recorder holds a long note.
    if (second) {
      band.recorder(t0, third(chord) + 24, EIGHTHS_PER_BAR * e * 0.98, 0.35);
      band.lute(t0, chord.root + 12, 0.5);
      band.lute(t0 + 3 * e, chord.root + 19, 0.45);
    } else {
      const picks = [12, 19, 24, third(chord) - chord.root + 24, 19, 24];
      picks.forEach((p, k) => band.lute(t0 + k * e, chord.root + p, k === 0 ? 0.55 : 0.32));
    }
    // The bass: root, fifth, and the octave just before the bar line.
    band.bass(t0, chord.root - 12, 2.6 * e);
    band.bass(t0 + 3 * e, chord.root - 5, 1.6 * e);
    band.bass(t0 + 5 * e, chord.root, 0.8 * e);
    // The drums, after a short intro: tabor on the two beats, jingles off them, a roll to end.
    if (this.played < 4) return;
    band.tabor(t0, 1);
    band.tabor(t0 + 3 * e, 0.7);
    const last = inRound === ROUND_BARS - 1;
    for (let k = 0; k < EIGHTHS_PER_BAR; k++) {
      if (k === 2 || k === 5 || (last && k >= 3)) band.tambourine(t0 + k * e, k === 5 ? 1 : 0.7);
    }
  }
}

export const music = new Music();
