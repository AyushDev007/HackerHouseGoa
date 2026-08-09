import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Storage for shared graphics.
 *
 * Two drivers, picked at runtime: Vercel Blob when a token is present (the
 * serverless filesystem is read-only and ephemeral, so nothing else survives
 * there), and the local filesystem everywhere else. Both expose the same shape,
 * and the share page only ever needs `imageUrl`.
 *
 * @typedef {object} ShareMeta
 * @property {string} id
 * @property {"pfp"|"card"} format
 * @property {string} name
 * @property {string} title
 * @property {string} imageUrl  Absolute for the blob driver, app-relative for the filesystem driver.
 * @property {number} createdAt
 */

const ID_RE = /^[a-z0-9]{16}$/;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const SHARE_DIR = process.env.SHARE_DIR || path.join(process.cwd(), ".data", "shares");

function usingBlob() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function newId() {
  return randomBytes(10).toString("hex").slice(0, 16);
}

export function isValidId(id) {
  return ID_RE.test(id);
}

/**
 * PNG signature plus an IHDR sanity check — the bytes arrive from an untrusted client.
 * @param {Buffer|Uint8Array} bytes
 */
export function looksLikePng(bytes) {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 33) return false;
  for (let i = 0; i < sig.length; i++) if (bytes[i] !== sig[i]) return false;
  if (String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]) !== "IHDR") return false;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  return width > 0 && height > 0 && width <= 4096 && height <= 4096;
}

/**
 * @param {Buffer} bytes
 * @param {{id: string, format: "pfp"|"card", name: string, title: string}} meta
 * @returns {Promise<ShareMeta>}
 */
export async function putShare(bytes, meta) {
  const createdAt = Date.now();

  if (usingBlob()) {
    const { put } = await import("@vercel/blob");
    const image = await put(`shares/${meta.id}.png`, bytes, {
      access: "public",
      contentType: "image/png",
      addRandomSuffix: false,
      cacheControlMaxAge: 31536000,
    });
    const full = { ...meta, imageUrl: image.url, createdAt };
    await put(`shares/${meta.id}.json`, JSON.stringify(full), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      cacheControlMaxAge: 31536000,
    });
    return full;
  }

  await mkdir(SHARE_DIR, { recursive: true });
  const full = { ...meta, imageUrl: `/api/share/${meta.id}`, createdAt };
  await writeFile(path.join(SHARE_DIR, `${meta.id}.png`), bytes);
  await writeFile(path.join(SHARE_DIR, `${meta.id}.json`), JSON.stringify(full), "utf8");
  return full;
}

/**
 * @param {string} id
 * @returns {Promise<ShareMeta | null>}
 */
export async function getShare(id) {
  if (!isValidId(id)) return null;

  if (usingBlob()) {
    try {
      const { head } = await import("@vercel/blob");
      const info = await head(`shares/${id}.json`);
      const res = await fetch(info.url, { cache: "no-store" });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  try {
    return JSON.parse(await readFile(path.join(SHARE_DIR, `${id}.json`), "utf8"));
  } catch {
    return null;
  }
}

/**
 * Filesystem driver only — the blob driver serves images straight from its CDN.
 * @param {string} id
 * @returns {Promise<Buffer | null>}
 */
export async function getShareImage(id) {
  if (!isValidId(id) || usingBlob()) return null;
  try {
    return await readFile(path.join(SHARE_DIR, `${id}.png`));
  } catch {
    return null;
  }
}
