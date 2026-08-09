/**
 * Auto-framing, so nobody has to crop their photo before using the tool.
 *
 * A cover-fit crop at zoom 1 only has one degree of freedom — the offset along
 * whichever axis overflows — so finding the best framing is a 1-D search over a
 * tiny saliency map rather than anything expensive. Faces are weighted heavily
 * because in practice these are all photos of people.
 */

import { makeCanvas } from "./decode.js";

/**
 * Focal point in normalised source coordinates plus a user zoom multiplier.
 * @typedef {object} CropState
 * @property {number} fx
 * @property {number} fy
 * @property {number} zoom
 */

/** @type {CropState} */
export const DEFAULT_CROP = { fx: 0.5, fy: 0.5, zoom: 1 };

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Where to draw a source of sw×sh into a tw×th target, cover-fit around the focal point.
 * @param {number} sw @param {number} sh @param {number} tw @param {number} th @param {CropState} crop
 */
export function coverDraw(sw, sh, tw, th, crop) {
  const scale = Math.max(tw / sw, th / sh) * Math.max(1, crop.zoom);
  const dw = sw * scale;
  const dh = sh * scale;
  // Put the focal point at the target's centre, then pull back so no gap shows.
  const dx = clamp(tw / 2 - crop.fx * dw, tw - dw, 0);
  const dy = clamp(th / 2 - crop.fy * dh, th - dh, 0);
  return { dx, dy, dw, dh };
}

/**
 * Re-derives the focal point after a drag of (dxPx, dyPx) in target pixels.
 * @param {CropState} crop
 * @param {number} sw @param {number} sh @param {number} tw @param {number} th
 * @param {number} dxPx @param {number} dyPx
 * @returns {CropState}
 */
export function panCrop(crop, sw, sh, tw, th, dxPx, dyPx) {
  const scale = Math.max(tw / sw, th / sh) * Math.max(1, crop.zoom);
  const dw = sw * scale;
  const dh = sh * scale;
  // Dragging the image right means looking further left in the source.
  return {
    ...crop,
    fx: dw > tw ? clamp(crop.fx - dxPx / dw, tw / 2 / dw, 1 - tw / 2 / dw) : 0.5,
    fy: dh > th ? clamp(crop.fy - dyPx / dh, th / 2 / dh, 1 - th / 2 / dh) : 0.5,
  };
}

/**
 * Keeps a focal point legal after a zoom change so the frame never shows a gap.
 * @param {CropState} crop
 * @param {number} sw @param {number} sh @param {number} tw @param {number} th
 * @returns {CropState}
 */
export function clampCrop(crop, sw, sh, tw, th) {
  const scale = Math.max(tw / sw, th / sh) * Math.max(1, crop.zoom);
  const dw = sw * scale;
  const dh = sh * scale;
  return {
    ...crop,
    fx: dw > tw ? clamp(crop.fx, tw / 2 / dw, 1 - tw / 2 / dw) : 0.5,
    fy: dh > th ? clamp(crop.fy, th / 2 / dh, 1 - th / 2 / dh) : 0.5,
  };
}

/** YCbCr skin-tone gate — noticeably more tone-inclusive than the RGB-only rules. */
function skinScore(r, g, b) {
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  if (y < 40 || y > 245) return 0;
  if (cb < 77 || cb > 133) return 0;
  if (cr < 133 || cr > 180) return 0;
  // Peak confidence in the middle of the chroma window, tapering to the edges.
  const cbMid = 1 - Math.abs(cb - 105) / 28;
  const crMid = 1 - Math.abs(cr - 154) / 26;
  return Math.max(0, Math.min(1, cbMid * crMid));
}

/**
 * Separable box blur, so a whole face region inherits credit from its features.
 * @param {Float32Array} src @param {number} w @param {number} h @param {number} radius
 */
function boxBlur(src, w, h, radius) {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const span = radius * 2 + 1;

  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) {
        sum += src[row + Math.min(w - 1, Math.max(0, x + k))];
      }
      tmp[row + x] = sum / span;
    }
  }

  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) {
        sum += tmp[Math.min(h - 1, Math.max(0, y + k)) * w + x];
      }
      out[y * w + x] = sum / span;
    }
  }
  return out;
}

/**
 * Picks the framing for a `tw:th` crop of the given bitmap.
 * Returns a focal point; the caller feeds it straight to `coverDraw`.
 * @param {ImageBitmap} bitmap @param {number} tw @param {number} th
 * @returns {CropState}
 */
