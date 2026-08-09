/**
 * The whole front end. No framework: a single state object, one `sync()` that
 * pushes state into the DOM, and direct event listeners.
 *
 * Text inputs stay uncontrolled — `sync()` never writes back into them, so the
 * caret can't jump mid-typing. It only updates derived UI (the generated class,
 * disabled states, visibility) and repaints the canvas.
 */

import { THEME_LIST, THEMES } from "../shared/brand.js";
import { buildClass } from "../shared/classes.js";
import { ACCEPT_ATTR, decodePhoto, DecodeError } from "../shared/decode.js";
import { ensureFonts } from "../shared/fonts.js";
import { buildShareImage, fileNameFor, paint, toPngBlob } from "../shared/render/index.js";
import { CARD_PHOTO_BOX } from "../shared/render/card.js";
import { PFP_PHOTO_BOX } from "../shared/render/pfp.js";
import {
  blobToFile,
  canShareFiles,
  captionFor,
  intentUrl,
  shareNative,
  triggerDownload,
} from "../shared/share.js";
import { clampCrop, DEFAULT_CROP, detectFocal, panCrop } from "../shared/smartcrop.js";

const $ = (id) => document.getElementById(id);
const ROLE_SUGGESTIONS = ["Full-stack", "Frontend", "Backend", "Solidity", "AI / ML", "Design", "Product", "DevRel"];

const el = {
  uploader: $("uploader"),
  editor: $("editor"),
  dropzone: $("dropzone"),
  pick: $("pick"),
  pickGlyph: $("pick-glyph"),
  dropTitle: $("dropzone-title"),
  file: $("file"),
  uploadError: $("upload-error"),
  renderError: $("render-error"),
  canvas: $("preview"),
  stageHint: $("stage-hint"),
  stageNote: $("stage-note"),
  zoom: $("zoom"),
  autofit: $("autofit"),
  themes: $("themes"),
  cardFields: $("card-fields"),
  name: $("builder-name"),
  role: $("builder-role"),
  roleChips: $("role-chips"),
  classPill: $("class-pill"),
  reroll: $("reroll"),
  download: $("download"),
  share: $("share"),
  shareText: $("share-text"),
  shareMsg: $("share-msg"),
  shareLink: $("share-link"),
  shareUrl: $("share-url"),
  copy: $("copy"),
  swap: $("swap"),
};

const state = {
  format: "pfp",
  themeId: "signal",
  /** @type {import("../shared/decode.js").DecodedPhoto | null} */
  photo: null,
  crop: { ...DEFAULT_CROP },
  name: "",
  role: "",
  seed: 0,
  fontsReady: false,
  decoding: false,
  sharing: false,
  nudged: false,
};

const photoBox = () => (state.format === "pfp" ? PFP_PHOTO_BOX : CARD_PHOTO_BOX);

function builderClass() {
  return buildClass(state.name || "builder", state.role, state.seed);
}

/** Assembles the object the renderers consume. */
function graphic() {
  if (!state.photo) return null;
  const cls = builderClass();
  return {
    format: state.format,
    bitmap: state.photo.bitmap,
    crop: state.crop,
    theme: THEMES[state.themeId],
    name: state.name,
    role: state.role,
    title: cls.title,
    clearance: cls.clearance,
    serial: cls.serial,
  };
}

function setState(patch) {
  Object.assign(state, patch);
  sync();
}

function sync() {
  const hasPhoto = Boolean(state.photo);
  const ready = hasPhoto && state.fontsReady;

  el.uploader.hidden = hasPhoto;
  el.editor.hidden = !hasPhoto;
  el.cardFields.hidden = state.format !== "card";
  el.stageNote.hidden = state.format !== "pfp";
  el.stageHint.hidden = !ready || state.nudged;

  el.classPill.textContent = builderClass().title;
  el.zoom.value = String(state.crop.zoom);

  el.download.disabled = !ready;
  el.share.disabled = !ready || state.sharing;

  el.pick.disabled = state.decoding;
  el.dropTitle.textContent = state.decoding ? "Reading your photo…" : "Drop a photo in";
  el.pickGlyph.className = state.decoding ? "spinner" : "";
  el.pickGlyph.textContent = state.decoding ? "" : "+";

  for (const btn of document.querySelectorAll(".switch__btn")) {
    const active = btn.dataset.format === state.format;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-pressed", String(active));
  }
  for (const btn of el.themes.children) {
    btn.classList.toggle("is-active", btn.dataset.theme === state.themeId);
    btn.setAttribute("aria-pressed", String(btn.dataset.theme === state.themeId));
  }

  repaint();
}

