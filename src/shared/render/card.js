/**
 * Format B — the Builder ID card.
 *
 * 16:9 so X shows it in the timeline uncropped. Laid out like a laminated event
 * pass: header rail, photo panel, credential block, and a perforated stub that
 * carries the hashtag.
 */

import { BRAND, EVENT, FONT_DISPLAY, FONT_MONO, SIZES } from "../brand.js";
import { hash32 } from "../classes.js";
import { coverDraw } from "../smartcrop.js";
import {
  barcode,
  dashedLine,
  drawGrain,
  ellipsize,
  fitFontSize,
  halftone,
  measureTracked,
  palmFrond,
  roundRectPath,
  slicedSun,
  trackedText,
} from "./atoms.js";

const W = SIZES.card.w; // 1600
const H = SIZES.card.h; // 900

const M = 44;
const CARD = { x: M, y: M, w: W - M * 2, h: H - M * 2, r: 26 };
const HEAD_H = 104;
const FOOT_H = 84;
const BODY_Y = CARD.y + HEAD_H;
const BODY_H = CARD.h - HEAD_H - FOOT_H;
const STUB_W = 196;
const STUB_X = CARD.x + CARD.w - STUB_W;
const PAD = 40;

const PHOTO = 452;
/** Side of the box the photo is fitted into, in output pixels. Gesture maths needs this. */
export const CARD_PHOTO_BOX = PHOTO;
const PHOTO_X = CARD.x + PAD;
const PHOTO_Y = BODY_Y + (BODY_H - PHOTO) / 2;

const INFO_X = PHOTO_X + PHOTO + 52;
const INFO_W = STUB_X - 36 - INFO_X;

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{bitmap: ImageBitmap, crop: import("../smartcrop.js").CropState, theme: import("../brand.js").Theme,
 *          name: string, role: string, title: string, clearance: string, serial: string, make: Function}} input
 */
export function renderCard(ctx, input) {
  const { theme, make } = input;

  ctx.save();
  ctx.clearRect(0, 0, W, H);

  // Backdrop behind the card, visible in the margin and through the badge slot.
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, theme.baseDeep);
  bg.addColorStop(1, BRAND.black);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  drawCardBody(ctx, theme);
  drawHeader(ctx, theme);
  drawPhoto(ctx, input);
  drawCredentials(ctx, input);
  drawStub(ctx, input);
  drawFooter(ctx, theme);
  drawBadgeSlot(ctx, theme);
  drawCropMarks(ctx, theme);

  drawGrain(ctx, W, H, 0.045, make);
  ctx.restore();
}

function clipCard(ctx) {
  roundRectPath(ctx, CARD.x, CARD.y, CARD.w, CARD.h, CARD.r);
  ctx.clip();
}

