// Sound effects (GDD §11, ASSETS §6), synthesised on the spot with the Web Audio API like the
// music: no audio file. Each effect is a short recipe of tones and filtered noise, on the effects
// bus of render/audio.ts, panned by where it happens on screen. The battle scene calls play() for
// the sim's events; a burst of events (a match caught up after a reload) is held to a few sounds.
import { audio } from './audio.ts';

export type SfxId =
  | 'bow'
  | 'crossbow'
  | 'sling'
  | 'throw'
  | 'thud'
  | 'explosionS'
  | 'explosionM'
  | 'explosionL'
  | 'fire'
  | 'pig'
  | 'swarm'
  | 'falcon'
  | 'creak'
  | 'volley'
  | 'sword'
  | 'mace'
  | 'charge'
  | 'hurt'
  | 'death'
  | 'splash'
  | 'thunder'
  | 'stone'
  | 'collapse'
  | 'roar'
  | 'chomp'
  | 'sparkle'
  | 'chime'
  | 'pickup'
  | 'heal'
  | 'bell'
  | 'horn'
  | 'fanfare'
  | 'click'
  | 'wood'
  | 'flap'
  | 'clink'
  | 'choir'
  | 'dig'
  | 'squeak'
  | 'refused';

/** ms the same effect waits before it may sound again, so a volley is not a din */
const SAME_SFX_MS = 45;
/** length of the rain's loop, s, and how many drops fall in a second */
const RAIN_LOOP_S = 6;
const RAIN_DROPS_PER_S = 140;
/** effects at most within one frame */
const MAX_PER_FRAME = 6;

class Sfx {
  private noiseBuf: AudioBuffer | null = null;
  private rainBuf: AudioBuffer | null = null;
  private readonly last = new Map<SfxId, number>();
  private frame = -1;
  private inFrame = 0;
  /** the rain's hiss while it rains, if any */
  private rain: { src: AudioBufferSourceNode; gain: GainNode } | null = null;

  /** Plays effect `id`, panned from -1 (left of the screen) to 1 (right). */
  play(id: SfxId, pan = 0): void {
    const ctx = audio.ctx;
    const bus = audio.sfx;
    if (!ctx || !bus || !audio.sfxOn) return;
    const now = performance.now();
    const frame = Math.floor(now / 16);
    if (frame !== this.frame) {
      this.frame = frame;
      this.inFrame = 0;
    }
    if (this.inFrame >= MAX_PER_FRAME) return;
    if (now - (this.last.get(id) ?? -1e9) < SAME_SFX_MS) return;
    this.last.set(id, now);
    this.inFrame++;
    const out = ctx.createStereoPanner();
    out.pan.value = Math.max(-1, Math.min(1, pan)) * 0.7;
    out.connect(bus);
    RECIPES[id](new Kit(ctx, out, this.noise(ctx)), ctx.currentTime + 0.01);
    // The node graph frees itself once its sources have stopped.
  }

  /** True while the rain falls (the test settings switch it on and off). */
  get raining(): boolean {
    return this.rain !== null;
  }

  /** The rain's hiss, while it rains. */
  setRain(on: boolean): void {
    const ctx = audio.ctx;
    const bus = audio.sfx;
    if (!on || !ctx || !bus || !audio.sfxOn) {
      if (this.rain && ctx) {
        const { src, gain } = this.rain;
        gain.gain.setTargetAtTime(0, ctx.currentTime, 0.6);
        src.stop(ctx.currentTime + 3);
      }
      this.rain = null;
      return;
    }
    if (this.rain) return;
    const src = ctx.createBufferSource();
    src.buffer = this.rainBuffer(ctx);
    src.loop = true;
    // No rumble under the shower, and no hiss over it.
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1100;
    f.Q.value = 0.35;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(0.09, ctx.currentTime, 1.5);
    src.connect(f);
    f.connect(gain);
    gain.connect(bus);
    src.start();
    this.rain = { src, gain };
  }

