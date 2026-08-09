/**
 * Brand tokens lifted from the live hhgoa.com design system.
 *
 * The palette is the event's actual CSS custom properties (deep palm green,
 * electric yellow, hot pink) and the typefaces are the two faces the site
 * ships: Imbue for display, Victor Mono for everything technical.
 */

export const BRAND = {
  green: "#0b6839",
  greenDeep: "#064526",
  greenInk: "#03301a",
  yellow: "#fee101",
  pink: "#ff0080",
  white: "#ffffff",
  black: "#000000",
  sand: "#f6e7c6",
  sunset: "#ff7a1a",
};

export const EVENT = {
  name: "HACKER HOUSE GOA",
  short: "HH GOA",
  year: "2026",
  tagline: "LESS NOISE. MORE SIGNAL.",
  dates: "28-31 OCT 2026",
  datesPretty: "28 – 31 OCT 2026",
  place: "GOA, INDIA",
  site: "hhgoa.com",
  studio: "2:47 PM STUDIO",
  hashtag: "#FrameInGoa",
  cohort: "247",
};

/**
 * Canvas font stacks. The fallbacks matter: `ctx.font` silently falls back to
 * the default serif if a family hasn't finished loading, which turns the whole
 * mono layer into a serif. Naming generics keeps a miss at least the right
 * shape.
 */
export const FONT_DISPLAY = '"Imbue", ui-serif, Georgia, serif';
export const FONT_MONO = '"Victor Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

/** Canvas output sizes. */
export const SIZES = {
  /** X profile pictures are cropped to the inscribed circle of a square. */
  pfp: { w: 1024, h: 1024 },
  /** 16:9 renders in an X timeline without any crop. */
  card: { w: 1600, h: 900 },
};

/**
 * @typedef {"pfp" | "card"} FormatId
 * @typedef {"signal" | "sunset" | "terminal"} ThemeId
 *
 * @typedef {object} Theme
 * @property {ThemeId} id
 * @property {string} label
 * @property {string} base      Backdrop behind / around the photo.
 * @property {string} baseDeep
 * @property {string} band      The band that carries the event name.
 * @property {string} bandInk
 * @property {string} accent    Hairline + tick accents.
 * @property {string} accentAlt
 * @property {string} glow
 */

/** @type {Record<ThemeId, Theme>} */
export const THEMES = {
  signal: {
    id: "signal",
    label: "Signal",
    base: BRAND.green,
    baseDeep: BRAND.greenInk,
    band: BRAND.green,
    bandInk: BRAND.yellow,
    accent: BRAND.yellow,
    accentAlt: BRAND.pink,
    glow: BRAND.yellow,
  },
  sunset: {
    id: "sunset",
    label: "Sunset",
    base: BRAND.greenInk,
    baseDeep: "#01180d",
    band: BRAND.pink,
    bandInk: BRAND.white,
    accent: BRAND.yellow,
    accentAlt: BRAND.sunset,
    glow: BRAND.pink,
  },
  terminal: {
    id: "terminal",
    label: "Terminal",
    base: "#050b07",
    baseDeep: "#000000",
    band: "#050b07",
    bandInk: "#39ff88",
    accent: "#39ff88",
    accentAlt: BRAND.yellow,
    glow: "#39ff88",
  },
};

export const THEME_LIST = [THEMES.signal, THEMES.sunset, THEMES.terminal];
