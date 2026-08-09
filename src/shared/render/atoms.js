/**
 * Shared canvas primitives for both output formats.
 *
 * Everything decorative is driven by a seeded PRNG so a re-render (theme
 * change, name edit) never reshuffles the grain underneath the user.
 */

import { rng } from "../classes.js";

/** @typedef {CanvasRenderingContext2D} Ctx */

/** @param {Ctx} ctx */
export function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

/**
 * Canvas `letterSpacing` is still uneven across browsers, so space glyphs by hand.
 * @param {Ctx} ctx
 * @param {"left"|"center"|"right"} [align]
 * @returns {number} rendered width
 */
export function trackedText(ctx, text, x, y, tracking, align = "left") {
  const chars = [...text];
  const width = measureTracked(ctx, text, tracking);
  let cursor = align === "left" ? x : align === "center" ? x - width / 2 : x - width;

  const prevAlign = ctx.textAlign;
  ctx.textAlign = "left";
  for (const ch of chars) {
    ctx.fillText(ch, cursor, y);
    cursor += ctx.measureText(ch).width + tracking;
  }
  ctx.textAlign = prevAlign;
  return width;
}

/** @param {Ctx} ctx */
export function measureTracked(ctx, text, tracking) {
  const chars = [...text];
  if (chars.length === 0) return 0;
  let w = 0;
  for (const ch of chars) w += ctx.measureText(ch).width + tracking;
  return w - tracking;
}

/**
 * Largest font size at which `text` fits `maxWidth`.
 * `setFont` receives a size and must apply it to the context.
 * @param {Ctx} ctx
 * @param {(size: number) => void} setFont
 */
export function fitFontSize(ctx, text, maxWidth, setFont, max, min, tracking = 0) {
  let lo = min;
  let hi = max;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    setFont(mid);
    if (measureTracked(ctx, text, tracking) <= maxWidth) lo = mid;
    else hi = mid;
  }
  setFont(lo);
  return lo;
}

/**
 * Hard-truncates with an ellipsis once shrinking has bottomed out.
 * @param {Ctx} ctx
 */
export function ellipsize(ctx, text, maxWidth, tracking = 0) {
  if (measureTracked(ctx, text, tracking) <= maxWidth) return text;
  const chars = [...text];
  while (chars.length > 1) {
    chars.pop();
    const candidate = chars.join("").trimEnd() + "…";
    if (measureTracked(ctx, candidate, tracking) <= maxWidth) return candidate;
  }
  return "…";
}

/**
 * Text on a circle. `centerAngle` is radians clockwise from 12 o'clock.
 * `flip` flops the glyphs so a bottom arc still reads left-to-right.
 * @param {Ctx} ctx
 */
export function arcText(ctx, text, cx, cy, radius, centerAngle, flip, tracking = 0) {
  const chars = [...text];
  if (!chars.length) return;
  const widths = chars.map((c) => ctx.measureText(c).width + tracking);
  const totalAngle = widths.reduce((a, b) => a + b, 0) / radius;

  const prevAlign = ctx.textAlign;
  const prevBaseline = ctx.textBaseline;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.save();
  ctx.translate(cx, cy);
  const dir = flip ? -1 : 1;
  let a = centerAngle - (dir * totalAngle) / 2;
  for (let i = 0; i < chars.length; i++) {
    const advance = widths[i] / radius;
    ctx.save();
    ctx.rotate(a + (dir * advance) / 2);
    ctx.translate(0, -radius);
    if (flip) ctx.rotate(Math.PI);
    ctx.fillText(chars[i], 0, 0);
    ctx.restore();
    a += dir * advance;
  }
  ctx.restore();

  ctx.textAlign = prevAlign;
  ctx.textBaseline = prevBaseline;
}

/** Cached 256px noise tile; repeated as a pattern instead of per-pixel over the full canvas. */
let grainTile = null;

function getGrainTile(make) {
  if (grainTile) return grainTile;
  const size = 256;
  const c = make(size, size);
  const g = c.getContext("2d");
  if (!g) return null;
  const img = g.createImageData(size, size);
  const rand = rng(0x9e3779b9);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (rand() - 0.5) * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  grainTile = c;
  return grainTile;
}

