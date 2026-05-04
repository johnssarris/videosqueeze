import { useRef, useState, useCallback } from 'react'

const SIZE_WARNING_BYTES = 200 * 1024 * 1024

function extractVideoMetadata(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      resolve({ duration: video.duration, width: video.videoWidth, height: video.videoHeight })
      URL.revokeObjectURL(url)
    }
    video.onerror = () => {
      resolve({ duration: 0, width: 0, height: 0 })
      URL.revokeObjectURL(url)
    }
    video.src = url
  })
}

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function formatDuration(seconds) {
  if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function FileDropZone({ onFileSelected, disabled }) {
  const inputRef = useRef(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [fileInfo, setFileInfo] = useState(null)

  const handleFile = useCallback(async (file) => {
    if (!file || !file.type.startsWith('video/')) return
    const meta = await extractVideoMetadata(file)
    const info = { file, ...meta }
    setFileInfo(info)
    onFileSelected(info)
  }, [onFileSelected])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragOver(false)
    if (disabled) return
    handleFile(e.dataTransfer.files[0])
  }, [handleFile, disabled])

  const onDragOver = (e) => { e.preventDefault(); if (!disabled) setIsDragOver(true) }
  const onDragLeave = () => setIsDragOver(false)

  const sizeWarning = fileInfo && fileInfo.file.size > SIZE_WARNING_BYTES

  return (
    <div>
      <div
        onClick={() => !disabled && inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={`
          border-2 border-dashed rounded-xl p-8 text-center transition-colors
          ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
          ${isDragOver
            ? 'border-blue-400 bg-blue-900/20'
            : 'border-slate-600 hover:border-slate-400 bg-slate-800/40'}
        `}
      >
        <div className="text-3xl mb-2">🎬</div>
        <p className="text-slate-300 text-sm font-medium">
          {fileInfo ? 'Drop a new file to replace' : 'Drop a video here or tap to browse'}
        </p>
        <p className="text-slate-500 text-xs mt-1">video files only</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files[0])}
      />

      {fileInfo && (
        <div className="mt-3 p-3 bg-slate-800 rounded-xl space-y-1.5">
          <p className="text-slate-200 text-sm font-medium truncate" title={fileInfo.file.name}>
            {fileInfo.file.name}
          </p>
          <div className="flex flex-wrap gap-3 text-slate-400 text-xs">
            <span>{formatSize(fileInfo.file.size)}</span>
            <span>{formatDuration(fileInfo.duration)}</span>
            {fileInfo.width > 0 && (
              <span>{fileInfo.width}×{fileInfo.height}</span>
            )}
          </div>
          {sizeWarning && (
            <p className="text-amber-400 text-xs mt-1 flex items-start gap-1">
              <span>⚠️</span>
              <span>Over 200 MB — may be slow or run out of memory on mobile.</span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
