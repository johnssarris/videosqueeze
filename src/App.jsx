import { useState, useCallback, useRef, useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useFFmpeg } from './hooks/useFFmpeg'
import { buildFFmpegArgs, DEFAULT_SETTINGS } from './utils/ffmpegArgs'
import { parseMediaInfo } from './utils/mediaProbe'
import FileDropZone from './components/FileDropZone'
import MediaInfoPanel from './components/MediaInfoPanel'
import SettingsPanel from './components/SettingsPanel'
import PresetButtons from './components/PresetButtons'
import EstimatedSize from './components/EstimatedSize'
import ProgressView from './components/ProgressView'
import ResultView from './components/ResultView'

const VERSION = import.meta.env.VITE_APP_VERSION

export default function App() {
  const {
    needRefresh: [needsRefresh],
    offlineReady: [isOfflineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW()

  const {
    isLoaded,
    isLoading,
    loadError,
    loadProgress,
    isLoadingFromCache,
    isThreaded,
    progress,
    isProcessing,
    compress,
    probe,
    cancel,
    reload,
    isProbing,
  } = useFFmpeg()

  const [fileInfo, setFileInfo] = useState(null)
  const [mediaInfo, setMediaInfo] = useState(null)
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [result, setResult] = useState(null)
  const [compressError, setCompressError] = useState(null)
  const [compressionLog, setCompressionLog] = useState([])
  const encodeStartRef = useRef(null)

  const handleFileSelected = useCallback((info) => {
    setFileInfo(info)
    setMediaInfo(null)
    setResult(null)
    setCompressError(null)
  }, [])

  useEffect(() => {
    if (!isLoaded || !fileInfo || isProcessing) return
    let cancelled = false
    async function run() {
      const lines = await probe(fileInfo.file)
      if (cancelled) return
      if (lines) setMediaInfo(parseMediaInfo(lines))
    }
    run()
    return () => { cancelled = true }
  }, [isLoaded, fileInfo, probe, isProcessing])

  const handleApplyPreset = useCallback((preset) => {
    setSettings(preset)
  }, [])

  const handleCompress = useCallback(async () => {
    if (!fileInfo || !isLoaded || isProcessing) return
    setResult(null)
    setCompressError(null)

    try {
      const { args, outputFilename } = buildFFmpegArgs(settings, fileInfo.file.name)
      encodeStartRef.current = Date.now()
      const { data, metrics } = await compress({ file: fileInfo.file, args, outputFilename })
      const encodeDuration = Date.now() - encodeStartRef.current
      setResult({
        filename: outputFilename,
        data,
        inputSize: fileInfo.file.size,
        encodeDuration,
        isThreaded,
        videoDuration: fileInfo.duration,
        inputWidth: fileInfo.width,
        inputHeight: fileInfo.height,
        outputFps: settings.framerate,
        videoCodec: settings.videoCodec,
        metrics,
      })
      setCompressionLog(prev => [...prev, {
        timestamp: new Date().toISOString(),
        input: {
          filename: fileInfo.file.name,
          sizeMB: +(fileInfo.file.size / 1024 / 1024).toFixed(2),
          durationSec: fileInfo.duration,
          width: fileInfo.width,
          height: fileInfo.height,
        },
        settings: { ...settings },
        output: {
          filename: outputFilename,
          sizeMB: +(data.byteLength / 1024 / 1024).toFixed(2),
          savingsPercent: fileInfo.file.size > 0
            ? +((1 - data.byteLength / fileInfo.file.size) * 100).toFixed(1)
            : null,
        },
        performance: {
          totalDurationMs: encodeDuration,
          writeTimeMs: metrics ? +metrics.writeTime.toFixed(0) : null,
          encodeTimeMs: metrics ? +metrics.encodeTime.toFixed(0) : null,
          readTimeMs: metrics ? +metrics.readTime.toFixed(0) : null,
          isThreaded,
          hardwareConcurrency: metrics?.hardwareConcurrency ?? null,
          peakMemoryMB: metrics?.peakMemoryMB != null ? +metrics.peakMemoryMB.toFixed(1) : null,
          memDeltaMB: metrics?.memDeltaMB != null ? +metrics.memDeltaMB.toFixed(1) : null,
        },
      }])
    } catch (err) {
      if (err?.message && !/terminat|abort|cancel/i.test(err.message)) {
        setCompressError(err.message)
      }
    }
  }, [fileInfo, isLoaded, isProcessing, settings, compress, isThreaded])

  const handleCancel = useCallback(() => {
    cancel()
  }, [cancel])

  const handleReset = useCallback(() => {
    setFileInfo(null)
    setResult(null)
    setCompressError(null)
  }, [])

  const handleExportLog = useCallback(() => {
    const blob = new Blob([JSON.stringify(compressionLog, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vidsqueeze-log-${Date.now()}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [compressionLog])

  const showSettings = isLoaded && !isProcessing && !result && fileInfo

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {needsRefresh && (
        <div className="bg-blue-950 border-b border-blue-800 px-4 py-2.5 flex items-center justify-between gap-4">
          <span className="text-blue-300 text-sm">A new version is available.</span>
          <button
            onClick={() => updateServiceWorker(true)}
            className="text-xs px-3 py-1 bg-blue-700 hover:bg-blue-600 text-white rounded-lg
                       transition-colors shrink-0"
          >
            Update now
          </button>
        </div>
      )}

      {isOfflineReady && (
        <div className="bg-slate-800 border-b border-slate-700 px-4 py-2.5 flex items-center justify-between gap-4">
          <span className="text-slate-300 text-sm">Ready to work offline.</span>
          <button
            onClick={() => setOfflineReady(false)}
            className="text-slate-500 hover:text-slate-300 text-lg leading-none"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      <div className="max-w-md mx-auto px-4 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 tracking-tight">VidSqueeze</h1>
            <p className="text-xs text-slate-600 mt-0.5">v{VERSION}</p>
          </div>
          {isLoaded && (
            <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
              isThreaded
                ? 'bg-green-950 text-green-300 border-green-800'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}>
              {isThreaded ? '⚡ Accelerated' : '🐢 Standard'}
            </span>
          )}
        </div>

        {isLoading && (
          <div className="p-4 bg-slate-800 rounded-xl space-y-3">
            {isLoadingFromCache ? (
              <div className="flex items-center gap-3 text-slate-400">
                <div className="w-5 h-5 rounded-full border-2 border-slate-600 border-t-blue-400 animate-spin shrink-0" />
                <p className="text-sm font-medium text-slate-300">Loading from cache…</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-300">
                    Downloading ffmpeg engine… {loadProgress}%
                  </p>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${loadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500">This may take a moment on first load.</p>
              </>
            )}
          </div>
        )}

        {loadError && (
          <div className="p-4 bg-red-950/50 border border-red-800 rounded-xl">
            <p className="text-red-300 text-sm font-medium">Failed to load ffmpeg.wasm</p>
            <p className="text-red-400/80 text-xs mt-1">{loadError}</p>
            <button
              onClick={reload}
              className="mt-3 text-xs px-3 py-1.5 bg-red-800 hover:bg-red-700 text-red-100
                         rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {isLoaded && (
          <>
            <FileDropZone
              onFileSelected={handleFileSelected}
              disabled={isProcessing}
            />

            {showSettings && (
              <>
                <MediaInfoPanel mediaInfo={mediaInfo} fileInfo={fileInfo} isProbing={isProbing} />
                <PresetButtons onApply={handleApplyPreset} disabled={isProcessing} />
                <SettingsPanel
                  settings={settings}
                  onChange={setSettings}
                  disabled={isProcessing}
                  mediaInfo={mediaInfo}
                  fileInfo={fileInfo}
                />
                <EstimatedSize
                  settings={settings}
                  duration={fileInfo.duration}
                  inputSize={fileInfo.file.size}
                />
                {compressError && (
                  <div className="p-3 bg-red-950/50 border border-red-800 rounded-xl">
                    <p className="text-red-300 text-sm">Error: {compressError}</p>
                  </div>
                )}
                <button
                  onClick={handleCompress}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700
                             text-white font-semibold rounded-xl transition-colors text-sm
                             shadow-lg shadow-blue-900/30"
                >
                  Compress Video
                </button>
              </>
            )}
          </>
        )}

        {isProcessing && (
          <ProgressView progress={progress} onCancel={handleCancel} />
        )}

        {result && !isProcessing && (
          <ResultView
            result={result}
            onReset={handleReset}
            logCount={compressionLog.length}
            onExportLog={handleExportLog}
          />
        )}

        <p className="text-xs text-slate-700 text-center pt-2">
          All processing happens in your browser — nothing is uploaded.
        </p>
      </div>
    </div>
  )
}