function repaint() {
  const g = graphic();
  if (!state.fontsReady || !g) return;
  try {
    paint(el.canvas, g);
    el.renderError.hidden = true;
  } catch {
    el.renderError.textContent = "Rendering failed in this browser.";
    el.renderError.hidden = false;
  }
}

/* --- Static controls ------------------------------------------------------ */

for (const theme of THEME_LIST) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "theme";
  btn.dataset.theme = theme.id;
  btn.innerHTML =
    `<span class="theme__dot" aria-hidden="true" style="background:linear-gradient(135deg, ${theme.band} 45%, ${theme.accent} 45%, ${theme.accentAlt} 80%)"></span>` +
    `<span class="theme__name">${theme.label}</span>`;
  btn.addEventListener("click", () => setState({ themeId: theme.id }));
  el.themes.appendChild(btn);
}

for (const role of ROLE_SUGGESTIONS) {
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "chip";
  chip.textContent = role;
  chip.addEventListener("click", () => {
    el.role.value = role;
    setState({ role });
  });
  el.roleChips.appendChild(chip);
}

el.file.setAttribute("accept", ACCEPT_ATTR);

/* --- Photo intake --------------------------------------------------------- */

async function handleFile(file) {
  if (!file) return;
  setState({ decoding: true });
  el.uploadError.hidden = true;
  el.shareLink.hidden = true;
  el.shareMsg.hidden = true;

  try {
    const decoded = await decodePhoto(file);
    const previous = state.photo;
    setState({
      photo: decoded,
      crop: detectFocal(decoded.bitmap, 1, 1),
      nudged: false,
      decoding: false,
    });
    previous?.bitmap.close();
  } catch (err) {
    el.uploadError.textContent =
      err instanceof DecodeError ? err.message : "Something went wrong reading that photo.";
    el.uploadError.hidden = false;
    setState({ decoding: false });
  }
}

el.pick.addEventListener("click", () => el.file.click());
el.swap.addEventListener("click", () => el.file.click());
el.file.addEventListener("change", () => {
  handleFile(el.file.files?.[0]);
  el.file.value = "";
});

el.dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  el.dropzone.classList.add("is-dragging");
});
el.dropzone.addEventListener("dragleave", () => el.dropzone.classList.remove("is-dragging"));
el.dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  el.dropzone.classList.remove("is-dragging");
  handleFile(e.dataTransfer?.files?.[0]);
});

/* --- Controls ------------------------------------------------------------- */

for (const btn of document.querySelectorAll(".switch__btn")) {
  btn.addEventListener("click", () => setState({ format: btn.dataset.format }));
}

el.name.addEventListener("input", () => setState({ name: el.name.value }));
el.role.addEventListener("input", () => setState({ role: el.role.value }));
el.reroll.addEventListener("click", () => setState({ seed: state.seed + 1 }));

el.autofit.addEventListener("click", () => {
  if (state.photo) setState({ crop: detectFocal(state.photo.bitmap, 1, 1) });
});

el.zoom.addEventListener("input", () => {
  if (!state.photo) return;
  const box = photoBox();
  const next = clampCrop(
    { ...state.crop, zoom: Number(el.zoom.value) },
    state.photo.width,
    state.photo.height,
    box,
    box
  );
  setState({ crop: next });
});

/* --- Canvas gestures ------------------------------------------------------ */

const pointers = new Map();
let pinch = null;
const MAX_ZOOM = 3;

/** Converts a delta in CSS pixels to the canvas's own coordinate space. */
function toOutput(dx, dy) {
  const rect = el.canvas.getBoundingClientRect();
  if (!rect.width) return { dx, dy };
  const k = el.canvas.width / rect.width;
  return { dx: dx * k, dy: dy * k };
}

el.canvas.addEventListener("pointerdown", (e) => {
  if (!state.photo) return;
  // Register first: capture is an optimisation, and it throws if the pointer
  // isn't active. Losing the drag entirely over that would be much worse.
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (!state.nudged) setState({ nudged: true });
  try {
    el.canvas.setPointerCapture(e.pointerId);
  } catch {
    // Capture unavailable — dragging still works, it just won't track outside the canvas.
  }
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: state.crop.zoom };
  }
});