/** @param {Ctx} ctx */
export function drawGrain(ctx, w, h, alpha, make) {
  const tile = getGrainTile(make);
  if (!tile) return;
  const pattern = ctx.createPattern(tile, "repeat");
  if (!pattern) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = "overlay";
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/**
 * Halftone dot field that fades along a direction — the print-y texture in the backdrop.
 * @param {Ctx} ctx
 * @param {{maxRadius?: number, fade?: "up"|"down"|"none", alpha?: number}} [opts]
 */
export function halftone(ctx, x, y, w, h, spacing, color, opts = {}) {
  const { maxRadius = spacing * 0.34, fade = "none", alpha = 1 } = opts;
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  const cols = Math.ceil(w / spacing);
  const rows = Math.ceil(h / spacing);
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const px = x + c * spacing + (r % 2 ? spacing / 2 : 0);
      const py = y + r * spacing;
      if (px < x - spacing || px > x + w + spacing) continue;
      const t = rows === 0 ? 0 : r / rows;
      const k = fade === "up" ? 1 - t : fade === "down" ? t : 1;
      const radius = maxRadius * k;
      if (radius <= 0.15) continue;
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/**
 * Retro sunset disc: solid sun sliced by horizontal gaps that widen toward the horizon.
 * @param {Ctx} ctx
 */
export function slicedSun(ctx, cx, cy, radius, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();

  const grad = ctx.createLinearGradient(0, cy - radius, 0, cy + radius);
  grad.addColorStop(0, color);
  grad.addColorStop(1, color);
  ctx.fillStyle = grad;
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

  // Punch out widening slits toward the bottom of the disc.
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "#000";
  let y = cy - radius * 0.05;
  let gap = radius * 0.035;
  while (y < cy + radius) {
    ctx.fillRect(cx - radius, y, radius * 2, gap);
    y += gap + radius * 0.09;
    gap *= 1.45;
  }
  ctx.restore();
}

/**
 * A single palm frond growing from (x, y). `angle` is radians, 0 = pointing right.
 * @param {Ctx} ctx
 */
export function palmFrond(ctx, x, y, len, angle, droop, color) {
  const steps = 26;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;

  // Spine: a quadratic that sags by `droop`.
  const p = (t) => ({ x: len * t, y: droop * len * t * t });

  ctx.lineWidth = Math.max(1.5, len * 0.012);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  for (let i = 1; i <= steps; i++) {
    const q = p(i / steps);
    ctx.lineTo(q.x, q.y);
  }
  ctx.stroke();

  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const base = p(t);
    const ahead = p(Math.min(1, t + 0.04));
    const tx = ahead.x - base.x;
    const ty = ahead.y - base.y;
    const tl = Math.hypot(tx, ty) || 1;
    const nx = -ty / tl;
    const ny = tx / tl;

    // Leaflets are longest mid-frond and sweep back toward the base.
    const leaf = len * 0.3 * Math.pow(Math.sin(Math.PI * t), 0.75);
    if (leaf < 1) continue;
    const sweepX = -tx / tl;
    const sweepY = -ty / tl;

    for (const side of [1, -1]) {
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.quadraticCurveTo(
        base.x + nx * side * leaf * 0.6 + sweepX * leaf * 0.1,
        base.y + ny * side * leaf * 0.6 + sweepY * leaf * 0.1,
        base.x + nx * side * leaf * 0.82 + sweepX * leaf * 0.55,
        base.y + ny * side * leaf * 0.82 + sweepY * leaf * 0.55
      );
      ctx.quadraticCurveTo(
        base.x + nx * side * leaf * 0.3,
        base.y + ny * side * leaf * 0.3,
        base.x,
        base.y
      );
      ctx.fill();
    }
  }
  ctx.restore();
}

/** @param {Ctx} ctx */
export function dashedLine(ctx, x1, y1, x2, y2, dash, color, width) {
  ctx.save();
  ctx.setLineDash(dash);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

/**
 * Decorative barcode for the badge stub. Deterministic from `seed`.
 * @param {Ctx} ctx
 */
export function barcode(ctx, x, y, w, h, seed, color) {
  const rand = rng(seed);
  ctx.save();
  ctx.fillStyle = color;
  let cursor = x;
  while (cursor < x + w) {
    const bar = 1 + Math.floor(rand() * 4);
    const gap = 1 + Math.floor(rand() * 4);
    if (cursor + bar > x + w) break;
    ctx.fillRect(cursor, y, bar, h);
    cursor += bar + gap;
  }
  ctx.restore();
}

/**
 * Clips to a circle, draws the photo cover-fit, restores.
 * @param {Ctx} ctx
 */
export function drawCircularPhoto(ctx, bitmap, cx, cy, radius, placement) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(bitmap, cx - radius + placement.dx, cy - radius + placement.dy, placement.dw, placement.dh);
  ctx.restore();
}
