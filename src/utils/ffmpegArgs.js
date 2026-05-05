// CRF → estimated video bitrate (kbps) at 720p. Scaled proportionally for other resolutions.
const CRF_BITRATE_720P = {
  18: 8000, 20: 5000, 22: 3500, 24: 2500, 26: 1800,
  28: 1200, 30: 900,  32: 650,  34: 500,  36: 380,
  38: 280,  40: 210,  42: 160,  44: 120,  46: 90,
  48: 70,   51: 50,
}

const RESOLUTION_SCALE = {
  original: 1,
  '1080p': 2.25,
  '720p': 1.0,
  '480p': 0.44,
  '360p': 0.25,
}

const PRESET_HEIGHTS = { '1080p': 1080, '720p': 720, '480p': 480, '360p': 360 }

function resolveResolutionHeight(resolution) {
  if (resolution === 'original') return null
  if (PRESET_HEIGHTS[resolution]) return PRESET_HEIGHTS[resolution]
  const n = parseInt(resolution, 10)
  return n > 0 ? n : null
}

function getResolutionScale(resolution) {
  if (RESOLUTION_SCALE[resolution] !== undefined) return RESOLUTION_SCALE[resolution]
  const h = resolveResolutionHeight(resolution)
  return h ? Math.pow(h / 720, 2) : 1.0
}

const AUDIO_BITRATE_KBPS = { '64k': 64, '96k': 96, '128k': 128, '192k': 192 }

function interpolateCrfBitrate(crf) {
  const keys = Object.keys(CRF_BITRATE_720P).map(Number).sort((a, b) => a - b)
  if (crf <= keys[0]) return CRF_BITRATE_720P[keys[0]]
  if (crf >= keys[keys.length - 1]) return CRF_BITRATE_720P[keys[keys.length - 1]]
  let lo = keys[0], hi = keys[1]
  for (let i = 0; i < keys.length - 1; i++) {
    if (keys[i] <= crf && crf <= keys[i + 1]) { lo = keys[i]; hi = keys[i + 1]; break }
  }
  const t = (crf - lo) / (hi - lo)
  return Math.round(CRF_BITRATE_720P[lo] + t * (CRF_BITRATE_720P[hi] - CRF_BITRATE_720P[lo]))
}

export function estimateOutputSize(settings, durationSeconds) {
  if (!durationSeconds || durationSeconds <= 0) return 0
  const { resolution, crf, videoCodec, audioCodec, audioBitrate, stripVideo } = settings

  let videoBitrateKbps = 0
  if (!stripVideo) {
    const base = interpolateCrfBitrate(crf)
    // H.265 achieves roughly half the bitrate of H.264 at equivalent CRF
    const codecMultiplier = videoCodec === 'h265' ? 0.5 : 1.0
    videoBitrateKbps = base * getResolutionScale(resolution) * codecMultiplier
  }

  const audioBitrateKbps = audioCodec === 'strip' ? 0 : (AUDIO_BITRATE_KBPS[audioBitrate] ?? parseInt(audioBitrate, 10) ?? 96)
  const totalKbps = videoBitrateKbps + audioBitrateKbps
  return Math.round((totalKbps * durationSeconds * 1000) / 8)
}

export const DEFAULT_SETTINGS = {
  resolution: 'original',
  crf: 28,
  framerate: '30',
  videoCodec: 'h264',
  stripVideo: false,
  audioCodec: 'aac',
  audioBitrate: '96k',
  volume: 100,
  audioDelay: 0,
}

export const PRESETS = {
  iMessageSmall: {
    resolution: '480p',
    crf: 32,
    framerate: '30',
    videoCodec: 'h264',
    stripVideo: false,
    audioCodec: 'aac',
    audioBitrate: '64k',
    volume: 100,
    audioDelay: 0,
  },
  iMessageHD: {
    resolution: '720p',
    crf: 26,
    framerate: '30',
    videoCodec: 'h264',
    stripVideo: false,
    audioCodec: 'aac',
    audioBitrate: '96k',
    volume: 100,
    audioDelay: 0,
  },
  keepQuality: {
    resolution: 'original',
    crf: 20,
    framerate: 'original',
    videoCodec: 'h264',
    stripVideo: false,
    audioCodec: 'aac',
    audioBitrate: '128k',
    volume: 100,
    audioDelay: 0,
  },
}

// Returns { args, outputFilename } where args does NOT include -i or the output path.
// compress() in useFFmpeg.js handles the virtual FS input name and appends the output.
export function buildFFmpegArgs(settings, originalFilename) {
  const {
    resolution,
    crf,
    framerate,
    videoCodec,
    stripVideo,
    audioCodec,
    audioBitrate,
    volume,
    audioDelay,
  } = settings

  const args = []

  if (stripVideo) {
    args.push('-vn')
  } else {
    args.push('-c:v', videoCodec === 'h265' ? 'libx265' : 'libx264')
    args.push('-crf', String(crf))
    args.push('-preset', 'fast')

    const targetHeight = resolveResolutionHeight(resolution)
    if (targetHeight) {
      args.push('-vf', `scale=-2:${targetHeight}`)
    }

    if (framerate !== 'original') {
      args.push('-r', String(framerate))
    }
  }

  if (audioCodec === 'strip') {
    args.push('-an')
  } else {
    args.push('-c:a', 'aac')
    args.push('-b:a', audioBitrate)

    const afFilters = []

    // Positive delay only: adelay pushes audio later relative to video.
    // Negative (advancing audio) requires a separate video input stream and
    // is not supported in this single-file workflow.
    if (audioDelay > 0) {
      afFilters.push(`adelay=${audioDelay}:all=1`)
    }

    if (volume !== 100) {
      afFilters.push(`volume=${volume / 100}`)
    }

    if (afFilters.length > 0) {
      args.push('-af', afFilters.join(','))
    }
  }

  // Optimize MP4 for web/streaming playback
  args.push('-movflags', '+faststart')

  const dot = originalFilename.lastIndexOf('.')
  const base = dot !== -1 ? originalFilename.slice(0, dot) : originalFilename
  const outputFilename = `${base}_squeezed.mp4`

  return { args, outputFilename }
}