function drawCardBody(ctx, theme) {
  ctx.save();
  clipCard(ctx);

  const g = ctx.createLinearGradient(CARD.x, CARD.y, CARD.x + CARD.w * 0.4, CARD.y + CARD.h);
  g.addColorStop(0, theme.base);
  g.addColorStop(1, theme.baseDeep);
  ctx.fillStyle = g;
  ctx.fillRect(CARD.x, CARD.y, CARD.w, CARD.h);

  // Warm horizon glow low on the card — the Goa part.
  const glow = ctx.createRadialGradient(
    CARD.x + CARD.w * 0.34,
    CARD.y + CARD.h * 1.02,
    20,
    CARD.x + CARD.w * 0.34,
    CARD.y + CARD.h * 1.02,
    CARD.w * 0.62
  );
  glow.addColorStop(0, theme.glow);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = glow;
  ctx.fillRect(CARD.x, CARD.y, CARD.w, CARD.h);
  ctx.restore();

  // Sun sits mostly below the card so only its top arc reads as a horizon.
  // Any higher and the translucent yellow just hazes the credential text.
  slicedSun(ctx, CARD.x + CARD.w * 0.45, CARD.y + CARD.h + 104, 300, theme.accent, 0.2);

  halftone(ctx, CARD.x, CARD.y, CARD.w, CARD.h, 20, theme.accent, {
    maxRadius: 2.7,
    fade: "down",
    alpha: 0.14,
  });

  // Palms anchored to the bottom edge of the card.
  ctx.save();
  ctx.globalAlpha = 0.34;
  const baseY = CARD.y + CARD.h + 10;
  palmFrond(ctx, CARD.x - 10, baseY, 330, -1.15, 0.52, BRAND.black);
  palmFrond(ctx, CARD.x - 10, baseY, 268, -0.62, 0.6, BRAND.black);
  palmFrond(ctx, CARD.x + CARD.w + 10, baseY, 300, Math.PI + 1.12, -0.52, BRAND.black);
  palmFrond(ctx, CARD.x + CARD.w + 10, baseY, 240, Math.PI + 0.6, -0.6, BRAND.black);
  ctx.restore();

  ctx.restore();

  // Card edge.
  roundRectPath(ctx, CARD.x, CARD.y, CARD.w, CARD.h, CARD.r);
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawHeader(ctx, theme) {
  ctx.save();
  clipCard(ctx);

  ctx.fillStyle = "rgba(0,0,0,0.34)";
  ctx.fillRect(CARD.x, CARD.y, CARD.w, HEAD_H);

  ctx.fillStyle = theme.accent;
  ctx.fillRect(CARD.x, CARD.y + HEAD_H - 4, CARD.w, 4);

  // Wordmark.
  ctx.fillStyle = BRAND.white;
  ctx.font = `900 74px ${FONT_DISPLAY}`;
  ctx.textBaseline = "alphabetic";
  const markW = trackedText(ctx, EVENT.short, CARD.x + PAD, CARD.y + HEAD_H - 30, 1, "left");

  ctx.fillStyle = theme.accent;
  ctx.font = `700 20px ${FONT_MONO}`;
  trackedText(ctx, EVENT.year, CARD.x + PAD + markW + 16, CARD.y + HEAD_H - 30, 3, "left");

  // Right rail.
  const rx = CARD.x + CARD.w - PAD;
  ctx.fillStyle = BRAND.white;
  ctx.font = `700 22px ${FONT_MONO}`;
  trackedText(ctx, "OFFICIAL BUILDER PASS", rx, CARD.y + 44, 4, "right");
  ctx.fillStyle = theme.accent;
  ctx.font = `500 20px ${FONT_MONO}`;
  trackedText(ctx, `${EVENT.datesPretty}  ·  ${EVENT.place}`, rx, CARD.y + 76, 3, "right");

  ctx.restore();
}

function drawPhoto(ctx, input) {
  const { bitmap, crop, theme } = input;

  // Offset block behind the photo — the printed-sticker look.
  ctx.save();
  clipCard(ctx);
  roundRectPath(ctx, PHOTO_X + 14, PHOTO_Y + 14, PHOTO, PHOTO, 20);
  ctx.fillStyle = theme.accentAlt;
  ctx.globalAlpha = 0.9;
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRectPath(ctx, PHOTO_X, PHOTO_Y, PHOTO, PHOTO, 20);
  ctx.clip();
  const p = coverDraw(bitmap.width, bitmap.height, PHOTO, PHOTO, crop);
  ctx.drawImage(bitmap, PHOTO_X + p.dx, PHOTO_Y + p.dy, p.dw, p.dh);
  ctx.restore();

  roundRectPath(ctx, PHOTO_X, PHOTO_Y, PHOTO, PHOTO, 20);
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 7;
  ctx.stroke();

  // Corner brackets on the photo, like a passport-photo guide.
  ctx.strokeStyle = BRAND.white;
  ctx.lineWidth = 4;
  const arm = 30;
  const inset = 18;
  const corners = [
    [PHOTO_X + inset, PHOTO_Y + inset, 1, 1],
    [PHOTO_X + PHOTO - inset, PHOTO_Y + inset, -1, 1],
    [PHOTO_X + inset, PHOTO_Y + PHOTO - inset, 1, -1],
    [PHOTO_X + PHOTO - inset, PHOTO_Y + PHOTO - inset, -1, -1],
  ];
  for (const [x, y, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(x + sx * arm, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + sy * arm);
    ctx.stroke();
  }
}

function drawCredentials(ctx, input) {
  const { theme, name, role, title, clearance, serial } = input;
  ctx.textBaseline = "alphabetic";

  let y = BODY_Y + 62;

  // Eyebrow.
  ctx.fillStyle = theme.accent;
  ctx.font = `700 20px ${FONT_MONO}`;
  trackedText(ctx, `BUILDER · ${EVENT.cohort} COHORT`, INFO_X, y, 5, "left");

  // Name — the loudest thing on the card.
  const displayName = (name.trim() || "YOUR NAME").toUpperCase();
  const nameSize = fitFontSize(
    ctx,
    displayName,
    INFO_W,
    (s) => {
      ctx.font = `900 ${s}px ${FONT_DISPLAY}`;
    },
    132,
    46,
    1
  );
  y += 30 + nameSize * 0.74;
  ctx.fillStyle = BRAND.white;
  ctx.font = `900 ${nameSize}px ${FONT_DISPLAY}`;
  trackedText(ctx, ellipsize(ctx, displayName, INFO_W, 1), INFO_X, y, 1, "left");

  // Generated class, in a solid pill so it reads as a stamped credential.
  y += 46;
  const pillFont = 27;
  ctx.font = `700 ${pillFont}px ${FONT_MONO}`;
  const pillLabel = ellipsize(ctx, title.toUpperCase(), INFO_W - 56, 2);
  const pillTextW = measureTracked(ctx, pillLabel, 2);
  const pillH = 56;
  roundRectPath(ctx, INFO_X, y, pillTextW + 52, pillH, pillH / 2);
  ctx.fillStyle = theme.accentAlt;
  ctx.fill();
  ctx.fillStyle = theme.id === "terminal" ? BRAND.black : BRAND.white;
  ctx.textBaseline = "middle";
  trackedText(ctx, pillLabel, INFO_X + 26, y + pillH / 2 + 1, 2, "left");
  ctx.textBaseline = "alphabetic";

  y += pillH + 40;
  dashedLine(ctx, INFO_X, y, INFO_X + INFO_W, y, [8, 9], "rgba(255,255,255,0.32)", 2);

  // Two-up detail grid.
  y += 44;
  const colW = INFO_W / 2;
  const cols = [
    ["STACK", role.trim().toUpperCase() || "FULL-STACK", BRAND.white],
    ["STATUS", clearance, theme.accent],
  ];
  cols.forEach(([label, value, colour], i) => {
    const x = INFO_X + i * colW;
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = `500 17px ${FONT_MONO}`;
    trackedText(ctx, label, x, y, 4, "left");

    ctx.fillStyle = colour;
    const size = fitFontSize(
      ctx,
      value,
      colW - 24,
      (s) => {
        ctx.font = `700 ${s}px ${FONT_MONO}`;
      },
      28,
      15,
      1
    );
    ctx.font = `700 ${size}px ${FONT_MONO}`;
    trackedText(ctx, ellipsize(ctx, value, colW - 24, 1), x, y + 34, 1, "left");
  });

  // Serial.
  y += 84;
  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.font = `500 19px ${FONT_MONO}`;
  trackedText(ctx, `PASS ID ${serial}  ·  ${EVENT.site.toUpperCase()}`, INFO_X, y, 3, "left");
}

function drawStub(ctx, input) {
  const { theme, serial } = input;

  ctx.save();
  clipCard(ctx);

  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(STUB_X, BODY_Y, STUB_W, BODY_H);

  // Perforation.
  dashedLine(ctx, STUB_X, BODY_Y, STUB_X, BODY_Y + BODY_H, [10, 10], theme.accent, 3);
  ctx.save();
  ctx.fillStyle = theme.baseDeep;
  for (let y = BODY_Y + 14; y < BODY_Y + BODY_H; y += 34) {
    ctx.beginPath();
    ctx.arc(STUB_X, y, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  const cx = STUB_X + STUB_W / 2;

  // Rotated hashtag running up the stub, ending clear of the cohort block below
  // and the serial above — the stub is only ~624px tall to share between them.
  ctx.save();
  ctx.translate(cx + 6, BODY_Y + BODY_H - 158);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = theme.accent;
  ctx.font = `700 34px ${FONT_MONO}`;
  ctx.textBaseline = "middle";
  trackedText(ctx, EVENT.hashtag, 0, 0, 2, "left");
  ctx.restore();
  ctx.textBaseline = "alphabetic";

  // Barcode + serial at the top of the stub.
  barcode(ctx, STUB_X + 30, BODY_Y + 34, STUB_W - 60, 68, hash32(serial), BRAND.white);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = `500 15px ${FONT_MONO}`;
  trackedText(ctx, serial, cx, BODY_Y + 124, 2, "center");

  // Cohort number, big, at the bottom of the stub.
  ctx.fillStyle = theme.accentAlt;
  ctx.font = `900 88px ${FONT_DISPLAY}`;
  trackedText(ctx, EVENT.cohort, cx, BODY_Y + BODY_H - 96, 2, "center");
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = `500 14px ${FONT_MONO}`;
  trackedText(ctx, "COHORT", cx, BODY_Y + BODY_H - 70, 3, "center");

  ctx.restore();
}

function drawFooter(ctx, theme) {
  ctx.save();
  clipCard(ctx);

  const y = CARD.y + CARD.h - FOOT_H;
  ctx.fillStyle = theme.accent;
  ctx.fillRect(CARD.x, y, CARD.w, FOOT_H);

  ctx.fillStyle = BRAND.black;
  ctx.font = `900 40px ${FONT_MONO}`;
  ctx.textBaseline = "middle";
  trackedText(ctx, EVENT.hashtag, CARD.x + PAD, y + FOOT_H / 2, 2, "left");

  ctx.font = `700 22px ${FONT_MONO}`;
  trackedText(ctx, EVENT.tagline, CARD.x + CARD.w - PAD, y + FOOT_H / 2, 5, "right");
  ctx.textBaseline = "alphabetic";

  ctx.restore();
}

/** Punched lanyard slot, letting the backdrop show through the header. */
function drawBadgeSlot(ctx, theme) {
  const w = 168;
  const h = 20;
  const x = CARD.x + CARD.w / 2 - w / 2;
  const y = CARD.y + 26;

  ctx.save();
  roundRectPath(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = BRAND.black;
  ctx.fill();
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();
}

/** Registration marks in the outer margin — reads as print artwork. */
function drawCropMarks(ctx, theme) {
  ctx.save();
  ctx.strokeStyle = theme.accent;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 2;
  const arm = 20;
  // Outward arms only — the inward halves would land on the yellow footer and vanish.
  const pts = [
    [CARD.x, CARD.y, -1, -1],
    [CARD.x + CARD.w, CARD.y, 1, -1],
    [CARD.x, CARD.y + CARD.h, -1, 1],
    [CARD.x + CARD.w, CARD.y + CARD.h, 1, 1],
  ];
  for (const [x, y, sx, sy] of pts) {
    ctx.beginPath();
    ctx.moveTo(x + sx * 6, y);
    ctx.lineTo(x + sx * arm, y);
    ctx.moveTo(x, y + sy * 6);
    ctx.lineTo(x, y + sy * arm);
    ctx.stroke();
  }
  ctx.restore();
}
