/**
 * Detect the YouTube player crop region by scanning for a dark-to-bright
 * vertical transition in the top half of the image.
 *
 * Returns coordinates in CANVAS space, or null if no clear transition is found.
 * The caller must scale back to video coordinates if the canvas was downscaled.
 *
 * @param {ImageData} imageData
 * @param {number} canvasW
 * @param {number} canvasH
 * @returns {{ x: number, y: number, w: number, h: number } | null}
 */
export function detectYouTubeCrop(imageData, canvasW, canvasH) {
  const { data } = imageData

  // Scan a 1%-wide band centered horizontally to avoid notch artifacts
  const bandHalf = Math.max(1, Math.round(canvasW * 0.005))
  const cx = Math.floor(canvasW / 2)
  const bandStart = Math.max(0, cx - bandHalf)
  const bandEnd = Math.min(canvasW - 1, cx + bandHalf)

  // Compute average luminance per row over the scan band
  const rowLuminance = new Float32Array(canvasH)
  for (let y = 0; y < canvasH; y++) {
    let sum = 0
    let count = 0
    for (let x = bandStart; x <= bandEnd; x++) {
      const i = (y * canvasW + x) * 4
      sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      count++
    }
    rowLuminance[y] = count > 0 ? sum / count : 0
  }

  // Find the contiguous dark band at the very top (status bar + YouTube header)
  const DARK_THRESHOLD = 40
  let darkBandCount = 0
  for (let y = 0; y < Math.min(canvasH * 0.4, canvasH); y++) {
    if (rowLuminance[y] <= DARK_THRESHOLD) {
      darkBandCount = y + 1
    } else {
      break
    }
  }

  // Require a meaningful dark band — fewer than 5 rows means no status bar present
  if (darkBandCount < 5) return null

  let avgDark = 0
  for (let y = 0; y < darkBandCount; y++) avgDark += rowLuminance[y]
  avgDark /= darkBandCount

  // Find the first row after the dark band that is significantly brighter
  const JUMP_THRESHOLD = 40
  const searchLimit = Math.floor(canvasH * 0.5)
  let transitionY = null
  for (let y = darkBandCount; y < searchLimit; y++) {
    if (rowLuminance[y] > avgDark + JUMP_THRESHOLD) {
      transitionY = y
      break
    }
  }

  if (transitionY === null) return null

  const cropH = Math.floor(canvasW * 9 / 16)

  // Guard: the 16:9 crop region must fit within the canvas
  if (transitionY + cropH > canvasH) return null

  return { x: 0, y: transitionY, w: canvasW, h: cropH }
}
