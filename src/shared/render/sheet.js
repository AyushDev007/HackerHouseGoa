/**
 * A 16:9 wrapper around a finished PFP.
 *
 * The square avatar is the thing people actually want to download, but a square
 * makes a poor link preview — X's `summary_large_image` card is 16:9. This
 * renders the circle onto a branded sheet so a shared link previews properly.
 */

import { BRAND, EVENT, FONT_DISPLAY, FONT_MONO } from "../brand.js";
import {
  drawGrain,
  fitFontSize,
  halftone,
  palmFrond,
  trackedText,
  measureTracked,
  roundRectPath,
} from "./atoms.js";

const W = 1600;
const H = 900;

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{pfp: CanvasImageSource, theme: import("../brand.js").Theme, make: Function}} input
 */
export function renderShareSheet(ctx, input) {
  const { pfp, theme, make } = input;

  ctx.save();
  ctx.clearRect(0, 0, W, H);

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, theme.base);
  bg.addColorStop(1, theme.baseDeep);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // A soft glow rather than a sun disc: at this scale the disc's hard edge cut
  // straight across the avatar and read as a stray shape, not as light.
  const horizon = ctx.createRadialGradient(W * 0.36, H * 1.12, 30, W * 0.36, H * 1.12, W * 0.5);
  horizon.addColorStop(0, theme.glow);
  horizon.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = horizon;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  halftone(ctx, 0, 0, W, H, 22, theme.accent, { maxRadius: 3, fade: "down", alpha: 0.14 });

  ctx.save();
  ctx.globalAlpha = 0.4;
  palmFrond(ctx, -20, H + 20, 380, -1.12, 0.5, BRAND.black);
  palmFrond(ctx, -20, H + 20, 300, -0.6, 0.58, BRAND.black);
  palmFrond(ctx, W + 20, H + 24, 340, Math.PI + 1.1, -0.5, BRAND.black);
  ctx.restore();

  // Avatar, cropped to the circle X would show.
  const size = 620;
  const cx = 380;
  const cy = H / 2 - 6;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 16;
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = theme.baseDeep;
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.clip();
  // Scale so the PFP's outer ring meets the clip exactly (ring sits at 496/512
  // of the square). Anything less and its corner artwork peeks into the circle.
  const drawn = size * (512 / 496);
  ctx.drawImage(pfp, cx - drawn / 2, cy - drawn / 2, drawn, drawn);
  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, size / 2 + 6, 0, Math.PI * 2);
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 4;
  ctx.stroke();

  // Copy block.
  const tx = 790;
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = theme.accent;
  ctx.font = `700 24px ${FONT_MONO}`;
  trackedText(ctx, `${EVENT.dates}  ·  ${EVENT.place}`, tx, 250, 5, "left");

  ctx.fillStyle = BRAND.white;
  ctx.font = `900 128px ${FONT_DISPLAY}`;
  trackedText(ctx, "NEW PFP.", tx, 380, 2, "left");
  trackedText(ctx, "SEE YOU", tx, 492, 2, "left");
  ctx.fillStyle = theme.accent;
  trackedText(ctx, "IN GOA.", tx, 604, 2, "left");

  // Fitted rather than fixed: the full string overruns the 750px column at 24px.
  const metaLine = `${EVENT.name} ${EVENT.year}  ·  ${EVENT.tagline}`;
  const metaWidth = W - tx - 60;
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  fitFontSize(ctx, metaLine, metaWidth, (s) => {
    ctx.font = `500 ${s}px ${FONT_MONO}`;
  }, 24, 14, 2);
  trackedText(ctx, metaLine, tx, 662, 2, "left");

  // Hashtag chip.
  ctx.font = `900 36px ${FONT_MONO}`;
  const chipText = EVENT.hashtag;
  const chipW = measureTracked(ctx, chipText, 3) + 64;
  const chipH = 74;
  roundRectPath(ctx, tx, 700, chipW, chipH, chipH / 2);
  ctx.fillStyle = theme.accentAlt;
  ctx.fill();
  ctx.fillStyle = theme.id === "terminal" ? BRAND.black : BRAND.white;
  ctx.textBaseline = "middle";
  trackedText(ctx, chipText, tx + 32, 700 + chipH / 2 + 1, 3, "left");
  ctx.textBaseline = "alphabetic";

  drawGrain(ctx, W, H, 0.05, make);
  ctx.restore();
}

export const SHEET_SIZE = { w: W, h: H };