el.canvas.addEventListener("pointermove", (e) => {
  if (!state.photo || !pointers.has(e.pointerId)) return;
  const prev = pointers.get(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const box = photoBox();

  if (pointers.size >= 2 && pinch) {
    const [a, b] = [...pointers.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinch.dist > 0) {
      const zoom = Math.min(MAX_ZOOM, Math.max(1, (pinch.zoom * dist) / pinch.dist));
      setState({
        crop: clampCrop({ ...state.crop, zoom }, state.photo.width, state.photo.height, box, box),
      });
    }
    return;
  }

  const moved = toOutput(e.clientX - prev.x, e.clientY - prev.y);
  setState({
    crop: panCrop(state.crop, state.photo.width, state.photo.height, box, box, moved.dx, moved.dy),
  });
});

function endPointer(e) {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = null;
}
el.canvas.addEventListener("pointerup", endPointer);
el.canvas.addEventListener("pointercancel", endPointer);

el.canvas.addEventListener("wheel", (e) => {
  if (!state.photo) return;
  e.preventDefault();
  const box = photoBox();
  const zoom = Math.min(MAX_ZOOM, Math.max(1, state.crop.zoom * (e.deltaY > 0 ? 0.94 : 1.06)));
  setState({
    crop: clampCrop({ ...state.crop, zoom }, state.photo.width, state.photo.height, box, box),
  });
}, { passive: false });

el.canvas.addEventListener("dblclick", () => {
  if (state.photo) setState({ crop: detectFocal(state.photo.bitmap, 1, 1) });
});

/* --- Output --------------------------------------------------------------- */

el.download.addEventListener("click", async () => {
  const g = graphic();
  if (!g) return;
  try {
    triggerDownload(await toPngBlob(el.canvas), fileNameFor(g));
  } catch {
    el.renderError.textContent = "Couldn't export the image. Try a different browser.";
    el.renderError.hidden = false;
  }
});

/** A 4-byte PNG stand-in, purely to ask the browser whether it can share files at all. */
function probeFile() {
  return new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "probe.png", { type: "image/png" });
}

function setShareMessage(text, isError) {
  el.shareMsg.textContent = text;
  el.shareMsg.hidden = !text;
  el.shareMsg.style.color = isError ? "var(--pink)" : "";
}

el.share.addEventListener("click", async () => {
  const g = graphic();
  if (!g) return;

  // Decide the path — and open any window — while still inside the click gesture.
  const nativeAvailable = canShareFiles([probeFile()]);
  const popup = nativeAvailable ? null : window.open("about:blank", "_blank");
  if (popup) popup.opener = null;

  setState({ sharing: true });
  el.shareText.textContent = "Preparing";
  setShareMessage("", false);

  try {
    const blob = await buildShareImage(g, el.canvas);

    if (nativeAvailable) {
      const result = await shareNative(blobToFile(blob, fileNameFor(g)), captionFor(g.format, g.title));
      if (result === "shared" || result === "cancelled") return;
    }

    const query = new URLSearchParams({ format: g.format, name: state.name, title: g.title });
    const res = await fetch(`/api/share?${query}`, {
      method: "POST",
      headers: { "Content-Type": "image/png" },
      body: blob,
    });
    const data = await res.json();
    if (!res.ok || !data.url) throw new Error(data.error || "Share link failed.");

    el.shareUrl.textContent = data.url;
    el.shareLink.hidden = false;
    setShareMessage("Tweet composer opened. The link preview shows your graphic — post away.", false);

    const target = intentUrl(captionFor(g.format, g.title), data.url);
    if (popup && !popup.closed) popup.location.href = target;
    else window.open(target, "_blank", "noopener,noreferrer");
  } catch (err) {
    popup?.close();
    setShareMessage(err?.message || "Share failed — download the image and post it directly.", true);
  } finally {
    el.shareText.textContent = "Share to X";
    setState({ sharing: false });
  }
});

el.copy.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(el.shareUrl.textContent || "");
    el.copy.textContent = "Copied";
    setTimeout(() => (el.copy.textContent = "Copy"), 2000);
  } catch {
    /* Clipboard blocked; the URL is selectable on screen anyway. */
  }
});

/* --- Boot ----------------------------------------------------------------- */

ensureFonts().then(() => setState({ fontsReady: true }));
sync();
