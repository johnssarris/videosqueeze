function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function formatElapsed(ms) {
  const totalSec = Math.round(ms / 1000)
  const mins = Math.floor(totalSec / 60)
  const secs = totalSec % 60
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
}

function formatBitrate(outputBytes, durationSec) {
  const kbps = (outputBytes * 8) / durationSec / 1000
  if (kbps >= 1000) return `~${(kbps / 1000).toFixed(1)} Mbps`
  return `~${Math.round(kbps)} kbps`
}

function StatRow({ label, value }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-400 tabular-nums">{value}</span>
    </div>
  )
}

export default function ResultView({ result, onReset }) {
  const {
    filename, data, inputSize,
    encodeDuration, isThreaded,
    videoDuration, inputWidth, inputHeight, outputFps,
  } = result
  const outputSize = data.byteLength
  const ratio = inputSize > 0 ? ((1 - outputSize / inputSize) * 100) : null
  const ratioStr = ratio !== null ? Math.abs(ratio).toFixed(1) : null

  const hasDuration = videoDuration > 0
  const encodeSeconds = encodeDuration / 1000

  const speedRatio = hasDuration ? (videoDuration / encodeSeconds) : null
  const outputBitrate = hasDuration ? formatBitrate(outputSize, videoDuration) : null
  const fpsNum = outputFps !== 'original' ? parseFloat(outputFps) : null
  const throughput = (hasDuration && fpsNum)
    ? Math.round(fpsNum * videoDuration / encodeSeconds)
    : null

  const handleDownload = () => {
    const blob = new Blob([data], { type: 'video/mp4' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="space-y-3 p-4 bg-slate-800 rounded-xl border border-green-800/60">
      <div className="flex items-center gap-2">
        <span className="text-green-400 text-lg">✓</span>
        <p className="text-green-400 font-medium text-sm">Compression complete</p>
      </div>

      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-400">Input</span>
          <span className="text-slate-300 tabular-nums">{formatSize(inputSize)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Output</span>
          <span className="text-slate-200 font-medium tabular-nums">{formatSize(outputSize)}</span>
        </div>
        {ratioStr !== null && (
          <div className="flex justify-between">
            <span className="text-slate-400">Savings</span>
            <span className={`font-medium ${ratio > 0 ? 'text-green-400' : 'text-amber-400'}`}>
              {ratio > 0
                ? `${ratioStr}% smaller`
                : `${ratioStr}% larger than input`}
            </span>
          </div>
        )}
      </div>

      {/* Collapsible encode stats */}
      <div className="border-t border-slate-700/60 pt-2.5">
        <details className="group">
          <summary className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none hover:text-slate-400 list-none">
            <span className="inline-block transition-transform duration-150 group-open:rotate-90">▶</span>
            Encode stats
          </summary>
          <div className="mt-2.5 space-y-1.5 text-xs">
            <StatRow label="Elapsed" value={formatElapsed(encodeDuration)} />
            {speedRatio !== null && (
              <StatRow label="Speed" value={`${speedRatio.toFixed(1)}× realtime`} />
            )}
            {throughput !== null && (
              <StatRow label="Throughput" value={`~${throughput} fps`} />
            )}
            {outputBitrate && (
              <StatRow label="Output bitrate" value={outputBitrate} />
            )}
            <StatRow
              label="Threading"
              value={isThreaded ? '⚡ Multi-thread' : '🐢 Single-thread'}
            />
            {inputWidth > 0 && (
              <StatRow label="Source resolution" value={`${inputWidth}×${inputHeight}`} />
            )}
          </div>
        </details>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleDownload}
          className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700
                     text-white font-semibold text-sm rounded-xl transition-colors"
        >
          Download
        </button>
        <button
          onClick={onReset}
          className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-slate-200
                     text-sm rounded-xl transition-colors"
        >
          New file
        </button>
      </div>

      <p className="text-xs text-slate-500 truncate" title={filename}>
        {filename}
      </p>
    </div>
  )
}
