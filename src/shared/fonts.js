/**
 * Canvas needs the brand faces resolved before the first draw, otherwise the
 * first render silently falls back to a system font. `document.fonts.load`
 * matches against the @font-face rules in styles.css.
 */

const FACES = [
  '900 100px "Imbue"',
  '700 100px "Imbue"',
  '400 100px "Imbue"',
  '900 100px "Victor Mono"',
  '700 100px "Victor Mono"',
  '500 100px "Victor Mono"',
  '400 100px "Victor Mono"',
];

/** @type {Promise<void> | null} */
let pending = null;

/** @returns {Promise<void>} */
export function ensureFonts() {
  if (pending) return pending;

  pending = (async () => {
    if (typeof document === "undefined" || !document.fonts) return;
    try {
      // Sample glyphs from both scripts we ship so the latin-ext subset loads too.
      await Promise.all(FACES.map((f) => document.fonts.load(f, "HHGOA 2026 #FrameInGoa")));
      await document.fonts.ready;
    } catch {
      // A missing webfont degrades to a fallback face; not worth blocking a render.
    }
  })();

  return pending;
}
