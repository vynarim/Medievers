// The ambient music (BACKLOG 7.8): a ritornello in the manner of an estampie, in D Dorian and
// 6/8, played under the match by a small band synthesised on the spot (render/music.ts): a
// recorder for the tune, a lute plucking the chords, a drone of fifths, a round bass and a tabor
// with a tambourine for the modern lilt. Data only: notes are MIDI numbers (0: a rest), lengths
// in eighths, six to a bar.

/** One note of the tune: MIDI pitch (0 for a rest), length in eighths. */
export type Note = readonly [pitch: number, eighths: number];

/** A chord under a bar: its root (MIDI, bass octave) and whether its third is minor. */
export interface Chord {
  readonly root: number;
  readonly minor: boolean;
}

export interface Phrase {
  /** four bars of tune, six eighths each */
  readonly bars: readonly (readonly Note[])[];
  /** one chord per bar */
  readonly chords: readonly Chord[];
}

const Dm: Chord = { root: 50, minor: true };
const C: Chord = { root: 48, minor: false };
const F: Chord = { root: 53, minor: false };
const G: Chord = { root: 55, minor: false };
const Am: Chord = { root: 57, minor: true };

/** The first strain, then its answer that climbs to the octave. */
const A1: Phrase = {
  bars: [
    [
      [69, 2],
      [74, 1],
      [72, 2],
      [69, 1],
    ],
    [
      [67, 1],
      [69, 1],
      [71, 1],
      [69, 3],
    ],
    [
      [65, 2],
      [67, 1],
      [69, 2],
      [65, 1],
    ],
    [
      [64, 1],
      [65, 1],
      [64, 1],
      [62, 3],
    ],
  ],
  chords: [Dm, G, F, Dm],
};
const A2: Phrase = {
  bars: [
    A1.bars[0] ?? [],
    A1.bars[1] ?? [],
    [
      [65, 2],
      [67, 1],
      [69, 1],
      [71, 1],
      [72, 1],
    ],
    [
      [72, 1],
      [71, 1],
      [72, 1],
      [74, 3],
    ],
  ],
  chords: [Dm, G, F, Dm],
};
/** The second strain, higher and skipping, that comes down home. */
const B1: Phrase = {
  bars: [
    [
      [74, 1],
      [76, 1],
      [77, 1],
      [76, 2],
      [74, 1],
    ],
    [
      [72, 2],
      [74, 1],
      [76, 3],
    ],
    [
      [74, 1],
      [72, 1],
      [71, 1],
      [72, 2],
      [69, 1],
    ],
    [
      [71, 1],
      [69, 1],
      [67, 1],
      [69, 3],
    ],
  ],
  chords: [Dm, C, Am, G],
};
const B2: Phrase = {
  bars: [
    B1.bars[0] ?? [],
    B1.bars[1] ?? [],
    [
      [67, 2],
      [69, 1],
      [65, 2],
      [64, 1],
    ],
    [
      [62, 3],
      [0, 3],
    ],
  ],
  chords: [Dm, C, F, Dm],
};

/** The whole round, played twice over in a loop: the second time the lute takes the tune. */
export const RITORNELLO: readonly Phrase[] = [A1, A2, B1, B2];

/** Eighths in a bar (6/8). */
export const EIGHTHS_PER_BAR = 6;

/** s an eighth lasts: a dotted crotchet at 75 a minute, an easy dance. */
export const EIGHTH_SECONDS = 0.2;

/** Default loudness of the music, 0 to 100: discreet, under the sound effects. */
export const DEFAULT_MUSIC_VOLUME = 35;
