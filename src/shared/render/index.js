/**
 * Render orchestration: one entry point the UI calls on every change.
 *
 * The visible <canvas> is sized at full output resolution and scaled down with
 * CSS, so the preview and the downloaded file are the same pixels — there's no
 * second "export" render that could drift from what the user approved.
 */

import { SIZES } from "../brand.js";
import { makeCanvas } from "../decode.js";
import { ensureFonts } from "../fonts.js";
import { renderCard } from "./card.js";
import { renderPfp } from "./pfp.js";
import { renderShareSheet, SHEET_SIZE } from "./sheet.js";

/**
 * @typedef {object} GraphicInput
 * @property {import("../brand.js").FormatId} format
 * @property {ImageBitmap} bitmap
 * @property {import("../smartcrop.js").CropState} crop
 * @property {import("../brand.js").Theme} theme
 * @property {string} name
 * @property {string} role
 * @property {string} title
 * @property {string} clearance
 * @property {string} serial
 */

export function outputSize(format) {
  return format === "pfp" ? SIZES.pfp : SIZES.card;
}

function get2d(canvas) {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("This browser blocked 2D canvas rendering.");
  return ctx;
}

/**
 * Draws `input` into `canvas`, resizing it to the format's output size first.
 *
 * Synchronous on purpose. Callers gate on {@link ensureFonts} once and then
 * paint straight through, so the canvas can never lag behind state and a
 * throttled or backgrounded tab (where rAF never fires) still renders.
 * Pointer events are already frame-aligned, so this needs no extra coalescing.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {GraphicInput} input
 */
export function paint(canvas, input) {
  const { w, h } = outputSize(input.format);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  drawInto(get2d(canvas), input);
}

function drawInto(ctx, input) {
  if (input.format === "pfp") {
    renderPfp(ctx, { bitmap: input.bitmap, crop: input.crop, theme: input.theme, make: makeCanvas });
  } else {
    renderCard(ctx, {
      bitmap: input.bitmap,
      crop: input.crop,
      theme: input.theme,
      name: input.name,
      role: input.role,
      title: input.title,
      clearance: input.clearance,
      serial: input.serial,
      make: makeCanvas,
    });
  }
}

/** @param {HTMLCanvasElement | OffscreenCanvas} canvas */
export function toPngBlob(canvas) {
  if ("convertToBlob" in canvas) {
    return canvas.convertToBlob({ type: "image/png" });
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the image."))),
      "image/png"
    );
  });
}

/**
 * The 16:9 image used for the link preview.
 *
 * Cards are already 16:9 so they're used as-is; a square PFP gets wrapped in a
 * branded sheet, because X's large-image card would otherwise crop it badly.
 *
 * @param {GraphicInput} input
 * @param {HTMLCanvasElement} rendered
 */
export async function buildShareImage(input, rendered) {
  await ensureFonts();
  if (input.format === "card") return toPngBlob(rendered);

  const sheet = makeCanvas(SHEET_SIZE.w, SHEET_SIZE.h);
  renderShareSheet(get2d(sheet), { pfp: rendered, theme: input.theme, make: makeCanvas });
  return toPngBlob(sheet);
}

/** @param {GraphicInput} input */
export function fileNameFor(input) {
  const slug =
    input.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 32) || "builder";
  return input.format === "pfp" ? `hhgoa-2026-pfp-${slug}.png` : `hhgoa-2026-builder-id-${slug}.png`;
}
