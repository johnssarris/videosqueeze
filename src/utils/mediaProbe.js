export function parseMediaInfo(logLines) {
  let videoCodec = null, framerate = null, videoBitrate = null, isHDR = false
  let audioCodec = null, audioBitrate = null, audioSampleRate = null, audioChannels = null

  for (const line of logLines) {
    const videoMatch = /Stream #\d+:\d+[^:]*:\s*Video:\s*(.+)/.exec(line)
    if (videoMatch && !videoCodec) {
      const body = videoMatch[1]
      videoCodec = (/^(\w+)/.exec(body) || [])[1]?.toLowerCase() ?? null
      const fpsMat = /([\d.]+)\s+fps/.exec(body)
      if (fpsMat) framerate = parseFloat(fpsMat[1])
      const vbMat = /(\d+)\s*kb\/s/.exec(body)
      if (vbMat) videoBitrate = parseInt(vbMat[1], 10)
      if (/bt2020|smpte2084|arib-std-b67/i.test(body)) isHDR = true
      continue
    }
    const audioMatch = /Stream #\d+:\d+[^:]*:\s*Audio:\s*(.+)/.exec(line)
    if (audioMatch && !audioCodec) {
      const body = audioMatch[1]
      audioCodec = (/^(\w+)/.exec(body) || [])[1]?.toLowerCase() ?? null
      const srMat = /(\d{4,6})\s*Hz/.exec(body)
      if (srMat) audioSampleRate = parseInt(srMat[1], 10)
      const chMat = /\b(mono|stereo|5\.1|7\.1)\b/i.exec(body)
      if (chMat) audioChannels = chMat[1].toLowerCase()
      const abMat = /(\d+)\s*kb\/s/.exec(body)
      if (abMat) audioBitrate = parseInt(abMat[1], 10)
    }
  }

  return { videoCodec, framerate, videoBitrate, audioCodec, audioBitrate, audioSampleRate, audioChannels, isHDR }
}
