import { useEffect, useState, useRef } from 'react'

export default function ProgressView({ progress, onCancel }) {
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(Date.now())
  const rafRef = useRef(null)

  useEffect(() => {
    startRef.current = Date.now()
    const tick = () => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const pct = Math.round(Math.max(0, Math.min(1, progress)) * 100)
  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60
  const elapsedStr = mins > 0
    ? `${mins}m ${secs}s`
    : `${secs}s`

  return (
    <div className="space-y-3 p-4 bg-slate-800 rounded-xl border border-slate-700">
      <div className="flex justify-between items-center text-sm">
        <span className="text-slate-300 font-medium">Compressing…</span>
        <div className="flex items-center gap-3 text-slate-400 text-xs tabular-nums">
          <span>{pct}%</span>
          <span>{elapsedStr}</span>
        </div>
      </div>

      <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
        <div
          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      <button
        onClick={onCancel}
        className="w-full py-2 bg-red-900/40 hover:bg-red-900/60 border border-red-800
                   text-red-300 text-sm rounded-lg transition-colors"
      >
        Cancel
      </button>
    </div>
  )
}
