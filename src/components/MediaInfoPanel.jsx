const CODEC_LABELS = {
  h264: 'H.264', h265: 'H.265', hevc: 'H.265', vp9: 'VP9', av1: 'AV1',
  aac: 'AAC', mp3: 'MP3', ac3: 'AC3', vorbis: 'Vorbis',
}

function fmtCodec(c) {
  return c ? (CODEC_LABELS[c.toLowerCase()] ?? c.toUpperCase()) : null
}

function fmtFps(fps) {
  if (fps == null) return null
  return Number.isInteger(fps) ? `${fps}` : fps.toFixed(3).replace(/\.?0+$/, '')
}

function fmtVideoBitrate(kbps) {
  if (kbps >= 1000) return `${(kbps / 1000).toFixed(1)} Mbps`
  return `${Math.round(kbps)} kbps`
}

export default function MediaInfoPanel({ mediaInfo, fileInfo, isProbing }) {
  if (isProbing) {
    return (
      <div className="px-3 py-2 bg-slate-800 rounded-xl flex items-center gap-2 text-xs text-slate-500">
        <div className="w-3 h-3 rounded-full border border-slate-600 border-t-blue-400 animate-spin shrink-0" />
        Detecting media properties…
      </div>
    )
  }

  const parts = []
  if (fileInfo?.width > 0) parts.push(`${fileInfo.width}×${fileInfo.height}`)
  if (mediaInfo?.framerate != null) parts.push(`${fmtFps(mediaInfo.framerate)} fps`)
  if (mediaInfo?.videoCodec) {
    let v = fmtCodec(mediaInfo.videoCodec)
    if (mediaInfo.videoBitrate != null) v += ` ${fmtVideoBitrate(mediaInfo.videoBitrate)}`
    parts.push(v)
  }
  if (mediaInfo?.audioCodec) {
    let a = fmtCodec(mediaInfo.audioCodec)
    if (mediaInfo.audioBitrate != null) a += ` ${mediaInfo.audioBitrate}k`
    parts.push(a)
  } else if (mediaInfo) {
    parts.push('No audio')
  }

  if (!parts.length) return null

  return (
    <div className="px-3 py-2 bg-slate-800 rounded-xl">
      <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Source</p>
      <p className="text-xs text-slate-300">
        {parts.join(' • ')}
        {mediaInfo?.isHDR && (
          <span className="ml-2 px-1.5 py-0.5 bg-amber-900/50 border border-amber-700/60 text-amber-300 rounded text-xs font-medium align-middle">
            HDR
          </span>
        )}
      </p>
      {mediaInfo?.isHDR && (
        <p className="text-xs text-amber-400/90 mt-1.5">
          HDR source — will be tone-mapped to SDR on compression. This is a one-way conversion.
        </p>
      )}
    </div>
  )
}
