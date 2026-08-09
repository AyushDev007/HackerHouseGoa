/**
 * Turning whatever came out of someone's camera roll into an ImageBitmap.
 *
 * The happy path is `createImageBitmap`, which handles jpg/png/webp/avif/gif
 * and — on iOS Safari — HEIC natively, applying EXIF orientation for us. Only
 * when that throws do we pay for the libheif wasm decoder, so desktop Chrome
 * users dragging in an iPhone photo still work without every other user
 * downloading a decoder they'll never run.
 */

/** Long-edge cap for the working bitmap. Well above what any output needs. */
const MAX_EDGE = 2200;

export const ACCEPTED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/heic",
  "image/heif",
];

/** What `<input accept>` should advertise. Extensions matter because iOS often reports HEIC as an empty MIME type. */
export const ACCEPT_ATTR = [...ACCEPTED_MIME, ".heic", ".heif", ".jpg", ".jpeg", ".png", ".webp"].join(",");

export class DecodeError extends Error {}

const HEIC_EXT = /\.(heic|heif|hif)$/i;

/** @param {File} file */
function looksHeic(file) {
  return /image\/(heic|heif)/i.test(file.type) || HEIC_EXT.test(file.name);
}

/**
 * Reads the ISO-BMFF brand so we can spot HEIC even when type and name lie.
 * @param {File} file
 */
async function sniffHeic(file) {
  try {
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    if (head.length < 12) return false;
    const box = String.fromCharCode(head[4], head[5], head[6], head[7]);
    if (box !== "ftyp") return false;
    const brand = String.fromCharCode(head[8], head[9], head[10], head[11]);
    return ["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs", "mif1", "msf1"].includes(brand);
  } catch {
    return false;
  }
}

/** @param {Blob} blob */
function viaCreateImageBitmap(blob) {
  return createImageBitmap(blob, { imageOrientation: "from-image" });
}

/**
 * Last resort: HTMLImageElement, which also applies EXIF orientation by default.
 * @param {Blob} blob
 */
async function viaImgElement(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new DecodeError("Browser could not decode this image."));
      img.src = url;
    });
    return await createImageBitmap(img);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** @param {Blob} blob */
async function viaHeic(blob) {
  const { heicTo } = await import("heic-to");
  return heicTo({ blob, type: "bitmap", options: { imageOrientation: "from-image" } });
}

/**
 * Shrinks an oversized bitmap and releases the original.
 * @param {ImageBitmap} bitmap
 */
async function clampSize(bitmap) {
  const longEdge = Math.max(bitmap.width, bitmap.height);
  if (longEdge <= MAX_EDGE) return bitmap;

  const scale = MAX_EDGE / longEdge;
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext("2d");
  if (!ctx) return bitmap;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h);

  const resized = await createImageBitmap(canvas);
  bitmap.close();
  return resized;
}

/**
 * OffscreenCanvas where available, DOM canvas otherwise (Safari < 16.4).
 * @param {number} w
 * @param {number} h
 * @returns {HTMLCanvasElement | OffscreenCanvas}
 */
export function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/**
 * @typedef {object} DecodedPhoto
 * @property {ImageBitmap} bitmap
 * @property {number} width
 * @property {number} height
 * @property {boolean} usedHeicFallback True when we had to spin up the wasm HEIC decoder.
 */

/**
 * @param {File} file
 * @returns {Promise<DecodedPhoto>}
 */
export async function decodePhoto(file) {
  if (file.size === 0) throw new DecodeError("That file is empty.");
  if (file.size > 40 * 1024 * 1024) throw new DecodeError("That image is over 40 MB — try a smaller one.");

  let bitmap = null;
  let usedHeicFallback = false;

  try {
    bitmap = await viaCreateImageBitmap(file);
  } catch {
    // Fall through to the slower paths below.
  }

  if (!bitmap && (looksHeic(file) || (await sniffHeic(file)))) {
    try {
      bitmap = await viaHeic(file);
      usedHeicFallback = true;
    } catch {
      // Fall through.
    }
  }

  if (!bitmap) {
    try {
      bitmap = await viaImgElement(file);
    } catch {
      // Fall through to the shared error below.
    }
  }

  if (!bitmap) {
    throw new DecodeError(
      "Couldn't read that photo. JPG, PNG, WEBP and iPhone HEIC all work — screenshots too."
    );
  }

  const clamped = await clampSize(bitmap);
  return {
    bitmap: clamped,
    width: clamped.width,
    height: clamped.height,
    usedHeicFallback,
  };
}
