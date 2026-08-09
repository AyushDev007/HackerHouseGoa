/**
 * Format A — the profile-picture frame.
 *
 * X renders avatars as the circle inscribed in the square, so every piece of
 * branding that has to survive lives inside radius 512. The corners are treated
 * as decoration for the downloaded square only: they look intentional if you
 * post the file, and cost nothing when they get clipped away.
 */

import { BRAND, EVENT, FONT_MONO, SIZES } from "../brand.js";
import { coverDraw } from "../smartcrop.js";
import {
  arcText,
  drawGrain,
  drawCircularPhoto,
  halftone,
  measureTracked,
  palmFrond,
  roundRectPath,
  slicedSun,
  trackedText,
} from "./atoms.js";

const S = SIZES.pfp.w;
const C = S / 2;

/** Ring geometry, all inside the 512 avatar circle. */
const RING_OUTER = 496;
const RING_WIDTH = 66;
const RING_INNER = RING_OUTER - RING_WIDTH; // 430 — the photo disc
const TEXT_RADIUS = RING_INNER + RING_WIDTH / 2;

/** Side of the box the photo is fitted into, in output pixels. Gesture maths needs this. */
export const PFP_PHOTO_BOX = RING_INNER * 2;

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{bitmap: ImageBitmap, crop: import("../smartcrop.js").CropState, theme: import("../brand.js").Theme, make: Function}} input
 */
export function renderPfp(ctx, input) {
  const { bitmap, crop, theme, make } = input;

  ctx.save();
  ctx.clearRect(0, 0, S, S);

  drawBackdrop(ctx, theme);

  // Photo.
  const placement = coverDraw(bitmap.width, bitmap.height, RING_INNER * 2, RING_INNER * 2, crop);
  drawCircularPhoto(ctx, bitmap, C, C, RING_INNER, placement);

  // A soft vignette keeps the ring from vibrating against a busy photo.
  const vignette = ctx.createRadialGradient(C, C, RING_INNER * 0.72, C, C, RING_INNER);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.34)");
  ctx.save();
  ctx.beginPath();
  ctx.arc(C, C, RING_INNER, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, S, S);
  ctx.restore();

  drawRing(ctx, theme);
  drawHashtagChip(ctx, theme);

  drawGrain(ctx, S, S, 0.05, make);
  ctx.restore();
}

function drawBackdrop(ctx, theme) {
  const g = ctx.createLinearGradient(0, 0, S, S);
  g.addColorStop(0, theme.base);
  g.addColorStop(1, theme.baseDeep);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);

  // Corner decoration — clipped away by the avatar circle, present in the file.
  // Kept at high opacity: a half-transparent yellow over green just reads as mud.
  slicedSun(ctx, S - 34, 40, 168, theme.accent, 0.92);

  ctx.save();
  ctx.globalAlpha = 0.38;
  palmFrond(ctx, -20, S + 24, 320, -1.06, 0.5, BRAND.black);
  palmFrond(ctx, -20, S + 24, 262, -0.5, 0.55, BRAND.black);
  palmFrond(ctx, S + 20, S + 20, 280, Math.PI + 1.0, -0.5, BRAND.black);
  ctx.restore();

  halftone(ctx, 0, 0, S, S, 22, theme.accent, { maxRadius: 3.1, fade: "down", alpha: 0.16 });
}

function drawRing(ctx, theme) {
  // Band.
  ctx.save();
  ctx.beginPath();
  ctx.arc(C, C, RING_OUTER, 0, Math.PI * 2);
  ctx.arc(C, C, RING_INNER, 0, Math.PI * 2, true);
  ctx.closePath();

  const bandGrad = ctx.createLinearGradient(0, C - RING_OUTER, 0, C + RING_OUTER);
  bandGrad.addColorStop(0, theme.band);
  bandGrad.addColorStop(0.55, theme.band);
  bandGrad.addColorStop(1, theme.baseDeep);
  ctx.fillStyle = bandGrad;
  ctx.fill();
  ctx.restore();

  // Hairlines on both edges of the band.
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(C, C, RING_OUTER - 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(C, C, RING_INNER + 3, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = theme.accentAlt;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(C, C, RING_OUTER - 10, 0, Math.PI * 2);
  ctx.stroke();

  // Instrument-style ticks around the band.
  ctx.save();
  ctx.translate(C, C);
  ctx.strokeStyle = theme.accentAlt;
  for (let i = 0; i < 120; i++) {
    const a = (i / 120) * Math.PI * 2;
    // Leave the arcs at 12 and 6 o'clock clear for the type.
    const deg = (a * 180) / Math.PI;
    const nearTop = deg < 68 || deg > 292;
    const nearBottom = deg > 112 && deg < 248;
    if (nearTop || nearBottom) continue;
    const major = i % 5 === 0;
    ctx.globalAlpha = major ? 0.95 : 0.4;
    ctx.lineWidth = major ? 3 : 1.6;
    const len = major ? 15 : 8;
    ctx.beginPath();
    ctx.moveTo(Math.sin(a) * (TEXT_RADIUS - len / 2), -Math.cos(a) * (TEXT_RADIUS - len / 2));
    ctx.lineTo(Math.sin(a) * (TEXT_RADIUS + len / 2), -Math.cos(a) * (TEXT_RADIUS + len / 2));
    ctx.stroke();
  }
  ctx.restore();

  // Arc type.
  ctx.fillStyle = theme.bandInk;
  ctx.font = `700 40px ${FONT_MONO}`;
  arcText(ctx, EVENT.name, C, C, TEXT_RADIUS, 0, false, 7);

  ctx.font = `500 27px ${FONT_MONO}`;
  ctx.fillStyle = theme.accent;
  arcText(ctx, `${EVENT.dates} · ${EVENT.place}`, C, C, TEXT_RADIUS + 1, Math.PI, true, 5);

  // Diamonds separating the two arcs.
  ctx.fillStyle = theme.accentAlt;
  for (const angle of [Math.PI / 2, -Math.PI / 2]) {
    const x = C + Math.sin(angle) * TEXT_RADIUS;
    const y = C - Math.cos(angle) * TEXT_RADIUS;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-9, -9, 18, 18);
    ctx.restore();
  }
}

/** The call-to-action, deliberately overlapping the photo's lower edge. */
function drawHashtagChip(ctx, theme) {
  ctx.font = `700 30px ${FONT_MONO}`;
  const tracking = 2.5;
  const textW = measureTracked(ctx, EVENT.hashtag, tracking);
  const padX = 30;
  const w = textW + padX * 2;
  const h = 62;
  const x = C - w / 2;
  const y = C + RING_INNER - h / 2 - 26;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 26;
  ctx.shadowOffsetY = 6;
  roundRectPath(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = theme.accentAlt;
  ctx.fill();
  ctx.restore();

  roundRectPath(ctx, x, y, w, h, h / 2);
  ctx.strokeStyle = theme.id === "terminal" ? BRAND.black : BRAND.white;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = theme.id === "terminal" ? BRAND.black : BRAND.white;
  ctx.textBaseline = "middle";
  trackedText(ctx, EVENT.hashtag, C, y + h / 2 + 1, tracking, "center");
  ctx.textBaseline = "alphabetic";
}