  /**
   * A shower on the fields: a soft wash of dark noise that swells and ebbs, and over it the
   * patter of drops, each a muffled tap of noise (never a tone: tones chirp like crickets),
   * some near and bright, most far and dull; in stereo, so it falls all around.
   */
  private rainBuffer(ctx: AudioContext): AudioBuffer {
    if (this.rainBuf) return this.rainBuf;
    const rate = ctx.sampleRate;
    const buf = ctx.createBuffer(2, rate * RAIN_LOOP_S, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      // The wash: white noise through two gentle low-pass poles, swelling slowly (whole cycles
      // over the loop, so that it joins seamlessly).
      let a = 0;
      let b = 0;
      const phase = Math.random() * 2 * Math.PI;
      for (let i = 0; i < d.length; i++) {
        a += (Math.random() * 2 - 1 - a) * 0.35;
        b += (a - b) * 0.35;
        const swell = 0.75 + 0.25 * Math.sin(phase + (2 * Math.PI * 2 * i) / d.length);
        d[i] = b * 0.55 * swell;
      }
      const drops = RAIN_DROPS_PER_S * RAIN_LOOP_S;
      for (let k = 0; k < drops; k++) {
        const at = Math.floor(Math.random() * d.length);
        const near = Math.random() < 0.15;
        const amp = (near ? 0.5 : 0.18) * (0.4 + Math.random() * 0.6);
        const tau = rate * (near ? 0.004 : 0.008) * (0.6 + Math.random() * 0.8);
        const len = Math.min(Math.floor(tau * 5), d.length - at);
        // Brightness: how much of the tap's noise passes (a near drop is crisper).
        const k1 = near ? 0.55 : 0.18;
        let y = 0;
        for (let i = 0; i < len; i++) {
          y += (Math.random() * 2 - 1 - y) * k1;
          d[at + i] = (d[at + i] ?? 0) + amp * Math.exp(-i / tau) * y;
        }
      }
    }
    this.rainBuf = buf;
    return buf;
  }

  private noise(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuf) return this.noiseBuf;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    return buf;
  }
}

/** The few gestures every recipe is made of. */
class Kit {
  readonly ctx: AudioContext;
  private readonly out: AudioNode;
  private readonly buf: AudioBuffer;

  constructor(ctx: AudioContext, out: AudioNode, buf: AudioBuffer) {
    this.ctx = ctx;
    this.out = out;
    this.buf = buf;
  }

  /** A gain that rises in `attack` s to `peak`, then dies away exponentially over `decay` s. */
  private env(t: number, peak: number, attack: number, decay: number): GainNode {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(this.out);
    return g;
  }

  /** A tone gliding from `f0` to `f1` Hz. */
  tone(
    t: number,
    f0: number,
    f1: number,
    o: { type?: OscillatorType; peak?: number; attack?: number; decay?: number } = {},
  ): void {
    const attack = o.attack ?? 0.005;
    const decay = o.decay ?? 0.2;
    const g = this.env(t, o.peak ?? 0.3, attack, decay);
    const osc = this.ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + attack + decay);
    osc.connect(g);
    osc.start(t);
    osc.stop(t + attack + decay + 0.05);
  }

  /** Noise through a filter whose frequency glides from `f0` to `f1` Hz. */
  noise(
    t: number,
    f0: number,
    f1: number,
    o: { type?: BiquadFilterType; q?: number; peak?: number; attack?: number; decay?: number } = {},
  ): void {
    const attack = o.attack ?? 0.003;
    const decay = o.decay ?? 0.15;
    const g = this.env(t, o.peak ?? 0.3, attack, decay);
    const f = this.ctx.createBiquadFilter();
    f.type = o.type ?? 'bandpass';
    f.Q.value = o.q ?? 1;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + attack + decay);
    f.connect(g);
    const src = this.ctx.createBufferSource();
    src.buffer = this.buf;
    // Each sound starts somewhere else in the noise: no two alike.
    src.connect(f);
    src.start(t, Math.random() * 1.5);
    src.stop(t + attack + decay + 0.05);
  }
}

type Recipe = (k: Kit, t: number) => void;

const boom =
  (peak: number, length: number): Recipe =>
  (k, t) => {
    k.noise(t, 1800, 120, { type: 'lowpass', peak, decay: length });
    k.tone(t, 90, 32, { peak: peak * 1.2, decay: length * 0.9 });
    k.noise(t + 0.02, 3000, 800, { type: 'bandpass', q: 0.6, peak: peak * 0.3, decay: 0.12 });
  };

