import { EVENT } from "./brand.js";

/**
 * Two share paths, because neither one covers everybody:
 *
 * - `navigator.share` with a File hands the actual PNG to the X app. This is
 *   the mobile path and the only way to get a genuine image attachment.
 * - Everywhere else, the graphic is uploaded and a permalink goes into a
 *   pre-filled intent. The permalink's OG tags carry the image, so the tweet
 *   still previews the real graphic.
 */

/**
 * @param {import("./brand.js").FormatId} format
 * @param {string} title
 * @param {string} [url]
 */
export function captionFor(format, title, url) {
  const lines =
    format === "pfp"
      ? [`Locked in for ${EVENT.name} ${EVENT.year}. 🌴`, `New PFP, straight from the frame generator.`]
      : [`Builder ID secured for ${EVENT.name} ${EVENT.year}. 🌴`, title ? `Class: ${title}.` : ""];

  const tail = [`${EVENT.datesPretty} · ${EVENT.place}.`, `Make yours ${EVENT.hashtag}`];
  const body = [...lines.filter(Boolean), ...tail].join("\n");
  return url ? `${body}\n${url}` : body;
}

/**
 * @param {string} text
 * @param {string} [url]
 */
export function intentUrl(text, url) {
  const params = new URLSearchParams();
  params.set("text", text);
  if (url) params.set("url", url);
  return `https://x.com/intent/post?${params.toString()}`;
}

/** @param {File[]} files */
export function canShareFiles(files) {
  if (typeof navigator === "undefined" || !navigator.canShare || !navigator.share) return false;
  try {
    return navigator.canShare({ files });
  } catch {
    return false;
  }
}

/**
 * @param {File} file
 * @param {string} text
 * @returns {Promise<"shared" | "cancelled" | "unsupported">}
 */
export async function shareNative(file, text) {
  if (!canShareFiles([file])) return "unsupported";
  try {
    // Deliberately no `url`: several iOS targets drop the file when one is present.
    await navigator.share({ files: [file], text });
    return "shared";
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
    return "unsupported";
  }
}

/** @param {Blob} blob @param {string} name */
export function blobToFile(blob, name) {
  return new File([blob], name, { type: "image/png" });
}

/** @param {Blob} blob @param {string} filename */
export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke late; Safari needs the object URL alive past the click.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
