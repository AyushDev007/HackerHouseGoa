# Frame In Goa 

Upload a photo, get a branded **Hacker House Goa 2026** graphic, download it, post it with `#FrameInGoa`.

Same two formats and the same output as the Next.js build in `../HHG`, rebuilt on plain HTML, CSS and JavaScript with an Express back end. No React, no framework, no JSX.

- **PFP Frame** — 1024×1024 avatar frame. The ring sits inside the circle X actually crops avatars to.
- **Builder ID** — 1600×900 event badge with name, stack and a generated builder class. 16:9 so X shows it uncropped.

## Running it

```bash
npm install
```

```bash
npm run build
```

```bash
npm start
```

Then open <http://localhost:3118>. Set `PORT` to change it. While working on the front end, `npm run dev` rebuilds the bundle on save (run `npm start` in a second terminal).

## Layout

```
public/
  index.html          Markup. %ORIGIN% is substituted per-request by the server.
  styles.css          Hand-written CSS. No framework, no build step.
  fonts/              Imbue + Victor Mono, self-hosted (OFL 1.1)
  og.png              Static link-preview image for the landing page
  js/                 esbuild output — generated, gitignored
src/
  shared/             Runs in the browser: brand, classes, decode, smartcrop, render/
  client/main.js      The UI shell — state object, one sync(), direct listeners
  server/
    server.js         Express: static files, upload, permalink
    store.js          Share storage (Vercel Blob | filesystem)
    pages.js          Server-rendered HTML for /s/:id
build.mjs             esbuild config (the only build step)
```

`src/shared` is a direct port of the rendering engine from the Next build — same geometry, same auto-framing, same output. `src/client` and `src/server` are what changed.

## Why there is a build step at all

Exactly one reason: `heic-to` is an npm package carrying an inlined libheif WASM worker, and browsers can't resolve a bare import. Everything else is plain ES modules that would run unbundled.

Code splitting is **not** optional in `build.mjs`. The HEIC decoder is ~3 MB and is reached through a dynamic import specifically so it only downloads for people whose browser can't decode HEIC natively. With splitting off, esbuild inlines it and every visitor pays for it:

| | entry bundle | HEIC decoder |
| --- | --- | --- |
| `splitting: false` | 2.9 MB | inlined |
| `splitting: true` | **30 KB** | 2.9 MB, on demand |

## Decisions worth knowing about

**Everything renders client-side.** The `<canvas>` is sized at full output resolution and scaled down with CSS, so the preview and the downloaded file are the same pixels — no separate export step that could drift from what the user approved.

**The photo doesn't leave the device unless you share.** Uploading in the background would make the share button feel faster, but it would send someone's face to a server they never opted into. The upload happens on click.

**HEIC decodes natively first.** iOS Safari handles HEIC through `createImageBitmap` unaided; the WASM decoder is the fallback for everyone else.

**Auto-framing anchors on faces, not on saliency mass.** Summing interest across a candidate crop favours whatever is *biggest*, so on a portrait the torso outvotes the head and the crop slides down past the face. Skin colour alone can't fix it either — sand, tan walls and beige clothing all sit inside any chroma gate — so a pixel counts as face only with skin chroma *and* local detail. Drag and pinch override it.

**Uploads are raw PNG, not multipart.** `POST /api/share` takes the image as the request body with metadata in the query string, which removes the need for a multipart parser dependency entirely.

**Everything interpolated into `/s/:id` is escaped.** Names and titles are user input landing in server-rendered HTML; `pages.js` escapes all five HTML-significant characters, verified against `<script>` and `onerror` payloads.

## Deploying

The back end is a plain Node server, so this runs anywhere Node runs.

**Any host with a persistent disk** (VPS, Render, Fly, Docker) — nothing to configure. Shares are written to `./.data/shares`. Set `SHARE_DIR` to relocate.

**Serverless** — the filesystem is read-only and per-invocation, so set `BLOB_READ_WRITE_TOKEN` and the Vercel Blob driver takes over. Without it, share links will 404 when X fetches the preview.

Put the app behind a proxy that rewrites `Host`? Set `PUBLIC_URL` so OG tags carry the right absolute origin.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3118` | Listen port |
| `PUBLIC_URL` | request headers | Pins the public origin for OG tags |
| `SHARE_DIR` | `./.data/shares` | Filesystem share store |
| `BLOB_READ_WRITE_TOKEN` | — | Switches to Vercel Blob storage |

## Brand

Colours and typefaces come from the live hhgoa.com design system rather than being approximated: palm green `#0b6839`, electric yellow `#fee101`, hot pink `#ff0080`, with **Imbue** for display and **Victor Mono** for everything technical. See [`public/fonts/ATTRIBUTION.md`](public/fonts/ATTRIBUTION.md) for licences.
