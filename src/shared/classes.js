/**
 * The "builder class" — a Goa-flavoured title generated from the builder's
 * details. Deterministic for a given (name, role, seed) so a re-render never
 * silently changes someone's card; the reroll button just bumps the seed.
 */

const PREFIX = [
  "Susegad",
  "Sunburnt",
  "Feni-Fuelled",
  "Midnight",
  "Low-Latency",
  "Salt-Crusted",
  "Offline-First",
  "Barefoot",
  "Monsoon",
  "Ocean-Cooled",
  "Terminal-Dwelling",
  "Zero-Downtime",
  "Cache-Warm",
  "Sunset-Deploying",
  "Palm-Shaded",
  "Hammock-Bound",
  "Kernel-Level",
  "Beachside",
  "Solar-Powered",
  "Chai-Driven",
  "Tide-Locked",
  "Sand-in-the-Keyboard",
  "Always-On",
  "Red-Eye",
  "High-Signal",
];

const NOUN = [
  "Shipwright",
  "Signal Hunter",
  "Merge Monk",
  "Latency Slayer",
  "Bytecode Bandit",
  "Sandbox Pirate",
  "Commit Curator",
  "Demo Day Dragon",
  "Stack Whisperer",
  "Prompt Smith",
  "Rollback Rebel",
  "Edge Runner",
  "Null Tamer",
  "Deploy Djinn",
  "Segfault Surfer",
  "Bandwidth Baron",
  "Regex Rishi",
  "Pixel Pilot",
  "Daemon Tamer",
  "Refactor Rogue",
  "Uptime Oracle",
  "Payload Poet",
  "Bounty Hunter",
  "Beach Architect",
  "Roadmap Renegade",
];

/** Small flavour line that sits under the class on the ID card. */
const CLEARANCE = [
  "SHIPS AT SUNRISE",
  "TALKS IN DIFFS",
  "SLEEP: OPTIONAL",
  "PUSHES TO MAIN",
  "READS THE DOCS",
  "ONE MORE COMMIT",
  "BUILDS IN PUBLIC",
  "NO SLIDES, JUST DEMO",
  "OCEAN > OFFICE",
  "LOCKED IN",
];

/**
 * FNV-1a, kept in 32-bit unsigned space.
 * @param {string} input
 * @returns {number}
 */
export function hash32(input) {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * @typedef {object} BuilderClass
 * @property {string} title
 * @property {string} clearance
 * @property {string} serial   Badge serial, e.g. "247-4F2A".
 */

/**
 * @param {string} name
 * @param {string} role
 * @param {number} seed
 * @returns {BuilderClass}
 */
export function buildClass(name, role, seed) {
  const key = `${name.trim().toLowerCase()}|${role.trim().toLowerCase()}|${seed}`;
  const h = hash32(key);

  // Pull independent-ish indices out of different bit ranges of one hash.
  const prefix = PREFIX[h % PREFIX.length];
  const noun = NOUN[(h >>> 8) % NOUN.length];
  const clearance = CLEARANCE[(h >>> 16) % CLEARANCE.length];

  const serialHex = (hash32(`serial:${key}`) % 0xffff).toString(16).toUpperCase().padStart(4, "0");

  return {
    title: `${prefix} ${noun}`,
    clearance,
    serial: `247-${serialHex}`,
  };
}

/**
 * Seeded PRNG (mulberry32) so decorative noise is stable across re-renders.
 * @param {number} seed
 * @returns {() => number}
 */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
