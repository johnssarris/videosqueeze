# VidSqueeze

Client-side video compression in your browser. Think Handbrake, but as a PWA you can add to your iPhone home screen.

Built for the common case: you just screen-recorded something on your phone, it's 200 MB, and you want to send it over iMessage.

## Features

- **No uploads** — ffmpeg runs entirely in your browser via WebAssembly. Your video never leaves your device.
- **Presets** — iMessage Small (480p), iMessage HD (720p), Keep Quality — sensible defaults, no configuration required.
- **Full control** — resolution, CRF quality, framerate cap, H.264/H.265, audio bitrate, volume, sync correction.
- **iOS PWA** — Add to Home Screen for a native app feel. Works offline after first load.
- **Multi-threading** — Uses `SharedArrayBuffer` workers when available (Chrome/Edge on desktop, Safari 15.2+). Automatic fallback to single-thread on older browsers. The UI shows which mode is active.

## Getting Started

```bash
git clone https://github.com/johnssarris/videosqueeze
cd videosqueeze
npm install        # installs deps
npm run dev        # http://localhost:5173
```

## Deploying

### Vercel

Connect `johnssarris/videosqueeze` to Vercel and point it at whatever branch you want. No extra config required.

The `vercel.json` at the repo root sets `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` on every response. These headers are required for `SharedArrayBuffer` to be available — without them, the multi-thread build silently falls back.

Vercel runs `npm install` then `npm run build` on each deploy.

### Cloudflare Pages

Connect the repo to Cloudflare Pages with these build settings:

| Setting | Value |
|---|---|
| Framework preset | None |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Environment variables | _(none required)_ |

The `public/_headers` file sets the COOP/COEP headers on every response (Cloudflare Pages reads `_headers` from the output directory). The `public/_redirects` file routes all paths to `index.html` for SPA navigation. Both files are copied to `dist/` automatically by Vite during the build.

> **Note:** Do not set `GITHUB_PAGES=true` on Cloudflare Pages — that flag switches the Vite `base` to `/videosqueeze/` which is only correct for GitHub Pages hosting.

## Project Structure

```
├── public/
│   ├── icons/               # PWA icons
│   ├── _headers             # COOP/COEP headers for Cloudflare Pages
│   └── _redirects           # SPA routing fallback for Cloudflare Pages
├── src/
│   ├── hooks/
│   │   ├── useFFmpeg.js     # All ffmpeg lifecycle: load, compress, cancel
│   │   └── useCropDetect.js # Auto crop-detection via ffmpeg cropdetect filter
│   ├── utils/
│   │   ├── ffmpegArgs.js    # FFmpeg command builder + output size estimator
│   │   ├── mediaProbe.js    # Parse ffmpeg probe output into structured media info
│   │   ├── cropDetect.js    # Crop detection helpers
│   │   └── constants.js     # Shared constants
│   ├── components/          # UI components (no business logic)
│   │   ├── FileDropZone.jsx
│   │   ├── MediaInfoPanel.jsx
│   │   ├── PresetButtons.jsx
│   │   ├── SettingsPanel.jsx
│   │   ├── CropPreview.jsx
│   │   ├── EstimatedSize.jsx
│   │   ├── ProgressView.jsx
│   │   └── ResultView.jsx
│   └── App.jsx              # Top-level state + layout
├── vite.config.js           # COOP/COEP headers, PWA config, WASM exclusions
├── vercel.json              # COOP/COEP headers for Vercel
├── public/_headers          # COOP/COEP headers for Cloudflare Pages
└── public/_redirects        # SPA fallback routing for Cloudflare Pages
```

## Architecture Notes

### Why WASM is loaded from CDN via blob URLs

The ffmpeg WASM files are fetched from the unpkg CDN at runtime using `toBlobURL` from `@ffmpeg/util`. This converts each CDN resource into a `blob:` URL before passing it to `ffmpeg.load()`.

The blob URL approach is required for Safari/iOS: if you pass a plain `https://` CDN URL directly to ffmpeg.load, Safari treats the worker as cross-origin and `SharedArrayBuffer` becomes unavailable, breaking multi-thread mode. Wrapping each resource as a blob URL makes it same-origin in Safari's security model, fixing multi-threading on iOS.

The packages `@ffmpeg/core` and `@ffmpeg/core-mt` are **not** installed as npm dependencies — do not add them. Only `@ffmpeg/ffmpeg` and `@ffmpeg/util` are installed; the core WASM files are always fetched from CDN.

### Service Worker + WASM Caching

The Workbox service worker does **not** precache the WASM files. Instead, they're handled by `CacheFirst` runtime cache rules for `unpkg.com/@ffmpeg/` and `cdn.jsdelivr.net/@ffmpeg/` URLs: they're downloaded on first ffmpeg load and served from the browser cache on every subsequent load. After the first compression, the app works fully offline.

### Settings & Presets

All settings live in a single state object in `App.jsx`. Presets are plain objects that replace the entire settings state. The FFmpeg command is built fresh on every compression from the current settings — there's no derived state to keep in sync.

### Version & Updates

The version string is pulled from `package.json` at build time via Vite's `define`. When a new service worker is installed in the background, `useRegisterSW` from `vite-plugin-pwa` exposes `needRefresh: [boolean, setter]` — when true, an "Update now" banner appears at the top of the page.

## Stack

| Layer | Package |
|---|---|
| UI | React 18, Tailwind CSS 3 |
| Build | Vite 5 |
| Video | @ffmpeg/ffmpeg 0.12, @ffmpeg/util |
| PWA | vite-plugin-pwa 0.20 (Workbox) |
| Deploy | Vercel, Cloudflare Pages |
