import { useState, useEffect } from 'react'
import { detectYouTubeCrop } from '../utils/cropDetect'

/**
 * Seeks to a representative frame of a video file, draws it to an offscreen
 * canvas, runs the YouTube crop detection algorithm, and returns the result.
 *
 * @param {File|null} file
 * @param {number|null} videoWidth   - native video width from fileInfo
 * @param {number|null} videoHeight  - native video height from fileInfo
 * @returns {{
 *   cropRegion: { x: number, y: number, w: number, h: number } | null,
 *   thumbnailDataUrl: string | null,
 *   isDetecting: boolean,
 * }}
 * cropRegion coordinates are in VIDEO pixel space (not canvas space).
 */
export function useCropDetect(file, videoWidth, videoHeight) {
  const [cropRegion, setCropRegion] = useState(null)
  const [thumbnailDataUrl, setThumbnailDataUrl] = useState(null)
  const [isDetecting, setIsDetecting] = useState(false)

  useEffect(() => {
    if (!file || !videoWidth || !videoHeight) {
      setCropRegion(null)
      setThumbnailDataUrl(null)
      setIsDetecting(false)
      return
    }

    let cancelled = false
    setIsDetecting(true)
    setCropRegion(null)
    setThumbnailDataUrl(null)

    const objectUrl = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.muted = true
    video.preload = 'metadata'

    async function run() {
      try {
        // Wait until we can seek to a frame with actual content
        await new Promise((resolve, reject) => {
          let settled = false
          const settle = (fn) => {
            if (!settled) { settled = true; fn() }
          }

          video.addEventListener('loadedmetadata', () => {
            const duration = isFinite(video.duration) && video.duration > 0
              ? video.duration
              : 2
            video.currentTime = Math.min(0.5, duration * 0.1)
          }, { once: true })

          // seeked fires after currentTime is applied
          video.addEventListener('seeked', () => settle(resolve), { once: true })

          // loadeddata fallback for browsers that skip seeked when time=0
          video.addEventListener('loadeddata', () => {
            setTimeout(() => settle(resolve), 50)
          }, { once: true })

          video.addEventListener('error', () => settle(reject), { once: true })

          video.src = objectUrl
        })

        if (cancelled) return

        // Draw at full resolution, capped at 1920px wide to keep memory reasonable
        const scale = Math.min(1, 1920 / videoWidth)
        const canvasW = Math.round(videoWidth * scale)
        const canvasH = Math.round(videoHeight * scale)

        const canvas = document.createElement('canvas')
        canvas.width = canvasW
        canvas.height = canvasH
        const ctx = canvas.getContext('2d')
        ctx.drawImage(video, 0, 0, canvasW, canvasH)

        let imageData
        try {
          imageData = ctx.getImageData(0, 0, canvasW, canvasH)
        } catch {
          // Canvas taint (should not happen with local File, but guard anyway)
          if (!cancelled) setIsDetecting(false)
          return
        }

        const canvasRegion = detectYouTubeCrop(imageData, canvasW, canvasH)

        if (!cancelled) {
          if (canvasRegion) {
            setCropRegion({
              x: 0,
              y: Math.round(canvasRegion.y / scale),
              w: videoWidth,
              h: Math.floor(videoWidth * 9 / 16),
            })
          }
          // Always capture the thumbnail so CropPreview can display the frame
          setThumbnailDataUrl(canvas.toDataURL('image/jpeg', 0.8))
          setIsDetecting(false)
        }
      } catch {
        if (!cancelled) setIsDetecting(false)
      } finally {
        URL.revokeObjectURL(objectUrl)
      }
    }

    run()

    return () => {
      cancelled = true
      // Stop the video to release resources; object URL revoked in run()'s finally
      video.src = ''
    }
  }, [file, videoWidth, videoHeight])

  return { cropRegion, thumbnailDataUrl, isDetecting }
}
