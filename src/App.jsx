import { useState, useCallback } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useFFmpeg } from './hooks/useFFmpeg'
import { buildFFmpegArgs, DEFAULT_SETTINGS } from './utils/ffmpegArgs'
import FileDropZone from './components/FileDropZone'
import SettingsPanel from './components/SettingsPanel'
import PresetButtons from './components/PresetButtons'
import EstimatedSize from './components/EstimatedSize'
import ProgressView from './components/ProgressView'
import ResultView from './components/ResultView'

const VERSION = import.meta.env.VITE_APP_VERSION

export default function App() {
  const { needRefresh: [needsRefresh], updateServiceWorker } = useRegisterSW()

  const {
    isLoaded,
    isLoading,
    loadError,
    isThreaded,
    progress,
    isProcessing,
    compress,
    cancel,
    reload,
  } = useFFmpeg()

  const [fileInfo, setFileInfo] = useState(null)
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [result, setResult] = useState(null)
  const [compressError, setCompressError] = useState(null)

  const handleFileSelected = useCallback((info) => {
    setFileInfo(info)
    setResult(null)
    setCompressError(null)
  }, [])

  const handleApplyPreset = useCallback((preset) => {
    setSettings(preset)
  }, [])

  const handleCompress = useCallback(async () => {
    if (!fileInfo || !isLoaded || isProcessing) return
    setResult(null)
    setCompressError(null)

    try {
      const { args, outputFilename } = buildFFmpegArgs(settings, fileInfo.file.name)
      const data = await compress({ file: fileInfo.file, args, outputFilename })
      setResult({ filename: outputFilename, data, inputSize: fileInfo.file.size })
    } catch (err) {
      if (err?.message && !err.message.includes('terminated')) {
        setCompressError(err.message)
      }
    }
  }, [fileInfo, isLoaded, isProcessing, settings, compress])

  const handleCancel = useCallback(() => {
    cancel()
  }, [cancel])

  const handleReset = useCallback(() => {
    setFileInfo(null)
    setResult(null)
    setCompressError(null)
  }, [])

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
          <div className="flex items-center gap-3 p-4 bg-slate-800 rounded-xl text-slate-400">
            <span className="text-xl animate-spin inline-block">⏳</span>
            <div>
              <p className="text-sm font-medium text-slate-300">Loading ffmpeg.wasm…</p>
              <p className="text-xs mt-0.5">This may take a moment on first load.</p>
            </div>
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
                <PresetButtons onApply={handleApplyPreset} disabled={isProcessing} />
                <SettingsPanel
                  settings={settings}
                  onChange={setSettings}
                  disabled={isProcessing}
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
          <ResultView result={result} onReset={handleReset} />
        )}

        <p className="text-xs text-slate-700 text-center pt-2">
          All processing happens in your browser — nothing is uploaded.
        </p>
      </div>
    </div>
  )
}
