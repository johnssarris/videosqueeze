import { useRef, useState, useCallback, useEffect } from 'react'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'

async function fetchToBlobURL(url, mimeType, onProgress) {
  const startTime = Date.now()
  const response = await fetch(url)
  const contentLength = response.headers.get('Content-Length')
  const total = contentLength ? parseInt(contentLength, 10) : 0

  if (!total || !response.body) {
    const blob = await response.blob()
    const elapsed = Date.now() - startTime
    return { blobURL: URL.createObjectURL(new Blob([blob], { type: mimeType })), fromCache: elapsed < 500 }
  }

  const reader = response.body.getReader()
  const chunks = []
  let received = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    received += value.length
    onProgress(Math.round((received / total) * 100))
  }

  const elapsed = Date.now() - startTime
  const blob = new Blob(chunks, { type: mimeType })
  return { blobURL: URL.createObjectURL(blob), fromCache: elapsed < 500 }
}

async function getFFmpegURLs(onWasmProgress) {
  const isMultiThread =
    typeof crossOriginIsolated !== 'undefined' &&
    crossOriginIsolated === true &&
    typeof SharedArrayBuffer !== 'undefined'

  if (isMultiThread) {
    const base = 'https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm'
    const [coreURL, wasmResult, workerURL] = await Promise.all([
      toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
      fetchToBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm', onWasmProgress),
      toBlobURL(`${base}/ffmpeg-core.worker.js`, 'text/javascript'),
    ])
    return { threaded: true, coreURL, wasmURL: wasmResult.blobURL, workerURL, fromCache: wasmResult.fromCache }
  }

  const base = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
  const [coreURL, wasmResult] = await Promise.all([
    toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
    fetchToBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm', onWasmProgress),
  ])
  return { threaded: false, coreURL, wasmURL: wasmResult.blobURL, workerURL: undefined, fromCache: wasmResult.fromCache }
}

function getHeapMB() {
  return performance?.memory?.usedJSHeapSize != null
    ? performance.memory.usedJSHeapSize / (1024 * 1024)
    : null
}

export function useFFmpeg() {
  const ffmpegRef = useRef(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [loadProgress, setLoadProgress] = useState(0)
  const [isLoadingFromCache, setIsLoadingFromCache] = useState(false)
  const [isThreaded, setIsThreaded] = useState(false)
  const [progress, setProgress] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)

  const load = useCallback(async () => {
    if (ffmpegRef.current?.loaded) return
    setIsLoading(true)
    setLoadError(null)
    setLoadProgress(0)
    setIsLoadingFromCache(false)
    try {
      const ffmpeg = new FFmpeg()
      const urls = await getFFmpegURLs((pct) => setLoadProgress(pct))

      setIsLoadingFromCache(urls.fromCache)

      await ffmpeg.load({
        coreURL: urls.coreURL,
        wasmURL: urls.wasmURL,
        ...(urls.workerURL ? { workerURL: urls.workerURL } : {}),
      })

      ffmpegRef.current = ffmpeg
      setIsThreaded(urls.threaded)
      setIsLoaded(true)
    } catch (err) {
      setLoadError(err.message || 'Failed to load ffmpeg.wasm')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const compress = useCallback(async ({ file, args, outputFilename }) => {
    const ffmpeg = ffmpegRef.current
    if (!ffmpeg) throw new Error('ffmpeg not loaded')

    setIsProcessing(true)
    setProgress(0)

    const progressHandler = ({ progress: p }) => {
      setProgress(Math.max(0, Math.min(1, p)))
    }
    ffmpeg.on('progress', progressHandler)

    let memPollId = null

    try {
      const inputData = new Uint8Array(await file.arrayBuffer())
      const ext = file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')) : '.mp4'
      const inputFilename = `input${ext}`

      const t0 = performance.now()
      await ffmpeg.writeFile(inputFilename, inputData)
      const t1 = performance.now()

      const baselineMemMB = getHeapMB()
      let peakMemMB = baselineMemMB

      if (baselineMemMB !== null) {
        memPollId = setInterval(() => {
          const current = getHeapMB()
          if (current !== null && current > peakMemMB) peakMemMB = current
        }, 200)
      }

      const t2 = performance.now()
      // args from buildFFmpegArgs does not include -i or the output path
      const exitCode = await ffmpeg.exec(['-i', inputFilename, ...args, outputFilename])
      const t3 = performance.now()

      if (memPollId !== null) { clearInterval(memPollId); memPollId = null }
      if (exitCode !== 0) throw new Error(`ffmpeg exited with code ${exitCode}`)

      const t4 = performance.now()
      const data = await ffmpeg.readFile(outputFilename)
      const t5 = performance.now()

      await ffmpeg.deleteFile(inputFilename).catch(() => {})
      await ffmpeg.deleteFile(outputFilename).catch(() => {})

      const memAvailable = baselineMemMB !== null
      const metrics = {
        writeTime: t1 - t0,
        encodeTime: t3 - t2,
        readTime: t5 - t4,
        memAvailable,
        peakMemoryMB: memAvailable ? peakMemMB : null,
        memDeltaMB: memAvailable ? peakMemMB - baselineMemMB : null,
        hardwareConcurrency: navigator.hardwareConcurrency ?? null,
      }

      return { data, metrics }
    } finally {
      if (memPollId !== null) clearInterval(memPollId)
      try { ffmpeg.off('progress', progressHandler) } catch (_) {}
      setIsProcessing(false)
    }
  }, [])

  const cancel = useCallback(() => {
    try { ffmpegRef.current?.terminate() } catch (_) {}
    ffmpegRef.current = null
    setIsLoaded(false)
    setIsProcessing(false)
    setProgress(0)
    // Auto-reload so the user can compress another file without a page refresh
    setTimeout(() => load(), 50)
  }, [load])

  return {
    isLoaded,
    isLoading,
    loadError,
    loadProgress,
    isLoadingFromCache,
    isThreaded,
    progress,
    isProcessing,
    compress,
    cancel,
    reload: load,
  }
}
