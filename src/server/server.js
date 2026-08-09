import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";

import { notFoundPage, sharePage } from "./pages.js";
import { getShare, getShareImage, isValidId, looksLikePng, MAX_IMAGE_BYTES, newId, putShare } from "./store.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PUBLIC = path.join(ROOT, "public");
const PORT = Number(process.env.PORT) || 3118;

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", true);

/**
 * Public origin for absolute OG URLs. X's crawler will not resolve a relative
 * `og:image`, and the deployed host is only knowable at request time unless
 * pinned explicitly.
 */
function origin(req) {
  const configured = process.env.PUBLIC_URL;
  if (configured) return configured.replace(/\/$/, "");
  return `${req.protocol}://${req.get("host")}`;
}

/* --- Share upload --------------------------------------------------------- */

/** Coarse per-IP throttle. In-memory, so it resets on restart — enough to stop casual abuse. */
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 12;
const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > RATE_MAX;
}

/** Strip control characters; these end up inside OG meta tags. */
function clean(value, max) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
}

app.post(
  "/api/share",
  express.raw({ type: "image/png", limit: MAX_IMAGE_BYTES }),
  async (req, res) => {
    if (rateLimited(req.ip || "unknown")) {
      return res.status(429).json({ error: "Slow down a moment, then try again." });
    }

    const bytes = req.body;
    if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
      return res.status(400).json({ error: "No image in the request." });
    }
    if (!looksLikePng(bytes)) {
      return res.status(415).json({ error: "Only PNG graphics from this tool can be shared." });
    }

    const id = newId();
    try {
      const meta = await putShare(bytes, {
        id,
        format: req.query.format === "card" ? "card" : "pfp",
        name: clean(req.query.name, 60),
        title: clean(req.query.title, 80),
      });
      const base = origin(req);
      res.json({
        id: meta.id,
        url: `${base}/s/${meta.id}`,
        imageUrl: meta.imageUrl.startsWith("http") ? meta.imageUrl : `${base}${meta.imageUrl}`,
      });
    } catch {
      res.status(500).json({
        error: "Couldn't save the share link. Download the image and post it directly.",
      });
    }
  }
);

/** Payload-too-large surfaces as an error from express.raw; answer it as JSON. */
app.use("/api/share", (err, _req, res, next) => {
  if (!err) return next();
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "That image is too large to share." });
  }
  return res.status(400).json({ error: "Malformed upload." });
});

/* --- Stored graphics (filesystem driver) ---------------------------------- */

app.get("/api/share/:id", async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return res.status(404).type("text/plain").send("Not found");

  const bytes = await getShareImage(id);
  if (!bytes) return res.status(404).type("text/plain").send("Not found");

  res.set({
    "Content-Type": "image/png",
    "Cache-Control": "public, max-age=31536000, immutable",
    "Content-Disposition": "inline",
    "X-Content-Type-Options": "nosniff",
  });
  res.send(bytes);
});

/* --- Share permalink ------------------------------------------------------ */

app.get("/s/:id", async (req, res) => {
  const meta = await getShare(req.params.id);
  if (!meta) return res.status(404).type("html").send(notFoundPage());
  res.type("html").send(sharePage(meta, origin(req)));
});

/* --- Front end ------------------------------------------------------------ */

/**
 * index.html is templated rather than served statically so `og:image` can carry
 * an absolute origin — the same reason the Next build needs `metadataBase`.
 */
let indexTemplate = "";
async function loadIndex() {
  indexTemplate = await readFile(path.join(PUBLIC, "index.html"), "utf8");
}

app.get("/", (req, res) => {
  res.type("html").send(indexTemplate.replaceAll("%ORIGIN%", origin(req)));
});

app.use(express.static(PUBLIC, { index: false, maxAge: "1h" }));

app.use((_req, res) => res.status(404).type("html").send(notFoundPage()));

await loadIndex();
app.listen(PORT, () => {
  console.log(`Frame In Goa  →  http://localhost:${PORT}`);
});