const RECIPES: Readonly<Record<SfxId, Recipe>> = {
  // The string let go, and the arrow's hiss.
  bow: (k, t) => {
    k.tone(t, 220, 150, { type: 'triangle', peak: 0.25, decay: 0.16 });
    k.noise(t, 2500, 1200, { peak: 0.12, decay: 0.12 });
  },
  crossbow: (k, t) => {
    k.noise(t, 4000, 2000, { type: 'highpass', peak: 0.25, decay: 0.04 });
    k.tone(t, 160, 70, { type: 'triangle', peak: 0.3, decay: 0.12 });
  },
  sling: (k, t) => {
    k.noise(t, 400, 1400, { q: 2, peak: 0.18, attack: 0.08, decay: 0.2 });
  },
  throw: (k, t) => {
    k.noise(t, 300, 900, { q: 1.5, peak: 0.14, attack: 0.05, decay: 0.18 });
  },
  // An arrow or a stone into the ground.
  thud: (k, t) => {
    k.noise(t, 900, 300, { type: 'lowpass', peak: 0.2, decay: 0.07 });
    k.tone(t, 140, 80, { peak: 0.12, decay: 0.06 });
  },
  explosionS: boom(0.2, 0.45),
  explosionM: boom(0.28, 0.8),
  explosionL: boom(0.36, 1.3),
  fire: (k, t) => {
    k.noise(t, 500, 1500, { q: 0.7, peak: 0.2, attack: 0.15, decay: 0.5 });
  },
  // The flaming pig's grunts: two, the second higher, burlesque.
  pig: (k, t) => {
    for (const [dt, f] of [
      [0, 130],
      [0.22, 170],
    ] as const) {
      k.tone(t + dt, f, f * 0.7, { type: 'sawtooth', peak: 0.12, attack: 0.02, decay: 0.16 });
      k.noise(t + dt, 600, 300, { q: 3, peak: 0.08, decay: 0.15 });
    }
  },
  swarm: (k, t) => {
    for (const f of [210, 223, 236]) {
      k.tone(t, f, f * 1.05, { type: 'sawtooth', peak: 0.04, attack: 0.1, decay: 0.9 });
    }
  },
  falcon: (k, t) => {
    k.tone(t, 1900, 1300, { type: 'triangle', peak: 0.12, attack: 0.02, decay: 0.3 });
    k.tone(t + 0.35, 2000, 1250, { type: 'triangle', peak: 0.1, attack: 0.02, decay: 0.35 });
  },
  // A siege engine: its wood creaks, then the arm swings.
  creak: (k, t) => {
    k.tone(t, 70, 55, { type: 'square', peak: 0.06, attack: 0.05, decay: 0.25 });
    k.noise(t + 0.2, 200, 700, { q: 1, peak: 0.2, attack: 0.05, decay: 0.3 });
  },
  volley: (k, t) => {
    for (let i = 0; i < 5; i++) k.noise(t + i * 0.07, 1500, 700, { peak: 0.08, decay: 0.2 });
  },
  sword: (k, t) => {
    k.noise(t, 6000, 3000, { q: 4, peak: 0.12, decay: 0.12 });
    k.tone(t, 2600, 2500, { peak: 0.06, decay: 0.35 });
    k.tone(t + 0.12, 2900, 2800, { peak: 0.05, decay: 0.3 });
  },
  mace: (k, t) => {
    k.tone(t, 110, 50, { peak: 0.4, decay: 0.18 });
    k.noise(t, 700, 200, { type: 'lowpass', peak: 0.25, decay: 0.12 });
  },
  charge: (k, t) => {
    for (let i = 0; i < 4; i++) k.tone(t + i * 0.11, 120, 70, { peak: 0.2, decay: 0.07 });
    k.noise(t + 0.45, 800, 200, { type: 'lowpass', peak: 0.3, decay: 0.15 });
  },
  // A unit hurt: a short, comic grunt.
  hurt: (k, t) => {
    k.tone(t, 330, 190, { type: 'square', peak: 0.06, attack: 0.01, decay: 0.12 });
  },
  // A unit falls for good: the slide whistle of the farce.
  death: (k, t) => {
    k.tone(t, 1100, 220, { type: 'sine', peak: 0.12, attack: 0.02, decay: 0.7 });
  },
  splash: (k, t) => {
    k.noise(t, 2000, 400, { q: 0.8, peak: 0.3, decay: 0.45 });
    k.tone(t + 0.05, 600, 250, { peak: 0.06, decay: 0.2 });
  },
  // Lightning: the crack, then the long roll of thunder.
  thunder: (k, t) => {
    k.noise(t, 5000, 1500, { type: 'highpass', peak: 0.45, decay: 0.15 });
    k.noise(t + 0.05, 400, 60, { type: 'lowpass', peak: 0.55, attack: 0.1, decay: 2.6 });
    k.noise(t + 0.7, 300, 60, { type: 'lowpass', peak: 0.3, attack: 0.2, decay: 1.8 });
  },
  stone: (k, t) => {
    k.noise(t, 500, 250, { q: 2, peak: 0.25, decay: 0.1 });
  },
  collapse: (k, t) => {
    k.noise(t, 600, 80, { type: 'lowpass', peak: 0.5, attack: 0.05, decay: 1.6 });
    for (let i = 0; i < 6; i++) {
      k.noise(t + 0.1 + i * 0.17, 900 - i * 80, 300, { q: 2, peak: 0.2, decay: 0.12 });
    }
  },
  roar: (k, t) => {
    k.tone(t, 95, 60, { type: 'sawtooth', peak: 0.16, attack: 0.15, decay: 1 });
    k.noise(t, 600, 200, { q: 0.8, peak: 0.18, attack: 0.15, decay: 1 });
  },
  chomp: (k, t) => {
    k.noise(t, 1200, 500, { q: 2, peak: 0.3, decay: 0.06 });
    k.noise(t + 0.14, 1100, 450, { q: 2, peak: 0.3, decay: 0.06 });
  },
  // The unicorn: a glitter of high notes.
  sparkle: (k, t) => {
    [1568, 1976, 2349, 3136].forEach((f, i) =>
      k.tone(t + i * 0.06, f, f, { type: 'triangle', peak: 0.06, decay: 0.3 }),
    );
  },
  chime: (k, t) => {
    k.tone(t, 1320, 1320, { peak: 0.08, decay: 0.9 });
    k.tone(t, 3460, 3460, { peak: 0.03, decay: 0.5 });
  },
  pickup: (k, t) => {
    k.tone(t, 880, 880, { type: 'triangle', peak: 0.1, decay: 0.1 });
    k.tone(t + 0.09, 1320, 1320, { type: 'triangle', peak: 0.1, decay: 0.18 });
  },
  heal: (k, t) => {
    [784, 988, 1175].forEach((f, i) =>
      k.tone(t + i * 0.08, f, f, { type: 'triangle', peak: 0.08, decay: 0.35 }),
    );
  },
  // The start of a turn: a small chapel bell.
  bell: (k, t) => {
    k.tone(t, 660, 660, { peak: 0.07, decay: 1.4 });
    k.tone(t, 1584, 1584, { peak: 0.025, decay: 0.8 });
  },
  // The Déluge: a horn, then its fifth.
  horn: (k, t) => {
    k.tone(t, 220, 220, { type: 'sawtooth', peak: 0.1, attack: 0.3, decay: 1.2 });
    k.tone(t + 0.9, 330, 330, { type: 'sawtooth', peak: 0.1, attack: 0.2, decay: 1.4 });
  },
  fanfare: (k, t) => {
    [523, 659, 784, 1047].forEach((f, i) =>
      k.tone(t + i * 0.16, f, f, {
        type: 'square',
        peak: 0.06,
        attack: 0.01,
        decay: i === 3 ? 0.9 : 0.15,
      }),
    );
  },
  click: (k, t) => {
    k.noise(t, 3000, 2000, { q: 3, peak: 0.12, decay: 0.03 });
  },
  wood: (k, t) => {
    k.tone(t, 420, 300, { type: 'triangle', peak: 0.16, decay: 0.08 });
    k.tone(t + 0.09, 380, 280, { type: 'triangle', peak: 0.12, decay: 0.08 });
  },
  flap: (k, t) => {
    for (let i = 0; i < 3; i++) k.noise(t + i * 0.09, 700, 400, { q: 1, peak: 0.12, decay: 0.06 });
  },
  clink: (k, t) => {
    k.tone(t, 2400, 2300, { type: 'triangle', peak: 0.08, decay: 0.15 });
  },
  // The miracle: a short choir, "aah".
  choir: (k, t) => {
    for (const f of [392, 494, 587, 784]) {
      k.tone(t, f, f * 1.003, { type: 'triangle', peak: 0.035, attack: 0.25, decay: 1 });
    }
  },
  dig: (k, t) => {
    for (let i = 0; i < 4; i++) {
      k.noise(t + i * 0.32, 900, 300, { type: 'lowpass', peak: 0.2, decay: 0.09 });
      k.tone(t + i * 0.32, 1800, 1500, { type: 'triangle', peak: 0.03, decay: 0.08 });
    }
  },
  squeak: (k, t) => {
    k.tone(t, 1400, 2200, { type: 'triangle', peak: 0.07, decay: 0.1 });
  },
  refused: (k, t) => {
    k.tone(t, 180, 140, { type: 'square', peak: 0.05, decay: 0.12 });
  },
};

export const sfx = new Sfx();

/** Every effect, in the order of its recipe (the test settings play each one). */
export const SFX_IDS = Object.keys(RECIPES) as SfxId[];
