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

export default function ResultView({ result, onReset, logCount = 0, onExportLog }) {
  const {
    filename, data, inputSize,
    encodeDuration, isThreaded,
    videoDuration, inputWidth, inputHeight, outputFps,
    videoCodec, metrics,
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

  const totalPhaseTime = metrics ? metrics.writeTime + metrics.encodeTime + metrics.readTime : 0
  const writePct  = totalPhaseTime > 0 ? (metrics.writeTime  / totalPhaseTime) * 100 : 0
  const encodePct = totalPhaseTime > 0 ? (metrics.encodeTime / totalPhaseTime) * 100 : 0
  const readPct   = totalPhaseTime > 0 ? (metrics.readTime   / totalPhaseTime) * 100 : 0
  const hasIoOverhead = metrics && totalPhaseTime > 0 &&
    (metrics.writeTime / totalPhaseTime > 0.15 || metrics.readTime / totalPhaseTime > 0.15)
  const showH265Tip = videoCodec === 'h265' && totalPhaseTime > 0 &&
    metrics.encodeTime / totalPhaseTime > 0.9
  const coreCount = metrics?.hardwareConcurrency ?? null
  const coreLabel = coreCount
    ? isThreaded ? `${coreCount} cores (multi-thread)` : `1 of ${coreCount} cores (single-thread)`
    : isThreaded ? 'Multi-thread' : 'Single-thread'

  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isAndroid = /Android/i.test(navigator.userAgent)

  const canShare = typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function'

  const handleDownload = () => {
    const blob = new Blob([data], { type: 'video/mp4' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const handleShare = async () => {
    const blob = new Blob([data], { type: 'video/mp4' })
    const file = new File([blob], filename, { type: 'video/mp4' })
    try {
      await navigator.share({ files: [file], title: filename })
    } catch (err) {
      if (err?.name !== 'AbortError') handleDownload()
    }
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
            {coreCount !== null && (
              <StatRow label="CPU cores" value={coreLabel} />
            )}
            {metrics?.memAvailable && metrics.peakMemoryMB !== null && (
              <StatRow
                label="Peak memory"
                value={`${metrics.peakMemoryMB.toFixed(0)} MB (+${metrics.memDeltaMB.toFixed(0)} MB)`}
              />
            )}
            {inputWidth > 0 && (
              <StatRow label="Source resolution" value={`${inputWidth}×${inputHeight}`} />
            )}
            {metrics && totalPhaseTime > 0 && (
              <div className="mt-1.5 space-y-1">
                <div className="flex h-2 rounded-full overflow-hidden">
                  <div style={{ width: `${writePct}%` }} className="bg-blue-500" title={`Write: ${metrics.writeTime.toFixed(0)}ms`} />
                  <div style={{ width: `${encodePct}%` }} className="bg-violet-500" title={`Encode: ${metrics.encodeTime.toFixed(0)}ms`} />
                  <div style={{ width: `${readPct}%` }} className="bg-teal-500" title={`Read: ${metrics.readTime.toFixed(0)}ms`} />
                </div>
                <div className="flex gap-3 text-xs text-slate-500">
                  <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 mr-1 align-middle" />Write {writePct.toFixed(0)}%</span>
                  <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-500 mr-1 align-middle" />Encode {encodePct.toFixed(0)}%</span>
                  <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-teal-500 mr-1 align-middle" />Read {readPct.toFixed(0)}%</span>
                </div>
              </div>
            )}
            {metrics && (!isThreaded || showH265Tip || hasIoOverhead) && (
              <div className="mt-2 space-y-1.5 border-t border-slate-700/60 pt-2.5">
                <p className="text-slate-500 text-xs font-medium uppercase tracking-wide">Insights</p>
                {!isThreaded && (
                  <p className="text-xs text-amber-400/90">
                    {isIOS
                      ? 'Single-thread mode — multi-thread compression isn\'t supported on iPhone or iPad.'
                      : isAndroid
                        ? 'Single-thread mode — open in Chrome (not an in-app browser) for faster compression.'
                        : 'Single-thread mode — try Chrome or Edge for faster compression.'}
                  </p>
                )}
                {showH265Tip && (
                  <p className="text-xs text-amber-400/90">H.265 is slower than H.264; switch to H.264 for faster encoding.</p>
                )}
                {hasIoOverhead && (
                  <p className="text-xs text-slate-400">File I/O overhead detected — common with very large files.</p>
                )}
              </div>
            )}
          </div>
        </details>
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          onClick={handleDownload}
          className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700
                     text-white font-semibold text-sm rounded-xl transition-colors"
        >
          Download
        </button>
        {canShare && (
          <button
            onClick={handleShare}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700
                       text-white font-semibold text-sm rounded-xl transition-colors"
          >
            Share
          </button>
        )}
        <button
          onClick={onReset}
          className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-slate-200
                     text-sm rounded-xl transition-colors"
        >
          New file
        </button>
        {logCount > 0 && (
          <button
            onClick={onExportLog}
            className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-slate-200
                       text-sm rounded-xl transition-colors"
            title={`Export ${logCount} run${logCount > 1 ? 's' : ''} as JSON`}
          >
            Export log ({logCount})
          </button>
        )}
      </div>

      <p className="text-xs text-slate-500 truncate" title={filename}>
        {filename}
      </p>
    </div>
  )
}
