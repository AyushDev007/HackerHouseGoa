import { EVENT } from "../shared/brand.js";

/**
 * Server-rendered HTML for the share permalink.
 *
 * This page is the entire reason the project needs a back end: per-graphic OG
 * tags cannot be produced by static hosting, and without them a shared link
 * previews as a blank card on X.
 */

/** Everything interpolated below originates from user input, so escape all of it. */
export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * @param {import("./store.js").ShareMeta} meta
 * @param {string} origin
 */
export function sharePage(meta, origin) {
  const image = meta.imageUrl.startsWith("http") ? meta.imageUrl : `${origin}${meta.imageUrl}`;
  const who = (meta.name || "").trim();
  const title = who
    ? `${who} is heading to ${EVENT.name} ${EVENT.year}`
    : `${EVENT.name} ${EVENT.year} — ${EVENT.hashtag}`;
  const description = [meta.title, `${EVENT.datesPretty} · ${EVENT.place}.`, "Make your own at Frame In Goa."]
    .filter(Boolean)
    .join(" · ");

  const e = escapeHtml;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${e(title)}</title>
    <meta name="description" content="${e(description)}" />
    <meta name="theme-color" content="#03301a" />

    <meta property="og:type" content="website" />
    <meta property="og:title" content="${e(title)}" />
    <meta property="og:description" content="${e(description)}" />
    <meta property="og:url" content="${e(`${origin}/s/${meta.id}`)}" />
    <meta property="og:image" content="${e(image)}" />
    <meta property="og:image:width" content="1600" />
    <meta property="og:image:height" content="900" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:alt" content="${e(title)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${e(title)}" />
    <meta name="twitter:description" content="${e(description)}" />
    <meta name="twitter:image" content="${e(image)}" />

    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <div class="backdrop" aria-hidden="true"></div>
    <main class="wrap share">
      <div class="share__bar">
        <span class="wordmark">HH GOA<sup>${e(EVENT.year)}</sup></span>
        <span class="share__tag">${e(EVENT.hashtag)}</span>
      </div>

      <img class="share__img" src="${e(image)}" width="1600" height="900"
           alt="${e(who ? `${who}'s ${EVENT.name} ${EVENT.year} graphic` : `${EVENT.name} ${EVENT.year} graphic`)}" />

      <div>
        <h1 class="share__title">${e(who ? `${who} is heading to Goa.` : "See you in Goa.")}</h1>
        ${meta.title ? `<p class="share__class">${e(meta.title)}</p>` : ""}
        <p class="share__meta">${e(`${EVENT.datesPretty} · ${EVENT.place}`)}</p>
      </div>

      <div class="share__actions">
        <a class="btn btn--primary" href="/">Make your own</a>
        <a class="btn btn--ghost" href="${e(image)}" download>Download this graphic</a>
      </div>
    </main>
  </body>
</html>`;
}

export function notFoundPage() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Not found — Frame In Goa</title>
    <meta name="robots" content="noindex" />
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <div class="backdrop" aria-hidden="true"></div>
    <main class="wrap share">
      <h1 class="share__title">That graphic isn't here.</h1>
      <p class="share__meta">The link may have expired, or the share store was reset.</p>
      <div class="share__actions"><a class="btn btn--primary" href="/">Make a new one</a></div>
    </main>
  </body>
</html>`;
}