export function detectFocal(bitmap, tw, th) {
  const S = 100;
  const long = Math.max(bitmap.width, bitmap.height);
  const w = Math.max(8, Math.round((bitmap.width / long) * S));
  const h = Math.max(8, Math.round((bitmap.height / long) * S));

  let data;
  try {
    const canvas = makeCanvas(w, h);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return DEFAULT_CROP;
    ctx.drawImage(bitmap, 0, 0, w, h);
    data = ctx.getImageData(0, 0, w, h).data;
  } catch {
    return DEFAULT_CROP;
  }

  const n = w * h;
  const luma = new Float32Array(n);
  const skin = new Float32Array(n);
  const edge = new Float32Array(n);
  const score = new Float32Array(n);

  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    luma[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    const sat = mx === 0 ? 0 : (mx - mn) / mx;

    skin[i] = skinScore(r, g, b);
    score[i] = skin[i] * 1.5 + sat * 0.5;
  }

  // Gradient magnitude adds structure (hair, glasses, shoulders) to the map.
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = luma[i + 1] - luma[i - 1];
      const gy = luma[i + w] - luma[i - w];
      edge[i] = Math.min(1, Math.hypot(gx, gy) / 90);
      score[i] += edge[i];
    }
  }

  /**
   * Skin colour alone is a bad face detector — sand, tan walls and beige
   * clothing all sit squarely inside any chroma gate, and they're usually the
   * largest thing in the frame. Requiring local detail as well is what
   * separates a face (eyes, mouth, hairline) from a flat wash of the same hue.
   */
  const edgeNear = boxBlur(edge, w, h, 2);
  let faceMass = 0;
  let faceX = 0;
  let faceY = 0;
  for (let i = 0; i < n; i++) {
    const f = skin[i] * Math.min(1, edgeNear[i] * 3);
    if (f <= 0) continue;
    faceMass += f;
    faceX += f * (i % w);
    faceY += f * ((i / w) | 0);
  }

  // Subjects are rarely jammed against the border; taper the outer 12%.
  const edgeTaper = (t) => Math.min(1, t / 0.12, (1 - t) / 0.12) * 0.35 + 0.65;
  for (let y = 0; y < h; y++) {
    const ty = edgeTaper((y + 0.5) / h);
    for (let x = 0; x < w; x++) {
      score[y * w + x] *= ty * edgeTaper((x + 0.5) / w);
    }
  }

  const targetAspect = tw / th;
  const srcAspect = w / h;

  // Cover-fit at zoom 1: exactly one axis overflows, so search only that axis.
  if (Math.abs(srcAspect - targetAspect) < 1e-3) return { fx: 0.5, fy: 0.5, zoom: 1 };

  /**
   * With a convincing face signal, anchor on it directly.
   *
   * Summing saliency across a window quietly favours whatever is *biggest*, so
   * on a normal portrait the torso outvotes the head and the crop slides down
   * past it. Anchoring on the face centroid instead — and seating it above the
   * window's middle, where a head belongs — avoids that entirely.
   */
  // Slightly above the middle: enough headroom that a circular mask doesn't clip hair.
  const HEAD_ANCHOR = 0.44;
  if (faceMass > n * 0.004) {
    const cxs = faceX / faceMass;
    const cys = faceY / faceMass;

    if (srcAspect > targetAspect) {
      const winW = Math.max(1, Math.round(h * targetAspect));
      const left = clamp(cxs - winW / 2, 0, Math.max(0, w - winW));
      return { fx: clamp((left + winW / 2) / w, 0, 1), fy: 0.5, zoom: 1 };
    }

    const winH = Math.max(1, Math.round(w / targetAspect));
    const top = clamp(cys - HEAD_ANCHOR * winH, 0, Math.max(0, h - winH));
    return { fx: 0.5, fy: clamp((top + winH / 2) / h, 0, 1), zoom: 1 };
  }

  /**
   * No usable face (a landscape, a pet, a logo). Fall back to raw saliency,
   * scoring each candidate window with a centre-favouring weight so a big dull
   * region can't outvote a smaller interesting one purely on area. The map is
   * ~100px on its long edge, so evaluating windows directly is a few thousand
   * operations — no need for a running sum.
   */
  const centreWeight = (t) => 1 - 0.6 * (2 * t - 1) ** 2;

  if (srcAspect > targetAspect) {
    // Source is wider than the frame — slide horizontally.
    const winW = Math.max(1, Math.round(h * targetAspect));
    const colSum = new Float32Array(w);
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let y = 0; y < h; y++) s += score[y * w + x];
      colSum[x] = s;
    }
    let best = -Infinity;
    let bestX = 0;
    for (let left = 0; left + winW <= w; left++) {
      let s = 0;
      for (let i = 0; i < winW; i++) s += colSum[left + i] * centreWeight((i + 0.5) / winW);
      if (s > best) {
        best = s;
        bestX = left;
      }
    }
    return { fx: clamp((bestX + winW / 2) / w, 0, 1), fy: 0.5, zoom: 1 };
  }

  // Source is taller than the frame — slide vertically.
  const winH = Math.max(1, Math.round(w / targetAspect));
  const rowSum = new Float32Array(h);
  for (let y = 0; y < h; y++) {
    let s = 0;
    for (let x = 0; x < w; x++) s += score[y * w + x];
    rowSum[y] = s;
  }
  let best = -Infinity;
  let bestY = 0;
  for (let top = 0; top + winH <= h; top++) {
    let s = 0;
    for (let i = 0; i < winH; i++) s += rowSum[top + i] * centreWeight((i + 0.5) / winH);
    if (s > best) {
      best = s;
      bestY = top;
    }
  }
  return { fx: 0.5, fy: clamp((bestY + winH / 2) / h, 0, 1), zoom: 1 };
}
