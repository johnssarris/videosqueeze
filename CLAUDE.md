# VidSqueeze — Claude Code Context

Client-side video compression PWA. ffmpeg.wasm runs in the browser — no server, no uploads. React + Vite + Tailwind. Deployed to Vercel.

## Commands

```bash
npm run dev        # dev server at localhost:5173 with COOP/COEP headers
npm run build      # production build → dist/
npm run preview    # preview the production build locally
npm install        # installs deps
```

## Key Files

| File | Purpose |
|---|---|
| `src/hooks/useFFmpeg.js` | All ffmpeg.wasm lifecycle: threading detection, load, compress, cancel |
| `src/utils/ffmpegArgs.js` | Pure ffmpeg command builder + estimated output size calculator |
| `src/App.jsx` | Top-level state owner; wires all hooks and components |
| `src/components/` | Stateless-ish UI components, no business logic |
| `vite.config.js` | COOP/COEP dev headers, Workbox config, optimizeDeps exclusions |
| `vercel.json` | COOP/COEP production headers (Vercel) |
| `public/_headers` | COOP/COEP production headers (Cloudflare Pages) |
| `public/_redirects` | SPA routing fallback (Cloudflare Pages) |

## Critical Invariants — Read Before Changing Anything

### 1. WASM is loaded from CDN as plain URLs
`getFFmpegURLs()` in `useFFmpeg.js` returns plain `https://` unpkg URLs for the core JS, WASM, and worker files. These are passed directly to `ffmpeg.load()` — no blob URL wrapping needed in 0.12.x. The packages `@ffmpeg/core` and `@ffmpeg/core-mt` are **not** installed — do not add them back. If upgrading the ffmpeg version, update the version string in both CDN base URLs inside `getFFmpegURLs()`.

### 2. COOP/COEP headers must be set in all three places
- `vite.config.js → server.headers` for local dev
- `vercel.json` for Vercel production
- `public/_headers` for Cloudflare Pages production (Vite copies this to `dist/`)

`SharedArrayBuffer` requires both `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`. Removing either breaks multi-thread mode silently.

### 3. `buildFFmpegArgs` does NOT include `-i` or the output filename
`buildFFmpegArgs(settings, originalFilename)` returns `{ args, outputFilename }` where `args` is only the middle flags (codec, filters, etc.). The `compress()` function in `useFFmpeg.js` prepends `-i {virtualInputFilename}` and appends `outputFilename`.

```js
// Correct call in App.jsx:
const { args, outputFilename } = buildFFmpegArgs(settings, fileInfo.file.name)
const data = await compress({ file: fileInfo.file, args, outputFilename })

// Inside compress(), the full exec call is:
ffmpeg.exec(['-i', inputFilename, ...args, outputFilename])
```

### 4. `useRegisterSW` returns tuples, not plain booleans
`vite-plugin-pwa`'s React hook returns state as `[value, setter]` pairs:
```js
// Correct:
const { needRefresh: [needsRefresh], updateServiceWorker } = useRegisterSW()

// Wrong — needRefresh is an array, always truthy:
const { needRefresh, updateServiceWorker } = useRegisterSW()
if (needRefresh) { ... }  // always true!
```

### 5. `optimizeDeps.exclude` is required for `@ffmpeg/ffmpeg`
Without `optimizeDeps: { exclude: ['@ffmpeg/ffmpeg'] }`, Vite's pre-bundler crashes at dev server startup trying to analyze the package.

## ffmpeg.wasm v0.12 API Reference

```js
import { FFmpeg } from '@ffmpeg/ffmpeg'

const ffmpeg = new FFmpeg()
ffmpeg.on('progress', ({ progress }) => { /* 0–1 */ })

// 0.12.x accepts plain https:// CDN URLs directly
const base = 'https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm'
await ffmpeg.load({
  coreURL:   `${base}/ffmpeg-core.js`,
  wasmURL:   `${base}/ffmpeg-core.wasm`,
  workerURL: `${base}/ffmpeg-core.worker.js`,
})

await ffmpeg.writeFile('input.mp4', uint8Array)
const exitCode = await ffmpeg.exec(['-i', 'input.mp4', ...flags, 'output.mp4'])
const data = await ffmpeg.readFile('output.mp4')  // returns Uint8Array
await ffmpeg.deleteFile('input.mp4')

ffmpeg.terminate()  // cancel in-progress compression; ref becomes invalid after this
```

After `terminate()`, the ref is null and `isLoaded` resets. `cancel()` in `useFFmpeg.js` calls `setTimeout(() => load(), 50)` to auto-reload so the user doesn't have to refresh.

## Settings Object Shape

```js
{
  resolution: 'original' | '1080p' | '720p' | '480p' | '360p',
  crf: 18–51,           // lower = better quality, larger file
  framerate: 'original' | '60' | '30' | '24',
  videoCodec: 'h264' | 'h265',
  stripVideo: boolean,
  audioCodec: 'aac' | 'opus' | 'strip',
  audioBitrate: '64k' | '96k' | '128k' | '192k',
  volume: 0–200,        // percent, 100 = unchanged
  audioDelay: 0–2000,  // ms; positive only — delays audio to fix audio-ahead-of-video sync
}
```

## Presets

Defined in `src/utils/ffmpegArgs.js` as plain objects matching the settings shape above.

| Preset | Resolution | CRF | FPS | Audio |
|---|---|---|---|---|
| iMessage Small | 480p | 32 | 30 | AAC 64k |
| iMessage HD | 720p | 26 | 30 | AAC 96k |
| Keep Quality | Original | 20 | Original | AAC 128k |

## Deployment

Branch `claude/build-vidsqueeze-pwa-SyVxM` contains the full implementation. Connect `johnssarris/videosqueeze` to Vercel — no extra config needed beyond what's in `vercel.json`.
