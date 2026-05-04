import { estimateOutputSize } from '../utils/ffmpegArgs'

function formatSize(bytes) {
  if (!bytes || bytes <= 0) return '—'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export default function EstimatedSize({ settings, duration, inputSize }) {
  const estimated = estimateOutputSize(settings, duration)
  const ratio = inputSize && estimated > 0 ? ((1 - estimated / inputSize) * 100) : null
  const ratioStr = ratio !== null ? Math.abs(ratio).toFixed(0) : null

  return (
    <div className="bg-slate-800 rounded-xl px-3 py-2.5 space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-400">Input</span>
        <span className="text-slate-300 tabular-nums">{formatSize(inputSize)}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-400">
          Est. output{' '}
          <span className="text-slate-600 text-xs">(rough estimate)</span>
        </span>
        <div className="flex items-center gap-2">
          <span className="text-slate-200 font-medium tabular-nums">{formatSize(estimated)}</span>
          {ratioStr !== null && (
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              ratio > 0
                ? 'text-green-400 bg-green-900/30'
                : 'text-amber-400 bg-amber-900/30'
            }`}>
              {ratio > 0 ? `−${ratioStr}%` : `+${ratioStr}%`}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
