import { useRef, useState, useCallback, useEffect } from 'react'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'

async function getFFmpegURLs() {
  const isMultiThread =
    typeof crossOriginIsolated !== 'undefined' &&
    crossOriginIsolated === true &&
    typeof SharedArrayBuffer !== 'undefined'

  if (isMultiThread) {
    const base = 'https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm'
    const [coreURL, wasmURL, workerURL] = await Promise.all([
      toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
      toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
      toBlobURL(`${base}/ffmpeg-core.worker.js`, 'text/javascript'),
    ])
    return { threaded: true, coreURL, wasmURL, workerURL }
  }

  const base = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
  const [coreURL, wasmURL] = await Promise.all([
    toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
    toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
  ])
  return { threaded: false, coreURL, wasmURL, workerURL: undefined }
}

export function useFFmpeg() {
  const ffmpegRef = useRef(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [isThreaded, setIsThreaded] = useState(false)
  const [progress, setProgress] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)

  const load = useCallback(async () => {
    if (ffmpegRef.current?.loaded) return
    setIsLoading(true)
    setLoadError(null)
    try {
      const ffmpeg = new FFmpeg()
      const urls = await getFFmpegURLs()

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

    try {
      const inputData = new Uint8Array(await file.arrayBuffer())
      const ext = file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')) : '.mp4'
      const inputFilename = `input${ext}`
      await ffmpeg.writeFile(inputFilename, inputData)

      // args from buildFFmpegArgs does not include -i or the output path
      const exitCode = await ffmpeg.exec(['-i', inputFilename, ...args, outputFilename])
      if (exitCode !== 0) throw new Error(`ffmpeg exited with code ${exitCode}`)

      const data = await ffmpeg.readFile(outputFilename)
      await ffmpeg.deleteFile(inputFilename).catch(() => {})
      await ffmpeg.deleteFile(outputFilename).catch(() => {})
      return data
    } finally {
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
    isThreaded,
    progress,
    isProcessing,
    compress,
    cancel,
    reload: load,
  }
}
