// UI typefaces (ASSETS §8): a textura for titles, IM Fell roman for readable text (its italic
// reads poorly, so the UI never uses it). Bundled (OFL),
// so the game needs no network; Phaser texts are created only after they have loaded.
import '@fontsource/unifrakturmaguntia/400.css';
import '@fontsource/im-fell-english/400.css';
import '@fontsource/im-fell-english-sc/400.css';

export const FONT_TITLE = "'UnifrakturMaguntia', 'IM Fell English', Georgia, serif";
export const FONT_TEXT = "'IM Fell English', Georgia, 'Book Antiqua', serif";
export const FONT_CAPS = "'IM Fell English SC', 'IM Fell English', Georgia, serif";

/** Resolves once the three faces are usable (or failed: the fallbacks then apply). */
export async function loadFonts(): Promise<void> {
  try {
    await Promise.all(
      [FONT_TITLE, FONT_TEXT, FONT_CAPS].map((f) => document.fonts.load(`32px ${f}`, 'Éé')),
    );
  } catch {
    // Fallback serif faces keep the game playable.
  }
}
