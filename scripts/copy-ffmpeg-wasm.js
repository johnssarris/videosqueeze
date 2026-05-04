#!/usr/bin/env node
import { cpSync, mkdirSync, existsSync } from 'fs'
import { resolve, join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const dest = join(root, 'public', 'ffmpeg')

mkdirSync(dest, { recursive: true })

function findEsmDir(pkgName) {
  const base = join(root, 'node_modules', pkgName, 'dist', 'esm')
  if (existsSync(base)) return base
  // Fallback: umd
  const umd = join(root, 'node_modules', pkgName, 'dist', 'umd')
  if (existsSync(umd)) return umd
  throw new Error(`Cannot find dist dir for ${pkgName}`)
}

function cp(src, dst) {
  if (!existsSync(src)) {
    console.warn(`[copy-ffmpeg-wasm] SKIP (not found): ${src}`)
    return
  }
  cpSync(src, dst)
  const rel = src.split('node_modules/')[1] ?? src
  console.log(`[copy-ffmpeg-wasm] ${rel} → public/ffmpeg/${dst.split('/ffmpeg/')[1]}`)
}

try {
  const stDir = findEsmDir('@ffmpeg/core')
  cp(join(stDir, 'ffmpeg-core.js'),   join(dest, 'ffmpeg-core.js'))
  cp(join(stDir, 'ffmpeg-core.wasm'), join(dest, 'ffmpeg-core.wasm'))

  const mtDir = findEsmDir('@ffmpeg/core-mt')
  // @ffmpeg/core-mt dist files may be named ffmpeg-core.js inside the package;
  // copy with -mt suffix to avoid collision with the single-thread build.
  const mtJs   = join(mtDir, 'ffmpeg-core.js')
  const mtWasm = join(mtDir, 'ffmpeg-core.wasm')
  const mtWork = join(mtDir, 'ffmpeg-core.worker.js')

  cp(mtJs,   join(dest, 'ffmpeg-core-mt.js'))
  cp(mtWasm, join(dest, 'ffmpeg-core-mt.wasm'))
  cp(mtWork, join(dest, 'ffmpeg-core-mt.worker.js'))

  console.log('[copy-ffmpeg-wasm] Done.')
} catch (err) {
  console.error(`[copy-ffmpeg-wasm] ERROR: ${err.message}`)
  process.exit(1)
}
